import React, { useState } from 'react';
import {
  BIMElement,
  BIMProject,
  ClashItem,
  CurrencyCode,
  EngineeringStandard,
  WorkspaceViewMode,
} from '../types/bim';
import {
  calculateDucts,
  calculateElectricalCircuits,
  calculateEnergyAnalysis,
  calculatePipes,
  calculateRoomsHVAC,
  formatArea,
  formatFlow,
  generateBOQ,
} from '../engine/calculations';
import { formatCurrency } from '../data/libraries';
import { downloadTextFile, exportBOQToCSV } from '../engine/exporters';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Flame,
  Printer,
  ShieldAlert,
  Sun,
  Wrench,
  Zap,
} from 'lucide-react';

interface EngineeringModulesProps {
  mode: WorkspaceViewMode;
  project: BIMProject;
  clashes: ClashItem[];
  onUpdateProjectMeta: (patch: Partial<BIMProject>) => void;
  onUpdateElement: (id: string, patch: Partial<BIMElement>) => void;
  onLocateClash: (clash: ClashItem) => void;
  onAutoResolveClash: (clash: ClashItem) => void;
}

export const EngineeringModules: React.FC<EngineeringModulesProps> = ({
  mode,
  project,
  clashes,
  onUpdateProjectMeta,
  onUpdateElement,
  onLocateClash,
  onAutoResolveClash,
}) => {
  const [calcTab, setCalcTab] = useState<'hvac' | 'electrical' | 'hydraulics'>('hvac');
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [sheetSize, setSheetSize] = useState<'A0' | 'A1' | 'A2' | 'A3' | 'A4'>('A1');
  const [sheetScale, setSheetScale] = useState<string>('1:100');
  const [scheduleType, setScheduleType] = useState<'doors' | 'windows' | 'rooms' | 'equipment' | 'panels'>('doors');
  const [overheadPct, setOverheadPct] = useState<number>(12);
  const [markupPct, setMarkupPct] = useState<number>(10);

  if (mode === 'CALCULATIONS') {
    const rooms = calculateRoomsHVAC(project);
    const ducts = calculateDucts(project);
    const circuits = calculateElectricalCircuits(project);
    const pipes = calculatePipes(project);

    return (
      <div className="flex-1 overflow-y-auto p-5 bg-[#0b1118] dark:bg-[#0b1118] bg-slate-50 space-y-5">
        {/* Header + Rule Engine Standard Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight">Engineering Calculation &amp; Rule Engine</h2>
            <p className="text-xs text-[#8b9cb2] mt-0.5">
              Advisory parametric formulas synced live with BIM geometry · Verify assumptions before issuing for construction.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono-tech text-[11px] text-[#8b9cb2] uppercase">Code Standard:</span>
            {(['ASHRAE', 'IEC', 'NFPA', 'EN', 'ISO'] as EngineeringStandard[]).map((std) => (
              <button
                key={std}
                type="button"
                onClick={() => onUpdateProjectMeta({ standard: std })}
                className={`px-2.5 py-1 text-[11px] font-mono-tech rounded border ${
                  project.standard === std
                    ? 'bg-[#00d2ff] text-[#0b1118] border-[#00d2ff] font-bold'
                    : 'bg-[#17202b] text-[#bbc9cf] border-[#2c3f58]'
                }`}
              >
                {std}
              </button>
            ))}
          </div>
        </div>

        {/* Sub-discipline tabs */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setCalcTab('hvac')}
            className={`px-4 py-2 text-xs font-mono-tech uppercase rounded border flex items-center gap-2 ${
              calcTab === 'hvac'
                ? 'bg-[#1b2636] border-[#00d2ff] text-[#00d2ff]'
                : 'bg-[#111a24] border-[#1e2b3d] text-[#8b9cb2]'
            }`}
          >
            HVAC Loads &amp; Ducts ({rooms.length} Rooms)
          </button>
          <button
            type="button"
            onClick={() => setCalcTab('electrical')}
            className={`px-4 py-2 text-xs font-mono-tech uppercase rounded border flex items-center gap-2 ${
              calcTab === 'electrical'
                ? 'bg-[#1b2636] border-[#ff9f1c] text-[#ff9f1c]'
                : 'bg-[#111a24] border-[#1e2b3d] text-[#8b9cb2]'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Electrical Load &amp; Voltage Drop ({circuits.length})
          </button>
          <button
            type="button"
            onClick={() => setCalcTab('hydraulics')}
            className={`px-4 py-2 text-xs font-mono-tech uppercase rounded border flex items-center gap-2 ${
              calcTab === 'hydraulics'
                ? 'bg-[#1b2636] border-[#10b981] text-[#10b981]'
                : 'bg-[#111a24] border-[#1e2b3d] text-[#8b9cb2]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" /> Plumbing, Fire &amp; Gas ({pipes.length})
          </button>
        </div>

        {calcTab === 'hvac' && (
          <div className="space-y-5">
            {/* Room Cooling & Heating Schedule */}
            <div className="border border-[#1e2b3d] rounded bg-[#111a24] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#17202b] border-b border-[#1e2b3d] flex items-center justify-between">
                <span className="font-mono-tech text-xs uppercase text-[#00d2ff]">
                  Room Thermal Loads ({project.standard} Fundamentals)
                </span>
                <span className="font-mono-tech text-xs text-[#dae3f1]">
                  Total Cooling: {rooms.reduce((a, r) => a + r.totalCoolingLoadKW, 0).toFixed(2)} kW (
                  {rooms.reduce((a, r) => a + r.coolingLoadTR, 0).toFixed(1)} TR)
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0d151f] font-mono-tech text-[10px] uppercase text-[#8b9cb2]">
                    <tr>
                      <th className="px-3 py-2">Room</th>
                      <th className="px-3 py-2 text-right">Area</th>
                      <th className="px-3 py-2 text-right">Sensible</th>
                      <th className="px-3 py-2 text-right">Latent</th>
                      <th className="px-3 py-2 text-right">Total Cool</th>
                      <th className="px-3 py-2 text-right">Heating</th>
                      <th className="px-3 py-2 text-right">Airflow</th>
                      <th className="px-3 py-2 text-right">ACH</th>
                      <th className="px-3 py-2">Status / Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2b3d] font-mono-tech">
                    {rooms.map((r) => (
                      <React.Fragment key={r.roomId}>
                        <tr className="hover:bg-[#17202b]">
                          <td className="px-3 py-2 font-sans font-medium text-[#dae3f1]">
                            {r.roomNumber} · {r.roomName}
                          </td>
                          <td className="px-3 py-2 text-right">{formatArea(r.areaM2, project.unitSystem)}</td>
                          <td className="px-3 py-2 text-right">{r.sensibleLoadKW} kW</td>
                          <td className="px-3 py-2 text-right">{r.latentLoadKW} kW</td>
                          <td className="px-3 py-2 text-right text-[#00d2ff] font-semibold">
                            {r.totalCoolingLoadKW} kW
                          </td>
                          <td className="px-3 py-2 text-right">{r.heatingLoadKW} kW</td>
                          <td className="px-3 py-2 text-right">{formatFlow(r.requiredAirflowLs, project.unitSystem)}</td>
                          <td className="px-3 py-2 text-right">{r.ach}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {r.warnings.length > 0 ? (
                                <span className="text-[#ff9f1c] whitespace-nowrap">[ WARN ]</span>
                              ) : (
                                <span className="text-[#10b981] whitespace-nowrap">[ OK ]</span>
                              )}
                              <button
                                type="button"
                                onClick={() => setExpandedRoomId(expandedRoomId === r.roomId ? null : r.roomId)}
                                className="px-2 py-0.5 text-[10px] border border-[#2c3f58] rounded hover:border-[#00d2ff] text-[#a5e7ff]"
                              >
                                {expandedRoomId === r.roomId ? 'Hide Steps' : 'Steps'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expandedRoomId === r.roomId && (
                          <tr className="bg-[#0d151f]">
                            <td colSpan={9} className="p-3 space-y-2">
                              {r.warnings.map((w, wi) => (
                                <div key={wi} className="text-[11px] text-[#ff9f1c]">
                                  [WARN] {w}
                                </div>
                              ))}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {r.steps.map((st, si) => (
                                  <div key={si} className="p-2 rounded bg-[#111a24] border border-[#1e2b3d] text-[11px]">
                                    <div className="text-[#00d2ff] font-semibold">{st.label}</div>
                                    <div className="text-[#8b9cb2]">Formula: {st.formula}</div>
                                    <div className="text-[#bbc9cf]">Inputs: {st.inputs}</div>
                                    <div className="text-[#69f6b9] font-semibold mt-0.5">
                                      Result: {st.result} {st.unit}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Equal Friction Duct Sizing */}
            <div className="border border-[#1e2b3d] rounded bg-[#111a24] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#17202b] border-b border-[#1e2b3d] font-mono-tech text-xs uppercase text-[#00d2ff]">
                Duct Sizing &amp; Friction Loss
              </div>
              <table className="w-full text-left text-xs font-mono-tech">
                <thead className="bg-[#0d151f] text-[10px] uppercase text-[#8b9cb2]">
                  <tr>
                    <th className="px-3 py-2">Duct Segment</th>
                    <th className="px-3 py-2 text-right">Airflow</th>
                    <th className="px-3 py-2 text-right">Current Size</th>
                    <th className="px-3 py-2 text-right">Velocity</th>
                    <th className="px-3 py-2 text-right">Friction</th>
                    <th className="px-3 py-2 text-right">Recommended</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2b3d]">
                  {ducts.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2 font-sans">{d.name}</td>
                      <td className="px-3 py-2 text-right">{d.airflowLs} L/s</td>
                      <td className="px-3 py-2 text-right">
                        {d.widthMm}×{d.heightMm} mm
                      </td>
                      <td className="px-3 py-2 text-right">{d.velocityMs} m/s</td>
                      <td className="px-3 py-2 text-right">{d.frictionPaM} Pa/m</td>
                      <td className="px-3 py-2 text-right text-[#a5e7ff]">{d.recommendedSize}</td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            d.status === 'OK'
                              ? 'text-[#10b981]'
                              : d.status === 'WARN'
                                ? 'text-[#ff9f1c]'
                                : 'text-[#ef4444]'
                          }
                        >
                          [ {d.status} ]
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {calcTab === 'electrical' && (
          <div className="border border-[#1e2b3d] rounded bg-[#111a24] overflow-hidden">
            <div className="px-4 py-2.5 bg-[#17202b] border-b border-[#1e2b3d] flex items-center justify-between">
              <span className="font-mono-tech text-xs uppercase text-[#ff9f1c]">
                IEC 60364 Circuit Load, Cable Sizing &amp; Voltage Drop
              </span>
              <span className="font-mono-tech text-[11px] text-[#8b9cb2]">Max Allowed ΔV: 3.0%</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono-tech">
                <thead className="bg-[#0d151f] text-[10px] uppercase text-[#8b9cb2]">
                  <tr>
                    <th className="px-3 py-2">Circuit</th>
                    <th className="px-3 py-2 text-right">V / Ph</th>
                    <th className="px-3 py-2 text-right">Demand kW</th>
                    <th className="px-3 py-2 text-right">Current (A)</th>
                    <th className="px-3 py-2 text-right">Len (m)</th>
                    <th className="px-3 py-2 text-right">Cable</th>
                    <th className="px-3 py-2 text-right">Drop %</th>
                    <th className="px-3 py-2 text-right">Breaker</th>
                    <th className="px-3 py-2">Status / Fix</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2b3d]">
                  {circuits.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-sans">
                        <span className="font-mono-tech text-[#ff9f1c] mr-1.5">{c.circuitId}</span>
                        {c.name}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {c.voltageV}V / {c.phaseCount}Φ
                      </td>
                      <td className="px-3 py-2 text-right">{c.demandKW} kW</td>
                      <td className="px-3 py-2 text-right">{c.currentA} A</td>
                      <td className="px-3 py-2 text-right">{c.lengthM} m</td>
                      <td className="px-3 py-2 text-right">{c.cableSizeMm2} mm²</td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          c.voltageDropPct > 3 ? 'text-[#ef4444]' : 'text-[#10b981]'
                        }`}
                      >
                        {c.voltageDropPct}%
                      </td>
                      <td className="px-3 py-2 text-right">{c.breakerA} A</td>
                      <td className="px-3 py-2">
                        {c.status === 'OK' ? (
                          <span className="text-[#10b981]">[ OK ]</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onUpdateElement(c.id, { cableSizeMm2: c.recommendedCableMm2 })}
                            className="px-2 py-0.5 text-[10px] bg-[#ff9f1c]/20 border border-[#ff9f1c] text-[#ff9f1c] rounded hover:bg-[#ff9f1c] hover:text-[#0b1118]"
                          >
                            UPGRADE TO {c.recommendedCableMm2}mm²
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {calcTab === 'hydraulics' && (
          <div className="border border-[#1e2b3d] rounded bg-[#111a24] overflow-hidden">
            <div className="px-4 py-2.5 bg-[#17202b] border-b border-[#1e2b3d] font-mono-tech text-xs uppercase text-[#10b981]">
              Plumbing, Fire Protection &amp; Fuel Gas Hydraulic Sizing
            </div>
            <table className="w-full text-left text-xs font-mono-tech">
              <thead className="bg-[#0d151f] text-[10px] uppercase text-[#8b9cb2]">
                <tr>
                  <th className="px-3 py-2">Pipe Line</th>
                  <th className="px-3 py-2">Discipline</th>
                  <th className="px-3 py-2 text-right">Flow</th>
                  <th className="px-3 py-2 text-right">DN</th>
                  <th className="px-3 py-2 text-right">Velocity</th>
                  <th className="px-3 py-2 text-right">Pressure Loss</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b3d]">
                {pipes.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-sans">{p.name}</td>
                    <td className="px-3 py-2">{p.discipline}</td>
                    <td className="px-3 py-2 text-right">{p.flowRate}</td>
                    <td className="px-3 py-2 text-right">DN{p.diameterMm}</td>
                    <td className="px-3 py-2 text-right">{p.velocityMs} m/s</td>
                    <td className="px-3 py-2 text-right">{p.pressureLoss}</td>
                    <td className="px-3 py-2">
                      <span className={p.status === 'OK' ? 'text-[#10b981]' : 'text-[#ff9f1c]'}>[ {p.status} ]</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'ENERGY') {
    const energy = calculateEnergyAnalysis(project);
    const ratings: Array<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'> = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const ratingColors: Record<string, string> = {
      A: '#10b981',
      B: '#34d399',
      C: '#a3e635',
      D: '#facc15',
      E: '#fb923c',
      F: '#f97316',
      G: '#ef4444',
    };
    const breakdown = [
      { label: 'HVAC Cooling', kwh: energy.annualCoolingKWh, color: '#00d2ff' },
      { label: 'Space Heating', kwh: energy.annualHeatingKWh, color: '#ff9f1c' },
      { label: 'Lighting Systems', kwh: energy.annualLightingKWh, color: '#69f6b9' },
      { label: 'Process & SCADA Equipment', kwh: energy.annualEquipmentKWh, color: '#a78bfa' },
    ];

    return (
      <div className="flex-1 overflow-y-auto p-5 bg-[#0b1118] space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2b3d]">
          <div>
            <h2 className="font-display text-xl font-bold">Building Energy Performance &amp; Solar Gain Analysis</h2>
            <p className="text-xs text-[#8b9cb2]">
              Automatically extracted from BIM thermal envelope ({energy.envelopeAreaM2} m²), glazing ratio (
              {energy.windowToWallRatioPct}%), and room HVAC loads.
            </p>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-[#17202b] border border-[#2c3f58] rounded">
            <span className="font-mono-tech text-xs text-[#8b9cb2]">ENERGY RATING</span>
            <span
              className="font-display text-2xl font-bold px-2.5 py-0.5 rounded"
              style={{ backgroundColor: ratingColors[energy.rating], color: '#0b1118' }}
            >
              {energy.rating}
            </span>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono-tech">
          <div className="p-4 bg-[#111a24] border border-[#1e2b3d] rounded">
            <div className="text-[10px] text-[#8b9cb2] uppercase">Energy Use Intensity (EUI)</div>
            <div className="text-2xl font-semibold text-[#00d2ff] mt-1">{energy.euiKWhM2Yr}</div>
            <div className="text-[11px] text-[#8b9cb2]">kWh / m² · yr</div>
          </div>
          <div className="p-4 bg-[#111a24] border border-[#1e2b3d] rounded">
            <div className="text-[10px] text-[#8b9cb2] uppercase">Annual Consumption</div>
            <div className="text-2xl font-semibold text-[#dae3f1] mt-1">
              {energy.totalAnnualKWh.toLocaleString()}
            </div>
            <div className="text-[11px] text-[#8b9cb2]">kWh / year</div>
          </div>
          <div className="p-4 bg-[#111a24] border border-[#1e2b3d] rounded">
            <div className="text-[10px] text-[#8b9cb2] uppercase">Carbon Emissions</div>
            <div className="text-2xl font-semibold text-[#ff9f1c] mt-1">
              {(energy.co2KgYr / 1000).toFixed(1)}
            </div>
            <div className="text-[11px] text-[#8b9cb2]">metric tons CO₂ / yr</div>
          </div>
          <div className="p-4 bg-[#111a24] border border-[#1e2b3d] rounded">
            <div className="text-[10px] text-[#8b9cb2] uppercase">Envelope U-Value Avg</div>
            <div className="text-2xl font-semibold text-[#69f6b9] mt-1">{energy.avgWallUValue}</div>
            <div className="text-[11px] text-[#8b9cb2]">W/m²K (Walls) · {energy.avgWindowUValue} (Glass)</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* End-use Segmented Breakdown */}
          <div className="p-4 bg-[#111a24] border border-[#1e2b3d] rounded space-y-3">
            <div className="font-mono-tech text-xs uppercase text-[#00d2ff]">Annual Energy Breakdown</div>
            {breakdown.map((b) => {
              const pct = Math.round((b.kwh / Math.max(1, energy.totalAnnualKWh)) * 100);
              return (
                <div key={b.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono-tech">
                    <span>{b.label}</span>
                    <span>
                      {b.kwh.toLocaleString()} kWh ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 bg-[#0b1118] border border-[#1e2b3d] rounded-sm overflow-hidden flex gap-0.5 p-0.5">
                    <div className="h-full rounded-xs" style={{ width: `${pct}%`, backgroundColor: b.color }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Solar Gains by Orientation & Rating Scale */}
          <div className="p-4 bg-[#111a24] border border-[#1e2b3d] rounded space-y-4">
            <div className="flex items-center gap-2 font-mono-tech text-xs uppercase text-[#ff9f1c]">
              <Sun className="w-4 h-4" /> Peak Solar Radiation Gain by Facade Orientation
            </div>
            <div className="grid grid-cols-4 gap-2 font-mono-tech">
              {(['N', 'E', 'S', 'W'] as const).map((dir) => (
                <div key={dir} className="p-2.5 bg-[#17202b] border border-[#2c3f58] rounded text-center">
                  <div className="text-[10px] text-[#8b9cb2]">{dir} FACADE</div>
                  <div className="text-base font-semibold text-[#ffb86b] mt-1">
                    {energy.solarGainsByOrientationKW[dir]} kW
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 pt-2">
              <div className="font-mono-tech text-[10px] text-[#8b9cb2] uppercase">EU / ISO Energy Rating Scale</div>
              <div className="flex gap-1">
                {ratings.map((r) => (
                  <div
                    key={r}
                    className={`flex-1 py-1.5 text-center font-mono-tech text-xs font-bold rounded-sm ${
                      energy.rating === r ? 'ring-2 ring-white scale-105' : 'opacity-45'
                    }`}
                    style={{ backgroundColor: ratingColors[r], color: '#0b1118' }}
                  >
                    {r}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'CLASH') {
    return (
      <div className="flex-1 overflow-y-auto p-5 bg-[#0b1118] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#1e2b3d]">
          <div>
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#ef4444]" /> Multi-Discipline 3D Clash Detection
            </h2>
            <p className="text-xs text-[#8b9cb2]">
              Real-time spatial bounding-volume intersection check across Structure, HVAC, Plumbing, Electrical &amp; Fire Protection.
            </p>
          </div>
          <div className="font-mono-tech text-xs px-3 py-1.5 rounded bg-[#17202b] border border-[#2c3f58]">
            {clashes.length === 0 ? (
              <span className="text-[#10b981] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> ZERO CLASHES DETECTED
              </span>
            ) : (
              <span className="text-[#ef4444]">{clashes.length} ACTIVE INTERFERENCES</span>
            )}
          </div>
        </div>

        {clashes.length === 0 ? (
          <div className="p-8 text-center border border-[#1e2b3d] rounded bg-[#111a24] text-sm text-[#10b981]">
            All MEP ducts, pipes, cable trays, and structural beams have verified positive spatial clearance.
          </div>
        ) : (
          <div className="border border-[#1e2b3d] rounded bg-[#111a24] overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0d151f] font-mono-tech text-[10px] uppercase text-[#8b9cb2]">
                <tr>
                  <th className="px-3 py-2.5">Clash ID</th>
                  <th className="px-3 py-2.5">Element A</th>
                  <th className="px-3 py-2.5">Element B</th>
                  <th className="px-3 py-2.5">3D Coordinates (X, Y, Z)</th>
                  <th className="px-3 py-2.5 text-right">Overlap</th>
                  <th className="px-3 py-2.5">Severity</th>
                  <th className="px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b3d]">
                {clashes.map((c) => (
                  <tr key={c.id} className="hover:bg-[#17202b]">
                    <td className="px-3 py-2.5 font-mono-tech text-[#00d2ff] font-semibold">{c.id}</td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono-tech text-[10px] text-[#8b9cb2] block">{c.elementACategory}</span>
                      {c.elementAName}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono-tech text-[10px] text-[#8b9cb2] block">{c.elementBCategory}</span>
                      {c.elementBName}
                    </td>
                    <td className="px-3 py-2.5 font-mono-tech">
                      ({c.location.x}, {c.location.y}, {c.location.z}m)
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono-tech text-[#ef4444]">
                      {Math.abs(c.clearanceMm)} mm
                    </td>
                    <td className="px-3 py-2.5 font-mono-tech">
                      <span
                        className={
                          c.severity === 'Critical' ? 'text-[#ef4444] font-semibold' : 'text-[#ff9f1c]'
                        }
                      >
                        [{c.severity.toUpperCase()}]
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onLocateClash(c)}
                          className="px-2 py-1 text-[10px] font-mono-tech bg-[#243348] text-[#00d2ff] rounded hover:bg-[#00d2ff] hover:text-[#0b1118]"
                        >
                          LOCATE 3D
                        </button>
                        <button
                          type="button"
                          onClick={() => onAutoResolveClash(c)}
                          className="px-2 py-1 text-[10px] font-mono-tech bg-[#10b981]/20 border border-[#10b981] text-[#10b981] rounded hover:bg-[#10b981] hover:text-[#0b1118] flex items-center gap-1"
                        >
                          <Wrench className="w-3 h-3" /> AUTO-RESOLVE
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'BOQ') {
    const boq = generateBOQ(project);
    const directCost = boq.reduce((a, b) => a + b.totalUSD, 0);
    const overheadCost = directCost * (overheadPct / 100);
    const markupCost = (directCost + overheadCost) * (markupPct / 100);
    const grandTotal = directCost + overheadCost + markupCost;

    return (
      <div className="flex-1 overflow-y-auto p-5 bg-[#0b1118] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[#1e2b3d]">
          <div>
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#10b981]" /> Automatic Quantity Takeoff &amp; BOQ Costing
            </h2>
            <p className="text-xs text-[#8b9cb2]">
              Quantities extracted directly from live BIM elements, materials, and equipment schedules.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(['USD', 'EUR', 'IQD'] as CurrencyCode[]).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => onUpdateProjectMeta({ currency: cur })}
                className={`px-3 py-1.5 text-xs font-mono-tech rounded border ${
                  project.currency === cur
                    ? 'bg-[#00d2ff] text-[#0b1118] border-[#00d2ff] font-bold'
                    : 'bg-[#17202b] text-[#bbc9cf] border-[#2c3f58]'
                }`}
              >
                {cur}
              </button>
            ))}
            <button
              type="button"
              onClick={() => downloadTextFile(`${project.projectNumber}-BOQ.csv`, exportBOQToCSV(boq, project), 'text/csv')}
              className="px-3 py-1.5 text-xs font-mono-tech bg-[#10b981] text-[#0b1118] font-bold rounded flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Cost Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono-tech">
          <div className="p-3 bg-[#111a24] border border-[#1e2b3d] rounded">
            <div className="text-[10px] text-[#8b9cb2]">DIRECT COST</div>
            <div className="text-lg font-semibold text-[#dae3f1]">{formatCurrency(directCost, project.currency)}</div>
          </div>
          <div className="p-3 bg-[#111a24] border border-[#1e2b3d] rounded flex items-center justify-between">
            <div>
              <div className="text-[10px] text-[#8b9cb2]">OVERHEAD ({overheadPct}%)</div>
              <div className="text-lg font-semibold text-[#ffb86b]">{formatCurrency(overheadCost, project.currency)}</div>
            </div>
            <input
              type="number"
              min={0}
              max={40}
              value={overheadPct}
              onChange={(e) => setOverheadPct(parseFloat(e.target.value) || 0)}
              aria-label="Overhead percentage"
              className="w-12 px-1 py-0.5 text-xs bg-[#0b1118] border border-[#2c3f58] rounded text-right"
            />
          </div>
          <div className="p-3 bg-[#111a24] border border-[#1e2b3d] rounded flex items-center justify-between">
            <div>
              <div className="text-[10px] text-[#8b9cb2]">CONTRACTOR MARKUP ({markupPct}%)</div>
              <div className="text-lg font-semibold text-[#ffb86b]">{formatCurrency(markupCost, project.currency)}</div>
            </div>
            <input
              type="number"
              min={0}
              max={40}
              value={markupPct}
              onChange={(e) => setMarkupPct(parseFloat(e.target.value) || 0)}
              aria-label="Markup percentage"
              className="w-12 px-1 py-0.5 text-xs bg-[#0b1118] border border-[#2c3f58] rounded text-right"
            />
          </div>
          <div className="p-3 bg-[#17202b] border border-[#00d2ff]/60 rounded">
            <div className="text-[10px] text-[#00d2ff]">ESTIMATED PROJECT TOTAL</div>
            <div className="text-lg font-bold text-[#69f6b9]">{formatCurrency(grandTotal, project.currency)}</div>
          </div>
        </div>

        {/* BOQ Table */}
        <div className="border border-[#1e2b3d] rounded bg-[#111a24] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0d151f] font-mono-tech text-[10px] uppercase text-[#8b9cb2]">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit Price</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2b3d]">
              {boq.map((row) => (
                <tr key={row.itemNo} className="hover:bg-[#17202b]">
                  <td className="px-3 py-2 font-mono-tech text-[#00d2ff]">{row.itemNo}</td>
                  <td className="px-3 py-2 font-mono-tech text-[11px] text-[#8b9cb2]">{row.category}</td>
                  <td className="px-3 py-2">
                    <div>{row.description}</div>
                    <div className="text-[10px] text-[#8b9cb2]">{row.notes}</div>
                  </td>
                  <td className="px-3 py-2 font-mono-tech">{row.unit}</td>
                  <td className="px-3 py-2 text-right font-mono-tech">{row.quantity}</td>
                  <td className="px-3 py-2 text-right font-mono-tech">
                    {formatCurrency(row.unitPriceUSD, project.currency)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono-tech font-semibold text-[#69f6b9]">
                    {formatCurrency(row.totalUSD, project.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // SHEETS & AUTOMATIC SCHEDULES & PRINTABLE REPORT
  const doors = project.elements.filter((e) => e.kind === 'door');
  const windows = project.elements.filter((e) => e.kind === 'window');
  const rooms = calculateRoomsHVAC(project);
  const equipment = project.elements.filter((e) => 'position' in e);
  const circuits = calculateElectricalCircuits(project);

  return (
    <div className="flex-1 overflow-y-auto p-5 bg-[#0b1118] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1e2b3d] no-print">
        <div>
          <h2 className="font-display text-xl font-bold">Drawing Sheets, Schedules &amp; Technical Reports</h2>
          <p className="text-xs text-[#8b9cb2]">
            ISO A0–A4 Title Block generator, live BIM schedules, and printable engineering PDF output.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sheetSize}
            onChange={(e) => setSheetSize(e.target.value as 'A0' | 'A1' | 'A2' | 'A3' | 'A4')}
            aria-label="Drawing sheet paper size"
            className="px-2 py-1.5 text-xs font-mono-tech bg-[#17202b] border border-[#2c3f58] rounded"
          >
            {['A0', 'A1', 'A2', 'A3', 'A4'].map((s) => (
              <option key={s} value={s}>
                ISO {s}
              </option>
            ))}
          </select>
          <select
            value={sheetScale}
            onChange={(e) => setSheetScale(e.target.value)}
            aria-label="Drawing scale"
            className="px-2 py-1.5 text-xs font-mono-tech bg-[#17202b] border border-[#2c3f58] rounded"
          >
            {['1:50', '1:100', '1:200', '1:500'].map((sc) => (
              <option key={sc} value={sc}>
                Scale {sc}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => window.print()}
            className="px-3 py-1.5 text-xs font-mono-tech bg-[#00d2ff] text-[#0b1118] font-bold rounded flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* Engineering Drawing Sheet Frame + Title Block */}
      <div className="border-2 border-[#3c494e] bg-[#111a24] p-4 rounded space-y-4">
        <div className="flex flex-wrap justify-between items-start gap-4 border border-[#2c3f58] p-4 bg-[#0b1118]">
          <div>
            <div className="font-mono-tech text-[10px] text-[#00d2ff] uppercase">
              SHEET {sheetSize} · SCALE {sheetScale} · REV R03
            </div>
            <h3 className="font-display text-lg font-bold mt-1">{project.name}</h3>
            <div className="text-xs text-[#8b9cb2]">
              Client: {project.client} · Location: {project.location}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-[11px] font-mono-tech border border-[#2c3f58] p-2.5 bg-[#111a24]">
            <div>
              <span className="text-[#8b9cb2] block text-[9px]">DESIGNER</span>
              {project.branding.designerName}
            </div>
            <div>
              <span className="text-[#8b9cb2] block text-[9px]">CHECKER</span>
              {project.branding.checkerName}
            </div>
            <div>
              <span className="text-[#8b9cb2] block text-[9px]">APPROVER</span>
              {project.branding.approverName}
            </div>
            <div>
              <span className="text-[#8b9cb2] block text-[9px]">DWG NO</span>
              {project.projectNumber}-BIM-001
            </div>
            <div>
              <span className="text-[#8b9cb2] block text-[9px]">STANDARD</span>
              {project.standard}
            </div>
            <div>
              <span className="text-[#8b9cb2] block text-[9px]">DATE</span>
              {project.updatedAt.slice(0, 10)}
            </div>
          </div>
        </div>

        {/* Schedule Switcher */}
        <div className="flex flex-wrap gap-1.5 no-print">
          {(
            [
              ['doors', `Door Schedule (${doors.length})`],
              ['windows', `Window Schedule (${windows.length})`],
              ['rooms', `Room & HVAC Schedule (${rooms.length})`],
              ['equipment', `Equipment Schedule (${equipment.length})`],
              ['panels', `Electrical Circuit Schedule (${circuits.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setScheduleType(key)}
              className={`px-3 py-1.5 text-xs font-mono-tech rounded border ${
                scheduleType === key
                  ? 'bg-[#243348] border-[#00d2ff] text-[#00d2ff]'
                  : 'bg-[#17202b] border-[#1e2b3d] text-[#8b9cb2]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Live Automatic Schedule Table */}
        <div className="border border-[#1e2b3d] rounded overflow-x-auto">
          {scheduleType === 'doors' && (
            <table className="w-full text-left text-xs font-mono-tech">
              <thead className="bg-[#17202b] text-[10px] text-[#8b9cb2] uppercase">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Door Assembly</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2 text-right">Width</th>
                  <th className="px-3 py-2 text-right">Height</th>
                  <th className="px-3 py-2">Fire Rating</th>
                  <th className="px-3 py-2">Host Wall</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b3d]">
                {doors.map((d) =>
                  d.kind === 'door' ? (
                    <tr key={d.id}>
                      <td className="px-3 py-2 text-[#00d2ff]">{d.id}</td>
                      <td className="px-3 py-2 font-sans">{d.name}</td>
                      <td className="px-3 py-2">{d.subType}</td>
                      <td className="px-3 py-2 text-right">{d.widthM.toFixed(2)} m</td>
                      <td className="px-3 py-2 text-right">{d.heightM.toFixed(2)} m</td>
                      <td className="px-3 py-2 text-[#ffb86b]">{d.fireRating}</td>
                      <td className="px-3 py-2">{d.hostWallId}</td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          )}
          {scheduleType === 'windows' && (
            <table className="w-full text-left text-xs font-mono-tech">
              <thead className="bg-[#17202b] text-[10px] text-[#8b9cb2] uppercase">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Window</th>
                  <th className="px-3 py-2 text-right">W × H (m)</th>
                  <th className="px-3 py-2 text-right">Sill (m)</th>
                  <th className="px-3 py-2 text-right">U-Value</th>
                  <th className="px-3 py-2 text-right">SHGC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b3d]">
                {windows.map((w) =>
                  w.kind === 'window' ? (
                    <tr key={w.id}>
                      <td className="px-3 py-2 text-[#00d2ff]">{w.id}</td>
                      <td className="px-3 py-2 font-sans">{w.name}</td>
                      <td className="px-3 py-2 text-right">
                        {w.widthM.toFixed(2)} × {w.heightM.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right">{w.sillHeightM.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right">{w.uValue}</td>
                      <td className="px-3 py-2 text-right">{w.shgc}</td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          )}
          {scheduleType === 'rooms' && (
            <table className="w-full text-left text-xs font-mono-tech">
              <thead className="bg-[#17202b] text-[10px] text-[#8b9cb2] uppercase">
                <tr>
                  <th className="px-3 py-2">Room</th>
                  <th className="px-3 py-2 text-right">Area (m²)</th>
                  <th className="px-3 py-2 text-right">Volume (m³)</th>
                  <th className="px-3 py-2 text-right">Cooling (kW)</th>
                  <th className="px-3 py-2 text-right">Airflow (L/s)</th>
                  <th className="px-3 py-2">Recommended Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b3d]">
                {rooms.map((r) => (
                  <tr key={r.roomId}>
                    <td className="px-3 py-2 font-sans">
                      {r.roomNumber} · {r.roomName}
                    </td>
                    <td className="px-3 py-2 text-right">{r.areaM2.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right">{r.volumeM3.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right text-[#00d2ff]">{r.totalCoolingLoadKW}</td>
                    <td className="px-3 py-2 text-right">{r.requiredAirflowLs}</td>
                    <td className="px-3 py-2 font-sans">{r.recommendedUnit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {scheduleType === 'equipment' && (
            <table className="w-full text-left text-xs font-mono-tech">
              <thead className="bg-[#17202b] text-[10px] text-[#8b9cb2] uppercase">
                <tr>
                  <th className="px-3 py-2">Tag</th>
                  <th className="px-3 py-2">Discipline</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Power (kW)</th>
                  <th className="px-3 py-2 text-right">Dims (m)</th>
                  <th className="px-3 py-2">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b3d]">
                {equipment.map((eq) =>
                  'position' in eq ? (
                    <tr key={eq.id}>
                      <td className="px-3 py-2 text-[#00d2ff]">{eq.tag}</td>
                      <td className="px-3 py-2">{eq.category}</td>
                      <td className="px-3 py-2 font-sans">{eq.name}</td>
                      <td className="px-3 py-2 text-right">{eq.ratedPowerKW}</td>
                      <td className="px-3 py-2 text-right">
                        {eq.widthM}×{eq.depthM}×{eq.heightM}
                      </td>
                      <td className="px-3 py-2 text-[#10b981]">{eq.valveState || 'ACTIVE'}</td>
                    </tr>
                  ) : null,
                )}
              </tbody>
            </table>
          )}
          {scheduleType === 'panels' && (
            <table className="w-full text-left text-xs font-mono-tech">
              <thead className="bg-[#17202b] text-[10px] text-[#8b9cb2] uppercase">
                <tr>
                  <th className="px-3 py-2">Circuit</th>
                  <th className="px-3 py-2">Load</th>
                  <th className="px-3 py-2 text-right">Current</th>
                  <th className="px-3 py-2 text-right">Cable</th>
                  <th className="px-3 py-2 text-right">Breaker</th>
                  <th className="px-3 py-2 text-right">Drop %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b3d]">
                {circuits.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 text-[#ff9f1c]">{c.circuitId}</td>
                    <td className="px-3 py-2 font-sans">{c.name}</td>
                    <td className="px-3 py-2 text-right">{c.currentA} A</td>
                    <td className="px-3 py-2 text-right">{c.cableSizeMm2} mm²</td>
                    <td className="px-3 py-2 text-right">{c.breakerA} A</td>
                    <td className="px-3 py-2 text-right">{c.voltageDropPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
