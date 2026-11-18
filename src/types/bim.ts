export type UnitSystem = 'metric' | 'imperial';
export type CurrencyCode = 'USD' | 'EUR' | 'IQD';
export type EngineeringStandard = 'ASHRAE' | 'NFPA' | 'IEC' | 'EN' | 'ISO';
export type ProjectType =
  | 'Industrial'
  | 'Commercial'
  | 'Residential'
  | 'Hospital'
  | 'School'
  | 'Office'
  | 'Hotel'
  | 'Warehouse'
  | 'Oil & Gas Facility'
  | 'Other';

export type RibbonTab =
  | 'HOME'
  | 'DRAW'
  | 'ARCHITECTURE'
  | 'STRUCTURE'
  | 'HVAC'
  | 'ELECTRICAL'
  | 'PLUMBING'
  | 'FIRE'
  | 'GAS'
  | 'ENERGY'
  | 'DOCUMENTATION';

export type WorkspaceViewMode =
  | '2D'
  | '3D'
  | 'SPLIT'
  | 'CALCULATIONS'
  | 'ENERGY'
  | 'CLASH'
  | 'BOQ'
  | 'SHEETS';

export type Visual3DMode = 'shaded' | 'realistic' | 'wireframe' | 'xray' | 'hidden';
export type Camera3DView = '3d' | 'top' | 'front' | 'back' | 'left' | 'right' | 'walk';

export type ActiveTool =
  | 'select'
  | 'pan'
  | 'move'
  | 'copy'
  | 'rotate'
  | 'mirror'
  | 'scale'
  | 'offset'
  | 'trim'
  | 'measure'
  | 'line'
  | 'polyline'
  | 'rect'
  | 'circle'
  | 'arc'
  | 'dimension'
  | 'text'
  | 'wall'
  | 'curtain_wall'
  | 'door'
  | 'window'
  | 'slab'
  | 'roof'
  | 'column'
  | 'beam'
  | 'room'
  | 'duct'
  | 'ahu'
  | 'fcu'
  | 'vav'
  | 'chiller'
  | 'boiler'
  | 'diffuser'
  | 'panel'
  | 'transformer'
  | 'generator'
  | 'lighting'
  | 'socket'
  | 'cable'
  | 'cold_pipe'
  | 'hot_pipe'
  | 'drain_pipe'
  | 'pump'
  | 'tank'
  | 'valve'
  | 'fixture'
  | 'fire_pipe'
  | 'sprinkler'
  | 'fire_pump'
  | 'hydrant'
  | 'detector'
  | 'gas_pipe'
  | 'gas_meter'
  | 'gas_regulator'
  | 'lift_shaft'
  | 'markup_pin';

export type DisciplineCategory =
  | 'Architecture'
  | 'Structure'
  | 'HVAC'
  | 'Electrical'
  | 'Plumbing'
  | 'Fire Protection'
  | 'Gas'
  | 'Elevator'
  | 'Drafting';

export type PhaseType = 'New Construction' | 'Existing' | 'Demolished';
export type ValveState = 'OPEN' | 'THROTTLED' | 'CLOSED';

export interface Point2D {
  x: number;
  y: number;
}

export interface Level {
  id: string;
  name: string;
  elevationM: number;
  heightM: number;
  visible: boolean;
  locked: boolean;
}

export interface Layer {
  id: string;
  name: string;
  color: string;
  lineType: 'solid' | 'dashed' | 'center';
  lineWidth: number;
  visible: boolean;
  locked: boolean;
  printable: boolean;
}

export interface MaterialDef {
  id: string;
  name: string;
  category:
    | 'Concrete'
    | 'Steel'
    | 'Brick'
    | 'Block'
    | 'Glass'
    | 'Insulation'
    | 'Wood'
    | 'Aluminum'
    | 'Gypsum'
    | 'Stone';
  densityKgM3: number;
  conductivityWmK: number;
  specificHeatJKgK: number;
  uValueWm2K: number;
  unitCostUSD: number;
  unit: string;
  colorHex: string;
  manufacturer: string;
  description: string;
}

export interface EquipmentDef {
  id: string;
  name: string;
  discipline: 'HVAC' | 'Electrical' | 'Plumbing' | 'Fire Protection' | 'Gas' | 'Elevator';
  kind: string;
  widthM: number;
  depthM: number;
  heightM: number;
  ratedPowerKW: number;
  ratedFlowLs?: number;
  voltageV?: number;
  unitCostUSD: number;
  manufacturer: string;
  modelCode: string;
}

export interface WallElement {
  id: string;
  kind: 'wall';
  category: 'Architecture';
  name: string;
  levelId: string;
  layerId: string;
  phase: PhaseType;
  wallType: 'exterior' | 'interior' | 'curtain' | 'composite';
  start: Point2D;
  end: Point2D;
  thicknessM: number;
  heightM: number;
  materialId: string;
  fireRating: string;
  uValue: number;
  visible: boolean;
  locked: boolean;
}

