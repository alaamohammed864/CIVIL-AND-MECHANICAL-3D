import {
  BIMElement,
  BIMProject,
  BOQLineItem,
  ClashItem,
  DuctCalcResult,
  ElectricalCircuitResult,
  EnergyAnalysisResult,
  EquipmentElement,
  LinearMEPElement,
  MaterialDef,
  OpeningElement,
  PipeCalcResult,
  Point2D,
  RoomElement,
  RoomHVACResult,
  SlabElement,
  StructureElement,
  UnitSystem,
  WallElement,
} from '../types/bim';
import { EQUIPMENT_LIBRARY, MATERIAL_LIBRARY } from '../data/libraries';

export function distance2D(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function polygonArea2D(points: Point2D[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    sum += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return Math.abs(sum) / 2;
}

export function polygonPerimeter2D(points: Point2D[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    total += distance2D(points[i], points[j]);
  }
  return total;
}

export function pointInPolygon(p: Point2D, poly: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function formatLength(meters: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    return `${(meters * 3.28084).toFixed(2)} ft`;
  }
  return `${meters.toFixed(2)} m`;
}

export function formatArea(sqMeters: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    return `${(sqMeters * 10.7639).toFixed(1)} ft²`;
  }
  return `${sqMeters.toFixed(1)} m²`;
}

export function formatFlow(litersPerSec: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    return `${(litersPerSec * 2.11888).toFixed(0)} CFM`;
  }
  return `${litersPerSec.toFixed(0)} L/s`;
}

export function findMaterial(project: BIMProject, materialId: string): MaterialDef {
  return (
    project.customMaterials.find((m) => m.id === materialId) ||
    MATERIAL_LIBRARY.find((m) => m.id === materialId) ||
    MATERIAL_LIBRARY[0]
  );
}

/**
 * ASHRAE-aligned Room Cooling & Heating Load Calculation Engine
 * Transparently returns formulas, inputs, assumptions, and warnings.
 */
