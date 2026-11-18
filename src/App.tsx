import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActiveTool,
  BIMElement,
  BIMProject,
  ClashItem,
  Point2D,
  RibbonTab,
  VersionSnapshot,
  WorkspaceViewMode,
} from './types/bim';
import { createSeedProject } from './engine/seedProject';
import {
  calculateDucts,
  calculateElectricalCircuits,
  calculateRoomsHVAC,
  detectClashes,
} from './engine/calculations';
import {
  downloadTextFile,
  exportProjectToDXF,
  exportProjectToIFC,
  importDXFEntities,
} from './engine/exporters';
import {
  loadAllProjectsOffline,
  loadVersionSnapshots,
  saveProjectOffline,
  saveVersionSnapshot,
  syncProjectToCloud,
} from './engine/storage';
import { Viewport2D } from './components/Viewport2D';
import { Viewport3D } from './components/Viewport3D';
import { ProjectBrowser } from './components/ProjectBrowser';
import { InspectorAndCopilot } from './components/InspectorAndCopilot';
import { EngineeringModules } from './components/EngineeringModules';
import {
  AdminModal,
  AIAutomateModal,
  GlobalSearchModal,
  LibraryModal,
  NewProjectModal,
} from './components/Modals';
import { OfflineIndicator, PWAInstallButton } from './components/PWAInstall';
import {
  BarChart3,
  Box,
  Columns2,
  Database,
  Download,
  FilePlus2,
  FolderTree,
  Moon,
  MoreVertical,
  PenTool,
  Redo2,
  Save,
  Search,
  Settings,
  ShieldAlert,
  Sliders,
  Sun,
  Terminal,
  Undo2,
  Upload,
  Wrench,
  X,
} from 'lucide-react';

interface RemoteCursor {
  userId: string;
  name: string;
  x: number;
  y: number;
}

const RIBBON_TOOLS: Record<
  RibbonTab,
  Array<{ id: ActiveTool | `VIEW:${WorkspaceViewMode}`; label: string }>
> = {
  HOME: [
    { id: 'select', label: 'Select' },
    { id: 'pan', label: 'Pan' },
    { id: 'move', label: 'Move' },
    { id: 'trim', label: 'Delete/Trim' },
    { id: 'measure', label: 'Measure' },
    { id: 'markup_pin', label: 'Markup Pin' },
    { id: 'VIEW:CLASH', label: 'Clash Scan' },
  ],
  DRAW: [
    { id: 'line', label: 'Line' },
    { id: 'rect', label: 'Rectangle' },
    { id: 'circle', label: 'Circle' },
    { id: 'dimension', label: 'Dimension' },
    { id: 'text', label: 'Text Note' },
  ],
  ARCHITECTURE: [
    { id: 'wall', label: 'Wall' },
    { id: 'curtain_wall', label: 'Curtain Wall' },
    { id: 'door', label: 'Door' },
    { id: 'window', label: 'Window' },
    { id: 'slab', label: 'Slab' },
    { id: 'room', label: 'Room Zone' },
    { id: 'lift_shaft', label: 'Elevator Shaft' },
  ],
  STRUCTURE: [
    { id: 'column', label: 'Column' },
    { id: 'beam', label: 'Steel Beam' },
    { id: 'slab', label: 'Structural Slab' },
    { id: 'VIEW:CLASH', label: 'Struct Clashes' },
  ],
  HVAC: [
    { id: 'duct', label: 'Duct' },
    { id: 'ahu', label: 'AHU' },
    { id: 'chiller', label: 'Chiller' },
    { id: 'fcu', label: 'FCU' },
    { id: 'vav', label: 'VAV Box' },
    { id: 'diffuser', label: 'Diffuser' },
    { id: 'VIEW:CALCULATIONS', label: 'HVAC Loads' },
  ],
  ELECTRICAL: [
    { id: 'panel', label: 'Panel / MDB' },
    { id: 'cable', label: 'Cable Run' },
    { id: 'transformer', label: 'Transformer' },
    { id: 'generator', label: 'Generator' },
    { id: 'lighting', label: 'Lighting' },
    { id: 'socket', label: 'Socket' },
    { id: 'VIEW:CALCULATIONS', label: 'Voltage Drop' },
  ],
  PLUMBING: [
    { id: 'cold_pipe', label: 'Cold Water' },
    { id: 'hot_pipe', label: 'Hot Water' },
    { id: 'drain_pipe', label: 'Drainage' },
    { id: 'pump', label: 'Booster Pump' },
    { id: 'tank', label: 'Water Tank' },
    { id: 'valve', label: 'Valve' },
    { id: 'fixture', label: 'Fixture' },
  ],
  FIRE: [
    { id: 'fire_pipe', label: 'Fire Pipe' },
    { id: 'sprinkler', label: 'Sprinkler' },
    { id: 'fire_pump', label: 'Fire Pump' },
    { id: 'hydrant', label: 'Hydrant' },
    { id: 'detector', label: 'Smoke Detector' },
  ],
  GAS: [
    { id: 'gas_pipe', label: 'Gas Pipe' },
    { id: 'gas_meter', label: 'Gas Meter' },
    { id: 'gas_regulator', label: 'Regulator' },
  ],
  ENERGY: [
    { id: 'VIEW:ENERGY', label: 'Energy Rating' },
    { id: 'VIEW:CALCULATIONS', label: 'Thermal Loads' },
  ],
  DOCUMENTATION: [
    { id: 'VIEW:SHEETS', label: 'Drawing Sheets' },
    { id: 'VIEW:BOQ', label: 'BOQ & Cost' },
    { id: 'dimension', label: 'Smart Dim' },
    { id: 'text', label: 'Callout Note' },
  ],
};