export interface OpeningElement {
  id: string;
  kind: 'door' | 'window';
  category: 'Architecture';
  name: string;
  levelId: string;
  layerId: string;
  phase: PhaseType;
  hostWallId: string;
  offsetRatio: number; // 0.1 to 0.9 along host wall
  widthM: number;
  heightM: number;
  sillHeightM: number;
  subType: 'single' | 'double' | 'sliding' | 'fire_rated' | 'fixed' | 'casement' | 'curtain_glazing';
  frameMaterial: string;
  fireRating: string;
  uValue: number;
  shgc: number;
  openDirection: 'in' | 'out';
  visible: boolean;
  locked: boolean;
}

export interface SlabElement {
  id: string;
  kind: 'slab' | 'roof';
  category: 'Architecture';
  name: string;
  levelId: string;
  layerId: string;
  phase: PhaseType;
  points: Point2D[];
  thicknessM: number;
  materialId: string;
  roofType?: 'flat' | 'sloped' | 'gable' | 'hip';
  slopeDeg?: number;
  uValue: number;
  visible: boolean;
  locked: boolean;
}

export interface StructureElement {
  id: string;
  kind: 'column' | 'beam' | 'foundation';
  category: 'Structure';
  name: string;
  levelId: string;
  layerId: string;
  phase: PhaseType;
  start: Point2D;
  end?: Point2D; // beams have start+end; columns have start
  widthM: number;
  depthM: number;
  heightM: number;
  elevationOffsetM: number; // e.g., beam soffit offset inside level
  materialId: string;
  loadKN: number;
  visible: boolean;
  locked: boolean;
}

export interface RoomElement {
  id: string;
  kind: 'room';
  category: 'Architecture';
  name: string;
  roomNumber: string;
  levelId: string;
  layerId: string;
  points: Point2D[];
  ceilingHeightM: number;
  occupancy: number;
  lightingWm2: number;
  equipmentWm2: number;
  outdoorTempC: number;
  indoorTempC: number;
  solarExposure: 'Low' | 'Medium' | 'High';
  ventilationLsPerPerson: number;
  floorFinish: string;
  wallFinish: string;
  visible: boolean;
  locked: boolean;
}

export interface LinearMEPElement {
  id: string;
  kind: 'duct' | 'cold_pipe' | 'hot_pipe' | 'drain_pipe' | 'fire_pipe' | 'gas_pipe' | 'cable';
  category: 'HVAC' | 'Electrical' | 'Plumbing' | 'Fire Protection' | 'Gas';
  name: string;
  levelId: string;
  layerId: string;
  systemName: string;
  start: Point2D;
  end: Point2D;
  elevationOffsetM: number;
  // HVAC Duct properties
  ductShape?: 'rectangular' | 'circular' | 'oval';
  widthMm?: number;
  heightMm?: number;
  airflowLs?: number;
  // Pipe properties
  pipeDiaMm?: number;
  flowLs?: number;
  pressureBar?: number;
  // Electrical Cable properties
  voltageV?: number;
  powerW?: number;
  powerFactor?: number;
  cableSizeMm2?: number;
  phaseCount?: 1 | 3;
  circuitId?: string;
  panelId?: string;
  // Valve / Flow state
  valveState?: ValveState;
  insulationMm?: number;
  visible: boolean;
  locked: boolean;
}

export interface EquipmentElement {
  id: string;
  kind:
    | 'ahu'
    | 'fcu'
    | 'vav'
    | 'chiller'
    | 'boiler'
    | 'diffuser'
    | 'panel'
    | 'transformer'
    | 'generator'
    | 'lighting'
    | 'socket'
    | 'pump'
    | 'tank'
    | 'valve'
    | 'fixture'
    | 'sprinkler'
    | 'fire_pump'
    | 'hydrant'
    | 'detector'
    | 'gas_meter'
    | 'gas_regulator'
    | 'lift_shaft';
  category: 'HVAC' | 'Electrical' | 'Plumbing' | 'Fire Protection' | 'Gas' | 'Elevator';
  name: string;
  tag: string;
  levelId: string;
  layerId: string;
  position: Point2D;
  rotationDeg: number;
  elevationOffsetM: number;
  widthM: number;
  depthM: number;
  heightM: number;
  ratedPowerKW: number;
  ratedFlowLs?: number;
  voltageV?: number;
  valveState?: ValveState;
  roomId?: string;
  equipmentDefId?: string;
  // Elevator specifics
  capacityKg?: number;
  speedMs?: number;
  stops?: number;
  visible: boolean;
  locked: boolean;
}

export interface Drafting2DElement {
  id: string;
  kind: 'line' | 'polyline' | 'rect' | 'circle' | 'arc' | 'dimension' | 'text';
  category: 'Drafting';
  name: string;
  levelId: string;
  layerId: string;
  points: Point2D[];
  radiusM?: number;
  text?: string;
  visible: boolean;
  locked: boolean;
}