export function calculateRoomsHVAC(project: BIMProject): RoomHVACResult[] {
  const rooms = project.elements.filter((el): el is RoomElement => el.kind === 'room');
  const walls = project.elements.filter((el): el is WallElement => el.kind === 'wall');
  const hvacEquipment = project.elements.filter(
    (el): el is EquipmentElement =>
      el.category === 'HVAC' && ['fcu', 'vav', 'diffuser', 'ahu'].includes(el.kind),
  );

  const solarFactorMap: Record<RoomElement['solarExposure'], number> = {
    Low: 12,
    Medium: 24,
    High: 38,
  };

  return rooms.map((room) => {
    const areaM2 = polygonArea2D(room.points);
    const perimeterM = polygonPerimeter2D(room.points);
    const volumeM3 = areaM2 * room.ceilingHeightM;
    const warnings: string[] = [];

    if (room.occupancy <= 0) {
      warnings.push(`Room ${room.roomNumber} (${room.name}) has 0 occupancy — ventilation defaults to minimum envelope infiltration.`);
    }
    if (areaM2 <= 0) {
      warnings.push(`Room ${room.roomNumber} has invalid zero polygon area.`);
    }

    // Check if room contains an HVAC terminal / diffuser
    const hasHVACServed = hvacEquipment.some(
      (eq) => eq.levelId === room.levelId && (eq.roomId === room.id || pointInPolygon(eq.position, room.points)),
    );
    if (!hasHVACServed) {
      warnings.push(`Room ${room.roomNumber} (${room.name}) has no HVAC terminal/diffuser assigned.`);
    }

    // Average exterior wall U-value for the level
    const levelWalls = walls.filter((w) => w.levelId === room.levelId);
    const avgU =
      levelWalls.length > 0
        ? levelWalls.reduce((acc, w) => acc + w.uValue, 0) / levelWalls.length
        : 0.45;

    const deltaT = Math.max(2, room.outdoorTempC - room.indoorTempC);
    const heatingDeltaT = Math.max(15, room.indoorTempC - 2); // Design winter outdoor 2°C

    // 1. Envelope conduction + solar W
    const envelopeArea = perimeterM * room.ceilingHeightM * 0.45; // exposed perimeter share
    const qEnvelopeW = envelopeArea * avgU * deltaT + areaM2 * solarFactorMap[room.solarExposure];

    // 2. Internal gains (ASHRAE Fundamentals)
    const qPeopleSensibleW = room.occupancy * 75;
    const qPeopleLatentW = room.occupancy * 55;
    const qLightingW = areaM2 * room.lightingWm2;
    const qEquipmentW = areaM2 * room.equipmentWm2;

    // 3. Ventilation load (1.21 * L/s * ΔT sensible, 3.01 * L/s * Δw latent)
    const ventLs = Math.max(room.occupancy * room.ventilationLsPerPerson, areaM2 * 0.6);
    const qVentSensibleW = 1.21 * ventLs * deltaT;
    const qVentLatentW = 1.85 * ventLs * 6.5; // ~6.5 g/kg humidity difference

    const sensibleLoadKW = (qEnvelopeW + qPeopleSensibleW + qLightingW + qEquipmentW + qVentSensibleW) / 1000;
    const latentLoadKW = (qPeopleLatentW + qVentLatentW) / 1000;
    const totalCoolingLoadKW = (sensibleLoadKW + latentLoadKW) * 1.1; // 10% safety factor
    const coolingLoadTR = totalCoolingLoadKW / 3.517;

    // Heating load: envelope loss + ventilation loss (no internal credit)
    const qHeatEnvelopeW = (envelopeArea * avgU + areaM2 * 0.25) * heatingDeltaT;
    const qHeatVentW = 1.21 * ventLs * heatingDeltaT;
    const heatingLoadKW = (qHeatEnvelopeW + qHeatVentW) / 1000;

    // Supply airflow required for sensible ΔT = 10°C (1.21 kJ/m³K)
    const requiredAirflowLs = Math.max(ventLs, (sensibleLoadKW * 1000) / (1.21 * 10));
    const requiredAirflowCFM = requiredAirflowLs * 2.11888;
    const ach = volumeM3 > 0 ? (requiredAirflowLs * 3.6) / volumeM3 : 0;

    let recommendedUnit = 'FCU 600 CFM';
    if (coolingLoadTR > 15) recommendedUnit = 'Modular AHU + VAV Zone';
    else if (coolingLoadTR > 4) recommendedUnit = 'Ducted FCU 1,800 CFM';
    else if (coolingLoadTR > 2) recommendedUnit = 'Ducted FCU 1,200 CFM';

    return {
      roomId: room.id,
      roomName: room.name,
      roomNumber: room.roomNumber,
      areaM2,
      volumeM3,
      sensibleLoadKW: Number(sensibleLoadKW.toFixed(2)),
      latentLoadKW: Number(latentLoadKW.toFixed(2)),
      totalCoolingLoadKW: Number(totalCoolingLoadKW.toFixed(2)),
      coolingLoadTR: Number(coolingLoadTR.toFixed(2)),
      heatingLoadKW: Number(heatingLoadKW.toFixed(2)),
      requiredAirflowLs: Number(requiredAirflowLs.toFixed(0)),
      requiredAirflowCFM: Number(requiredAirflowCFM.toFixed(0)),
      ach: Number(ach.toFixed(1)),
      recommendedUnit,
      hasHVACServed,
      warnings,
      steps: [
        {
          label: 'Envelope & Solar Conduction',
          formula: 'Q_env = U * A_exp * ΔT + A_floor * q_solar',
          inputs: `U=${avgU.toFixed(2)} W/m²K, ΔT=${deltaT.toFixed(1)}K, Solar=${room.solarExposure}`,
          result: (qEnvelopeW / 1000).toFixed(2),
          unit: 'kW',
        },
        {
          label: 'Internal Gains (People + Light + Equip)',
          formula: 'Q_int = N*75 + A*(W_lt + W_eq)',
          inputs: `N=${room.occupancy}, Lt=${room.lightingWm2}W/m², Eq=${room.equipmentWm2}W/m²`,
          result: ((qPeopleSensibleW + qLightingW + qEquipmentW) / 1000).toFixed(2),
          unit: 'kW',
        },
        {
          label: 'Ventilation & Latent Load',
          formula: 'V_oa = max(N*q_p, 0.6*A); Q_lat = N*55 + 1.85*V_oa*Δw',
          inputs: `V_oa=${ventLs.toFixed(0)} L/s, Δw=6.5 g/kg`,
          result: latentLoadKW.toFixed(2),
          unit: 'kW',
        },
        {
          label: 'Total Design Cooling (1.10 Safety Factor)',
          formula: 'Q_cool = 1.10 * (Q_sens + Q_lat)',
          inputs: `Sens=${sensibleLoadKW.toFixed(2)} kW, Lat=${latentLoadKW.toFixed(2)} kW`,
          result: `${totalCoolingLoadKW.toFixed(2)} (${coolingLoadTR.toFixed(2)} TR)`,
          unit: 'kW',
        },
        {
          label: 'Required Supply Airflow & ACH',
          formula: 'V_sup = Q_sens / (1.21 * 10K); ACH = 3.6 * V_sup / Vol',
          inputs: `Vol=${volumeM3.toFixed(1)} m³, ΔT_sup=10K`,
          result: `${requiredAirflowLs.toFixed(0)} L/s (${ach.toFixed(1)} ACH)`,
          unit: 'L/s',
        },
      ],
    };
  });
}

/**
 * Equal-Friction Duct Sizing & Pressure Loss Engine
 */
