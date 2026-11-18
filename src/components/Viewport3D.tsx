import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BIMProject,
  Camera3DView,
  ClashItem,
  EquipmentElement,
  LinearMEPElement,
  Visual3DMode,
} from '../types/bim';

interface Viewport3DProps {
  project: BIMProject;
  selectedIds: string[];
  onSelectIds: (ids: string[]) => void;
  clashes: ClashItem[];
  showClashes: boolean;
  darkMode: boolean;
  focusClash?: ClashItem | null;
}

// Module-scope scratch math helpers (zero GC inside render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

function createProceduralGridBumpTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    const v = 108 + ((i * 29) % 44);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.strokeStyle = '#606060';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.anisotropy = anisotropy;
  return tex;
}

function createBrushedMetalTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#909090';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) {
    const shade = 128 + ((y * 19) % 36);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    ctx.fillRect(0, y, 256, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = anisotropy;
  return tex;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  project,
  selectedIds,
  onSelectIds,
  clashes,
  showClashes,
  darkMode,
  focusClash,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [visualMode, setVisualMode] = useState<Visual3DMode>('realistic');
  const [cameraView, setCameraView] = useState<Camera3DView>('3d');
  const [sectionY, setSectionY] = useState<number>(12.5);
  const [sectionX, setSectionX] = useState<number>(22);
  const [solarHour, setSolarHour] = useState<number>(13);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false,
  );
  const [webglError, setWebglError] = useState<string | null>(null);

  // Refs synced to Three.js engine so React updates never tear down the renderer
  const projectRef = useRef(project);
  projectRef.current = project;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const onSelectRef = useRef(onSelectIds);
  onSelectRef.current = onSelectIds;
  const clashesRef = useRef(clashes);
  clashesRef.current = clashes;
  const showClashesRef = useRef(showClashes);
  showClashesRef.current = showClashes;
  const visualModeRef = useRef(visualMode);
  visualModeRef.current = visualMode;
  const darkModeRef = useRef(darkMode);
  darkModeRef.current = darkMode;

  const engineRef = useRef<{
    rebuildScene: () => void;
    requestRender: () => void;
    applyCameraPreset: (view: Camera3DView) => void;
    updateSectionPlanes: (sx: number, sy: number) => void;
    updateSolarAngle: (hour: number) => void;
    focusAt: (x: number, y: number, z: number) => void;
  } | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Software WebGL probe (SwiftShader / llvmpipe / headless verification path)
    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      setWebglError(err instanceof Error ? err.message : 'WebGL initialization failed');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    renderer.setSize(w, h);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('WebGL context lost — awaiting GPU restore.');
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);

    const scene = new THREE.Scene();
    const bgHex = darkModeRef.current ? 0x0b1118 : 0xeef2f6;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.011);

    // Mandatory studio environment reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 250);
    camera.position.set(29, 21, 31);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(9, 3.0, 6);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.495;
    controls.minDistance = 4;
    controls.maxDistance = 85;
    controls.update();

    // 3-Point Studio + Solar Lighting Rig (warm key + cool hemisphere fill)
    const hemiLight = new THREE.HemisphereLight(0x88c8ff, 0x1e293b, 0.75);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.1);
    keyLight.position.set(24, 32, 20);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.left = -22;
    keyLight.shadow.camera.right = 22;
    keyLight.shadow.camera.top = 22;
    keyLight.shadow.camera.bottom = -22;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 85;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    keyLight.target.position.set(9, 0, 6);
    scene.add(keyLight.target);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x00d2ff, 0.55);
    rimLight.position.set(-20, 14, -18);
    scene.add(rimLight);

    // Ground site pad + grid
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const concreteBump = createProceduralGridBumpTexture(maxAniso);
    const metalBump = createBrushedMetalTexture(maxAniso);

    const groundGroup = new THREE.Group();
    const groundMat = new THREE.MeshStandardMaterial({
      color: darkModeRef.current ? 0x101822 : 0xdbe3ec,
      roughness: 0.9,
      metalness: 0.05,
      bumpMap: concreteBump,
      bumpScale: 0.015,
    });
    const groundPlane = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), groundMat);
    groundPlane.rotation.x = -Math.PI / 2;
    groundPlane.position.set(9, -0.02, 6);
    groundPlane.receiveShadow = true;
    groundGroup.add(groundPlane);

    const gridHelper = new THREE.GridHelper(60, 60, 0x1e3a5f, 0x182536);
    gridHelper.position.set(9, 0.005, 6);
    const gridMat = gridHelper.material as THREE.Material;
    gridMat.polygonOffset = true;
    gridMat.polygonOffsetFactor = -1;
    gridMat.polygonOffsetUnits = -1;
    groundGroup.add(gridHelper);
    scene.add(groundGroup);

    // Clipping Planes for interactive Section Box (X & Y)
    const clipX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 22);
    const clipY = new THREE.Plane(new THREE.Vector3(0, -1, 0), 12.5);
    const activeClips = [clipX, clipY];

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);

    const interactables: THREE.Object3D[] = [];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    // On-demand coalesced rendering + software-WebGL afterDraw pacing
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let camAnimTargetPos: THREE.Vector3 | null = null;
    let camAnimTargetLook: THREE.Vector3 | null = null;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        if (camAnimTargetPos && camAnimTargetLook) {
          camera.position.lerp(camAnimTargetPos, 0.22);
          controls.target.lerp(camAnimTargetLook, 0.22);
          if (camera.position.distanceTo(camAnimTargetPos) < 0.08) {
            camera.position.copy(camAnimTargetPos);
            controls.target.copy(camAnimTargetLook);
            camAnimTargetPos = null;
            camAnimTargetLook = null;
          } else {
            renderDirty = true;
          }
        }
        controls.update();
        renderer.render(scene, camera);
        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    controls.addEventListener('start', () => {
      camAnimTargetPos = null;
      camAnimTargetLook = null;
    });
    controls.addEventListener('change', () => requestRender());

    // Helper: Build composite 3-12 part procedural Equipment Group
    function buildCompositeEquipment(eq: EquipmentElement, baseElevation: number, isSelected: boolean, mode: Visual3DMode): THREE.Group {
      const grp = new THREE.Group();
      const w = eq.widthM;
      const d = eq.depthM;
      const h = eq.heightM;
      const isWire = mode === 'wireframe';
      const isXray = mode === 'xray';

      const colorMap: Record<string, number> = {
        HVAC: 0x00a8cc,
        Electrical: 0xe68a00,
        Plumbing: 0x10b981,
        'Fire Protection': 0xdc2626,
        Gas: 0xeab308,
        Elevator: 0x6366f1,
      };
      const primaryHex = isSelected ? 0x00d2ff : colorMap[eq.category] || 0x00a8cc;

      const bodyMat = new THREE.MeshStandardMaterial({
        color: primaryHex,
        roughness: 0.45,
        metalness: 0.35,
        bumpMap: metalBump,
        bumpScale: 0.01,
        wireframe: isWire,
        transparent: isXray,
        opacity: isXray ? 0.45 : 1,
        clippingPlanes: activeClips,
        emissive: isSelected ? 0x004466 : 0x000000,
      });

      const skidMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.85,
        metalness: 0.55,
        wireframe: isWire,
        clippingPlanes: activeClips,
      });

      const trimMat = new THREE.MeshStandardMaterial({
        color: 0xdbe3ec,
        roughness: 0.2,
        metalness: 0.85,
        wireframe: isWire,
        clippingPlanes: activeClips,
      });

      // 1. Base structural skid (grounded at y=0 local)
      const skid = new THREE.Mesh(new THREE.BoxGeometry(w * 1.04, 0.12, d * 1.04), skidMat);
      skid.position.y = 0.06;
      skid.castShadow = true;
      grp.add(skid);

      // 2. Primary insulated housing / cabinet
      const bodyH = Math.max(0.15, h - 0.18);
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), bodyMat);
      body.position.y = 0.12 + bodyH / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      grp.add(body);

      // 3. Discipline-specific secondary & accent details (3-8 sub-parts)
      if (eq.kind === 'chiller') {
        // Condenser fan shrouds on top + twin compressor cylinders
        for (let i = -1; i <= 1; i += 2) {
          const fanShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.28, 16), skidMat);
          fanShroud.position.set((i * w) / 4, h + 0.05, 0);
          grp.add(fanShroud);
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.3, 12), trimMat);
          hub.position.set((i * w) / 4, h + 0.06, 0);
          grp.add(hub);
        }
        const headerPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, w * 0.85, 12), trimMat);
        headerPipe.rotation.z = Math.PI / 2;
        headerPipe.position.set(0, h * 0.4, d * 0.54);
        grp.add(headerPipe);
      } else if (eq.kind === 'ahu') {
        // Intake louver + duct discharge collar + control box
        const collar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.25), trimMat);
        collar.position.set(w * 0.25, h * 0.6, d * 0.58);
        grp.add(collar);
        const ctrlBox = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.14), skidMat);
        ctrlBox.position.set(-w * 0.3, h * 0.5, d * 0.54);
        grp.add(ctrlBox);
      } else if (eq.kind === 'panel' || eq.kind === 'transformer') {
        // Cooling fins / breaker bezel + top busbar trunk
        const bezel = new THREE.Mesh(new THREE.BoxGeometry(w * 0.85, bodyH * 0.8, 0.06), skidMat);
        bezel.position.set(0, h * 0.5, d * 0.52);
        grp.add(bezel);
        const busTrunk = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.22, d * 0.5), trimMat);
        busTrunk.position.set(0, h + 0.05, 0);
        grp.add(busTrunk);
      } else if (eq.kind === 'tank') {
        // Manway hatch + sight gauge + top flange
        const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.18, 16), trimMat);
        hatch.position.set(0, h + 0.04, 0);
        grp.add(hatch);
        const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 12), skidMat);
        flange.rotation.x = Math.PI / 2;
        flange.position.set(w * 0.3, 0.4, d * 0.55);
        grp.add(flange);
      } else {
        // Top collar / nameplate accent
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.08, d * 0.7), trimMat);
        cap.position.y = h - 0.02;
        grp.add(cap);
      }

      grp.position.set(eq.position.x, baseElevation + eq.elevationOffsetM, eq.position.y);
      grp.rotation.y = -(eq.rotationDeg * Math.PI) / 180;
      grp.userData.elementId = eq.id;
      grp.traverse((child) => {
        child.userData.elementId = eq.id;
      });
      return grp;
    }

    function rebuildScene() {
      // Clear previous meshes & dispose geometries/materials cleanly
      while (modelGroup.children.length > 0) {
        const child = modelGroup.children[0];
        modelGroup.remove(child);
        child.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.geometry.dispose();
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material.dispose();
          }
        });
      }
      interactables.length = 0;

      const proj = projectRef.current;
      const mode = visualModeRef.current;
      const isWire = mode === 'wireframe';
      const isXray = mode === 'xray';
      const isHidden = mode === 'hidden';
      const sel = new Set(selectedIdsRef.current);
      const levelMap = new Map(proj.levels.map((l) => [l.id, l]));
      const layerMap = new Map(proj.layers.map((l) => [l.id, l]));

      // Update bg / fog for theme
      const bg = darkModeRef.current ? 0x0b1118 : 0xeef2f6;
      (scene.background as THREE.Color).setHex(bg);
      if (scene.fog instanceof THREE.FogExp2) scene.fog.color.setHex(bg);

      proj.elements.forEach((el) => {
        if (!el.visible) return;
        const lvl = levelMap.get(el.levelId);
        if (lvl && !lvl.visible) return;
        const lay = layerMap.get(el.layerId);
        if (lay && !lay.visible) return;

        const baseY = lvl ? lvl.elevationM : 0;
        const isSelected = sel.has(el.id);

        if (el.kind === 'slab' || el.kind === 'roof') {
          if (el.points.length < 3) return;
          const shape = new THREE.Shape();
          el.points.forEach((p, idx) => {
            if (idx === 0) shape.moveTo(p.x, -p.y);
            else shape.lineTo(p.x, -p.y);
          });
          shape.closePath();
          const geo = new THREE.ExtrudeGeometry(shape, { depth: el.thicknessM, bevelEnabled: false });
          geo.rotateX(-Math.PI / 2);

          const mat = new THREE.MeshStandardMaterial({
            color: isSelected ? 0x00d2ff : el.kind === 'roof' ? 0x243348 : 0x334155,
            roughness: el.kind === 'roof' ? 0.55 : 0.88,
            metalness: el.kind === 'roof' ? 0.45 : 0.08,
            bumpMap: concreteBump,
            bumpScale: 0.02,
            wireframe: isWire,
            transparent: isXray,
            opacity: isXray ? 0.25 : 1,
            clippingPlanes: activeClips,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.y = el.kind === 'roof' ? baseY : baseY - el.thicknessM;
          mesh.receiveShadow = true;
          mesh.castShadow = true;
          mesh.userData.elementId = el.id;
          modelGroup.add(mesh);
          interactables.push(mesh);
        } else if (el.kind === 'wall') {
          const dx = el.end.x - el.start.x;
          const dy = el.end.y - el.start.y;
          const len = Math.hypot(dx, dy);
          if (len < 0.05) return;
          const angle = Math.atan2(dy, dx);

          const wallGrp = new THREE.Group();
          const isCurtain = el.wallType === 'curtain';

          // Composite 3-part wall: concrete plinth + wall body + parapet/top cap
          const bodyMatOptions: THREE.MeshStandardMaterialParameters = {
            color: isSelected ? 0x00d2ff : isCurtain ? 0x38bdf8 : isHidden ? 0xdbe3ec : 0x475569,
            roughness: isCurtain ? 0.12 : 0.85,
            metalness: isCurtain ? 0.25 : 0.05,
            wireframe: isWire,
            transparent: isCurtain || isXray,
            opacity: isXray ? 0.22 : isCurtain ? 0.42 : 1,
            depthWrite: !(isCurtain || isXray),
            clippingPlanes: activeClips,
          };
          if (!isCurtain) {
            bodyMatOptions.bumpMap = concreteBump;
            bodyMatOptions.bumpScale = 0.02;
          }
          const bodyMat = new THREE.MeshStandardMaterial(bodyMatOptions);
          const capMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.45,
            metalness: 0.5,
            wireframe: isWire,
            clippingPlanes: activeClips,
          });

          const plinth = new THREE.Mesh(new THREE.BoxGeometry(len, 0.14, el.thicknessM + 0.04), capMat);
          plinth.position.y = 0.07;
          wallGrp.add(plinth);

          const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(len, el.heightM - 0.22, el.thicknessM), bodyMat);
          wallMesh.position.y = 0.14 + (el.heightM - 0.22) / 2;
          wallMesh.castShadow = !isCurtain;
          wallMesh.receiveShadow = true;
          wallGrp.add(wallMesh);

          const topCap = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, el.thicknessM + 0.03), capMat);
          topCap.position.y = el.heightM - 0.04;
          wallGrp.add(topCap);

          wallGrp.position.set((el.start.x + el.end.x) / 2, baseY, (el.start.y + el.end.y) / 2);
          wallGrp.rotation.y = -angle;
          wallGrp.traverse((c) => {
            c.userData.elementId = el.id;
          });
          modelGroup.add(wallGrp);
          interactables.push(wallGrp);
        } else if (el.kind === 'door' || el.kind === 'window') {
          const host = proj.elements.find((w) => w.id === el.hostWallId);
          if (!host || host.kind !== 'wall') return;
          const dx = host.end.x - host.start.x;
          const dy = host.end.y - host.start.y;
          const angle = Math.atan2(dy, dx);
          const cx = host.start.x + dx * el.offsetRatio;
          const cy = host.start.y + dy * el.offsetRatio;

          const openGrp = new THREE.Group();
          const frameMat = new THREE.MeshStandardMaterial({
            color: isSelected ? 0x00d2ff : 0xcbd5e1,
            roughness: 0.3,
            metalness: 0.8,
            wireframe: isWire,
            clippingPlanes: activeClips,
          });
          const panelMat = new THREE.MeshStandardMaterial({
            color: el.kind === 'window' ? 0x7dd3fc : 0xb45309,
            roughness: el.kind === 'window' ? 0.08 : 0.55,
            metalness: el.kind === 'window' ? 0.15 : 0.2,
            transparent: el.kind === 'window',
            opacity: el.kind === 'window' ? 0.52 : 1,
            wireframe: isWire,
            clippingPlanes: activeClips,
          });

          // 4-part frame (left jamb, right jamb, head) + leaf/glass
          const jambThick = host.thicknessM + 0.06;
          const leftJ = new THREE.Mesh(new THREE.BoxGeometry(0.08, el.heightM, jambThick), frameMat);
          leftJ.position.set(-el.widthM / 2, el.heightM / 2, 0);
          openGrp.add(leftJ);

          const rightJ = new THREE.Mesh(new THREE.BoxGeometry(0.08, el.heightM, jambThick), frameMat);
          rightJ.position.set(el.widthM / 2, el.heightM / 2, 0);
          openGrp.add(rightJ);

          const head = new THREE.Mesh(new THREE.BoxGeometry(el.widthM + 0.08, 0.08, jambThick), frameMat);
          head.position.set(0, el.heightM, 0);
          openGrp.add(head);

          const leaf = new THREE.Mesh(new THREE.BoxGeometry(el.widthM - 0.08, el.heightM - 0.06, 0.05), panelMat);
          leaf.position.set(0, el.heightM / 2, 0);
          openGrp.add(leaf);

          openGrp.position.set(cx, baseY + el.sillHeightM, cy);
          openGrp.rotation.y = -angle;
          openGrp.traverse((c) => {
            c.userData.elementId = el.id;
          });
          modelGroup.add(openGrp);
          interactables.push(openGrp);
        } else if (el.kind === 'column') {
          const colGrp = new THREE.Group();
          const steelMat = new THREE.MeshStandardMaterial({
            color: isSelected ? 0x00d2ff : 0x3b82f6,
            roughness: 0.35,
            metalness: 0.78,
            bumpMap: metalBump,
            bumpScale: 0.01,
            wireframe: isWire,
            clippingPlanes: activeClips,
          });
          // Base plate + column shaft + cap plate
          const basePlate = new THREE.Mesh(new THREE.BoxGeometry(el.widthM * 1.4, 0.06, el.depthM * 1.4), steelMat);
          basePlate.position.y = 0.03;
          colGrp.add(basePlate);
          const shaft = new THREE.Mesh(new THREE.BoxGeometry(el.widthM, el.heightM - 0.1, el.depthM), steelMat);
          shaft.position.y = el.heightM / 2;
          shaft.castShadow = true;
          colGrp.add(shaft);
          const capPlate = new THREE.Mesh(new THREE.BoxGeometry(el.widthM * 1.3, 0.05, el.depthM * 1.3), steelMat);
          capPlate.position.y = el.heightM - 0.025;
          colGrp.add(capPlate);

          colGrp.position.set(el.start.x, baseY, el.start.y);
          colGrp.traverse((c) => {
            c.userData.elementId = el.id;
          });
          modelGroup.add(colGrp);
          interactables.push(colGrp);
        } else if (el.kind === 'beam' && el.end) {
          const dx = el.end.x - el.start.x;
          const dy = el.end.y - el.start.y;
          const len = Math.hypot(dx, dy);
          if (len < 0.05) return;
          const beamMat = new THREE.MeshStandardMaterial({
            color: isSelected ? 0x00d2ff : 0x60a5fa,
            roughness: 0.35,
            metalness: 0.78,
            wireframe: isWire,
            clippingPlanes: activeClips,
          });
          const beam = new THREE.Mesh(new THREE.BoxGeometry(len, el.heightM, el.widthM), beamMat);
          beam.position.set((el.start.x + el.end.x) / 2, baseY + el.elevationOffsetM + el.heightM / 2, (el.start.y + el.end.y) / 2);
          beam.rotation.y = -Math.atan2(dy, dx);
          beam.castShadow = true;
          beam.userData.elementId = el.id;
          modelGroup.add(beam);
          interactables.push(beam);
        } else if (
          el.kind === 'duct' ||
          el.kind === 'cable' ||
          el.kind === 'cold_pipe' ||
          el.kind === 'hot_pipe' ||
          el.kind === 'drain_pipe' ||
          el.kind === 'fire_pipe' ||
          el.kind === 'gas_pipe'
        ) {
          const mep = el as LinearMEPElement;
          const dx = mep.end.x - mep.start.x;
          const dy = mep.end.y - mep.start.y;
          const len = Math.hypot(dx, dy);
          if (len < 0.05) return;

          const colorMap: Record<string, number> = {
            duct: 0x00d2ff,
            cable: 0xff9f1c,
            cold_pipe: 0x10b981,
            hot_pipe: 0xf97316,
            drain_pipe: 0xa78bfa,
            fire_pipe: 0xef4444,
            gas_pipe: 0xeab308,
          };
          const mat = new THREE.MeshStandardMaterial({
            color: isSelected ? 0xffffff : colorMap[mep.kind] || 0x00d2ff,
            roughness: 0.3,
            metalness: 0.65,
            wireframe: isWire,
            clippingPlanes: activeClips,
          });

          const mepGrp = new THREE.Group();
          if (mep.kind === 'duct') {
            const wM = (mep.widthMm || 400) / 1000;
            const hM = (mep.heightMm || 250) / 1000;
            const ductMesh = new THREE.Mesh(new THREE.BoxGeometry(len, hM, wM), mat);
            mepGrp.add(ductMesh);
            // Flange collars
            for (const xOff of [-len / 2 + 0.05, 0, len / 2 - 0.05]) {
              const flange = new THREE.Mesh(new THREE.BoxGeometry(0.05, hM + 0.06, wM + 0.06), mat);
              flange.position.x = xOff;
              mepGrp.add(flange);
            }
          } else {
            const rad = Math.max(0.035, (mep.pipeDiaMm || 45) / 2000);
            const pipeGeo = new THREE.CylinderGeometry(rad, rad, len, 12);
            pipeGeo.rotateZ(Math.PI / 2);
            const pipeMesh = new THREE.Mesh(pipeGeo, mat);
            mepGrp.add(pipeMesh);
          }

          mepGrp.position.set((mep.start.x + mep.end.x) / 2, baseY + mep.elevationOffsetM, (mep.start.y + mep.end.y) / 2);
          mepGrp.rotation.y = -Math.atan2(dy, dx);
          mepGrp.traverse((c) => {
            c.userData.elementId = mep.id;
          });
          modelGroup.add(mepGrp);
          interactables.push(mepGrp);
        } else if ('position' in el) {
          const eqGrp = buildCompositeEquipment(el as EquipmentElement, baseY, isSelected, mode);
          modelGroup.add(eqGrp);
          interactables.push(eqGrp);
        }
      });

      // 3D Clash Highlight Spheres
      if (showClashesRef.current) {
        clashesRef.current.forEach((c) => {
          const clashMat = new THREE.MeshStandardMaterial({
            color: c.severity === 'Critical' ? 0xef4444 : 0xff9f1c,
            emissive: c.severity === 'Critical' ? 0x991b1b : 0x92400e,
            roughness: 0.2,
            transparent: true,
            opacity: 0.78,
          });
          const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 1), clashMat);
          marker.position.set(c.location.x, c.location.z, c.location.y);
          marker.userData.elementId = c.elementAId;
          modelGroup.add(marker);
          interactables.push(marker);
        });
      }

      requestRender();
    }

    // Raycast click-to-select 3D BIM object
    let downX = 0;
    let downY = 0;
    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(interactables, true);
      if (hits.length > 0) {
        const eid = hits[0].object.userData.elementId as string | undefined;
        if (eid) onSelectRef.current([eid]);
      } else {
        onSelectRef.current([]);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // WASD Walk Mode support
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }
      const step = 0.9;
      camera.getWorldDirection(_v1);
      _v1.y = 0;
      _v1.normalize();
      _v2.crossVectors(_v1, camera.up).normalize();
      let moved = false;
      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') {
        camera.position.addScaledVector(_v1, step);
        controls.target.addScaledVector(_v1, step);
        moved = true;
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') {
        camera.position.addScaledVector(_v1, -step);
        controls.target.addScaledVector(_v1, -step);
        moved = true;
      } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        camera.position.addScaledVector(_v2, -step);
        controls.target.addScaledVector(_v2, -step);
        moved = true;
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        camera.position.addScaledVector(_v2, step);
        controls.target.addScaledVector(_v2, step);
        moved = true;
      }
      if (moved) requestRender();
    };
    window.addEventListener('keydown', onKeyDown);

    const onResize = () => {
      if (!container) return;
      const nw = container.clientWidth || 800;
      const nh = container.clientHeight || 600;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
      requestRender();
    };
    window.addEventListener('resize', onResize);
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);

    engineRef.current = {
      rebuildScene,
      requestRender,
      applyCameraPreset: (view: Camera3DView) => {
        const tgt = new THREE.Vector3(9, 3.0, 6);
        let pos = new THREE.Vector3(29, 21, 31);
        if (view === 'top') pos = new THREE.Vector3(9, 34, 6.05);
        else if (view === 'front') pos = new THREE.Vector3(9, 4.5, 32);
        else if (view === 'back') pos = new THREE.Vector3(9, 4.5, -20);
        else if (view === 'left') pos = new THREE.Vector3(-18, 4.5, 6);
        else if (view === 'right') pos = new THREE.Vector3(36, 4.5, 6);
        else if (view === 'walk') {
          pos = new THREE.Vector3(3.5, 1.75, 10.5);
          tgt.set(9, 1.75, 4);
        }
        if (isSoftwareGl) {
          camera.position.copy(pos);
          controls.target.copy(tgt);
          requestRender();
        } else {
          camAnimTargetPos = pos;
          camAnimTargetLook = tgt;
          requestRender();
        }
      },
      updateSectionPlanes: (sx: number, sy: number) => {
        clipX.constant = sx;
        clipY.constant = sy;
        requestRender();
      },
      updateSolarAngle: (hour: number) => {
        const sunAngle = ((hour - 6) / 12) * Math.PI;
        const elev = Math.max(0.25, Math.sin(sunAngle) * 32);
        const horiz = Math.cos(sunAngle) * 30;
        keyLight.position.set(9 + horiz, elev, 20);
        requestRender();
      },
      focusAt: (x: number, y: number, z: number) => {
        const tgt = new THREE.Vector3(x, z, y);
        const pos = new THREE.Vector3(x + 6.5, z + 4.5, y + 6.5);
        if (isSoftwareGl) {
          camera.position.copy(pos);
          controls.target.copy(tgt);
          requestRender();
        } else {
          camAnimTargetPos = pos;
          camAnimTargetLook = tgt;
          requestRender();
        }
      },
    };

    rebuildScene();
    if (!isSoftwareGl) renderer.compile(scene, camera);
    requestRender();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      controls.dispose();
      envTex.dispose();
      concreteBump.dispose();
      metalBump.dispose();
      renderer.dispose();
    };
  }, []);

  // Trigger scene rebuild when BIM model or visual settings update
  useEffect(() => {
    engineRef.current?.rebuildScene();
  }, [project, selectedIds, clashes, showClashes, visualMode, darkMode]);

  useEffect(() => {
    engineRef.current?.updateSectionPlanes(sectionX, sectionY);
  }, [sectionX, sectionY]);

  useEffect(() => {
    engineRef.current?.updateSolarAngle(solarHour);
  }, [solarHour]);

  useEffect(() => {
    if (focusClash) {
      engineRef.current?.focusAt(focusClash.location.x, focusClash.location.y, focusClash.location.z);
    }
  }, [focusClash]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#0b1118]" data-testid="cad-viewport-3d">
      <div ref={mountRef} className="w-full h-full touch-none" />

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b1118]/90 text-sm font-mono-tech text-[#ffb4ab] p-6">
          3D Viewport Notice: {webglError}
        </div>
      )}

      {/* Minimal Top-Left Navigation Cube / Spec Pill */}
      <div className="pointer-events-none absolute top-2.5 left-2.5 flex items-center gap-1.5 bg-[#111a24]/95 border border-[#2c3f58] rounded-xl px-2.5 py-1 text-[11px] font-mono-tech text-[#dae3f1]">
        <span className="text-[#00d2ff] font-semibold">3D BIM</span>
        <span className="hidden sm:inline text-[#38495e]">|</span>
        <span className="hidden sm:inline text-[#8b9cb2]">Drag Orbit · Scroll Zoom · WASD Walk</span>
      </div>

      {/* Collapsible Bottom Control Dock (solid rgba surface, no backdrop-filter over WebGL) */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex flex-col items-center z-10 w-[96%] max-w-[780px]">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="px-2.5 py-0.5 text-[9px] font-mono-tech uppercase tracking-wider bg-[#111a24] text-[#8b9cb2] hover:text-[#00d2ff] border border-b-0 border-[#2c3f58] rounded-t"
        >
          {dockCollapsed ? '▴ 3D Controls' : '▾ Hide Controls'}
        </button>

        {!dockCollapsed && (
          <div className="w-full flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 py-1.5 bg-[#111a24]/95 border border-[#2c3f58] rounded text-[10px]">
            {/* Camera Navigation Cube Presets */}
            <div className="flex items-center gap-0.5">
              {(['3d', 'top', 'front', 'left', 'walk'] as Camera3DView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setCameraView(v);
                    engineRef.current?.applyCameraPreset(v);
                  }}
                  className={`px-1.5 py-0.5 rounded-sm font-mono-tech uppercase whitespace-nowrap shrink-0 transition-colors ${
                    cameraView === v
                      ? 'bg-[#00d2ff] text-[#0b1118] font-semibold'
                      : 'bg-[#17202b] text-[#bbc9cf] hover:bg-[#243348]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="h-3.5 w-px bg-[#2c3f58]" />

            {/* Visual Modes */}
            <div className="flex items-center gap-0.5">
              {(['realistic', 'shaded', 'wireframe', 'xray', 'hidden'] as Visual3DMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setVisualMode(m)}
                  className={`px-1.5 py-0.5 rounded-sm font-mono-tech uppercase whitespace-nowrap shrink-0 transition-colors ${
                    visualMode === m
                      ? 'bg-[#243348] text-[#00d2ff] border border-[#00d2ff]/60'
                      : 'bg-[#17202b] text-[#8b9cb2] hover:text-[#dae3f1]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="h-3.5 w-px bg-[#2c3f58]" />

            {/* Section Box & Solar Controls */}
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 font-mono-tech text-[#8b9cb2] whitespace-nowrap">
                <span>Y:{sectionY.toFixed(1)}m</span>
                <input
                  type="range"
                  min={1}
                  max={12.5}
                  step={0.5}
                  value={sectionY}
                  onChange={(e) => setSectionY(parseFloat(e.target.value))}
                  className="w-11 accent-[#00d2ff]"
                  aria-label="Section height cut plane"
                />
              </label>
              <label className="flex items-center gap-1 font-mono-tech text-[#8b9cb2] whitespace-nowrap">
                <span>X:{sectionX.toFixed(0)}m</span>
                <input
                  type="range"
                  min={2}
                  max={22}
                  step={1}
                  value={sectionX}
                  onChange={(e) => setSectionX(parseFloat(e.target.value))}
                  className="w-11 accent-[#00d2ff]"
                  aria-label="Section X cut plane"
                />
              </label>
              <label className="flex items-center gap-1 font-mono-tech text-[#ffb86b] whitespace-nowrap">
                <span>SUN {solarHour}:00</span>
                <input
                  type="range"
                  min={7}
                  max={18}
                  step={1}
                  value={solarHour}
                  onChange={(e) => setSolarHour(parseInt(e.target.value, 10))}
                  className="w-11 accent-[#ff9f1c]"
                  aria-label="Solar hour simulation"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
