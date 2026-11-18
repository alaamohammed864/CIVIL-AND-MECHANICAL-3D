import React, { useState } from 'react';
import {
  BIMElement,
  BIMProject,
  ClashItem,
  ValveState,
} from '../types/bim';
import { MATERIAL_LIBRARY } from '../data/libraries';
import {
  calculateElectricalCircuits,
  calculateEnergyAnalysis,
  calculateRoomsHVAC,
  distance2D,
  generateBOQ,
  polygonArea2D,
} from '../engine/calculations';
import { Bot, Copy, Send, Sliders, Sparkles, Trash2 } from 'lucide-react';

interface InspectorAndCopilotProps {
  project: BIMProject;
  selectedIds: string[];
  onUpdateElement: (id: string, patch: Partial<BIMElement>) => void;
  onDuplicateElement: (id: string) => void;
  onDeleteElements: (ids: string[]) => void;
  clashes: ClashItem[];
  onRunAIAutomate: () => void;
}

interface ChatMsg {
  role: 'user' | 'assistant' | 'error';
  text: string;
}

export const InspectorAndCopilot: React.FC<InspectorAndCopilotProps> = ({
  project,
  selectedIds,
  onUpdateElement,
  onDuplicateElement,
  onDeleteElements,
  clashes,
  onRunAIAutomate,
}) => {
  const [tab, setTab] = useState<'inspector' | 'copilot'>('inspector');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      text: 'Engineering Copilot ready. Ask me to analyze room cooling loads, detect HVAC/MEP clashes, audit electrical voltage drops, or review BOQ quantities.',
    },
  ]);

  const selectedEl = selectedIds.length === 1 ? project.elements.find((e) => e.id === selectedIds[0]) : undefined;
  const allMaterials = [...MATERIAL_LIBRARY, ...project.customMaterials];

  const sendCopilotQuery = async (customQuery?: string) => {
    const q = (customQuery || prompt).trim();
    if (!q || loading) return;
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    if (!customQuery) setPrompt('');
    setLoading(true);

    try {
      const hvac = calculateRoomsHVAC(project);
      const elec = calculateElectricalCircuits(project);
      const energy = calculateEnergyAnalysis(project);
      const boq = generateBOQ(project);

      const modelSummary = {
        projectName: project.name,
        standard: project.standard,
        levels: project.levels.map((l) => ({ name: l.name, elevationM: l.elevationM })),
        elementCount: project.elements.length,
        roomsHVAC: hvac.map((r) => ({
          roomNumber: r.roomNumber,
          name: r.roomName,
          areaM2: r.areaM2,
          coolingLoadKW: r.totalCoolingLoadKW,
          airflowLs: r.requiredAirflowLs,
          hasHVACServed: r.hasHVACServed,
          warnings: r.warnings,
        })),
        electricalCircuits: elec.map((c) => ({
          circuitId: c.circuitId,
          name: c.name,
          voltageV: c.voltageV,
          lengthM: c.lengthM,
          cableSizeMm2: c.cableSizeMm2,
          recommendedCableMm2: c.recommendedCableMm2,
          voltageDropPct: c.voltageDropPct,
          status: c.status,
        })),
        clashes: clashes.map((c) => ({
          id: c.id,
          description: c.description,
          severity: c.severity,
          clearanceMm: c.clearanceMm,
        })),
        energy: {
          euiKWhM2Yr: energy.euiKWhM2Yr,
          rating: energy.rating,
          totalAnnualKWh: energy.totalAnnualKWh,
          co2KgYr: energy.co2KgYr,
        },
        boqTotalUSD: Number(boq.reduce((a, b) => a + b.totalUSD, 0).toFixed(2)),
      };

      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: q, modelSummary }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'error', text: data.error || 'Copilot request failed.' }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', text: data.reply }]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'error', text: err instanceof Error ? err.message : 'Network error contacting Copilot API.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside
      className="w-full lg:w-80 h-full shrink-0 flex flex-col bg-[#111a24] dark:bg-[#111a24] bg-white lg:border-l border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200 overflow-hidden"
      aria-label="Properties Inspector and Engineering Copilot"
    >
      {/* Tabs */}
      <div className="flex border-b border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200 bg-[#0d151f] dark:bg-[#0d151f] bg-slate-50">
        <button
          type="button"
          onClick={() => setTab('inspector')}
          className={`flex-1 py-2 text-[11px] font-mono-tech uppercase tracking-wider border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            tab === 'inspector'
              ? 'border-[#00d2ff] text-[#00d2ff] bg-[#17202b] dark:bg-[#17202b] bg-white'
              : 'border-transparent text-[#8b9cb2] hover:text-[#dae3f1]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" /> Inspector
        </button>
        <button
          type="button"
          onClick={() => setTab('copilot')}
          className={`flex-1 py-2 text-[11px] font-mono-tech uppercase tracking-wider border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
            tab === 'copilot'
              ? 'border-[#00d2ff] text-[#00d2ff] bg-[#17202b] dark:bg-[#17202b] bg-white'
              : 'border-transparent text-[#8b9cb2] hover:text-[#dae3f1]'
          }`}
        >
          <Bot className="w-3.5 h-3.5" /> Copilot AI
        </button>
      </div>

      {tab === 'inspector' && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
          {!selectedEl ? (
            <div className="space-y-3">
              <div className="p-3 rounded bg-[#17202b] dark:bg-[#17202b] bg-slate-100 border border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200">
                <div className="font-mono-tech text-[10px] uppercase text-[#8b9cb2] mb-1">
                  {selectedIds.length > 1 ? `${selectedIds.length} Elements Selected` : 'Project Summary'}
                </div>
                <div className="font-display font-semibold text-sm">{project.name}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 font-mono-tech text-[11px]">
                  <div>
                    <span className="text-[#8b9cb2] block text-[10px]">ELEMENTS</span>
                    {project.elements.length}
                  </div>
                  <div>
                    <span className="text-[#8b9cb2] block text-[10px]">LEVELS</span>
                    {project.levels.length}
                  </div>
                  <div>
                    <span className="text-[#8b9cb2] block text-[10px]">STANDARD</span>
                    {project.standard}
                  </div>
                  <div>
                    <span className="text-[#8b9cb2] block text-[10px]">OPEN CLASHES</span>
                    <span className={clashes.length > 0 ? 'text-[#ef4444]' : 'text-[#10b981]'}>{clashes.length}</span>
                  </div>
                </div>
              </div>
              {selectedIds.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDeleteElements(selectedIds)}
                  className="w-full py-1.5 rounded bg-[#1b2636] border border-[#ef4444] text-[#ef4444] font-mono-tech text-[11px] hover:bg-[#ef4444]/10"
                >
                  DELETE {selectedIds.length} SELECTED
                </button>
              )}
              <p className="text-[11px] text-[#8b9cb2] leading-relaxed">
                Click any wall, door, window, room, duct, pipe, cable, or equipment block in the 2D Plan, 3D BIM viewport, or Model Tree to inspect and edit its parametric engineering properties.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Header ID & Actions */}
              <div className="flex items-center justify-between pb-2 border-b border-[#1e2b3d]">
                <div className="truncate pr-2">
                  <div className="font-mono-tech text-[10px] text-[#00d2ff] uppercase">
                    {selectedEl.category} · {selectedEl.id}
                  </div>
                  <div className="font-display font-semibold text-sm truncate">{selectedEl.name}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onDuplicateElement(selectedEl.id)}
                    title="Duplicate Element"
                    aria-label="Duplicate Element"
                    className="p-1.5 rounded bg-[#17202b] border border-[#2c3f58] text-[#bbc9cf] hover:text-[#00d2ff]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteElements([selectedEl.id])}
                    title="Delete Element"
                    aria-label="Delete Element"
                    className="p-1.5 rounded bg-[#17202b] border border-[#ef4444]/60 text-[#ef4444] hover:bg-[#ef4444]/15"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Common Identity Fields */}
              <div className="space-y-2">
                <label className="block">
                  <span className="text-[10px] font-mono-tech uppercase text-[#8b9cb2]">Element Name</span>
                  <input
                    type="text"
                    value={selectedEl.name}
                    onChange={(e) => onUpdateElement(selectedEl.id, { name: e.target.value })}
                    className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] dark:bg-[#0b1118] bg-slate-100 border border-[#2c3f58] rounded text-xs font-mono-tech"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-[10px] font-mono-tech uppercase text-[#8b9cb2]">Level</span>
                    <select
                      value={selectedEl.levelId}
                      onChange={(e) => onUpdateElement(selectedEl.id, { levelId: e.target.value })}
                      className="mt-0.5 w-full px-1.5 py-1 bg-[#0b1118] dark:bg-[#0b1118] bg-slate-100 border border-[#2c3f58] rounded text-[11px] font-mono-tech"
                    >
                      {project.levels.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name.split('—')[0].trim()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-mono-tech uppercase text-[#8b9cb2]">Layer</span>
                    <select
                      value={selectedEl.layerId}
                      onChange={(e) => onUpdateElement(selectedEl.id, { layerId: e.target.value })}
                      className="mt-0.5 w-full px-1.5 py-1 bg-[#0b1118] dark:bg-[#0b1118] bg-slate-100 border border-[#2c3f58] rounded text-[11px] font-mono-tech"
                    >
                      {project.layers.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              {/* Wall Parametric Properties */}
              {selectedEl.kind === 'wall' && (
                <div className="p-2.5 rounded bg-[#17202b] dark:bg-[#17202b] bg-slate-100 border border-[#1e2b3d] space-y-2">
                  <div className="text-[10px] font-mono-tech uppercase text-[#00d2ff]">Wall BIM Parameters</div>
                  <div className="grid grid-cols-2 gap-2 font-mono-tech">
                    <div>
                      <span className="text-[10px] text-[#8b9cb2] block">LENGTH</span>
                      {distance2D(selectedEl.start, selectedEl.end).toFixed(2)} m
                    </div>
                    <div>
                      <span className="text-[10px] text-[#8b9cb2] block">FIRE RATING</span>
                      {selectedEl.fireRating}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label>
                      <span className="text-[10px] font-mono-tech text-[#8b9cb2]">HEIGHT (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedEl.heightM}
                        onChange={(e) => onUpdateElement(selectedEl.id, { heightM: parseFloat(e.target.value) || 3 })}
                        className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                      />
                    </label>
                    <label>
                      <span className="text-[10px] font-mono-tech text-[#8b9cb2]">THICK (m)</span>
                      <input
                        type="number"
                        step="0.02"
                        value={selectedEl.thicknessM}
                        onChange={(e) => onUpdateElement(selectedEl.id, { thicknessM: parseFloat(e.target.value) || 0.2 })}
                        className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-[10px] font-mono-tech text-[#8b9cb2]">MATERIAL</span>
                    <select
                      value={selectedEl.materialId}
                      onChange={(e) => {
                        const mat = allMaterials.find((m) => m.id === e.target.value);
                        onUpdateElement(selectedEl.id, {
                          materialId: e.target.value,
                          uValue: mat ? mat.uValueWm2K : selectedEl.uValue,
                        });
                      }}
                      className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded text-[11px]"
                    >
                      {allMaterials.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (U={m.uValueWm2K})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[10px] font-mono-tech text-[#8b9cb2]">THERMAL U-VALUE (W/m²K)</span>
                    <input
                      type="number"
                      step="0.05"
                      value={selectedEl.uValue}
                      onChange={(e) => onUpdateElement(selectedEl.id, { uValue: parseFloat(e.target.value) || 0.5 })}
                      className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                    />
                  </label>
                </div>
              )}

              {/* Door / Window Parametric Properties */}
              {(selectedEl.kind === 'door' || selectedEl.kind === 'window') && (
                <div className="p-2.5 rounded bg-[#17202b] border border-[#1e2b3d] space-y-2">
                  <div className="text-[10px] font-mono-tech uppercase text-[#00d2ff]">
                    {selectedEl.kind.toUpperCase()} HOSTED ON {selectedEl.hostWallId}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label>
                      <span className="text-[10px] font-mono-tech text-[#8b9cb2]">WIDTH (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedEl.widthM}
                        onChange={(e) => onUpdateElement(selectedEl.id, { widthM: parseFloat(e.target.value) || 1 })}
                        className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                      />
                    </label>
                    <label>
                      <span className="text-[10px] font-mono-tech text-[#8b9cb2]">HEIGHT (m)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={selectedEl.heightM}
                        onChange={(e) => onUpdateElement(selectedEl.id, { heightM: parseFloat(e.target.value) || 2 })}
                        className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                      />
                    </label>
                    <label>
                      <span className="text-[10px] font-mono-tech text-[#8b9cb2]">WALL POS (0-1)</span>
                      <input
                        type="number"
                        step="0.05"
                        min={0.1}
                        max={0.9}
                        value={selectedEl.offsetRatio}
                        onChange={(e) =>
                          onUpdateElement(selectedEl.id, {
                            offsetRatio: Math.max(0.1, Math.min(0.9, parseFloat(e.target.value) || 0.5)),
                          })
                        }
                        className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                      />
                    </label>
                    <label>
                      <span className="text-[10px] font-mono-tech text-[#8b9cb2]">U-VALUE</span>
                      <input
                        type="number"
                        step="0.05"
                        value={selectedEl.uValue}
                        onChange={(e) => onUpdateElement(selectedEl.id, { uValue: parseFloat(e.target.value) || 1.2 })}
                        className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Room Thermal Properties */}
              {selectedEl.kind === 'room' && (
                <div className="p-2.5 rounded bg-[#17202b] border border-[#1e2b3d] space-y-2">
                  <div className="text-[10px] font-mono-tech uppercase text-[#10b981]">
                    Room {selectedEl.roomNumber} · {polygonArea2D(selectedEl.points).toFixed(1)} m²
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label>
                      <span className="text-[10px] font-mono-tech text-[#8b9cb2]">OCCUPANCY</span>
                      <input
                        type="number"
                        value={selectedEl.occupancy}
                        onChange={(e) => onUpdateElement(selectedEl.id, { occupancy: parseInt(e.target.value, 10) || 0 })}
                        className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                      />
                    </label>
                    <label>
                      <span className="text-[10px] font-mono-tech text-[#8b9cb2]">INDOOR °C</span>
                      <input
                        type="number"
                        value={selectedEl.indoorTempC}
                        onChange={(e) => onUpdateElement(selectedEl.id, { indoorTempC: parseFloat(e.target.value) || 22 })}
                        className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                      />
                    </label>
                    <label>
                      <span className="text-[10px] font-mono-tech text-[#8b9cb2]">LIGHT W/m²</span>
                      <input
                        type="number"
                        value={selectedEl.lightingWm2}
                        onChange={(e) => onUpdateElement(selectedEl.id, { lightingWm2: parseFloat(e.target.value) || 10 })}
                        className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                      />
                    </label>
                    <label>
                      <span className="text-[10px] font-mono-tech text-[#8b9cb2]">EQUIP W/m²</span>
                      <input
                        type="number"
                        value={selectedEl.equipmentWm2}
                        onChange={(e) => onUpdateElement(selectedEl.id, { equipmentWm2: parseFloat(e.target.value) || 15 })}
                        className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Linear MEP (Duct, Pipe, Cable) */}
              {(selectedEl.kind === 'duct' ||
                selectedEl.kind === 'cable' ||
                selectedEl.kind === 'cold_pipe' ||
                selectedEl.kind === 'hot_pipe' ||
                selectedEl.kind === 'drain_pipe' ||
                selectedEl.kind === 'fire_pipe' ||
                selectedEl.kind === 'gas_pipe') && (
                <div className="p-2.5 rounded bg-[#17202b] border border-[#1e2b3d] space-y-2">
                  <div className="text-[10px] font-mono-tech uppercase text-[#00d2ff]">
                    MEP Run · Length {distance2D(selectedEl.start, selectedEl.end).toFixed(2)} m
                  </div>
                  <label className="block">
                    <span className="text-[10px] font-mono-tech text-[#8b9cb2]">ELEVATION OFFSET (m)</span>
                    <input
                      type="number"
                      step="0.05"
                      value={selectedEl.elevationOffsetM}
                      onChange={(e) =>
                        onUpdateElement(selectedEl.id, { elevationOffsetM: parseFloat(e.target.value) || 2.8 })
                      }
                      className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                    />
                  </label>
                  {selectedEl.kind === 'duct' && (
                    <div className="grid grid-cols-3 gap-1.5">
                      <label>
                        <span className="text-[9px] font-mono-tech text-[#8b9cb2]">W (mm)</span>
                        <input
                          type="number"
                          step="50"
                          value={selectedEl.widthMm || 400}
                          onChange={(e) => onUpdateElement(selectedEl.id, { widthMm: parseInt(e.target.value, 10) || 400 })}
                          className="mt-0.5 w-full px-1.5 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                        />
                      </label>
                      <label>
                        <span className="text-[9px] font-mono-tech text-[#8b9cb2]">H (mm)</span>
                        <input
                          type="number"
                          step="50"
                          value={selectedEl.heightMm || 250}
                          onChange={(e) => onUpdateElement(selectedEl.id, { heightMm: parseInt(e.target.value, 10) || 250 })}
                          className="mt-0.5 w-full px-1.5 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                        />
                      </label>
                      <label>
                        <span className="text-[9px] font-mono-tech text-[#8b9cb2]">L/s</span>
                        <input
                          type="number"
                          step="50"
                          value={selectedEl.airflowLs || 800}
                          onChange={(e) => onUpdateElement(selectedEl.id, { airflowLs: parseInt(e.target.value, 10) || 800 })}
                          className="mt-0.5 w-full px-1.5 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                        />
                      </label>
                    </div>
                  )}
                  {selectedEl.kind === 'cable' && (
                    <div className="grid grid-cols-3 gap-1.5">
                      <label>
                        <span className="text-[9px] font-mono-tech text-[#8b9cb2]">POWER (W)</span>
                        <input
                          type="number"
                          step="500"
                          value={selectedEl.powerW || 8000}
                          onChange={(e) => onUpdateElement(selectedEl.id, { powerW: parseInt(e.target.value, 10) || 8000 })}
                          className="mt-0.5 w-full px-1.5 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                        />
                      </label>
                      <label>
                        <span className="text-[9px] font-mono-tech text-[#8b9cb2]">VOLTS</span>
                        <input
                          type="number"
                          value={selectedEl.voltageV || 400}
                          onChange={(e) => onUpdateElement(selectedEl.id, { voltageV: parseInt(e.target.value, 10) || 400 })}
                          className="mt-0.5 w-full px-1.5 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                        />
                      </label>
                      <label>
                        <span className="text-[9px] font-mono-tech text-[#8b9cb2]">mm²</span>
                        <input
                          type="number"
                          value={selectedEl.cableSizeMm2 || 10}
                          onChange={(e) => onUpdateElement(selectedEl.id, { cableSizeMm2: parseFloat(e.target.value) || 10 })}
                          className="mt-0.5 w-full px-1.5 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                        />
                      </label>
                    </div>
                  )}
                  {selectedEl.kind.includes('pipe') && (
                    <div className="grid grid-cols-2 gap-2">
                      <label>
                        <span className="text-[10px] font-mono-tech text-[#8b9cb2]">DN (mm)</span>
                        <input
                          type="number"
                          value={selectedEl.pipeDiaMm || 50}
                          onChange={(e) => onUpdateElement(selectedEl.id, { pipeDiaMm: parseInt(e.target.value, 10) || 50 })}
                          className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                        />
                      </label>
                      <label>
                        <span className="text-[10px] font-mono-tech text-[#8b9cb2]">FLOW (L/s)</span>
                        <input
                          type="number"
                          step="0.5"
                          value={selectedEl.flowLs || 3}
                          onChange={(e) => onUpdateElement(selectedEl.id, { flowLs: parseFloat(e.target.value) || 3 })}
                          className="mt-0.5 w-full px-2 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                        />
                      </label>
                    </div>
                  )}
                  {selectedEl.valveState && (
                    <div className="flex items-center gap-1 pt-1">
                      {(['OPEN', 'THROTTLED', 'CLOSED'] as ValveState[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => onUpdateElement(selectedEl.id, { valveState: st })}
                          className={`flex-1 py-1 text-[10px] font-mono-tech rounded border ${
                            selectedEl.valveState === st
                              ? st === 'OPEN'
                                ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]'
                                : st === 'THROTTLED'
                                  ? 'bg-[#ff9f1c]/20 border-[#ff9f1c] text-[#ff9f1c]'
                                  : 'bg-[#ef4444]/20 border-[#ef4444] text-[#ef4444]'
                              : 'bg-[#0b1118] border-[#2c3f58] text-[#8b9cb2]'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Equipment Parameters */}
              {'position' in selectedEl && (
                <div className="p-2.5 rounded bg-[#17202b] border border-[#1e2b3d] space-y-2">
                  <div className="text-[10px] font-mono-tech uppercase text-[#00d2ff]">Equipment Tag: {selectedEl.tag}</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <label>
                      <span className="text-[9px] font-mono-tech text-[#8b9cb2]">X (m)</span>
                      <input
                        type="number"
                        step="0.25"
                        value={selectedEl.position.x}
                        onChange={(e) =>
                          onUpdateElement(selectedEl.id, {
                            position: { ...selectedEl.position, x: parseFloat(e.target.value) || 0 },
                          })
                        }
                        className="mt-0.5 w-full px-1.5 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                      />
                    </label>
                    <label>
                      <span className="text-[9px] font-mono-tech text-[#8b9cb2]">Y (m)</span>
                      <input
                        type="number"
                        step="0.25"
                        value={selectedEl.position.y}
                        onChange={(e) =>
                          onUpdateElement(selectedEl.id, {
                            position: { ...selectedEl.position, y: parseFloat(e.target.value) || 0 },
                          })
                        }
                        className="mt-0.5 w-full px-1.5 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                      />
                    </label>
                    <label>
                      <span className="text-[9px] font-mono-tech text-[#8b9cb2]">ROT°</span>
                      <input
                        type="number"
                        step="15"
                        value={selectedEl.rotationDeg}
                        onChange={(e) =>
                          onUpdateElement(selectedEl.id, { rotationDeg: parseFloat(e.target.value) || 0 })
                        }
                        className="mt-0.5 w-full px-1.5 py-1 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'copilot' && (
        <div className="flex-1 flex flex-col overflow-hidden text-xs">
          {/* AI Automate Banner */}
          <div className="p-2.5 border-b border-[#1e2b3d] bg-[#131c26]">
            <button
              type="button"
              onClick={onRunAIAutomate}
              className="w-full py-2 px-3 chamfer-btn bg-[#00d2ff] text-[#0b1118] font-display font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-[#33dbff] transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" /> AI AUTOMATE MEP &amp; CLASHES
            </button>
            <div className="mt-2 flex flex-wrap gap-1">
              {[
                'Calculate cooling load',
                'Find all HVAC clashes',
                'Rooms without HVAC',
                'Excessive voltage drop',
              ].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendCopilotQuery(q)}
                  className="px-2 py-0.5 text-[10px] font-mono-tech bg-[#17202b] border border-[#2c3f58] rounded text-[#a5e7ff] hover:border-[#00d2ff]"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Feed */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`p-2.5 rounded text-xs leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#243348] text-[#dae3f1] ml-4'
                    : m.role === 'error'
                      ? 'bg-[#93000a]/30 border border-[#ef4444] text-[#ffb4ab]'
                      : 'bg-[#17202b] border border-[#1e2b3d] text-[#dae3f1] mr-2'
                }`}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="p-2 rounded bg-[#17202b] border border-[#1e2b3d] font-mono-tech text-[11px] text-[#00d2ff]">
                Analyzing BIM telemetry...
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendCopilotQuery();
            }}
            className="p-2 border-t border-[#1e2b3d] flex gap-1.5 bg-[#0d151f]"
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask Engineering Copilot..."
              aria-label="Engineering Copilot prompt"
              className="flex-1 px-2.5 py-1.5 bg-[#0b1118] border border-[#2c3f58] rounded text-xs text-[#dae3f1] focus:outline-none focus:border-[#00d2ff]"
            />
            <button
              type="submit"
              disabled={loading}
              aria-label="Send prompt"
              className="px-2.5 py-1.5 bg-[#00d2ff] text-[#0b1118] rounded font-semibold disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </aside>
  );
};