export function calculateDucts(project: BIMProject): DuctCalcResult[] {
  const ducts = project.elements.filter((el): el is LinearMEPElement => el.kind === 'duct');
  return ducts.map((d) => {
    const lengthM = distance2D(d.start, d.end);
    const airflowLs = d.airflowLs || 450;
    const flowM3s = airflowLs / 1000;
    const shape = d.ductShape || 'rectangular';
    const wMm = d.widthMm || 400;
    const hMm = d.heightMm || 250;

    const areaM2 =
      shape === 'circular'
        ? Math.PI * Math.pow(wMm / 2000, 2)
        : (wMm / 1000) * (hMm / 1000);

    const velocityMs = areaM2 > 0 ? flowM3s / areaM2 : 0;
    // Equivalent hydraulic diameter
    const eqDiaM =
      shape === 'circular'
        ? wMm / 1000
        : (1.3 * Math.pow((wMm / 1000) * (hMm / 1000), 0.625)) /
          Math.pow(wMm / 1000 + hMm / 1000, 0.25);

    // Darcy-Weisbach air friction approximation (rho=1.2 kg/m3, f=0.022)
    const frictionPaM = eqDiaM > 0 ? (0.022 * 1.2 * Math.pow(velocityMs, 2)) / (2 * eqDiaM) : 0;
    const totalDropPa = frictionPaM * lengthM;

    let status: 'OK' | 'WARN' | 'FAIL' = 'OK';
    if (velocityMs > 10 || frictionPaM > 2.0) status = 'FAIL';
    else if (velocityMs > 7.5 || frictionPaM > 1.2) status = 'WARN';

    // Target 5.5 m/s optimal velocity
    const reqAreaM2 = flowM3s / 5.5;
    const recW = Math.ceil((Math.sqrt(reqAreaM2 * 1.5) * 1000) / 50) * 50;
    const recH = Math.max(150, Math.ceil(((reqAreaM2 / (recW / 1000)) * 1000) / 50) * 50);

    return {
      id: d.id,
      name: d.name,
      airflowLs,
      shape,
      widthMm: wMm,
      heightMm: hMm,
      velocityMs: Number(velocityMs.toFixed(2)),
      frictionPaM: Number(frictionPaM.toFixed(2)),
      totalDropPa: Number(totalDropPa.toFixed(1)),
      recommendedSize: shape === 'circular' ? `Ø${Math.ceil((Math.sqrt((4 * reqAreaM2) / Math.PI) * 1000) / 25) * 25} mm` : `${recW}×${recH} mm`,
      status,
    };
  });
}

const STANDARD_CABLE_SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240];
const STANDARD_BREAKERS = [10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 250, 400, 630];
const CABLE_AMPACITY_A: Record<number, number> = {
  1.5: 15,
  2.5: 21,
  4: 28,
  6: 36,
  10: 50,
  16: 68,
  25: 89,
  35: 110,
  50: 134,
  70: 171,
  95: 207,
  120: 239,
  150: 272,
  185: 310,
  240: 364,
};

/**
 * IEC 60364 Electrical Load, Cable Sizing, Breaker & Voltage Drop Calculation Engine
 */
export function calculateElectricalCircuits(project: BIMProject): ElectricalCircuitResult[] {
  const cables = project.elements.filter((el): el is LinearMEPElement => el.kind === 'cable');
  return cables.map((c) => {
    const lengthM = Math.max(1, distance2D(c.start, c.end));
    const voltageV = c.voltageV || 400;
    const phaseCount = c.phaseCount || (voltageV >= 380 ? 3 : 1);
    const powerW = c.powerW || 8500;
    const pf = c.powerFactor || 0.88;
    const demandFactor = 0.85;
    const demandW = powerW * demandFactor;
    const cableSizeMm2 = c.cableSizeMm2 || 4;

    const currentA =
      phaseCount === 3
        ? demandW / (Math.sqrt(3) * voltageV * pf)
        : demandW / (voltageV * pf);

    // Copper resistivity rho = 0.0178 Ohm·mm²/m at 70°C ~ 0.0215
    const rhoCu = 0.0215;
    const phaseFactor = phaseCount === 3 ? Math.sqrt(3) : 2;
    const deltaV = (phaseFactor * rhoCu * lengthM * currentA * pf) / cableSizeMm2;
    const voltageDropPct = (deltaV / voltageV) * 100;

    // Pick breaker >= 1.25 * currentA
    const breakerA = STANDARD_BREAKERS.find((b) => b >= currentA * 1.15) || 630;
    // Recommended cable: satisfies ampacity >= breakerA AND voltage drop <= 3%
    const recommendedCableMm2 =
      STANDARD_CABLE_SIZES.find((sz) => {
        const ampOk = (CABLE_AMPACITY_A[sz] || 400) >= breakerA;
        const vd = ((phaseFactor * rhoCu * lengthM * currentA * pf) / sz / voltageV) * 100;
        return ampOk && vd <= 3.0;
      }) || 240;

    const ampacity = CABLE_AMPACITY_A[cableSizeMm2] || 400;
    let status: 'OK' | 'WARN' | 'FAIL' = 'OK';
    if (voltageDropPct > 5.0 || currentA > ampacity) status = 'FAIL';
    else if (voltageDropPct > 3.0 || currentA > ampacity * 0.85) status = 'WARN';

    // Estimated prospective short circuit kA
    const zLoopOhm = Math.max(0.02, (2 * rhoCu * lengthM) / cableSizeMm2 + 0.035);
    const shortCircuitKA = (voltageV / (phaseCount === 3 ? Math.sqrt(3) : 1) / zLoopOhm) / 1000;

    return {
      id: c.id,
      name: c.name,
      circuitId: c.circuitId || c.id.toUpperCase(),
      voltageV,
      phaseCount,
      connectedPowerKW: Number((powerW / 1000).toFixed(2)),
      demandKW: Number((demandW / 1000).toFixed(2)),
      currentA: Number(currentA.toFixed(1)),
      lengthM: Number(lengthM.toFixed(1)),
      cableSizeMm2,
      recommendedCableMm2,
      breakerA,
      voltageDropPct: Number(voltageDropPct.toFixed(2)),
      shortCircuitKA: Number(shortCircuitKA.toFixed(2)),
      status,
      steps: [
        {
          label: 'Design Current (Demand Factor 0.85)',
          formula: phaseCount === 3 ? 'I_b = (P * DF) / (√3 * V * cosφ)' : 'I_b = (P * DF) / (V * cosφ)',
          inputs: `P=${(powerW / 1000).toFixed(1)}kW, V=${voltageV}V, cosφ=${pf}`,
          result: currentA.toFixed(1),
          unit: 'A',
        },
        {
          label: 'Voltage Drop (IEC 60364 ≤ 3.0%)',
          formula: 'ΔV% = (k * ρ * L * I_b * cosφ / S) / V * 100',
          inputs: `L=${lengthM.toFixed(1)}m, S=${cableSizeMm2}mm², ρ=0.0215`,
          result: voltageDropPct.toFixed(2),
          unit: '%',
        },
        {
          label: 'Breaker & Recommended Cable',
          formula: 'I_n >= 1.15 * I_b; I_z >= I_n',
          inputs: `Selected S=${cableSizeMm2}mm² (I_z=${ampacity}A)`,
          result: `${breakerA}A MCB / ${recommendedCableMm2}mm² Cu`,
          unit: 'IEC',
        },
      ],
    };
  });
}