export default function App() {
  const [project, setProject] = useState<BIMProject>(() => createSeedProject('Oil & Gas Facility'));
  const [activeLevelId, setActiveLevelId] = useState<string>('lvl-00');
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>('HOME');
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? '2D' : 'SPLIT',
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [orthoMode, setOrthoMode] = useState<boolean>(true);
  const [snapMode, setSnapMode] = useState<boolean>(true);
  const [showClashes, setShowClashes] = useState<boolean>(true);
  const [darkMode, setDarkMode] = useState<boolean>(true);

  // Undo / Redo transaction stacks
  const [undoStack, setUndoStack] = useState<BIMProject[]>([]);
  const [redoStack, setRedoStack] = useState<BIMProject[]>([]);

  // Modals, mobile bottom sheets & notifications
  const [showWizard, setShowWizard] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAIAutomate, setShowAIAutomate] = useState(false);
  const [activeSheet, setActiveSheet] = useState<'none' | 'tools' | 'modules' | 'tree' | 'inspect' | 'menu'>('none');
  const [toast, setToast] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'LOCAL' | 'SYNCED' | 'OFFLINE'>('LOCAL');
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);

  // Focus coordinates for Locate Clash / Locate Issue
  const [focus2D, setFocus2D] = useState<Point2D | null>(null);
  const [focus3DClash, setFocus3DClash] = useState<ClashItem | null>(null);

  // Command Console
  const [cmdInput, setCmdInput] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([
    '4M ENGINEERING CLOUD CAD/BIM Engine initialized. Type HELP for commands.',
  ]);

  // Collaboration WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [peerCount, setPeerCount] = useState<number>(1);
  const dxfInputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3400);
  }, []);

  // Load offline project & version snapshots on mount
  useEffect(() => {
    loadAllProjectsOffline().then((list) => {
      const savedId = localStorage.getItem('4m_active_project_id');
      const found = list.find((p) => p.id === savedId) || list[0];
      if (found) {
        setProject(found);
        if (found.levels[0]) setActiveLevelId(found.levels[0].id);
      }
    });
    loadVersionSnapshots().then(setVersions);
  }, []);

  // Sync dark class on <html>
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Connect WebSocket for live collaboration presence & cursors
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/ws`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            type: 'join',
            projectId: project.id,
            name: project.branding.designerName,
          }),
        );
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'presence' && Array.isArray(msg.peers)) {
            setPeerCount(Math.max(1, msg.peers.length));
          } else if (msg.type === 'cursor' && msg.cursor) {
            setRemoteCursors((prev) => {
              const others = prev.filter((c) => c.userId !== msg.userId);
              return [...others, { userId: msg.userId, name: msg.name || 'Peer', x: msg.cursor.x, y: msg.cursor.y }];
            });
          }
        } catch {
          // ignore invalid frame
        }
      };
    } catch {
      // WebSocket offline fallback
    }
    return () => {
      ws?.close();
    };
  }, [project.id, project.branding.designerName]);

  // Autosave to IndexedDB whenever project changes
  useEffect(() => {
    const t = window.setTimeout(() => {
      saveProjectOffline(project).then(() => {
        setSyncStatus(navigator.onLine ? 'LOCAL' : 'OFFLINE');
      });
    }, 500);
    return () => clearTimeout(t);
  }, [project]);

  // Transaction-safe mutator
  const commitProject = useCallback((updater: (prev: BIMProject) => BIMProject) => {
    setProject((prev) => {
      const next = updater(prev);
      setUndoStack((u) => [...u.slice(-29), prev]);
      setRedoStack([]);
      return { ...next, updatedAt: new Date().toISOString() };
    });
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack((u) => {
      if (u.length === 0) return u;
      const previous = u[u.length - 1];
      setProject((cur) => {
        setRedoStack((r) => [...r, cur]);
        return previous;
      });
      notify('Undo applied');
      return u.slice(0, -1);
    });
  }, [notify]);

  const handleRedo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const next = r[r.length - 1];
      setProject((cur) => {
        setUndoStack((u) => [...u, cur]);
        return next;
      });
      notify('Redo applied');
      return r.slice(0, -1);
    });
  }, [notify]);

  const handleSaveCloud = useCallback(async () => {
    await saveProjectOffline(project);
    const res = await syncProjectToCloud(project);
    if (res.synced) {
      setSyncStatus('SYNCED');
      notify('Project saved to IndexedDB & synced to Cloud');
    } else {
      setSyncStatus('OFFLINE');
      notify(`Saved locally (${res.error || 'offline'})`);
    }
  }, [project, notify]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      const typing = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveCloud();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearch(true);
      } else if (e.key === 'Escape') {
        setActiveTool('select');
        setSelectedIds([]);
      } else if (e.key === 'F8') {
        e.preventDefault();
        setOrthoMode((v) => !v);
      } else if (e.key === 'F3') {
        e.preventDefault();
        setSnapMode((v) => !v);
      } else if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        commitProject((p) => ({
          ...p,
          elements: p.elements.filter((el) => !selectedIds.includes(el.id)),
        }));
        setSelectedIds([]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo, handleSaveCloud, selectedIds, commitProject]);

  // Live Clash Detection
  const clashes = useMemo(() => detectClashes(project), [project]);

  const handleAddElement = (el: BIMElement) => {
    commitProject((p) => ({ ...p, elements: [...p.elements, el] }));
    setSelectedIds([el.id]);
    setCmdHistory((h) => [...h.slice(-14), `Created ${el.kind.toUpperCase()}: ${el.name}`]);
  };

  const handleUpdateElement = (id: string, patch: Partial<BIMElement>) => {
    commitProject((p) => ({
      ...p,
      elements: p.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as BIMElement) : el)),
    }));
  };

  const handleDeleteElements = (ids: string[]) => {
    commitProject((p) => ({
      ...p,
      elements: p.elements.filter((el) => !ids.includes(el.id)),
    }));
    setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
  };

  const handleDuplicateElement = (id: string) => {
    const orig = project.elements.find((e) => e.id === id);
    if (!orig) return;
    const copyId = `${orig.kind}-${Date.now()}`;
    const clone = JSON.parse(JSON.stringify(orig)) as BIMElement;
    clone.id = copyId;
    clone.name = `${orig.name} (Copy)`;
    if ('position' in clone) {
      clone.position.x += 1.5;
      clone.position.y += 1.5;
    } else if ('start' in clone) {
      clone.start.x += 1.5;
      clone.start.y += 1.5;
      if ('end' in clone && clone.end) {
        clone.end.x += 1.5;
        clone.end.y += 1.5;
      }
    }
    handleAddElement(clone);
  };

  const handleAutoResolveClash = (clash: ClashItem) => {
    const targetEl =
      project.elements.find((e) => e.id === clash.elementAId && e.category !== 'Structure') ||
      project.elements.find((e) => e.id === clash.elementBId && e.category !== 'Structure');
    if (!targetEl || !('elevationOffsetM' in targetEl)) return;
    const newElev = Number(Math.max(2.1, targetEl.elevationOffsetM - 0.55).toFixed(2));
    handleUpdateElement(targetEl.id, { elevationOffsetM: newElev } as Partial<BIMElement>);
    notify(`Adjusted ${targetEl.name} elevation to +${newElev}m to clear clash ${clash.id}`);
  };

  // AI Automate calculated proposal list
  const aiAutomatePlan = useMemo(() => {
    const actions: string[] = [];
    const rooms = calculateRoomsHVAC(project);
    const unserved = rooms.filter((r) => !r.hasHVACServed);
    unserved.forEach((r) => {
      actions.push(`Add FCU terminal in Room ${r.roomNumber} (${r.roomName}) sized for ${r.totalCoolingLoadKW} kW (${r.requiredAirflowLs} L/s).`);
    });
    const circuits = calculateElectricalCircuits(project).filter((c) => c.status !== 'OK');
    circuits.forEach((c) => {
      actions.push(`Upgrade circuit ${c.circuitId} cable from ${c.cableSizeMm2}mm² to ${c.recommendedCableMm2}mm² (ΔV currently ${c.voltageDropPct}%).`);
    });
    const ducts = calculateDucts(project).filter((d) => d.status !== 'OK');
    ducts.forEach((d) => {
      actions.push(`Resize duct ${d.name} to ${d.recommendedSize} for optimal 5.5 m/s velocity.`);
    });
    clashes.forEach((c) => {
      actions.push(`Drop MEP elevation by 0.55m on ${c.elementAName} / ${c.elementBName} to resolve ${c.id}.`);
    });
    if (actions.length === 0) {
      actions.push('All rooms have HVAC terminals, circuits pass IEC voltage drop (<3%), and zero clashes exist.');
    }
    return actions;
  }, [project, clashes]);

  const applyAIAutomate = () => {
    commitProject((p) => {
      let nextElements = [...p.elements];
      // 1. Add missing HVAC FCU in unserved rooms
      const rooms = calculateRoomsHVAC(p);
      rooms
        .filter((r) => !r.hasHVACServed)
        .forEach((r) => {
          const roomObj = nextElements.find((e) => e.id === r.roomId);
          if (roomObj && roomObj.kind === 'room') {
            const cx = roomObj.points.reduce((a, pt) => a + pt.x, 0) / roomObj.points.length;
            const cy = roomObj.points.reduce((a, pt) => a + pt.y, 0) / roomObj.points.length;
            nextElements.push({
              id: `eq-fcu-ai-${r.roomNumber}`,
              kind: 'fcu',
              category: 'HVAC',
              name: `FCU-${r.roomNumber} Auto-Sized Terminal`,
              tag: `FCU-${r.roomNumber}`,
              levelId: roomObj.levelId,
              layerId: 'lay-hvac',
              position: { x: Number(cx.toFixed(2)), y: Number(cy.toFixed(2)) },
              rotationDeg: 0,
              elevationOffsetM: 2.8,
              widthM: 1.2,
              depthM: 0.65,
              heightM: 0.35,
              ratedPowerKW: 0.55,
              ratedFlowLs: r.requiredAirflowLs,
              valveState: 'OPEN',
              roomId: roomObj.id,
              visible: true,
              locked: false,
            });
          }
        });

      // 2. Upgrade undersized electrical cables
      const circuits = calculateElectricalCircuits(p).filter((c) => c.status !== 'OK');
      circuits.forEach((c) => {
        nextElements = nextElements.map((el) =>
          el.id === c.id && el.kind === 'cable' ? { ...el, cableSizeMm2: c.recommendedCableMm2 } : el,
        );
      });

      // 3. Lower clashing MEP segments below structural girders
      const curClashes = detectClashes({ ...p, elements: nextElements });
      curClashes.forEach((cl) => {
        nextElements = nextElements.map((el) => {
          if ((el.id === cl.elementAId || el.id === cl.elementBId) && el.category !== 'Structure' && 'elevationOffsetM' in el) {
            return { ...el, elevationOffsetM: Number(Math.max(2.1, el.elevationOffsetM - 0.55).toFixed(2)) };
          }
          return el;
        });
      });

      return { ...p, elements: nextElements };
    });
    notify('AI Automate applied engineering fixes across HVAC, Electrical & Clashes');
  };

  // CAD Command Console interpreter
  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = cmdInput.trim();
    if (!raw) return;
    const cmd = raw.toUpperCase();
    setCmdInput('');

    const toolAliases: Record<string, ActiveTool> = {
      SELECT: 'select',
      LINE: 'line',
      L: 'line',
      RECT: 'rect',
      CIRCLE: 'circle',
      C: 'circle',
      WALL: 'wall',
      W: 'wall',
      DOOR: 'door',
      WINDOW: 'window',
      SLAB: 'slab',
      ROOM: 'room',
      COLUMN: 'column',
      BEAM: 'beam',
      DUCT: 'duct',
      PIPE: 'cold_pipe',
      CABLE: 'cable',
      DIM: 'dimension',
      MOVE: 'move',
      MEASURE: 'measure',
    };

    let output = '';
    if (cmd === 'HELP') {
      output = 'Commands: WALL, DOOR, WINDOW, DUCT, PIPE, CABLE, LINE, CIRCLE, DIM, 2D, 3D, SPLIT, CALC, CLASH, ENERGY, BOQ, SHEETS, UNDO, SAVE, EXPORT DXF, EXPORT IFC';
    } else if (toolAliases[cmd]) {
      setActiveTool(toolAliases[cmd]);
      if (viewMode !== '2D' && viewMode !== 'SPLIT') setViewMode('SPLIT');
      output = `Active tool set to ${toolAliases[cmd].toUpperCase()}`;
    } else if (cmd === '2D') {
      setViewMode('2D');
      output = 'Switched to 2D CAD Drafting Viewport';
    } else if (cmd === '3D') {
      setViewMode('3D');
      output = 'Switched to 3D WebGL BIM Viewport';
    } else if (cmd === 'SPLIT') {
      setViewMode('SPLIT');
      output = 'Switched to Split 2D/3D Synchronized View';
    } else if (cmd === 'CALC' || cmd === 'HVAC') {
      setViewMode('CALCULATIONS');
      output = 'Opened Engineering Calculation & Rule Engine';
    } else if (cmd === 'CLASH') {
      setViewMode('CLASH');
      output = `Clash scan active: ${clashes.length} interference(s) found`;
    } else if (cmd === 'BOQ') {
      setViewMode('BOQ');
      output = 'Opened Automatic Quantity Takeoff & BOQ';
    } else if (cmd === 'ENERGY') {
      setViewMode('ENERGY');
      output = 'Opened Building Energy Rating & Solar Gain';
    } else if (cmd === 'SHEETS' || cmd === 'REPORT') {
      setViewMode('SHEETS');
      output = 'Opened Drawing Sheets & Schedules';
    } else if (cmd === 'UNDO') {
      handleUndo();
      output = 'Undid last transaction';
    } else if (cmd === 'REDO') {
      handleRedo();
      output = 'Redid transaction';
    } else if (cmd === 'SAVE') {
      handleSaveCloud();
      output = 'Saved project snapshot';
    } else if (cmd === 'EXPORT DXF') {
      downloadTextFile(`${project.projectNumber}.dxf`, exportProjectToDXF(project));
      output = 'Exported AutoCAD DXF';
    } else if (cmd === 'EXPORT IFC') {
      downloadTextFile(`${project.projectNumber}.ifc`, exportProjectToIFC(project));
      output = 'Exported ISO-10303-21 IFC4 STEP model';
    } else {
      output = `Unknown command "${raw}". Type HELP for CAD/BIM commands.`;
    }

    setCmdHistory((h) => [...h.slice(-14), `> ${raw}`, output]);
  };

  const handleImportDXF = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      if (file.name.toLowerCase().endsWith('.json')) {
        try {
          const parsed = JSON.parse(text) as BIMProject;
          if (parsed.elements && parsed.levels) {
            setProject(parsed);
            notify(`Imported BIM Project: ${parsed.name}`);
          }
        } catch {
          notify('Invalid BIM JSON file');
        }
      } else {
        const entities = importDXFEntities(text, activeLevelId);
        if (entities.length > 0) {
          commitProject((p) => ({ ...p, elements: [...p.elements, ...entities] }));
          notify(`Imported ${entities.length} DXF vector entities onto ${activeLevelId}`);
        } else {
          notify('No LINE or CIRCLE entities found in DXF file');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#0b1118] dark:bg-[#0b1118] bg-slate-100 text-[#dae3f1] dark:text-[#dae3f1] text-slate-900">
      {/* Hidden DXF / JSON Import File Input */}
      <input
        ref={dxfInputRef}
        type="file"
        accept=".dxf,.json"
        onChange={handleImportDXF}
        className="hidden"
        aria-label="Import DXF or BIM JSON file"
      />

      {/* MOBILE-FIRST APP TOP BAR (48px on mobile, 52px on desktop) */}
      <header className="h-12 md:h-13 shrink-0 flex items-center justify-between gap-2 px-2.5 md:px-4 bg-[#111a24] dark:bg-[#111a24] bg-white border-b border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200 no-print z-30">
        {/* Left Zone: Tree Drawer Trigger (mobile) + App Brand & Project Title */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => setActiveSheet((s) => (s === 'tree' ? 'none' : 'tree'))}
            aria-label="Open Project Tree and Layers"
            className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[#1b2636] dark:hover:bg-[#1b2636] hover:bg-slate-100 shrink-0"
          >
            <FolderTree className="w-5 h-5 text-[#00d2ff]" />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#00d2ff] text-[#0b1118] font-display font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
              4M
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-sm tracking-tight truncate max-w-[155px] sm:max-w-[240px]">
                {project.branding.platformTitle}
              </div>
              <div className="hidden sm:block text-[10px] text-[#8b9cb2] truncate max-w-[240px]">
                {project.name}
              </div>
            </div>
          </div>
        </div>

        {/* Center Zone: Desktop Segmented App Pill Switcher */}
        <nav
          className="hidden lg:flex items-center gap-1 bg-[#0b1118] dark:bg-[#0b1118] bg-slate-100 p-1 rounded-2xl border border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200"
          aria-label="Workspace Views"
        >
          {(
            [
              ['2D', '2D Plan'],
              ['3D', '3D BIM'],
              ['SPLIT', 'Split'],
              ['CALCULATIONS', 'Calc'],
              ['ENERGY', 'Energy'],
              ['CLASH', `Clash (${clashes.length})`],
              ['BOQ', 'BOQ'],
              ['SHEETS', 'Sheets'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setViewMode(m)}
              className={`px-3 py-1 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 transition-colors ${
                viewMode === m
                  ? 'bg-[#00d2ff] text-[#0b1118] font-bold shadow-sm'
                  : 'text-[#8b9cb2] hover:text-[#dae3f1] dark:hover:text-[#dae3f1] hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Right Zone: Touch-friendly Quick Actions + App Menu Trigger */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            aria-label="Undo"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[#1b2636] dark:hover:bg-[#1b2636] hover:bg-slate-100 disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            aria-label="Redo"
            className="hidden sm:flex min-w-[44px] min-h-[44px] items-center justify-center rounded-xl hover:bg-[#1b2636] dark:hover:bg-[#1b2636] hover:bg-slate-100 disabled:opacity-30"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            aria-label="Global Search"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[#1b2636] dark:hover:bg-[#1b2636] hover:bg-slate-100"
            title="Global Search (Ctrl+K)"
          >
            <Search className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleSaveCloud}
            aria-label="Save Project"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#00d2ff] text-[#0b1118] text-xs font-semibold hover:opacity-90 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" /> Save
          </button>
          <PWAInstallButton variant="header" />
          <button
            type="button"
            onClick={() => setActiveSheet((s) => (s === 'menu' ? 'none' : 'menu'))}
            aria-label="App Menu and Settings"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-[#1b2636] dark:hover:bg-[#1b2636] hover:bg-slate-100"
            title="Menu, Export & Settings"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN APP WORKSPACE */}
      <div className="flex-1 flex overflow-hidden min-h-0 md:p-2 md:gap-2">
        {/* Left: Project Browser (Desktop card) */}
        <div className="hidden md:flex rounded-2xl overflow-hidden border border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200 shadow-sm no-print">
          <ProjectBrowser
            project={project}
            activeLevelId={activeLevelId}
            onSetActiveLevel={setActiveLevelId}
            onAddLevel={() => {
              const idx = project.levels.length;
              const newLvl = {
                id: `lvl-0${idx}`,
                name: `Level 0${idx} — Upper Deck`,
                elevationM: Number((idx * 3.6).toFixed(1)),
                heightM: 3.6,
                visible: true,
                locked: false,
              };
              commitProject((p) => ({ ...p, levels: [...p.levels, newLvl] }));
              setActiveLevelId(newLvl.id);
              notify(`Added ${newLvl.name} (+${newLvl.elevationM}m)`);
            }}
            onToggleLevelVis={(id) =>
              commitProject((p) => ({
                ...p,
                levels: p.levels.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
              }))
            }
            onIsolateLevel={(id) => {
              commitProject((p) => ({
                ...p,
                levels: p.levels.map((l) => ({ ...l, visible: l.id === id })),
              }));
              setActiveLevelId(id);
            }}
            selectedIds={selectedIds}
            onSelectIds={setSelectedIds}
            onToggleElementVis={(id) =>
              commitProject((p) => ({
                ...p,
                elements: p.elements.map((e) => (e.id === id ? { ...e, visible: !e.visible } : e)),
              }))
            }
            onToggleElementLock={(id) =>
              commitProject((p) => ({
                ...p,
                elements: p.elements.map((e) => (e.id === id ? { ...e, locked: !e.locked } : e)),
              }))
            }
            onDeleteElements={handleDeleteElements}
            onToggleLayerVis={(id) =>
              commitProject((p) => ({
                ...p,
                layers: p.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
              }))
            }
            onToggleLayerLock={(id) =>
              commitProject((p) => ({
                ...p,
                layers: p.layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)),
              }))
            }
            onUpdateIssueStatus={(id, status) =>
              commitProject((p) => ({
                ...p,
                issues: p.issues.map((i) => (i.id === id ? { ...i, status } : i)),
              }))
            }
            onLocatePoint={(x, y, lvlId) => {
              setActiveLevelId(lvlId);
              setFocus2D({ x, y });
              if (viewMode !== '2D' && viewMode !== 'SPLIT') setViewMode('SPLIT');
            }}
            versions={versions}
            onCreateSnapshot={async (desc) => {
              const snap: VersionSnapshot = {
                id: `ver-${Date.now()}`,
                version: `v1.${versions.length + 1}`,
                timestamp: new Date().toISOString(),
                author: project.branding.designerName,
                description: desc,
                elementCount: project.elements.length,
                dataJson: JSON.stringify(project),
              };
              await saveVersionSnapshot(snap);
              setVersions((prev) => [snap, ...prev]);
              notify(`Committed version ${snap.version}`);
            }}
            onRestoreSnapshot={(snap) => {
              try {
                const parsed = JSON.parse(snap.dataJson) as BIMProject;
                setProject(parsed);
                notify(`Restored ${snap.version}`);
              } catch {
                notify('Could not restore version snapshot');
              }
            }}
          />
        </div>

        {/* Center Stage: 2D / 3D / Split / Engineering Modules */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative md:rounded-2xl md:border border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200 bg-[#0b1118] dark:bg-[#0b1118] bg-slate-50">
          {(viewMode === '2D' || viewMode === '3D' || viewMode === 'SPLIT') ? (
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0 relative">
              {(viewMode === '2D' || viewMode === 'SPLIT') && (
                <div
                  className={`${
                    viewMode === 'SPLIT'
                      ? 'h-1/2 md:h-full w-full md:w-1/2 border-b md:border-b-0 md:border-r border-[#1e2b3d]'
                      : 'w-full h-full'
                  } relative`}
                >
                  <Viewport2D
                    project={project}
                    activeLevelId={activeLevelId}
                    activeTool={activeTool}
                    selectedIds={selectedIds}
                    onSelectIds={setSelectedIds}
                    onAddElement={handleAddElement}
                    onUpdateElement={handleUpdateElement}
                    onDeleteElements={handleDeleteElements}
                    onAddIssueAt={(pt) => {
                      commitProject((p) => ({
                        ...p,
                        issues: [
                          ...p.issues,
                          {
                            id: `ISS-${String(p.issues.length + 1).padStart(2, '0')}`,
                            title: 'Site Field Markup Pin',
                            author: p.branding.designerName,
                            date: new Date().toISOString().slice(0, 10),
                            status: 'Open',
                            priority: 'Medium',
                            assignedTo: 'Engineering Lead',
                            comment: `Markup pinned at (${pt.x.toFixed(2)}m, ${pt.y.toFixed(2)}m)`,
                            position: pt,
                            levelId: activeLevelId,
                          },
                        ],
                      }));
                      notify('Added issue markup pin');
                    }}
                    clashes={clashes}
                    showClashes={showClashes}
                    orthoMode={orthoMode}
                    snapMode={snapMode}
                    darkMode={darkMode}
                    remoteCursors={remoteCursors}
                    onCursorMove={(pt) => {
                      if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({ type: 'cursor', cursor: pt }));
                      }
                    }}
                    focusPoint={focus2D}
                  />

                  {/* Floating Quick Tool Launcher on 2D Canvas */}
                  <button
                    type="button"
                    onClick={() => setActiveSheet('tools')}
                    className="absolute bottom-3 left-3 min-h-[40px] px-3 py-1.5 rounded-xl bg-[#111a24]/95 border border-[#2c3f58] text-[#dae3f1] text-xs font-medium flex items-center gap-1.5 shadow-lg hover:border-[#00d2ff]"
                  >
                    <Wrench className="w-3.5 h-3.5 text-[#00d2ff]" />
                    <span className="capitalize whitespace-nowrap">{activeTool.replace('_', ' ')}</span>
                  </button>
                </div>
              )}

              {(viewMode === '3D' || viewMode === 'SPLIT') && (
                <div
                  className={`${
                    viewMode === 'SPLIT' ? 'h-1/2 md:h-full w-full md:w-1/2' : 'w-full h-full'
                  }`}
                >
                  <Viewport3D
                    project={project}
                    selectedIds={selectedIds}
                    onSelectIds={setSelectedIds}
                    clashes={clashes}
                    showClashes={showClashes}
                    darkMode={darkMode}
                    focusClash={focus3DClash}
                  />
                </div>
              )}
            </div>
          ) : (
            <EngineeringModules
              mode={viewMode}
              project={project}
              clashes={clashes}
              onUpdateProjectMeta={(patch) => commitProject((p) => ({ ...p, ...patch }))}
              onUpdateElement={handleUpdateElement}
              onLocateClash={(c) => {
                setFocus3DClash(c);
                setFocus2D({ x: c.location.x, y: c.location.y });
                setActiveLevelId(c.levelId);
                setSelectedIds([c.elementAId]);
                setViewMode('SPLIT');
              }}
              onAutoResolveClash={handleAutoResolveClash}
            />
          )}

          {/* Desktop-only Quick Command Bar */}
          <div className="hidden md:flex shrink-0 bg-[#0d151f] dark:bg-[#0d151f] bg-slate-100 border-t border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200 px-3 py-1.5 items-center gap-3 no-print">
            <div className="flex items-center gap-1.5 text-[11px] font-mono-tech text-[#00d2ff] shrink-0">
              <Terminal className="w-3.5 h-3.5" />
              <span>CMD:</span>
            </div>
            <form onSubmit={handleCommandSubmit} className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={cmdInput}
                onChange={(e) => setCmdInput(e.target.value)}
                placeholder="Type CAD command (WALL, DUCT, PIPE, CABLE, CALC, CLASH, BOQ, 3D, HELP)..."
                aria-label="CAD Command Console"
                className="flex-1 bg-transparent text-xs font-mono-tech text-[#dae3f1] dark:text-[#dae3f1] text-slate-900 focus:outline-none"
              />
            </form>
            <div className="hidden xl:block text-[11px] font-mono-tech text-[#8b9cb2] truncate max-w-md">
              {cmdHistory[cmdHistory.length - 1]}
            </div>
          </div>
        </main>

        {/* Right: Inspector & AI Copilot (Desktop card) */}
        <div className="hidden lg:flex rounded-2xl overflow-hidden border border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200 shadow-sm no-print">
          <InspectorAndCopilot
            project={project}
            selectedIds={selectedIds}
            onUpdateElement={handleUpdateElement}
            onDuplicateElement={handleDuplicateElement}
            onDeleteElements={handleDeleteElements}
            clashes={clashes}
            onRunAIAutomate={() => setShowAIAutomate(true)}
          />
        </div>
      </div>

      {/* MOBILE APP BOTTOM TAB BAR (56px thumb-zone anchor on mobile/tablet + compact app dock on desktop) */}
      <nav
        aria-label="Mobile App Navigation"
        className="h-14 shrink-0 grid grid-cols-5 items-center bg-[#111a24]/95 dark:bg-[#111a24]/95 bg-white/95 backdrop-blur-md border-t border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200 z-30 no-print"
      >
        <button
          type="button"
          onClick={() => {
            setViewMode('2D');
            setActiveSheet('none');
          }}
          className={`min-h-[44px] h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            viewMode === '2D' && activeSheet === 'none'
              ? 'text-[#00d2ff]'
              : 'text-[#8b9cb2] hover:text-[#dae3f1] dark:hover:text-[#dae3f1] hover:text-slate-900'
          }`}
        >
          <PenTool className="w-5 h-5" />
          <span className="text-[10px] font-medium whitespace-nowrap">2D Plan</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('3D');
            setActiveSheet('none');
          }}
          className={`min-h-[44px] h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            viewMode === '3D' && activeSheet === 'none'
              ? 'text-[#00d2ff]'
              : 'text-[#8b9cb2] hover:text-[#dae3f1] dark:hover:text-[#dae3f1] hover:text-slate-900'
          }`}
        >
          <Box className="w-5 h-5" />
          <span className="text-[10px] font-medium whitespace-nowrap">3D BIM</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSheet((s) => (s === 'tools' ? 'none' : 'tools'))}
          className={`min-h-[44px] h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeSheet === 'tools'
              ? 'text-[#00d2ff]'
              : 'text-[#8b9cb2] hover:text-[#dae3f1] dark:hover:text-[#dae3f1] hover:text-slate-900'
          }`}
        >
          <Wrench className="w-5 h-5" />
          <span className="text-[10px] font-medium whitespace-nowrap">Tools</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSheet((s) => (s === 'modules' ? 'none' : 'modules'))}
          className={`min-h-[44px] h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeSheet === 'modules' ||
            (activeSheet === 'none' &&
              viewMode !== '2D' &&
              viewMode !== '3D')
              ? 'text-[#00d2ff]'
              : 'text-[#8b9cb2] hover:text-[#dae3f1] dark:hover:text-[#dae3f1] hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-medium whitespace-nowrap">Modules</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSheet((s) => (s === 'inspect' ? 'none' : 'inspect'))}
          className={`min-h-[44px] h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            activeSheet === 'inspect'
              ? 'text-[#00d2ff]'
              : 'text-[#8b9cb2] hover:text-[#dae3f1] dark:hover:text-[#dae3f1] hover:text-slate-900'
          }`}
        >
          <Sliders className="w-5 h-5" />
          <span className="text-[10px] font-medium whitespace-nowrap">Inspect</span>
        </button>
      </nav>

      {/* SLIDE-UP MOBILE APP BOTTOM SHEETS */}
      {activeSheet !== 'none' && (
        <div
          className="fixed inset-0 z-40 flex flex-col justify-end bg-black/55 backdrop-blur-xs no-print"
          onClick={() => setActiveSheet('none')}
        >
          <div
            className="w-full max-w-2xl mx-auto bg-[#111a24] dark:bg-[#111a24] bg-white border-t border-x border-[#2c3f58] dark:border-[#2c3f58] border-slate-200 rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Drag Handle & Header */}
            <div className="pt-2.5 pb-2 px-4 border-b border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200 shrink-0">
              <div className="w-10 h-1.5 bg-[#38495e] dark:bg-[#38495e] bg-slate-300 rounded-full mx-auto mb-2.5" />
              <div className="flex items-center justify-between">
                <h2 className="font-display font-bold text-sm text-[#dae3f1] dark:text-[#dae3f1] text-slate-900">
                  {activeSheet === 'tools' && 'CAD & MEP Drafting Tools'}
                  {activeSheet === 'modules' && 'Engineering Views & Modules'}
                  {activeSheet === 'tree' && 'Model Tree, Layers & Issues'}
                  {activeSheet === 'inspect' && 'Element Inspector & Copilot AI'}
                  {activeSheet === 'menu' && 'Project Actions & Settings'}
                </h2>
                <button
                  type="button"
                  onClick={() => setActiveSheet('none')}
                  aria-label="Close sheet"
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#8b9cb2] hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sheet Body */}
            {activeSheet === 'tools' && (
              <div className="p-4 space-y-4 overflow-y-auto">
                {/* Discipline Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {(Object.keys(RIBBON_TOOLS) as RibbonTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setRibbonTab(tab)}
                      className={`px-3 min-h-[40px] rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                        ribbonTab === tab
                          ? 'bg-[#00d2ff] text-[#0b1118] font-bold'
                          : 'bg-[#17202b] dark:bg-[#17202b] bg-slate-100 text-[#bbc9cf] dark:text-[#bbc9cf] text-slate-700'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Tool Buttons Grid (Touch Targets >= 44px) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {RIBBON_TOOLS[ribbonTab].map((tool) => {
                    const isViewBtn = tool.id.startsWith('VIEW:');
                    const active = !isViewBtn && activeTool === tool.id;
                    return (
                      <button
                        key={tool.id + tool.label}
                        type="button"
                        onClick={() => {
                          if (isViewBtn) {
                            const targetMode = tool.id.replace('VIEW:', '') as WorkspaceViewMode;
                            setViewMode(targetMode);
                          } else {
                            setActiveTool(tool.id as ActiveTool);
                            if (viewMode !== '2D' && viewMode !== 'SPLIT') {
                              setViewMode('2D');
                            }
                          }
                          setActiveSheet('none');
                        }}
                        className={`min-h-[46px] px-3 py-2 rounded-2xl border text-xs font-medium text-left flex items-center justify-between transition-colors ${
                          active
                            ? 'bg-[#00d2ff] text-[#0b1118] border-[#00d2ff] font-bold'
                            : isViewBtn
                              ? 'bg-[#1b2636] text-[#69f6b9] border-[#10b981]/40'
                              : 'bg-[#17202b] dark:bg-[#17202b] bg-slate-100 text-[#dae3f1] dark:text-[#dae3f1] text-slate-900 border-[#2c3f58] dark:border-[#2c3f58] border-slate-200'
                        }`}
                      >
                        <span className="truncate">{tool.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Drafting Aids */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200">
                  <button
                    type="button"
                    onClick={() => setSnapMode((v) => !v)}
                    className={`min-h-[44px] px-2 rounded-xl border text-xs font-mono-tech ${
                      snapMode ? 'border-[#10b981] text-[#10b981] bg-[#10b981]/10' : 'border-[#2c3f58] text-[#8b9cb2]'
                    }`}
                  >
                    SNAP {snapMode ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrthoMode((v) => !v)}
                    className={`min-h-[44px] px-2 rounded-xl border text-xs font-mono-tech ${
                      orthoMode ? 'border-[#00d2ff] text-[#00d2ff] bg-[#00d2ff]/10' : 'border-[#2c3f58] text-[#8b9cb2]'
                    }`}
                  >
                    ORTHO {orthoMode ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClashes((v) => !v)}
                    className={`min-h-[44px] px-2 rounded-xl border text-xs font-mono-tech flex items-center justify-center gap-1 ${
                      showClashes ? 'border-[#ef4444] text-[#ef4444] bg-[#ef4444]/10' : 'border-[#2c3f58] text-[#8b9cb2]'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" /> {clashes.length}
                  </button>
                </div>

                {/* Mobile Command Console Input */}
                <form onSubmit={handleCommandSubmit} className="flex items-center gap-2 pt-2 border-t border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200">
                  <Terminal className="w-4 h-4 text-[#00d2ff] shrink-0" />
                  <input
                    type="text"
                    value={cmdInput}
                    onChange={(e) => setCmdInput(e.target.value)}
                    placeholder="CAD command (WALL, DUCT, CALC, HELP)..."
                    aria-label="Mobile CAD Command Console"
                    className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#0b1118] dark:bg-[#0b1118] bg-slate-100 border border-[#2c3f58] text-xs font-mono-tech text-[#dae3f1] dark:text-[#dae3f1] text-slate-900"
                  />
                  <button
                    type="submit"
                    className="min-h-[42px] px-3 rounded-xl bg-[#00d2ff] text-[#0b1118] text-xs font-bold"
                  >
                    Run
                  </button>
                </form>
              </div>
            )}

            {activeSheet === 'modules' && (
              <div className="p-4 space-y-2.5 overflow-y-auto">
                {(
                  [
                    ['SPLIT', 'Split 2D Plan + 3D BIM', 'View floor plan & 3D model together'],
                    ['CALCULATIONS', 'Engineering Calculations', 'HVAC loads, duct sizing, IEC voltage drop & hydraulics'],
                    ['ENERGY', 'Energy Rating & Solar', 'Annual kWh, EUI benchmark, CO2 & envelope heat gains'],
                    ['CLASH', `3D Clash Detection (${clashes.length})`, 'Inspect structural vs MEP interferences & auto-resolve'],
                    ['BOQ', 'Quantity Takeoff & BOQ', 'Multi-currency bills of quantities & CSV export'],
                    ['SHEETS', 'Drawing Sheets & Schedules', 'ISO A0–A4 Title Block & printable schedules'],
                  ] as const
                ).map(([m, title, desc]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setViewMode(m);
                      setActiveSheet('none');
                    }}
                    className={`w-full min-h-[58px] px-4 py-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors ${
                      viewMode === m
                        ? 'bg-[#00d2ff]/15 border-[#00d2ff] text-[#00d2ff]'
                        : 'bg-[#17202b] dark:bg-[#17202b] bg-slate-100 border-[#2c3f58] dark:border-[#2c3f58] border-slate-200 text-[#dae3f1] dark:text-[#dae3f1] text-slate-900'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{title}</div>
                      <div className="text-xs text-[#8b9cb2] truncate">{desc}</div>
                    </div>
                    <Columns2 className="w-4 h-4 shrink-0 opacity-70" />
                  </button>
                ))}
              </div>
            )}

            {activeSheet === 'tree' && (
              <div className="flex-1 min-h-0 overflow-hidden h-[68vh]">
                <ProjectBrowser
                  project={project}
                  activeLevelId={activeLevelId}
                  onSetActiveLevel={setActiveLevelId}
                  onAddLevel={() => {
                    const idx = project.levels.length;
                    const newLvl = {
                      id: `lvl-0${idx}`,
                      name: `Level 0${idx} — Upper Deck`,
                      elevationM: Number((idx * 3.6).toFixed(1)),
                      heightM: 3.6,
                      visible: true,
                      locked: false,
                    };
                    commitProject((p) => ({ ...p, levels: [...p.levels, newLvl] }));
                    setActiveLevelId(newLvl.id);
                    notify(`Added ${newLvl.name} (+${newLvl.elevationM}m)`);
                  }}
                  onToggleLevelVis={(id) =>
                    commitProject((p) => ({
                      ...p,
                      levels: p.levels.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
                    }))
                  }
                  onIsolateLevel={(id) => {
                    commitProject((p) => ({
                      ...p,
                      levels: p.levels.map((l) => ({ ...l, visible: l.id === id })),
                    }));
                    setActiveLevelId(id);
                  }}
                  selectedIds={selectedIds}
                  onSelectIds={(ids) => {
                    setSelectedIds(ids);
                    setActiveSheet('none');
                  }}
                  onToggleElementVis={(id) =>
                    commitProject((p) => ({
                      ...p,
                      elements: p.elements.map((e) => (e.id === id ? { ...e, visible: !e.visible } : e)),
                    }))
                  }
                  onToggleElementLock={(id) =>
                    commitProject((p) => ({
                      ...p,
                      elements: p.elements.map((e) => (e.id === id ? { ...e, locked: !e.locked } : e)),
                    }))
                  }
                  onDeleteElements={handleDeleteElements}
                  onToggleLayerVis={(id) =>
                    commitProject((p) => ({
                      ...p,
                      layers: p.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
                    }))
                  }
                  onToggleLayerLock={(id) =>
                    commitProject((p) => ({
                      ...p,
                      layers: p.layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)),
                    }))
                  }
                  onUpdateIssueStatus={(id, status) =>
                    commitProject((p) => ({
                      ...p,
                      issues: p.issues.map((i) => (i.id === id ? { ...i, status } : i)),
                    }))
                  }
                  onLocatePoint={(x, y, lvlId) => {
                    setActiveLevelId(lvlId);
                    setFocus2D({ x, y });
                    setViewMode('2D');
                    setActiveSheet('none');
                  }}
                  versions={versions}
                  onCreateSnapshot={async (desc) => {
                    const snap: VersionSnapshot = {
                      id: `ver-${Date.now()}`,
                      version: `v1.${versions.length + 1}`,
                      timestamp: new Date().toISOString(),
                      author: project.branding.designerName,
                      description: desc,
                      elementCount: project.elements.length,
                      dataJson: JSON.stringify(project),
                    };
                    await saveVersionSnapshot(snap);
                    setVersions((prev) => [snap, ...prev]);
                    notify(`Committed version ${snap.version}`);
                  }}
                  onRestoreSnapshot={(snap) => {
                    try {
                      const parsed = JSON.parse(snap.dataJson) as BIMProject;
                      setProject(parsed);
                      notify(`Restored ${snap.version}`);
                    } catch {
                      notify('Could not restore version snapshot');
                    }
                  }}
                />
              </div>
            )}

            {activeSheet === 'inspect' && (
              <div className="flex-1 min-h-0 overflow-hidden h-[70vh]">
                <InspectorAndCopilot
                  project={project}
                  selectedIds={selectedIds}
                  onUpdateElement={handleUpdateElement}
                  onDuplicateElement={handleDuplicateElement}
                  onDeleteElements={handleDeleteElements}
                  clashes={clashes}
                  onRunAIAutomate={() => {
                    setActiveSheet('none');
                    setShowAIAutomate(true);
                  }}
                />
              </div>
            )}

            {activeSheet === 'menu' && (
              <div className="p-4 space-y-3 overflow-y-auto">
                <PWAInstallButton variant="menu" />
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSheet('none');
                      setShowWizard(true);
                    }}
                    className="min-h-[48px] px-3 rounded-2xl bg-[#17202b] dark:bg-[#17202b] bg-slate-100 border border-[#2c3f58] dark:border-[#2c3f58] border-slate-200 flex items-center gap-2.5 text-xs font-medium text-[#dae3f1] dark:text-[#dae3f1] text-slate-900"
                  >
                    <FilePlus2 className="w-4 h-4 text-[#00d2ff]" /> New Project
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSaveCloud();
                      setActiveSheet('none');
                    }}
                    className="min-h-[48px] px-3 rounded-2xl bg-[#17202b] dark:bg-[#17202b] bg-slate-100 border border-[#2c3f58] dark:border-[#2c3f58] border-slate-200 flex items-center gap-2.5 text-xs font-medium text-[#dae3f1] dark:text-[#dae3f1] text-slate-900"
                  >
                    <Save className="w-4 h-4 text-[#10b981]" /> Save ({syncStatus})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSheet('none');
                      dxfInputRef.current?.click();
                    }}
                    className="min-h-[48px] px-3 rounded-2xl bg-[#17202b] dark:bg-[#17202b] bg-slate-100 border border-[#2c3f58] dark:border-[#2c3f58] border-slate-200 flex items-center gap-2.5 text-xs font-medium text-[#dae3f1] dark:text-[#dae3f1] text-slate-900"
                  >
                    <Upload className="w-4 h-4 text-[#bbc9cf]" /> Import DXF / JSON
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSheet('none');
                      setShowLibrary(true);
                    }}
                    className="min-h-[48px] px-3 rounded-2xl bg-[#17202b] dark:bg-[#17202b] bg-slate-100 border border-[#2c3f58] dark:border-[#2c3f58] border-slate-200 flex items-center gap-2.5 text-xs font-medium text-[#dae3f1] dark:text-[#dae3f1] text-slate-900"
                  >
                    <Database className="w-4 h-4 text-[#00d2ff]" /> Material &amp; Equip DB
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitProject((p) => ({
                        ...p,
                        unitSystem: p.unitSystem === 'metric' ? 'imperial' : 'metric',
                      }))
                    }
                    className="min-h-[48px] px-3 rounded-2xl bg-[#17202b] dark:bg-[#17202b] bg-slate-100 border border-[#2c3f58] dark:border-[#2c3f58] border-slate-200 flex items-center justify-between text-xs font-mono-tech text-[#dae3f1] dark:text-[#dae3f1] text-slate-900"
                  >
                    <span>Units</span>
                    <span className="text-[#00d2ff] font-bold">
                      {project.unitSystem === 'metric' ? 'SI (m)' : 'IMP (ft)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDarkMode((d) => !d)}
                    className="min-h-[48px] px-3 rounded-2xl bg-[#17202b] dark:bg-[#17202b] bg-slate-100 border border-[#2c3f58] dark:border-[#2c3f58] border-slate-200 flex items-center justify-between text-xs font-medium text-[#dae3f1] dark:text-[#dae3f1] text-slate-900"
                  >
                    <span>Theme</span>
                    {darkMode ? <Sun className="w-4 h-4 text-[#ffb86b]" /> : <Moon className="w-4 h-4 text-[#00d2ff]" />}
                  </button>
                </div>

                <div className="pt-2 border-t border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200 space-y-2">
                  <div className="text-[11px] font-mono-tech text-[#8b9cb2]">Export Project</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        downloadTextFile(`${project.projectNumber}.dxf`, exportProjectToDXF(project));
                        setActiveSheet('none');
                        notify('Exported AutoCAD DXF');
                      }}
                      className="min-h-[44px] px-2 rounded-xl bg-[#17202b] border border-[#2c3f58] text-xs font-mono-tech text-[#ffb86b] flex items-center justify-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> DXF
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        downloadTextFile(`${project.projectNumber}.ifc`, exportProjectToIFC(project));
                        setActiveSheet('none');
                        notify('Exported OpenBIM IFC4 (.ifc)');
                      }}
                      className="min-h-[44px] px-2 rounded-xl bg-[#17202b] border border-[#2c3f58] text-xs font-mono-tech text-[#00d2ff] flex items-center justify-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> IFC4
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        downloadTextFile(`${project.projectNumber}.json`, JSON.stringify(project, null, 2), 'application/json');
                        setActiveSheet('none');
                        notify('Exported BIM Project JSON');
                      }}
                      className="min-h-[44px] px-2 rounded-xl bg-[#17202b] border border-[#2c3f58] text-xs font-mono-tech text-[#69f6b9] flex items-center justify-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" /> JSON
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveSheet('none');
                    setShowAdmin(true);
                  }}
                  className="w-full min-h-[48px] px-4 rounded-2xl bg-[#17202b] dark:bg-[#17202b] bg-slate-100 border border-[#2c3f58] dark:border-[#2c3f58] border-slate-200 flex items-center justify-between text-xs font-medium text-[#dae3f1] dark:text-[#dae3f1] text-slate-900"
                >
                  <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-[#8b9cb2]" /> Admin &amp; Company Branding
                  </span>
                  <span className="font-mono-tech text-[11px] text-[#69f6b9]">{peerCount} active</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <OfflineIndicator />

      {/* Toast Feedback */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-16 right-4 z-50 px-3.5 py-2 rounded-xl bg-[#17202b] border border-[#00d2ff] text-xs font-mono-tech text-[#a5e7ff] shadow-lg"
        >
          {toast}
        </div>
      )}

      {/* Modals */}
      {showWizard && (
        <NewProjectModal
          onClose={() => setShowWizard(false)}
          onCreate={(newProj) => {
            setProject(newProj);
            setActiveLevelId(newProj.levels[0].id);
            setSelectedIds([]);
            setUndoStack([]);
            setRedoStack([]);
            notify(`Created project: ${newProj.name}`);
          }}
        />
      )}
      {showLibrary && <LibraryModal onClose={() => setShowLibrary(false)} />}
      {showAdmin && (
        <AdminModal
          project={project}
          onUpdateProjectMeta={(patch) => commitProject((p) => ({ ...p, ...patch }))}
          onClose={() => setShowAdmin(false)}
        />
      )}
      {showSearch && (
        <GlobalSearchModal
          project={project}
          onSelectElement={(id, lvlId) => {
            setActiveLevelId(lvlId);
            setSelectedIds([id]);
          }}
          onClose={() => setShowSearch(false)}
        />
      )}
      {showAIAutomate && (
        <AIAutomateModal
          onClose={() => setShowAIAutomate(false)}
          onApplyAll={applyAIAutomate}
          summaryActions={aiAutomatePlan}
        />
      )}
    </div>
  );
}
