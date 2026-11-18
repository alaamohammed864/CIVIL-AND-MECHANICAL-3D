import React, { useEffect, useRef, useState } from 'react';
import {
  ActiveTool,
  BIMElement,
  BIMProject,
  ClashItem,
  EquipmentElement,
  Point2D,
} from '../types/bim';
import {
  calculateRoomsHVAC,
  distance2D,
  formatLength,
  polygonArea2D,
} from '../engine/calculations';

interface RemoteCursor {
  userId: string;
  name: string;
  x: number;
  y: number;
}

interface Viewport2DProps {
  project: BIMProject;
  activeLevelId: string;
  activeTool: ActiveTool;
  selectedIds: string[];
  onSelectIds: (ids: string[]) => void;
  onAddElement: (el: BIMElement) => void;
  onUpdateElement: (id: string, patch: Partial<BIMElement>) => void;
  onDeleteElements: (ids: string[]) => void;
  onAddIssueAt: (pt: Point2D) => void;
  clashes: ClashItem[];
  showClashes: boolean;
  orthoMode: boolean;
  snapMode: boolean;
  darkMode: boolean;
  remoteCursors: RemoteCursor[];
  onCursorMove?: (worldPt: Point2D) => void;
  focusPoint?: Point2D | null;
}

export const Viewport2D: React.FC<Viewport2DProps> = ({
  project,
  activeLevelId,
  activeTool,
  selectedIds,
  onSelectIds,
  onAddElement,
  onUpdateElement,
  onDeleteElements,
  onAddIssueAt,
  clashes,
  showClashes,
  orthoMode,
  snapMode,
  darkMode,
  remoteCursors,
  onCursorMove,
  focusPoint,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Camera state stored in ref for 60fps smooth canvas pan/zoom
  const camRef = useRef({ offsetX: 140, offsetY: 110, scale: 36 }); // 36 px per meter
  const [zoomPct, setZoomPct] = useState(100);
  const [cursorWorld, setCursorWorld] = useState<Point2D>({ x: 0, y: 0 });
  const [measureResult, setMeasureResult] = useState<string | null>(null);

  // Interactive drafting state
  const drawStartRef = useRef<Point2D | null>(null);
  const polyPointsRef = useRef<Point2D[]>([]);
  const isPanningRef = useRef(false);
  const panLastRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const boxSelectRef = useRef<{ start: Point2D; end: Point2D } | null>(null);
  const dragMoveRef = useRef<{ startWorld: Point2D; lastWorld: Point2D } | null>(null);
  const rafRef = useRef<number>(0);

  const fitToBuilding = () => {
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width < 40 || height < 40) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    project.elements.forEach((el) => {
      if (!el.visible) return;
      if ('start' in el && 'end' in el && el.end) {
        minX = Math.min(minX, el.start.x, el.end.x);
        minY = Math.min(minY, el.start.y, el.end.y);
        maxX = Math.max(maxX, el.start.x, el.end.x);
        maxY = Math.max(maxY, el.start.y, el.end.y);
      } else if ('start' in el) {
        minX = Math.min(minX, el.start.x);
        minY = Math.min(minY, el.start.y);
        maxX = Math.max(maxX, el.start.x);
        maxY = Math.max(maxY, el.start.y);
      } else if ('position' in el) {
        minX = Math.min(minX, el.position.x - el.widthM / 2);
        minY = Math.min(minY, el.position.y - el.depthM / 2);
        maxX = Math.max(maxX, el.position.x + el.widthM / 2);
        maxY = Math.max(maxY, el.position.y + el.depthM / 2);
      } else if ('points' in el) {
        el.points.forEach((p) => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });
      }
    });

    if (!Number.isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 18;
      maxY = 12;
    }

    const spanX = Math.max(4, maxX - minX);
    const spanY = Math.max(4, maxY - minY);
    const padX = 56;
    const padTop = 78;
    const padBottom = 56;
    const availW = Math.max(100, width - padX * 2);
    const availH = Math.max(100, height - padTop - padBottom);
    const scale = Math.max(10, Math.min(60, Math.min(availW / spanX, availH / spanY)));

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    camRef.current = {
      scale,
      offsetX: width / 2 - cx * scale,
      offsetY: padTop + availH / 2 - cy * scale,
    };
    setZoomPct(Math.round((scale / 36) * 100));
    scheduleDraw();
  };

  // Center on focusPoint when triggered (e.g., Locate Clash)
  useEffect(() => {
    if (!focusPoint || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const s = Math.max(camRef.current.scale, 44);
    camRef.current = {
      scale: s,
      offsetX: rect.width / 2 - focusPoint.x * s,
      offsetY: rect.height / 2 - focusPoint.y * s,
    };
    setZoomPct(Math.round((s / 36) * 100));
    scheduleDraw();
  }, [focusPoint]);

  const screenToWorld = (sx: number, sy: number): Point2D => {
    const cam = camRef.current;
    return {
      x: (sx - cam.offsetX) / cam.scale,
      y: (sy - cam.offsetY) / cam.scale,
    };
  };

  const applySnap = (pt: Point2D, anchor?: Point2D | null): Point2D => {
    let x = pt.x;
    let y = pt.y;
    if (snapMode) {
      // Snap to 0.25m grid first
      x = Math.round(x * 4) / 4;
      y = Math.round(y * 4) / 4;

      // Object snap to nearby wall/duct/pipe endpoints within 0.35m
      let bestDist = 0.38;
      for (const el of project.elements) {
        if (!el.visible || el.levelId !== activeLevelId) continue;
        const candidates: Point2D[] = [];
        if ('start' in el) candidates.push(el.start);
        if ('end' in el && el.end) candidates.push(el.end);
        if ('position' in el) candidates.push(el.position);
        for (const c of candidates) {
          const d = Math.hypot(c.x - pt.x, c.y - pt.y);
          if (d < bestDist) {
            bestDist = d;
            x = c.x;
            y = c.y;
          }
        }
      }
    }
    if (orthoMode && anchor) {
      const dx = Math.abs(x - anchor.x);
      const dy = Math.abs(y - anchor.y);
      if (dx >= dy) y = anchor.y;
      else x = anchor.x;
    }
    return { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
  };

  const scheduleDraw = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawScene);
  };

  const drawScene = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Background
    ctx.fillStyle = darkMode ? '#0b1118' : '#f1f5f9';
    ctx.fillRect(0, 0, width, height);

    const cam = camRef.current;
    const worldToScreen = (p: Point2D) => ({
      x: p.x * cam.scale + cam.offsetX,
      y: p.y * cam.scale + cam.offsetY,
    });

    // 2. Adaptive CAD Engineering Grid
    const minWorld = screenToWorld(0, 0);
    const maxWorld = screenToWorld(width, height);
    const stepMinor = cam.scale > 50 ? 0.25 : cam.scale > 20 ? 0.5 : 1;
    const stepMajor = cam.scale > 20 ? 1 : 5;

    ctx.lineWidth = 1;
    // Minor grid
    if (cam.scale > 14) {
      ctx.strokeStyle = darkMode ? 'rgba(56, 73, 94, 0.22)' : 'rgba(148, 163, 184, 0.28)';
      ctx.beginPath();
      for (let gx = Math.floor(minWorld.x / stepMinor) * stepMinor; gx <= maxWorld.x; gx += stepMinor) {
        const sx = gx * cam.scale + cam.offsetX;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
      }
      for (let gy = Math.floor(minWorld.y / stepMinor) * stepMinor; gy <= maxWorld.y; gy += stepMinor) {
        const sy = gy * cam.scale + cam.offsetY;
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
      }
      ctx.stroke();
    }

    // Major grid
    ctx.strokeStyle = darkMode ? 'rgba(56, 73, 94, 0.55)' : 'rgba(148, 163, 184, 0.55)';
    ctx.beginPath();
    for (let gx = Math.floor(minWorld.x / stepMajor) * stepMajor; gx <= maxWorld.x; gx += stepMajor) {
      const sx = gx * cam.scale + cam.offsetX;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, height);
    }
    for (let gy = Math.floor(minWorld.y / stepMajor) * stepMajor; gy <= maxWorld.y; gy += stepMajor) {
      const sy = gy * cam.scale + cam.offsetY;
      ctx.moveTo(0, sy);
      ctx.lineTo(width, sy);
    }
    ctx.stroke();

    // Origin Axes (0,0)
    const origin = worldToScreen({ x: 0, y: 0 });
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + 48, origin.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x, origin.y + 48);
    ctx.stroke();

    // Layer lookup
    const layerMap = new Map(project.layers.map((l) => [l.id, l]));
    const levelElements = project.elements.filter((el) => {
      if (!el.visible) return false;
      const lay = layerMap.get(el.layerId);
      if (lay && !lay.visible) return false;
      return el.levelId === activeLevelId;
    });

    // Underlay ghost from level 00 if viewing upper level
    if (activeLevelId !== 'lvl-00') {
      ctx.save();
      ctx.globalAlpha = 0.22;
      project.elements
        .filter((e) => e.levelId === 'lvl-00' && e.kind === 'wall' && e.visible)
        .forEach((w) => {
          if (w.kind !== 'wall') return;
          const a = worldToScreen(w.start);
          const b = worldToScreen(w.end);
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = Math.max(2, w.thicknessM * cam.scale);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        });
      ctx.restore();
    }

    const hvacRooms = calculateRoomsHVAC(project);
    const roomHvacMap = new Map(hvacRooms.map((r) => [r.roomId, r]));

    // 3. Draw Slabs & Rooms first (bottom z-order)
    levelElements.forEach((el) => {
      const isSelected = selectedIds.includes(el.id);
      if (el.kind === 'slab' || el.kind === 'roof') {
        if (el.points.length < 3) return;
        ctx.beginPath();
        el.points.forEach((p, idx) => {
          const sp = worldToScreen(p);
          if (idx === 0) ctx.moveTo(sp.x, sp.y);
          else ctx.lineTo(sp.x, sp.y);
        });
        ctx.closePath();
        ctx.fillStyle =
          el.kind === 'roof'
            ? darkMode
              ? 'rgba(30, 41, 59, 0.45)'
              : 'rgba(148, 163, 184, 0.25)'
            : darkMode
              ? 'rgba(23, 32, 43, 0.72)'
              : 'rgba(226, 232, 240, 0.7)';
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#00d2ff' : darkMode ? '#2c3f58' : '#94a3b8';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.stroke();
      }
    });

    levelElements.forEach((el) => {
      if (el.kind !== 'room' || el.points.length < 3) return;
      const isSelected = selectedIds.includes(el.id);
      const hvacInfo = roomHvacMap.get(el.id);

      ctx.beginPath();
      let cx = 0;
      let cy = 0;
      el.points.forEach((p, idx) => {
        const sp = worldToScreen(p);
        cx += sp.x;
        cy += sp.y;
        if (idx === 0) ctx.moveTo(sp.x, sp.y);
        else ctx.lineTo(sp.x, sp.y);
      });
      ctx.closePath();
      cx /= el.points.length;
      cy /= el.points.length;

      ctx.fillStyle = isSelected
        ? 'rgba(0, 210, 255, 0.14)'
        : hvacInfo && !hvacInfo.hasHVACServed
          ? 'rgba(255, 159, 28, 0.08)'
          : 'rgba(16, 185, 129, 0.06)';
      ctx.fill();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = isSelected ? '#00d2ff' : hvacInfo && !hvacInfo.hasHVACServed ? '#ff9f1c' : '#38495e';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);

      // Room Tag
      const areaM2 = polygonArea2D(el.points);
      ctx.textAlign = 'center';
      ctx.font = '600 11px "Space Grotesk", sans-serif';
      ctx.fillStyle = darkMode ? '#dae3f1' : '#0f172a';
      ctx.fillText(`RM ${el.roomNumber} · ${el.name}`, cx, cy - 6);
      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.fillStyle = hvacInfo && !hvacInfo.hasHVACServed ? '#ff9f1c' : '#00d2ff';
      const loadStr = hvacInfo ? ` | ${hvacInfo.totalCoolingLoadKW} kW` : '';
      ctx.fillText(`${areaM2.toFixed(1)} m²${loadStr}`, cx, cy + 9);
      if (hvacInfo && !hvacInfo.hasHVACServed) {
        ctx.fillStyle = '#ff9f1c';
        ctx.fillText('! NO HVAC TERMINAL', cx, cy + 22);
      }
    });

    // 4. Draw Walls
    const wallMap = new Map<string, Extract<BIMElement, { kind: 'wall' }>>();
    levelElements.forEach((el) => {
      if (el.kind === 'wall') wallMap.set(el.id, el);
    });

    levelElements.forEach((el) => {
      if (el.kind !== 'wall') return;
      const isSelected = selectedIds.includes(el.id);
      const a = worldToScreen(el.start);
      const b = worldToScreen(el.end);
      const pxThick = Math.max(3, el.thicknessM * cam.scale);

      ctx.save();
      ctx.lineCap = 'square';
      ctx.strokeStyle = isSelected
        ? '#00d2ff'
        : el.wallType === 'curtain'
          ? '#38bdf8'
          : darkMode
            ? '#94a3b8'
            : '#334155';
      ctx.lineWidth = pxThick;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();

      // Inner core fill for architectural wall cut
      ctx.strokeStyle =
        el.wallType === 'curtain'
          ? 'rgba(0, 210, 255, 0.35)'
          : darkMode
            ? '#1e293b'
            : '#cbd5e1';
      ctx.lineWidth = Math.max(1, pxThick - 3);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
    });

    // 5. Doors & Windows hosted on Walls
    levelElements.forEach((el) => {
      if (el.kind !== 'door' && el.kind !== 'window') return;
      const host = wallMap.get(el.hostWallId);
      if (!host) return;
      const isSelected = selectedIds.includes(el.id);
      const dx = host.end.x - host.start.x;
      const dy = host.end.y - host.start.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const nx = -uy;
      const ny = ux;

      const cx = host.start.x + dx * el.offsetRatio;
      const cy = host.start.y + dy * el.offsetRatio;
      const halfW = el.widthM / 2;
      const p1 = worldToScreen({ x: cx - ux * halfW, y: cy - uy * halfW });
      const p2 = worldToScreen({ x: cx + ux * halfW, y: cy + uy * halfW });

      // Clear wall gap
      ctx.strokeStyle = darkMode ? '#0b1118' : '#f1f5f9';
      ctx.lineWidth = Math.max(4, host.thicknessM * cam.scale + 2);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      if (el.kind === 'window') {
        ctx.strokeStyle = isSelected ? '#00d2ff' : '#47d6ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      } else {
        // Door leaf + swing arc
        const swingDir = el.openDirection === 'out' ? 1 : -1;
        const leafEnd = worldToScreen({
          x: cx - ux * halfW + nx * el.widthM * swingDir,
          y: cy - uy * halfW + ny * el.widthM * swingDir,
        });
        ctx.strokeStyle = isSelected ? '#00d2ff' : '#ffb86b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(leafEnd.x, leafEnd.y);
        ctx.stroke();

        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = isSelected ? '#00d2ff' : 'rgba(255, 184, 107, 0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const rPx = el.widthM * cam.scale;
        const a0 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const a1 = Math.atan2(leafEnd.y - p1.y, leafEnd.x - p1.x);
        ctx.arc(p1.x, p1.y, rPx, a0, a1, swingDir < 0);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    // 6. Structural Columns & Beams
    levelElements.forEach((el) => {
      if (el.kind !== 'column' && el.kind !== 'beam' && el.kind !== 'foundation') return;
      const isSelected = selectedIds.includes(el.id);
      if (el.kind === 'column' || el.kind === 'foundation') {
        const sp = worldToScreen(el.start);
        const w = Math.max(6, el.widthM * cam.scale);
        const h = Math.max(6, el.depthM * cam.scale);
        ctx.fillStyle = isSelected ? '#00d2ff' : '#3b82f6';
        ctx.fillRect(sp.x - w / 2, sp.y - h / 2, w, h);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(sp.x - w / 2, sp.y - h / 2, w, h);
      } else if (el.kind === 'beam' && el.end) {
        const a = worldToScreen(el.start);
        const b = worldToScreen(el.end);
        ctx.save();
        ctx.setLineDash([8, 4]);
        ctx.strokeStyle = isSelected ? '#00d2ff' : '#60a5fa';
        ctx.lineWidth = Math.max(2, el.widthM * cam.scale * 0.6);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
      }
    });

    // 7. Linear MEP (Ducts, Pipes, Cables)
    const mepColors: Record<string, string> = {
      duct: '#00d2ff',
      cable: '#ff9f1c',
      cold_pipe: '#10b981',
      hot_pipe: '#f97316',
      drain_pipe: '#a78bfa',
      fire_pipe: '#ef4444',
      gas_pipe: '#eab308',
    };

    levelElements.forEach((el) => {
      if (
        el.kind !== 'duct' &&
        el.kind !== 'cable' &&
        el.kind !== 'cold_pipe' &&
        el.kind !== 'hot_pipe' &&
        el.kind !== 'drain_pipe' &&
        el.kind !== 'fire_pipe' &&
        el.kind !== 'gas_pipe'
      ) {
        return;
      }
      const isSelected = selectedIds.includes(el.id);
      const a = worldToScreen(el.start);
      const b = worldToScreen(el.end);
      const color = isSelected ? '#ffffff' : mepColors[el.kind] || '#00d2ff';

      ctx.save();
      if (el.kind === 'duct') {
        const wPx = Math.max(8, ((el.widthMm || 400) / 1000) * cam.scale);
        ctx.strokeStyle = color;
        ctx.lineWidth = wPx;
        ctx.globalAlpha = 0.28;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          Math.min(a.x, b.x) - (Math.abs(a.x - b.x) < 2 ? wPx / 2 : 0),
          Math.min(a.y, b.y) - (Math.abs(a.y - b.y) < 2 ? wPx / 2 : 0),
          Math.max(wPx, Math.abs(b.x - a.x)),
          Math.max(wPx, Math.abs(b.y - a.y)),
        );
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 4 : el.kind === 'fire_pipe' ? 3 : 2.2;
        if (el.kind === 'cable' || el.kind === 'gas_pipe') ctx.setLineDash([6, 3]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // P&ID Valve / Telemetry tag at midpoint
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (el.valveState && cam.scale > 22) {
        const badgeColor =
          el.valveState === 'OPEN' ? '#10b981' : el.valveState === 'THROTTLED' ? '#ff9f1c' : '#ef4444';
        ctx.fillStyle = darkMode ? '#111a24' : '#ffffff';
        ctx.fillRect(mx - 24, my - 8, 48, 15);
        ctx.strokeStyle = badgeColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(mx - 24, my - 8, 48, 15);
        ctx.font = '600 8px "JetBrains Mono", monospace';
        ctx.fillStyle = badgeColor;
        ctx.textAlign = 'center';
        ctx.fillText(el.valveState, mx, my + 2.5);
      }
      ctx.restore();
    });

    // 8. Equipment Symbols
    levelElements.forEach((el) => {
      if (!('position' in el)) return;
      const eq = el as EquipmentElement;
      const isSelected = selectedIds.includes(eq.id);
      const sp = worldToScreen(eq.position);
      const w = Math.max(12, eq.widthM * cam.scale);
      const h = Math.max(12, eq.depthM * cam.scale);

      const catColor: Record<string, string> = {
        HVAC: '#00d2ff',
        Electrical: '#ff9f1c',
        Plumbing: '#10b981',
        'Fire Protection': '#ef4444',
        Gas: '#eab308',
        Elevator: '#a78bfa',
      };
      const color = isSelected ? '#ffffff' : catColor[eq.category] || '#00d2ff';

      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate((eq.rotationDeg * Math.PI) / 180);

      ctx.fillStyle = darkMode ? 'rgba(17, 26, 36, 0.92)' : 'rgba(255, 255, 255, 0.92)';
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.strokeRect(-w / 2, -h / 2, w, h);

      // Diagonal equipment cross for mechanical/elevator blocks
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2, h / 2);
      ctx.moveTo(w / 2, -h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;

      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(eq.tag || eq.kind.toUpperCase(), 0, -h / 2 - 4);
      ctx.restore();
    });

    // 9. 2D Drafting Entities
    levelElements.forEach((el) => {
      if (el.category !== 'Drafting') return;
      const isSelected = selectedIds.includes(el.id);
      ctx.save();
      ctx.strokeStyle = isSelected ? '#00d2ff' : darkMode ? '#cbd5e1' : '#1e293b';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = isSelected ? 2.2 : 1.4;

      if (el.kind === 'line' && el.points.length >= 2) {
        const a = worldToScreen(el.points[0]);
        const b = worldToScreen(el.points[1]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      } else if ((el.kind === 'polyline' || el.kind === 'rect') && el.points.length >= 2) {
        ctx.beginPath();
        el.points.forEach((p, idx) => {
          const sp = worldToScreen(p);
          if (idx === 0) ctx.moveTo(sp.x, sp.y);
          else ctx.lineTo(sp.x, sp.y);
        });
        if (el.kind === 'rect') ctx.closePath();
        ctx.stroke();
      } else if (el.kind === 'circle' && el.points.length >= 1) {
        const c = worldToScreen(el.points[0]);
        ctx.beginPath();
        ctx.arc(c.x, c.y, (el.radiusM || 1) * cam.scale, 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.kind === 'dimension' && el.points.length >= 2) {
        const a = worldToScreen(el.points[0]);
        const b = worldToScreen(el.points[1]);
        ctx.strokeStyle = isSelected ? '#ffffff' : '#47d6ff';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        const dist = distance2D(el.points[0], el.points[1]);
        ctx.font = '600 10px "JetBrains Mono", monospace';
        ctx.fillStyle = '#47d6ff';
        ctx.textAlign = 'center';
        ctx.fillText(formatLength(dist, project.unitSystem), (a.x + b.x) / 2, (a.y + b.y) / 2 - 5);
      } else if (el.kind === 'text' && el.points.length >= 1) {
        const p = worldToScreen(el.points[0]);
        ctx.font = '600 12px "Space Grotesk", sans-serif';
        ctx.fillText(el.text || el.name, p.x, p.y);
      }
      ctx.restore();
    });

    // 10. Issue Markups & Clashes Overlay
    project.issues
      .filter((i) => i.levelId === activeLevelId)
      .forEach((iss) => {
        const sp = worldToScreen(iss.position);
        ctx.save();
        ctx.fillStyle = iss.status === 'Resolved' ? '#10b981' : '#ff9f1c';
        ctx.beginPath();
        ctx.moveTo(sp.x, sp.y - 12);
        ctx.lineTo(sp.x + 8, sp.y);
        ctx.lineTo(sp.x, sp.y + 4);
        ctx.lineTo(sp.x - 8, sp.y);
        ctx.closePath();
        ctx.fill();
        ctx.font = '600 9px "JetBrains Mono", monospace';
        ctx.fillText(iss.id, sp.x + 11, sp.y);
        ctx.restore();
      });

    if (showClashes) {
      clashes
        .filter((c) => c.levelId === activeLevelId)
        .forEach((c) => {
          const sp = worldToScreen({ x: c.location.x, y: c.location.y });
          ctx.save();
          ctx.strokeStyle = c.severity === 'Critical' ? '#ef4444' : '#ff9f1c';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 12, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(sp.x - 6, sp.y - 6);
          ctx.lineTo(sp.x + 6, sp.y + 6);
          ctx.moveTo(sp.x + 6, sp.y - 6);
          ctx.lineTo(sp.x - 6, sp.y + 6);
          ctx.stroke();
          ctx.font = '700 9px "JetBrains Mono", monospace';
          ctx.fillStyle = c.severity === 'Critical' ? '#ef4444' : '#ff9f1c';
          ctx.fillText(c.id, sp.x + 15, sp.y - 4);
          ctx.restore();
        });
    }

    // 11. Active Rubber-band Drawing Preview
    if (drawStartRef.current) {
      const a = worldToScreen(drawStartRef.current);
      const b = worldToScreen(cursorWorld);
      ctx.save();
      ctx.strokeStyle = '#00d2ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      if (activeTool === 'rect' || activeTool === 'slab' || activeTool === 'room') {
        ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      } else if (activeTool === 'circle') {
        const r = Math.hypot(b.x - a.x, b.y - a.y);
        ctx.beginPath();
        ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      const d = distance2D(drawStartRef.current, cursorWorld);
      const ang = (Math.atan2(cursorWorld.y - drawStartRef.current.y, cursorWorld.x - drawStartRef.current.x) * 180) / Math.PI;
      ctx.fillStyle = '#111a24';
      ctx.fillRect(b.x + 10, b.y - 24, 130, 20);
      ctx.strokeStyle = '#00d2ff';
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      ctx.strokeRect(b.x + 10, b.y - 24, 130, 20);
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#00d2ff';
      ctx.fillText(`${formatLength(d, project.unitSystem)} ∠${ang.toFixed(0)}°`, b.x + 16, b.y - 10);
      ctx.restore();
    }

    // Active Box Selection Preview
    if (boxSelectRef.current) {
      const a = worldToScreen(boxSelectRef.current.start);
      const b = worldToScreen(boxSelectRef.current.end);
      const crossing = boxSelectRef.current.end.x < boxSelectRef.current.start.x;
      ctx.save();
      ctx.fillStyle = crossing ? 'rgba(16, 185, 129, 0.14)' : 'rgba(0, 210, 255, 0.14)';
      ctx.strokeStyle = crossing ? '#10b981' : '#00d2ff';
      ctx.lineWidth = 1;
      if (crossing) ctx.setLineDash([4, 3]);
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.restore();
    }

    // Remote WebSocket Cursors
    remoteCursors.forEach((rc) => {
      const sp = worldToScreen({ x: rc.x, y: rc.y });
      ctx.save();
      ctx.strokeStyle = '#69f6b9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sp.x - 6, sp.y);
      ctx.lineTo(sp.x + 6, sp.y);
      ctx.moveTo(sp.x, sp.y - 6);
      ctx.lineTo(sp.x, sp.y + 6);
      ctx.stroke();
      ctx.font = '600 9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#69f6b9';
      ctx.fillText(rc.name, sp.x + 8, sp.y - 6);
      ctx.restore();
    });

    ctx.restore();
  };

  useEffect(() => {
    scheduleDraw();
  }, [project, activeLevelId, selectedIds, clashes, showClashes, darkMode, remoteCursors, cursorWorld]);

  useEffect(() => {
    fitToBuilding();
    let lastW = containerRef.current?.clientWidth || 0;
    const ro = new ResizeObserver((entries) => {
      const nw = entries[0]?.contentRect.width || 0;
      if (Math.abs(nw - lastW) > 60) {
        lastW = nw;
        fitToBuilding();
      } else {
        scheduleDraw();
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    const onResize = () => scheduleDraw();
    window.addEventListener('resize', onResize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const hitTestElement = (pt: Point2D): BIMElement | null => {
    const tol = 0.45;
    const candidates = project.elements.filter((e) => e.visible && e.levelId === activeLevelId);
    // Reverse order so top-drawn items (equipment, MEP, doors) pick first
    for (let i = candidates.length - 1; i >= 0; i--) {
      const el = candidates[i];
      if ('position' in el) {
        if (Math.abs(pt.x - el.position.x) <= el.widthM / 2 + 0.25 && Math.abs(pt.y - el.position.y) <= el.depthM / 2 + 0.25) {
          return el;
        }
      } else if ('start' in el && 'end' in el && el.end) {
        const d = pointToSegmentDist(pt, el.start, el.end);
        if (d <= tol) return el;
      } else if ('start' in el) {
        if (distance2D(pt, el.start) <= 0.5) return el;
      } else if (el.kind === 'door' || el.kind === 'window') {
        const host = candidates.find((w) => w.id === el.hostWallId);
        if (host && host.kind === 'wall') {
          const cx = host.start.x + (host.end.x - host.start.x) * el.offsetRatio;
          const cy = host.start.y + (host.end.y - host.start.y) * el.offsetRatio;
          if (distance2D(pt, { x: cx, y: cy }) <= el.widthM / 2 + 0.2) return el;
        }
      } else if (el.kind === 'room' || el.kind === 'slab' || el.kind === 'roof') {
        // Click near edge or inside room tag
        const cx = el.points.reduce((a, p) => a + p.x, 0) / (el.points.length || 1);
        const cy = el.points.reduce((a, p) => a + p.y, 0) / (el.points.length || 1);
        if (distance2D(pt, { x: cx, y: cy }) <= 1.2) return el;
      } else if (el.kind === 'line' && el.points.length >= 2) {
        if (pointToSegmentDist(pt, el.points[0], el.points[1]) <= tol) return el;
      } else if (el.kind === 'circle' && el.points.length >= 1) {
        if (Math.abs(distance2D(pt, el.points[0]) - (el.radiusM || 1)) <= tol) return el;
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const rawWorld = screenToWorld(sx, sy);
    const snapped = applySnap(rawWorld, drawStartRef.current);

    if (e.button === 1 || activeTool === 'pan' || e.altKey) {
      isPanningRef.current = true;
      panLastRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (activeTool === 'markup_pin') {
      onAddIssueAt(snapped);
      return;
    }

    if (activeTool === 'select') {
      const hit = hitTestElement(rawWorld);
      if (hit) {
        if (e.shiftKey) {
          onSelectIds(
            selectedIds.includes(hit.id) ? selectedIds.filter((id) => id !== hit.id) : [...selectedIds, hit.id],
          );
        } else {
          onSelectIds([hit.id]);
        }
      } else {
        boxSelectRef.current = { start: rawWorld, end: rawWorld };
        if (!e.shiftKey) onSelectIds([]);
      }
      return;
    }

    if (activeTool === 'move') {
      if (selectedIds.length > 0) {
        dragMoveRef.current = { startWorld: snapped, lastWorld: snapped };
      }
      return;
    }

    if (activeTool === 'trim') {
      const hit = hitTestElement(rawWorld);
      if (hit) onDeleteElements([hit.id]);
      return;
    }

    // Hosting doors/windows on nearest wall immediately on click
    if (activeTool === 'door' || activeTool === 'window') {
      const walls = project.elements.filter((el) => el.kind === 'wall' && el.levelId === activeLevelId);
      let bestWall: Extract<BIMElement, { kind: 'wall' }> | null = null;
      let bestDist = 1.2;
      let bestRatio = 0.5;
      walls.forEach((w) => {
        if (w.kind !== 'wall') return;
        const { dist, t } = projectPointOnSegment(rawWorld, w.start, w.end);
        if (dist < bestDist) {
          bestDist = dist;
          bestWall = w;
          bestRatio = Math.max(0.1, Math.min(0.9, t));
        }
      });
      if (bestWall) {
        const bw = bestWall as Extract<BIMElement, { kind: 'wall' }>;
        onAddElement({
          id: `${activeTool}-${Date.now()}`,
          kind: activeTool,
          category: 'Architecture',
          name: activeTool === 'door' ? 'Industrial Door' : 'Double Glazed Window',
          levelId: activeLevelId,
          layerId: 'lay-open',
          phase: 'New Construction',
          hostWallId: bw.id,
          offsetRatio: Number(bestRatio.toFixed(2)),
          widthM: activeTool === 'door' ? 1.1 : 2.0,
          heightM: activeTool === 'door' ? 2.2 : 1.4,
          sillHeightM: activeTool === 'door' ? 0 : 0.9,
          subType: activeTool === 'door' ? 'single' : 'fixed',
          frameMaterial: 'Thermal Aluminum',
          fireRating: activeTool === 'door' ? '1 HR' : 'N/A',
          uValue: activeTool === 'door' ? 1.6 : 1.2,
          shgc: 0.35,
          openDirection: 'in',
          visible: true,
          locked: false,
        });
      }
      return;
    }

    // Single-click equipment/column/text placement
    const pointPlacementTools: ActiveTool[] = [
      'column',
      'ahu',
      'fcu',
      'vav',
      'chiller',
      'boiler',
      'diffuser',
      'panel',
      'transformer',
      'generator',
      'lighting',
      'socket',
      'pump',
      'tank',
      'valve',
      'fixture',
      'sprinkler',
      'fire_pump',
      'hydrant',
      'detector',
      'gas_meter',
      'gas_regulator',
      'lift_shaft',
      'text',
    ];
    if (pointPlacementTools.includes(activeTool)) {
      if (activeTool === 'column') {
        onAddElement({
          id: `col-${Date.now()}`,
          kind: 'column',
          category: 'Structure',
          name: 'Steel Column HEB300',
          levelId: activeLevelId,
          layerId: 'lay-struct',
          phase: 'New Construction',
          start: snapped,
          widthM: 0.35,
          depthM: 0.35,
          heightM: 3.6,
          elevationOffsetM: 0,
          materialId: 'mat-steel-s355',
          loadKN: 420,
          visible: true,
          locked: false,
        });
      } else if (activeTool === 'text') {
        onAddElement({
          id: `txt-${Date.now()}`,
          kind: 'text',
          category: 'Drafting',
          name: 'Engineering Note',
          levelId: activeLevelId,
          layerId: 'lay-draft',
          points: [snapped],
          text: 'SPEC NOTE: VERIFY CLEARANCE',
          visible: true,
          locked: false,
        });
      } else {
        const catMap: Record<string, EquipmentElement['category']> = {
          ahu: 'HVAC',
          fcu: 'HVAC',
          vav: 'HVAC',
          chiller: 'HVAC',
          boiler: 'HVAC',
          diffuser: 'HVAC',
          panel: 'Electrical',
          transformer: 'Electrical',
          generator: 'Electrical',
          lighting: 'Electrical',
          socket: 'Electrical',
          pump: 'Plumbing',
          tank: 'Plumbing',
          valve: 'Plumbing',
          fixture: 'Plumbing',
          sprinkler: 'Fire Protection',
          fire_pump: 'Fire Protection',
          hydrant: 'Fire Protection',
          detector: 'Fire Protection',
          gas_meter: 'Gas',
          gas_regulator: 'Gas',
          lift_shaft: 'Elevator',
        };
        const layMap: Record<string, string> = {
          HVAC: 'lay-hvac',
          Electrical: 'lay-elec',
          Plumbing: 'lay-plumb',
          'Fire Protection': 'lay-fire',
          Gas: 'lay-gas',
          Elevator: 'lay-arch',
        };
        const category = catMap[activeTool] || 'HVAC';
        onAddElement({
          id: `eq-${activeTool}-${Date.now()}`,
          kind: activeTool as EquipmentElement['kind'],
          category,
          name: `${activeTool.toUpperCase()} Unit`,
          tag: `${activeTool.slice(0, 3).toUpperCase()}-${Math.floor(10 + Math.random() * 89)}`,
          levelId: activeLevelId,
          layerId: layMap[category] || 'lay-hvac',
          position: snapped,
          rotationDeg: 0,
          elevationOffsetM: activeTool === 'vav' || activeTool === 'diffuser' || activeTool === 'sprinkler' ? 2.8 : 0,
          widthM: activeTool === 'chiller' || activeTool === 'generator' ? 3.2 : activeTool === 'ahu' || activeTool === 'tank' ? 2.4 : activeTool === 'lift_shaft' ? 2.4 : 1.0,
          depthM: activeTool === 'chiller' || activeTool === 'tank' ? 2.0 : activeTool === 'lift_shaft' ? 2.4 : 0.8,
          heightM: activeTool === 'lift_shaft' ? 3.8 : 1.6,
          ratedPowerKW: category === 'Electrical' ? 50 : 4.5,
          ratedFlowLs: category === 'HVAC' ? 550 : 4.5,
          valveState: 'OPEN',
          visible: true,
          locked: false,
        });
      }
      return;
    }

    // Two-click CAD line/wall/duct/pipe/cable/rect/circle/dimension/measure workflow
    if (!drawStartRef.current) {
      drawStartRef.current = snapped;
      polyPointsRef.current = [snapped];
      scheduleDraw();
    } else {
      const start = drawStartRef.current;
      const end = snapped;
      drawStartRef.current = null;
      polyPointsRef.current = [];
      if (distance2D(start, end) < 0.1) {
        scheduleDraw();
        return;
      }

      if (activeTool === 'measure') {
        const d = distance2D(start, end);
        setMeasureResult(`Distance: ${formatLength(d, project.unitSystem)} (ΔX=${(end.x - start.x).toFixed(2)}m, ΔY=${(end.y - start.y).toFixed(2)}m)`);
        scheduleDraw();
        return;
      }

      if (activeTool === 'wall' || activeTool === 'curtain_wall') {
        onAddElement({
          id: `wall-${Date.now()}`,
          kind: 'wall',
          category: 'Architecture',
          name: activeTool === 'curtain_wall' ? 'Curtain Glazed Wall' : 'BIM Parametric Wall',
          levelId: activeLevelId,
          layerId: 'lay-arch',
          phase: 'New Construction',
          wallType: activeTool === 'curtain_wall' ? 'curtain' : 'exterior',
          start,
          end,
          thicknessM: activeTool === 'curtain_wall' ? 0.16 : 0.22,
          heightM: 3.6,
          materialId: activeTool === 'curtain_wall' ? 'mat-curtain-glass' : 'mat-conc-wall',
          fireRating: '2 HR',
          uValue: activeTool === 'curtain_wall' ? 1.15 : 0.42,
          visible: true,
          locked: false,
        });
      } else if (activeTool === 'beam') {
        onAddElement({
          id: `beam-${Date.now()}`,
          kind: 'beam',
          category: 'Structure',
          name: 'Steel Girder IPE400',
          levelId: activeLevelId,
          layerId: 'lay-struct',
          phase: 'New Construction',
          start,
          end,
          widthM: 0.25,
          depthM: 0.25,
          heightM: 0.4,
          elevationOffsetM: 3.1,
          materialId: 'mat-steel-s355',
          loadKN: 180,
          visible: true,
          locked: false,
        });
      } else if (
        activeTool === 'duct' ||
        activeTool === 'cable' ||
        activeTool === 'cold_pipe' ||
        activeTool === 'hot_pipe' ||
        activeTool === 'drain_pipe' ||
        activeTool === 'fire_pipe' ||
        activeTool === 'gas_pipe'
      ) {
        const catMap = {
          duct: 'HVAC',
          cable: 'Electrical',
          cold_pipe: 'Plumbing',
          hot_pipe: 'Plumbing',
          drain_pipe: 'Plumbing',
          fire_pipe: 'Fire Protection',
          gas_pipe: 'Gas',
        } as const;
        const layMap = {
          duct: 'lay-hvac',
          cable: 'lay-elec',
          cold_pipe: 'lay-plumb',
          hot_pipe: 'lay-plumb',
          drain_pipe: 'lay-plumb',
          fire_pipe: 'lay-fire',
          gas_pipe: 'lay-gas',
        };
        onAddElement({
          id: `${activeTool}-${Date.now()}`,
          kind: activeTool,
          category: catMap[activeTool],
          name: `${activeTool.replace('_', ' ').toUpperCase()} Run`,
          levelId: activeLevelId,
          layerId: layMap[activeTool],
          systemName: catMap[activeTool],
          start,
          end,
          elevationOffsetM: activeTool === 'duct' ? 2.85 : activeTool === 'fire_pipe' ? 3.05 : 2.65,
          ductShape: activeTool === 'duct' ? 'rectangular' : undefined,
          widthMm: activeTool === 'duct' ? 450 : undefined,
          heightMm: activeTool === 'duct' ? 250 : undefined,
          airflowLs: activeTool === 'duct' ? 850 : undefined,
          pipeDiaMm: activeTool.includes('pipe') ? 50 : undefined,
          flowLs: activeTool.includes('pipe') ? 3.5 : undefined,
          voltageV: activeTool === 'cable' ? 400 : undefined,
          powerW: activeTool === 'cable' ? 18000 : undefined,
          powerFactor: activeTool === 'cable' ? 0.88 : undefined,
          cableSizeMm2: activeTool === 'cable' ? 10 : undefined,
          phaseCount: activeTool === 'cable' ? 3 : undefined,
          circuitId: activeTool === 'cable' ? `CKT-${Math.floor(10 + Math.random() * 89)}` : undefined,
          valveState: 'OPEN',
          visible: true,
          locked: false,
        });
      } else if (activeTool === 'slab' || activeTool === 'room') {
        const pts = [
          { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) },
          { x: Math.max(start.x, end.x), y: Math.min(start.y, end.y) },
          { x: Math.max(start.x, end.x), y: Math.max(start.y, end.y) },
          { x: Math.min(start.x, end.x), y: Math.max(start.y, end.y) },
        ];
        if (activeTool === 'slab') {
          onAddElement({
            id: `slab-${Date.now()}`,
            kind: 'slab',
            category: 'Architecture',
            name: 'Concrete Floor Slab',
            levelId: activeLevelId,
            layerId: 'lay-arch',
            phase: 'New Construction',
            points: pts,
            thicknessM: 0.25,
            materialId: 'mat-rc-slab',
            uValue: 0.45,
            visible: true,
            locked: false,
          });
        } else {
          onAddElement({
            id: `room-${Date.now()}`,
            kind: 'room',
            category: 'Architecture',
            name: 'Engineering Zone',
            roomNumber: `${Math.floor(104 + Math.random() * 90)}`,
            levelId: activeLevelId,
            layerId: 'lay-arch',
            points: pts,
            ceilingHeightM: 3.5,
            occupancy: 6,
            lightingWm2: 12,
            equipmentWm2: 20,
            outdoorTempC: 44,
            indoorTempC: 22,
            solarExposure: 'Medium',
            ventilationLsPerPerson: 10,
            floorFinish: 'Epoxy Industrial',
            wallFinish: 'Acoustic Panel',
            visible: true,
            locked: false,
          });
        }
      } else if (activeTool === 'rect') {
        onAddElement({
          id: `rect-${Date.now()}`,
          kind: 'rect',
          category: 'Drafting',
          name: '2D Rectangle',
          levelId: activeLevelId,
          layerId: 'lay-draft',
          points: [
            { x: start.x, y: start.y },
            { x: end.x, y: start.y },
            { x: end.x, y: end.y },
            { x: start.x, y: end.y },
          ],
          visible: true,
          locked: false,
        });
      } else if (activeTool === 'circle') {
        onAddElement({
          id: `circ-${Date.now()}`,
          kind: 'circle',
          category: 'Drafting',
          name: '2D Circle',
          levelId: activeLevelId,
          layerId: 'lay-draft',
          points: [start],
          radiusM: Number(distance2D(start, end).toFixed(2)),
          visible: true,
          locked: false,
        });
      } else if (activeTool === 'dimension') {
        onAddElement({
          id: `dim-${Date.now()}`,
          kind: 'dimension',
          category: 'Drafting',
          name: 'Linear Dimension',
          levelId: activeLevelId,
          layerId: 'lay-draft',
          points: [start, end],
          visible: true,
          locked: false,
        });
      } else {
        onAddElement({
          id: `line-${Date.now()}`,
          kind: 'line',
          category: 'Drafting',
          name: '2D CAD Line',
          levelId: activeLevelId,
          layerId: 'lay-draft',
          points: [start, end],
          visible: true,
          locked: false,
        });
      }
      scheduleDraw();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (isPanningRef.current) {
      const dx = e.clientX - panLastRef.current.x;
      const dy = e.clientY - panLastRef.current.y;
      panLastRef.current = { x: e.clientX, y: e.clientY };
      camRef.current.offsetX += dx;
      camRef.current.offsetY += dy;
      scheduleDraw();
      return;
    }

    const rawWorld = screenToWorld(sx, sy);
    const snapped = applySnap(rawWorld, drawStartRef.current);
    setCursorWorld(snapped);
    if (onCursorMove) onCursorMove(snapped);

    if (boxSelectRef.current) {
      boxSelectRef.current.end = rawWorld;
      scheduleDraw();
    } else if (dragMoveRef.current) {
      const dx = snapped.x - dragMoveRef.current.lastWorld.x;
      const dy = snapped.y - dragMoveRef.current.lastWorld.y;
      if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
        dragMoveRef.current.lastWorld = snapped;
        selectedIds.forEach((id) => {
          const el = project.elements.find((item) => item.id === id);
          if (!el || el.locked) return;
          if ('start' in el && 'end' in el && el.end) {
            onUpdateElement(id, {
              start: { x: Number((el.start.x + dx).toFixed(3)), y: Number((el.start.y + dy).toFixed(3)) },
              end: { x: Number((el.end.x + dx).toFixed(3)), y: Number((el.end.y + dy).toFixed(3)) },
            } as Partial<BIMElement>);
          } else if ('start' in el) {
            onUpdateElement(id, {
              start: { x: Number((el.start.x + dx).toFixed(3)), y: Number((el.start.y + dy).toFixed(3)) },
            } as Partial<BIMElement>);
          } else if ('position' in el) {
            onUpdateElement(id, {
              position: { x: Number((el.position.x + dx).toFixed(3)), y: Number((el.position.y + dy).toFixed(3)) },
            } as Partial<BIMElement>);
          }
        });
      }
    } else if (drawStartRef.current) {
      scheduleDraw();
    }
  };

  const handlePointerUp = () => {
    isPanningRef.current = false;
    dragMoveRef.current = null;
    if (boxSelectRef.current) {
      const { start, end } = boxSelectRef.current;
      boxSelectRef.current = null;
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);
      if (maxX - minX > 0.15 || maxY - minY > 0.15) {
        const picked: string[] = [];
        project.elements.forEach((el) => {
          if (!el.visible || el.levelId !== activeLevelId) return;
          if ('position' in el) {
            if (el.position.x >= minX && el.position.x <= maxX && el.position.y >= minY && el.position.y <= maxY) {
              picked.push(el.id);
            }
          } else if ('start' in el) {
            if (el.start.x >= minX && el.start.x <= maxX && el.start.y >= minY && el.start.y <= maxY) {
              picked.push(el.id);
            }
          }
        });
        onSelectIds(picked);
      }
      scheduleDraw();
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const cam = camRef.current;
    const newScale = Math.max(8, Math.min(180, cam.scale * factor));
    const ratio = newScale / cam.scale;
    cam.offsetX = mx - (mx - cam.offsetX) * ratio;
    cam.offsetY = my - (my - cam.offsetY) * ratio;
    cam.scale = newScale;
    setZoomPct(Math.round((newScale / 36) * 100));
    scheduleDraw();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none" data-testid="cad-viewport-2d">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={(e) => {
          e.preventDefault();
          drawStartRef.current = null;
          scheduleDraw();
        }}
        className="block w-full h-full cursor-crosshair touch-none"
      />

      {/* Top-left coordinate & tool telemetry HUD */}
      <div className="pointer-events-none absolute top-2.5 left-2.5 max-w-[calc(100%-20px)] flex flex-wrap items-center gap-1.5 bg-[#111a24]/95 border border-[#2c3f58] px-2.5 py-1 rounded-xl text-[11px] font-mono-tech text-[#dae3f1]">
        <span className="text-[#00d2ff] font-semibold uppercase whitespace-nowrap">2D</span>
        <span className="hidden sm:inline text-[#8b9cb2]">|</span>
        <span className="hidden sm:inline whitespace-nowrap">
          X:{cursorWorld.x.toFixed(2)} Y:{cursorWorld.y.toFixed(2)} m
        </span>
        <span className="text-[#8b9cb2]">|</span>
        <span className="whitespace-nowrap">{zoomPct}%</span>
        <span className="text-[#8b9cb2]">|</span>
        <span className="text-[#69f6b9] uppercase whitespace-nowrap truncate max-w-[110px]">
          {activeTool.replace('_', ' ')}
        </span>
      </div>

      {measureResult && (
        <div className="absolute top-12 left-2.5 flex items-center gap-3 bg-[#17202b] border border-[#00d2ff] px-3 py-1.5 rounded-xl text-xs font-mono-tech text-[#a5e7ff]">
          <span>{measureResult}</span>
          <button
            type="button"
            onClick={() => setMeasureResult(null)}
            className="text-[#8b9cb2] hover:text-white min-w-[28px] min-h-[28px]"
            aria-label="Clear measurement"
          >
            ×
          </button>
        </div>
      )}

      {/* Zoom / Fit quick controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-[#111a24]/95 border border-[#2c3f58] rounded-xl p-1">
        <button
          type="button"
          onClick={fitToBuilding}
          className="px-2.5 min-h-[36px] text-[11px] font-mono-tech text-[#dae3f1] hover:bg-[#222b35] rounded-lg whitespace-nowrap"
          title="Zoom Extents"
        >
          FIT
        </button>
        <button
          type="button"
          onClick={() => {
            camRef.current.scale = Math.min(180, camRef.current.scale * 1.2);
            setZoomPct(Math.round((camRef.current.scale / 36) * 100));
            scheduleDraw();
          }}
          className="min-w-[36px] min-h-[36px] text-xs font-mono-tech text-[#dae3f1] hover:bg-[#222b35] rounded-lg"
          aria-label="Zoom in 2D"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => {
            camRef.current.scale = Math.max(8, camRef.current.scale * 0.85);
            setZoomPct(Math.round((camRef.current.scale / 36) * 100));
            scheduleDraw();
          }}
          className="min-w-[36px] min-h-[36px] text-xs font-mono-tech text-[#dae3f1] hover:bg-[#222b35] rounded-lg"
          aria-label="Zoom out 2D"
        >
          −
        </button>
      </div>
    </div>
  );
};

function pointToSegmentDist(p: Point2D, a: Point2D, b: Point2D): number {
  const { dist } = projectPointOnSegment(p, a, b);
  return dist;
}

function projectPointOnSegment(p: Point2D, a: Point2D, b: Point2D): { dist: number; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { dist: distance2D(p, a), t: 0 };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const proj = { x: a.x + t * dx, y: a.y + t * dy };
  return { dist: distance2D(p, proj), t };
}