/**
 * Plumbing, Fire Protection & Gas Pipe Sizing Calculations
 */
export function calculatePipes(project: BIMProject): PipeCalcResult[] {
  const pipes = project.elements.filter(
    (el): el is LinearMEPElement =>
      el.kind === 'cold_pipe' ||
      el.kind === 'hot_pipe' ||
      el.kind === 'drain_pipe' ||
      el.kind === 'fire_pipe' ||
      el.kind === 'gas_pipe',
  );

  const stdDias = [15, 20, 25, 32, 40, 50, 65, 80, 100, 150, 200];

  return pipes.map((p) => {
    const lengthM = Math.max(1, distance2D(p.start, p.end));
    const flowLs = p.flowLs || (p.kind === 'fire_pipe' ? 12.5 : p.kind === 'gas_pipe' ? 2.5 : 1.4);
    const diaMm = p.pipeDiaMm || 32;
    const areaM2 = Math.PI * Math.pow(diaMm / 2000, 2);
    const velocityMs = areaM2 > 0 ? (flowLs / 1000) / areaM2 : 0;

    // Hazen-Williams / Darcy simplified pressure drop
    const targetVel = p.kind === 'fire_pipe' ? 3.5 : p.kind === 'gas_pipe' ? 6.0 : 1.8;
    const reqDiaMm = Math.sqrt((4 * (flowLs / 1000)) / (Math.PI * targetVel)) * 1000;
    const recommendedDiaMm = stdDias.find((d) => d >= reqDiaMm) || 200;

    const dropKpa = (0.025 * (lengthM / (diaMm / 1000)) * 1000 * Math.pow(velocityMs, 2)) / 2000;
    let status: 'OK' | 'WARN' | 'FAIL' = 'OK';
    if (velocityMs > targetVel * 1.6) status = 'FAIL';
    else if (velocityMs > targetVel * 1.2) status = 'WARN';

    return {
      id: p.id,
      name: p.name,
      discipline: p.category === 'Fire Protection' ? 'Fire Protection' : p.category === 'Gas' ? 'Gas' : 'Plumbing',
      flowRate: p.kind === 'fire_pipe' ? `${(flowLs * 60).toFixed(0)} L/min` : `${flowLs.toFixed(2)} L/s`,
      diameterMm: diaMm,
      recommendedDiaMm,
      velocityMs: Number(velocityMs.toFixed(2)),
      pressureLoss: p.kind === 'gas_pipe' ? `${(dropKpa * 10).toFixed(1)} mbar` : `${dropKpa.toFixed(1)} kPa`,
      status,
    };
  });
}

/**
 * Building Energy Analysis & A-G Rating Engine
 */