export type BIMElement =
  | WallElement
  | OpeningElement
  | SlabElement
  | StructureElement
  | RoomElement
  | LinearMEPElement
  | EquipmentElement
  | Drafting2DElement;

export interface IssueMarkup {
  id: string;
  title: string;
  author: string;
  date: string;
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  assignedTo: string;
  comment: string;
  position: Point2D;
  levelId: string;
  linkedElementId?: string;
}

export interface ProjectMember {
  id: string;
  name: string;
  role:
    | 'Owner'
    | 'Architect'
    | 'Civil Engineer'
    | 'Mechanical Engineer'
    | 'Electrical Engineer'
    | 'Plumbing Engineer'
    | 'Fire Engineer'
    | 'Contractor';
  permission: 'Admin' | 'Approve' | 'Edit' | 'Comment' | 'View';
  email: string;
}

export interface VersionSnapshot {
  id: string;
  version: string;
  timestamp: string;
  author: string;
  description: string;
  elementCount: number;
  dataJson: string;
}

export interface ProjectBranding {
  organizationName: string;
  platformTitle: string;
  accentColor: string;
  designerName: string;
  checkerName: string;
  approverName: string;
}

export interface BIMProject {
  id: string;
  name: string;
  projectNumber: string;
  client: string;
  location: string;
  projectType: ProjectType;
  unitSystem: UnitSystem;
  currency: CurrencyCode;
  standard: EngineeringStandard;
  template: string;
  updatedAt: string;
  branding: ProjectBranding;
  levels: Level[];
  layers: Layer[];
  elements: BIMElement[];
  issues: IssueMarkup[];
  members: ProjectMember[];
  customMaterials: MaterialDef[];
  customEquipment: EquipmentDef[];
}

export interface CalculationStep {
  label: string;
  formula: string;
  inputs: string;
  result: string;
  unit: string;
}

export interface RoomHVACResult {
  roomId: string;
  roomName: string;
  roomNumber: string;
  areaM2: number;
  volumeM3: number;
  sensibleLoadKW: number;
  latentLoadKW: number;
  totalCoolingLoadKW: number;
  coolingLoadTR: number;
  heatingLoadKW: number;
  requiredAirflowLs: number;
  requiredAirflowCFM: number;
  ach: number;
  recommendedUnit: string;
  hasHVACServed: boolean;
  warnings: string[];
  steps: CalculationStep[];
}

export interface DuctCalcResult {
  id: string;
  name: string;
  airflowLs: number;
  shape: 'rectangular' | 'circular' | 'oval';
  widthMm: number;
  heightMm: number;
  velocityMs: number;
  frictionPaM: number;
  totalDropPa: number;
  recommendedSize: string;
  status: 'OK' | 'WARN' | 'FAIL';
}

export interface ElectricalCircuitResult {
  id: string;
  name: string;
  circuitId: string;
  voltageV: number;
  phaseCount: 1 | 3;
  connectedPowerKW: number;
  demandKW: number;
  currentA: number;
  lengthM: number;
  cableSizeMm2: number;
  recommendedCableMm2: number;
  breakerA: number;
  voltageDropPct: number;
  shortCircuitKA: number;
  status: 'OK' | 'WARN' | 'FAIL';
  steps: CalculationStep[];
}

export interface PipeCalcResult {
  id: string;
  name: string;
  discipline: 'Plumbing' | 'Fire Protection' | 'Gas';
  flowRate: string;
  diameterMm: number;
  recommendedDiaMm: number;
  velocityMs: number;
  pressureLoss: string;
  status: 'OK' | 'WARN' | 'FAIL';
}

export interface EnergyAnalysisResult {
  totalFloorAreaM2: number;
  totalVolumeM3: number;
  envelopeAreaM2: number;
  windowToWallRatioPct: number;
  avgWallUValue: number;
  avgWindowUValue: number;
  annualHeatingKWh: number;
  annualCoolingKWh: number;
  annualLightingKWh: number;
  annualEquipmentKWh: number;
  totalAnnualKWh: number;
  euiKWhM2Yr: number;
  co2KgYr: number;
  rating: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  solarGainsByOrientationKW: Record<'N' | 'E' | 'S' | 'W', number>;
}

export interface ClashItem {
  id: string;
  elementAId: string;
  elementAName: string;
  elementACategory: string;
  elementBId: string;
  elementBName: string;
  elementBCategory: string;
  levelId: string;
  location: { x: number; y: number; z: number };
  clearanceMm: number;
  severity: 'Critical' | 'Warning';
  status: 'Open' | 'Resolved';
  description: string;
}

export interface BOQLineItem {
  itemNo: string;
  category: string;
  description: string;
  unit: string;
  quantity: number;
  materialCostUSD: number;
  laborCostUSD: number;
  equipmentCostUSD: number;
  unitPriceUSD: number;
  totalUSD: number;
  notes: string;
}