export function calculateEnergyAnalysis(project: BIMProject): EnergyAnalysisResult {
  const slabs = project.elements.filter((el): el is SlabElement => el.kind === 'slab');
  const rooms = project.elements.filter((el): el is RoomElement => el.kind === 'room');
  const walls = project.elements.filter((el): el is WallElement => el.kind === 'wall');
  const openings = project.elements.filter(
    (el): el is OpeningElement => el.kind === 'door' || el.kind === 'window',
  );

  const floorAreaFromRooms = rooms.reduce((acc, r) => acc + polygonArea2D(r.points), 0);
  const floorAreaFromSlabs = slabs.reduce((acc, s) => acc + polygonArea2D(s.points), 0);
  const totalFloorAreaM2 = Math.max(10, floorAreaFromSlabs || floorAreaFromRooms);
  const totalVolumeM3 = rooms.reduce((acc, r) => acc + polygonArea2D(r.points) * r.ceilingHeightM, 0) || totalFloorAreaM2 * 3.5;

  const extWalls = walls.filter((w) => w.wallType === 'exterior' || w.wallType === 'curtain');
  const totalWallArea = extWalls.reduce((acc, w) => acc + distance2D(w.start, w.end) * w.heightM, 0) || 120;
  const windows = openings.filter((o) => o.kind === 'window');
  const totalWindowArea = windows.reduce((acc, win) => acc + win.widthM * win.heightM, 0);

  const avgWallUValue =
    extWalls.length > 0 ? extWalls.reduce((acc, w) => acc + w.uValue, 0) / extWalls.length : 0.45;
  const avgWindowUValue =
    windows.length > 0 ? windows.reduce((acc, w) => acc + w.uValue, 0) / windows.length : 1.4;

  const roomHvac = calculateRoomsHVAC(project);
  const peakCoolKW = roomHvac.reduce((a, r) => a + r.totalCoolingLoadKW, 0) || totalFloorAreaM2 * 0.11;
  const peakHeatKW = roomHvac.reduce((a, r) => a + r.heatingLoadKW, 0) || totalFloorAreaM2 * 0.06;

  // Equivalent full-load operating hours (industrial/commercial 2,600 hrs/yr, COP 3.2 cooling, 0.92 heating)
  const annualCoolingKWh = (peakCoolKW / 3.2) * 1850;
  const annualHeatingKWh = (peakHeatKW / 0.92) * 950;
  const avgLightWm2 = rooms.length > 0 ? rooms.reduce((a, r) => a + r.lightingWm2, 0) / rooms.length : 10;
  const avgEqWm2 = rooms.length > 0 ? rooms.reduce((a, r) => a + r.equipmentWm2, 0) / rooms.length : 18;
  const annualLightingKWh = (avgLightWm2 * totalFloorAreaM2 * 2800) / 1000;
  const annualEquipmentKWh = (avgEqWm2 * totalFloorAreaM2 * 3100) / 1000;

  const totalAnnualKWh = annualCoolingKWh + annualHeatingKWh + annualLightingKWh + annualEquipmentKWh;
  const euiKWhM2Yr = totalAnnualKWh / totalFloorAreaM2;
  const co2KgYr = totalAnnualKWh * 0.42; // 0.42 kgCO2/kWh grid factor

  let rating: EnergyAnalysisResult['rating'] = 'G';
  if (euiKWhM2Yr <= 65) rating = 'A';
  else if (euiKWhM2Yr <= 105) rating = 'B';
  else if (euiKWhM2Yr <= 150) rating = 'C';
  else if (euiKWhM2Yr <= 200) rating = 'D';
  else if (euiKWhM2Yr <= 260) rating = 'E';
  else if (euiKWhM2Yr <= 330) rating = 'F';

  // Orientation solar gains based on wall normals
  const solarGainsByOrientationKW: Record<'N' | 'E' | 'S' | 'W', number> = { N: 1.2, E: 3.4, S: 5.8, W: 4.9 };
  windows.forEach((win) => {
    const host = walls.find((w) => w.id === win.hostWallId);
    if (!host) return;
    const dx = host.end.x - host.start.x;
    const dy = host.end.y - host.start.y;
    const gain = (win.widthM * win.heightM * win.shgc * 0.65);
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (host.start.y <= 5) solarGainsByOrientationKW.N += gain * 0.4;
      else solarGainsByOrientationKW.S += gain * 1.1;
    } else {
      if (host.start.x <= 5) solarGainsByOrientationKW.W += gain * 0.95;
      else solarGainsByOrientationKW.E += gain * 0.85;
    }
  });

  return {
    totalFloorAreaM2: Number(totalFloorAreaM2.toFixed(1)),
    totalVolumeM3: Number(totalVolumeM3.toFixed(1)),
    envelopeAreaM2: Number((totalWallArea + totalFloorAreaM2).toFixed(1)),
    windowToWallRatioPct: Number(Math.min(95, (totalWindowArea / Math.max(1, totalWallArea)) * 100).toFixed(1)),
    avgWallUValue: Number(avgWallUValue.toFixed(2)),
    avgWindowUValue: Number(avgWindowUValue.toFixed(2)),
    annualHeatingKWh: Math.round(annualHeatingKWh),
    annualCoolingKWh: Math.round(annualCoolingKWh),
    annualLightingKWh: Math.round(annualLightingKWh),
    annualEquipmentKWh: Math.round(annualEquipmentKWh),
    totalAnnualKWh: Math.round(totalAnnualKWh),
    euiKWhM2Yr: Number(euiKWhM2Yr.toFixed(1)),
    co2KgYr: Math.round(co2KgYr),
    rating,
    solarGainsByOrientationKW: {
      N: Number(solarGainsByOrientationKW.N.toFixed(2)),
      E: Number(solarGainsByOrientationKW.E.toFixed(2)),
      S: Number(solarGainsByOrientationKW.S.toFixed(2)),
      W: Number(solarGainsByOrientationKW.W.toFixed(2)),
    },
  };
}

interface BBox3D {
  id: string;
  name: string;
  category: string;
  levelId: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

function getElementBBox3D(el: BIMElement, levelElevMap: Map<string, number>): BBox3D | null {
  const baseZ = levelElevMap.get(el.levelId) ?? 0;
  if (el.kind === 'beam') {
    const end = el.end || el.start;
    const minX = Math.min(el.start.x, end.x) - el.widthM / 2;
    const maxX = Math.max(el.start.x, end.x) + el.widthM / 2;
    const minY = Math.min(el.start.y, end.y) - el.widthM / 2;
    const maxY = Math.max(el.start.y, end.y) + el.widthM / 2;
    const minZ = baseZ + el.elevationOffsetM;
    const maxZ = minZ + el.heightM;
    return { id: el.id, name: el.name, category: el.category, levelId: el.levelId, minX, maxX, minY, maxY, minZ, maxZ };
  }
  if (el.kind === 'column') {
    const minX = el.start.x - el.widthM / 2;
    const maxX = el.start.x + el.widthM / 2;
    const minY = el.start.y - el.depthM / 2;
    const maxY = el.start.y + el.depthM / 2;
    return {
      id: el.id,
      name: el.name,
      category: el.category,
      levelId: el.levelId,
      minX,
      maxX,
      minY,
      maxY,
      minZ: baseZ,
      maxZ: baseZ + el.heightM,
    };
  }
  if (
    el.kind === 'duct' ||
    el.kind === 'cold_pipe' ||
    el.kind === 'hot_pipe' ||
    el.kind === 'drain_pipe' ||
    el.kind === 'fire_pipe' ||
    el.kind === 'gas_pipe' ||
    el.kind === 'cable'
  ) {
    const halfW = ((el.widthMm || el.pipeDiaMm || 150) / 1000) / 2;
    const halfH = ((el.heightMm || el.pipeDiaMm || 150) / 1000) / 2;
    const minX = Math.min(el.start.x, el.end.x) - halfW;
    const maxX = Math.max(el.start.x, el.end.x) + halfW;
    const minY = Math.min(el.start.y, el.end.y) - halfW;
    const maxY = Math.max(el.start.y, el.end.y) + halfW;
    const minZ = baseZ + el.elevationOffsetM - halfH;
    const maxZ = baseZ + el.elevationOffsetM + halfH;
    return { id: el.id, name: el.name, category: el.category, levelId: el.levelId, minX, maxX, minY, maxY, minZ, maxZ };
  }
  return null;
}

/**
 * 3D Multi-Discipline Clash Detection Engine
 */
export function detectClashes(project: BIMProject): ClashItem[] {
  const levelElev = new Map(project.levels.map((l) => [l.id, l.elevationM]));
  const boxes = project.elements
    .filter((e) => e.visible)
    .map((e) => getElementBBox3D(e, levelElev))
    .filter((b): b is BBox3D => b !== null);

  const clashes: ClashItem[] = [];
  let seq = 1;

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.category === b.category) continue; // cross-discipline clash checks

      const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
      const oy = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
      const oz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);

      if (ox > 0.01 && oy > 0.01 && oz > 0.01) {
        const minPenetrationMm = Math.round(Math.min(ox, oy, oz) * 1000);
        const cx = (Math.max(a.minX, b.minX) + Math.min(a.maxX, b.maxX)) / 2;
        const cy = (Math.max(a.minY, b.minY) + Math.min(a.maxY, b.maxY)) / 2;
        const cz = (Math.max(a.minZ, b.minZ) + Math.min(a.maxZ, b.maxZ)) / 2;

        const involvesStructure = a.category === 'Structure' || b.category === 'Structure';
        clashes.push({
          id: `CLH-${String(seq++).padStart(3, '0')}`,
          elementAId: a.id,
          elementAName: a.name,
          elementACategory: a.category,
          elementBId: b.id,
          elementBName: b.name,
          elementBCategory: b.category,
          levelId: a.levelId,
          location: {
            x: Number(cx.toFixed(2)),
            y: Number(cy.toFixed(2)),
            z: Number(cz.toFixed(2)),
          },
          clearanceMm: -minPenetrationMm,
          severity: involvesStructure || minPenetrationMm >= 80 ? 'Critical' : 'Warning',
          status: 'Open',
          description: `${a.category} (${a.name}) intersects ${b.category} (${b.name}) by ${minPenetrationMm} mm.`,
        });
      }
    }
  }
  return clashes;
}

/**
 * Automatic Quantity Takeoff & BOQ Generator
 */
export function generateBOQ(project: BIMProject): BOQLineItem[] {
  const items: BOQLineItem[] = [];
  let idx = 1;
  const nextNo = () => `BOQ-${String(idx++).padStart(3, '0')}`;

  // 1. Walls grouped by material
  const wallGroups = new Map<string, { areaM2: number; lengthM: number; mat: MaterialDef }>();
  project.elements.forEach((el) => {
    if (el.kind === 'wall') {
      const len = distance2D(el.start, el.end);
      const area = len * el.heightM;
      const mat = findMaterial(project, el.materialId);
      const cur = wallGroups.get(mat.id) || { areaM2: 0, lengthM: 0, mat };
      cur.areaM2 += area;
      cur.lengthM += len;
      wallGroups.set(mat.id, cur);
    }
  });
  wallGroups.forEach((g) => {
    const qty = Number(g.areaM2.toFixed(1));
    const matC = g.mat.unitCostUSD * 0.65;
    const labC = g.mat.unitCostUSD * 0.25;
    const eqC = g.mat.unitCostUSD * 0.1;
    items.push({
      itemNo: nextNo(),
      category: 'Architecture',
      description: `${g.mat.name} (Total Length ${g.lengthM.toFixed(1)} m)`,
      unit: 'm²',
      quantity: qty,
      materialCostUSD: Number((matC * qty).toFixed(2)),
      laborCostUSD: Number((labC * qty).toFixed(2)),
      equipmentCostUSD: Number((eqC * qty).toFixed(2)),
      unitPriceUSD: g.mat.unitCostUSD,
      totalUSD: Number((qty * g.mat.unitCostUSD).toFixed(2)),
      notes: 'Extracted from parametric wall geometry',
    });
  });

  // 2. Doors & Windows
  const doors = project.elements.filter((e) => e.kind === 'door');
  if (doors.length > 0) {
    items.push({
      itemNo: nextNo(),
      category: 'Architecture',
      description: 'Industrial Fire-Rated & Aluminum Door Assemblies',
      unit: 'nos',
      quantity: doors.length,
      materialCostUSD: doors.length * 680,
      laborCostUSD: doors.length * 180,
      equipmentCostUSD: doors.length * 40,
      unitPriceUSD: 900,
      totalUSD: doors.length * 900,
      notes: 'Includes frame, hardware, and fire seal',
    });
  }
  const windows = project.elements.filter((e) => e.kind === 'window');
  if (windows.length > 0) {
    const winArea = windows.reduce((acc, w) => acc + (w.kind === 'window' ? w.widthM * w.heightM : 0), 0);
    const qty = Number(winArea.toFixed(1));
    items.push({
      itemNo: nextNo(),
      category: 'Architecture',
      description: `Double/Triple Glazed Low-E Window Assemblies (${windows.length} units)`,
      unit: 'm²',
      quantity: qty,
      materialCostUSD: Number((qty * 240).toFixed(2)),
      laborCostUSD: Number((qty * 65).toFixed(2)),
      equipmentCostUSD: Number((qty * 15).toFixed(2)),
      unitPriceUSD: 320,
      totalUSD: Number((qty * 320).toFixed(2)),
      notes: 'Thermal-break aluminum mullions',
    });
  }

  // 3. Concrete Slabs & Structural Steel
  const slabs = project.elements.filter((e): e is SlabElement => e.kind === 'slab' || e.kind === 'roof');
  const concreteVol = slabs
    .filter((s) => s.kind === 'slab')
    .reduce((acc, s) => acc + polygonArea2D(s.points) * s.thicknessM, 0);
  if (concreteVol > 0) {
    const qty = Number(concreteVol.toFixed(1));
    items.push({
      itemNo: nextNo(),
      category: 'Structure',
      description: 'Reinforced Concrete C35/45 Floor Slabs & Formwork',
      unit: 'm³',
      quantity: qty,
      materialCostUSD: Number((qty * 130).toFixed(2)),
      laborCostUSD: Number((qty * 45).toFixed(2)),
      equipmentCostUSD: Number((qty * 20).toFixed(2)),
      unitPriceUSD: 195,
      totalUSD: Number((qty * 195).toFixed(2)),
      notes: 'Includes rebar allowance 110 kg/m³',
    });
  }
  const structs = project.elements.filter((e): e is StructureElement => e.kind === 'column' || e.kind === 'beam');
  if (structs.length > 0) {
    const steelTons = structs.reduce((acc, s) => {
      const len = s.kind === 'beam' && s.end ? distance2D(s.start, s.end) : s.heightM;
      return acc + len * 0.068; // ~68 kg/m average wide flange
    }, 0);
    const qty = Number(steelTons.toFixed(2));
    items.push({
      itemNo: nextNo(),
      category: 'Structure',
      description: 'Structural Steel S355JR Columns & Beams (Erected)',
      unit: 'ton',
      quantity: qty,
      materialCostUSD: Number((qty * 1650).toFixed(2)),
      laborCostUSD: Number((qty * 550).toFixed(2)),
      equipmentCostUSD: Number((qty * 250).toFixed(2)),
      unitPriceUSD: 2450,
      totalUSD: Number((qty * 2450).toFixed(2)),
      notes: 'Includes base plates and intumescent paint',
    });
  }

  // 4. Linear MEP Systems (Ducts, Pipes, Cables)
  const ducts = project.elements.filter((e): e is LinearMEPElement => e.kind === 'duct');
  if (ducts.length > 0) {
    const ductLen = ducts.reduce((acc, d) => acc + distance2D(d.start, d.end), 0);
    const qty = Number(ductLen.toFixed(1));
    items.push({
      itemNo: nextNo(),
      category: 'HVAC',
      description: 'Galvanized Steel Insulated Supply/Return Ductwork',
      unit: 'm',
      quantity: qty,
      materialCostUSD: Number((qty * 58).toFixed(2)),
      laborCostUSD: Number((qty * 28).toFixed(2)),
      equipmentCostUSD: Number((qty * 9).toFixed(2)),
      unitPriceUSD: 95,
      totalUSD: Number((qty * 95).toFixed(2)),
      notes: 'Includes hangers, flanges & 25mm elastomeric insulation',
    });
  }

  const cables = project.elements.filter((e): e is LinearMEPElement => e.kind === 'cable');
  if (cables.length > 0) {
    const cableLen = cables.reduce((acc, c) => acc + distance2D(c.start, c.end), 0);
    const qty = Number(cableLen.toFixed(1));
    items.push({
      itemNo: nextNo(),
      category: 'Electrical',
      description: 'XLPE/SWA Armored Power & Control Cabling + Ladder Tray',
      unit: 'm',
      quantity: qty,
      materialCostUSD: Number((qty * 32).toFixed(2)),
      laborCostUSD: Number((qty * 14).toFixed(2)),
      equipmentCostUSD: Number((qty * 4).toFixed(2)),
      unitPriceUSD: 50,
      totalUSD: Number((qty * 50).toFixed(2)),
      notes: 'IEC 60364 compliant copper conductors',
    });
  }

  const pipes = project.elements.filter(
    (e): e is LinearMEPElement =>
      e.kind === 'cold_pipe' ||
      e.kind === 'hot_pipe' ||
      e.kind === 'drain_pipe' ||
      e.kind === 'fire_pipe' ||
      e.kind === 'gas_pipe',
  );
  if (pipes.length > 0) {
    const pipeLen = pipes.reduce((acc, p) => acc + distance2D(p.start, p.end), 0);
    const qty = Number(pipeLen.toFixed(1));
    items.push({
      itemNo: nextNo(),
      category: 'Plumbing / Fire / Gas',
      description: 'Process, Sanitary, Fire & Gas Piping Networks',
      unit: 'm',
      quantity: qty,
      materialCostUSD: Number((qty * 44).toFixed(2)),
      laborCostUSD: Number((qty * 22).toFixed(2)),
      equipmentCostUSD: Number((qty * 6).toFixed(2)),
      unitPriceUSD: 72,
      totalUSD: Number((qty * 72).toFixed(2)),
      notes: 'Includes fittings, supports & hydrostatic testing',
    });
  }

  // 5. Major Equipment
  const eqElements = project.elements.filter((e): e is EquipmentElement => 'position' in e);
  const eqGrouped = new Map<string, { count: number; label: string; category: string; unitPrice: number }>();
  eqElements.forEach((eq) => {
    const libDef = EQUIPMENT_LIBRARY.find((d) => d.id === eq.equipmentDefId || d.kind === eq.kind);
    const unitPrice = libDef ? libDef.unitCostUSD : 480;
    const label = libDef ? `${libDef.name} (${libDef.manufacturer})` : `${eq.kind.toUpperCase()} Assembly`;
    const key = `${eq.category}:${eq.kind}`;
    const cur = eqGrouped.get(key) || { count: 0, label, category: eq.category, unitPrice };
    cur.count += 1;
    eqGrouped.set(key, cur);
  });

  eqGrouped.forEach((g) => {
    items.push({
      itemNo: nextNo(),
      category: g.category,
      description: g.label,
      unit: 'nos',
      quantity: g.count,
      materialCostUSD: Number((g.count * g.unitPrice * 0.78).toFixed(2)),
      laborCostUSD: Number((g.count * g.unitPrice * 0.14).toFixed(2)),
      equipmentCostUSD: Number((g.count * g.unitPrice * 0.08).toFixed(2)),
      unitPriceUSD: g.unitPrice,
      totalUSD: Number((g.count * g.unitPrice).toFixed(2)),
      notes: 'Supplied, installed, wired & commissioned',
    });
  });

  return items;
}
