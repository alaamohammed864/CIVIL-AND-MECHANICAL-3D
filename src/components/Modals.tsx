import React, { useState } from 'react';
import {
  BIMProject,
  EngineeringStandard,
  ProjectType,
  UnitSystem,
} from '../types/bim';
import { EQUIPMENT_LIBRARY, MATERIAL_LIBRARY } from '../data/libraries';
import { createSeedProject } from '../engine/seedProject';
import { Check, Search, Sparkles, X } from 'lucide-react';

interface NewProjectModalProps {
  onClose: () => void;
  onCreate: (project: BIMProject) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('Refinery Process Control Center B2');
  const [projectNumber, setProjectNumber] = useState('4M-2026-NEW');
  const [client, setClient] = useState('Gulf Energy Operations');
  const [location, setLocation] = useState('Basrah Industrial Zone');
  const [projectType, setProjectType] = useState<ProjectType>('Oil & Gas Facility');
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [standard, setStandard] = useState<EngineeringStandard>('ASHRAE');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const base = createSeedProject(projectType, name.trim());
    onCreate({
      ...base,
      id: `proj-${Date.now()}`,
      projectNumber: projectNumber.trim() || '4M-2026-01',
      client: client.trim() || 'Client',
      location: location.trim() || 'Site A',
      unitSystem,
      standard,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="New Project Wizard">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-[#111a24] border border-[#00d2ff]/40 rounded p-5 space-y-4 text-xs shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-[#1e2b3d] pb-3">
          <h3 className="font-display text-base font-bold text-[#dae3f1]">New Project Wizard</h3>
          <button type="button" onClick={onClose} aria-label="Close wizard" className="text-[#8b9cb2] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2">
            <span className="font-mono-tech text-[10px] uppercase text-[#8b9cb2]">Project Name</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 bg-[#0b1118] border border-[#2c3f58] rounded text-[#dae3f1]"
            />
          </label>
          <label>
            <span className="font-mono-tech text-[10px] uppercase text-[#8b9cb2]">Project Number</span>
            <input
              type="text"
              value={projectNumber}
              onChange={(e) => setProjectNumber(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech text-[#dae3f1]"
            />
          </label>
          <label>
            <span className="font-mono-tech text-[10px] uppercase text-[#8b9cb2]">Template / Type</span>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as ProjectType)}
              className="mt-1 w-full px-2.5 py-1.5 bg-[#0b1118] border border-[#2c3f58] rounded text-[#dae3f1]"
            >
              {[
                'Oil & Gas Facility',
                'Industrial',
                'Commercial',
                'Hospital',
                'Office',
                'Residential',
                'School',
                'Hotel',
                'Warehouse',
              ].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="font-mono-tech text-[10px] uppercase text-[#8b9cb2]">Client</span>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 bg-[#0b1118] border border-[#2c3f58] rounded text-[#dae3f1]"
            />
          </label>
          <label>
            <span className="font-mono-tech text-[10px] uppercase text-[#8b9cb2]">Location</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 bg-[#0b1118] border border-[#2c3f58] rounded text-[#dae3f1]"
            />
          </label>
          <label>
            <span className="font-mono-tech text-[10px] uppercase text-[#8b9cb2]">Units</span>
            <select
              value={unitSystem}
              onChange={(e) => setUnitSystem(e.target.value as UnitSystem)}
              className="mt-1 w-full px-2.5 py-1.5 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech text-[#dae3f1]"
            >
              <option value="metric">Metric (m, m², L/s, kW)</option>
              <option value="imperial">Imperial (ft, ft², CFM, TR)</option>
            </select>
          </label>
          <label>
            <span className="font-mono-tech text-[10px] uppercase text-[#8b9cb2]">Design Standard</span>
            <select
              value={standard}
              onChange={(e) => setStandard(e.target.value as EngineeringStandard)}
              className="mt-1 w-full px-2.5 py-1.5 bg-[#0b1118] border border-[#2c3f58] rounded font-mono-tech text-[#dae3f1]"
            >
              <option value="ASHRAE">ASHRAE / NFPA / IEC</option>
              <option value="EN">Eurocode / EN</option>
              <option value="ISO">ISO 19650</option>
              <option value="NFPA">NFPA</option>
              <option value="IEC">IEC 60364</option>
            </select>
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#1e2b3d]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#17202b] border border-[#2c3f58] text-[#bbc9cf]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-1.5 chamfer-btn bg-[#00d2ff] text-[#0b1118] font-bold"
          >
            Create BIM Project
          </button>
        </div>
      </form>
    </div>
  );
};

interface LibraryModalProps {
  onClose: () => void;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'materials' | 'equipment'>('materials');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Material and Equipment Database">
      <div className="w-full max-w-4xl max-h-[82vh] flex flex-col bg-[#111a24] border border-[#2c3f58] rounded overflow-hidden text-xs">
        <div className="flex items-center justify-between px-4 py-3 bg-[#17202b] border-b border-[#1e2b3d]">
          <div className="flex items-center gap-3">
            <h3 className="font-display text-base font-bold">Material, Equipment &amp; BIM Family Database</h3>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setTab('materials')}
                className={`px-3 py-1 rounded font-mono-tech text-[11px] ${
                  tab === 'materials' ? 'bg-[#00d2ff] text-[#0b1118] font-bold' : 'bg-[#111a24] text-[#8b9cb2]'
                }`}
              >
                Materials ({MATERIAL_LIBRARY.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('equipment')}
                className={`px-3 py-1 rounded font-mono-tech text-[11px] ${
                  tab === 'equipment' ? 'bg-[#00d2ff] text-[#0b1118] font-bold' : 'bg-[#111a24] text-[#8b9cb2]'
                }`}
              >
                Equipment Families ({EQUIPMENT_LIBRARY.length})
              </button>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close database" className="text-[#8b9cb2] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'materials' ? (
            <table className="w-full text-left font-mono-tech">
              <thead className="bg-[#0d151f] text-[10px] text-[#8b9cb2] uppercase">
                <tr>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2 text-right">Density</th>
                  <th className="px-3 py-2 text-right">k (W/mK)</th>
                  <th className="px-3 py-2 text-right">U-Value</th>
                  <th className="px-3 py-2 text-right">Cost (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b3d]">
                {MATERIAL_LIBRARY.map((m) => (
                  <tr key={m.id}>
                    <td className="px-3 py-2 font-sans">
                      <div className="font-medium text-[#dae3f1]">{m.name}</div>
                      <div className="text-[10px] text-[#8b9cb2]">{m.manufacturer}</div>
                    </td>
                    <td className="px-3 py-2">{m.category}</td>
                    <td className="px-3 py-2 text-right">{m.densityKgM3} kg/m³</td>
                    <td className="px-3 py-2 text-right">{m.conductivityWmK}</td>
                    <td className="px-3 py-2 text-right text-[#00d2ff]">{m.uValueWm2K}</td>
                    <td className="px-3 py-2 text-right text-[#69f6b9]">
                      ${m.unitCostUSD}/{m.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left font-mono-tech">
              <thead className="bg-[#0d151f] text-[10px] text-[#8b9cb2] uppercase">
                <tr>
                  <th className="px-3 py-2">Equipment Family</th>
                  <th className="px-3 py-2">Discipline</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2 text-right">Dimensions (m)</th>
                  <th className="px-3 py-2 text-right">Power</th>
                  <th className="px-3 py-2 text-right">Unit Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2b3d]">
                {EQUIPMENT_LIBRARY.map((eq) => (
                  <tr key={eq.id}>
                    <td className="px-3 py-2 font-sans">
                      <div className="font-medium text-[#dae3f1]">{eq.name}</div>
                      <div className="text-[10px] text-[#8b9cb2]">{eq.manufacturer}</div>
                    </td>
                    <td className="px-3 py-2">{eq.discipline}</td>
                    <td className="px-3 py-2 text-[#00d2ff]">{eq.modelCode}</td>
                    <td className="px-3 py-2 text-right">
                      {eq.widthM}×{eq.depthM}×{eq.heightM}
                    </td>
                    <td className="px-3 py-2 text-right">{eq.ratedPowerKW} kW</td>
                    <td className="px-3 py-2 text-right text-[#69f6b9]">${eq.unitCostUSD.toLocaleString()}</td>
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

interface AdminModalProps {
  project: BIMProject;
  onUpdateProjectMeta: (patch: Partial<BIMProject>) => void;
  onClose: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ project, onUpdateProjectMeta, onClose }) => {
  const [platformTitle, setPlatformTitle] = useState(project.branding.platformTitle);
  const [orgName, setOrgName] = useState(project.branding.organizationName);
  const [designer, setDesigner] = useState(project.branding.designerName);

  const saveBranding = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProjectMeta({
      branding: {
        ...project.branding,
        platformTitle: platformTitle.trim() || '4M ENGINEERING CLOUD',
        organizationName: orgName.trim() || '4M Engineering',
        designerName: designer.trim() || 'Lead Engineer',
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Branding and Collaboration Settings">
      <form
        onSubmit={saveBranding}
        className="w-full max-w-xl bg-[#111a24] border border-[#2c3f58] rounded p-5 space-y-4 text-xs"
      >
        <div className="flex items-center justify-between border-b border-[#1e2b3d] pb-2.5">
          <h3 className="font-display text-base font-bold">Platform Branding, Team &amp; Permissions</h3>
          <button type="button" onClick={onClose} aria-label="Close settings" className="text-[#8b9cb2] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="font-mono-tech text-[10px] uppercase text-[#8b9cb2]">White-Label Platform Title</span>
            <input
              type="text"
              value={platformTitle}
              onChange={(e) => setPlatformTitle(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 bg-[#0b1118] border border-[#2c3f58] rounded text-[#dae3f1]"
            />
          </label>
          <label>
            <span className="font-mono-tech text-[10px] uppercase text-[#8b9cb2]">Organization</span>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 bg-[#0b1118] border border-[#2c3f58] rounded text-[#dae3f1]"
            />
          </label>
          <label className="col-span-2">
            <span className="font-mono-tech text-[10px] uppercase text-[#8b9cb2]">Lead Engineer (Title Block)</span>
            <input
              type="text"
              value={designer}
              onChange={(e) => setDesigner(e.target.value)}
              className="mt-1 w-full px-2.5 py-1.5 bg-[#0b1118] border border-[#2c3f58] rounded text-[#dae3f1]"
            />
          </label>
        </div>

        <div className="space-y-1.5">
          <div className="font-mono-tech text-[10px] uppercase text-[#8b9cb2]">Project Collaboration Roles</div>
          <div className="border border-[#1e2b3d] rounded divide-y divide-[#1e2b3d]">
            {project.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-3 py-1.5 bg-[#0b1118]">
                <div>
                  <span className="font-medium text-[#dae3f1]">{m.name}</span>
                  <span className="ml-2 text-[#8b9cb2]">{m.role}</span>
                </div>
                <span className="font-mono-tech text-[10px] text-[#00d2ff]">[{m.permission.toUpperCase()}]</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[#1e2b3d]">
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded bg-[#17202b] border border-[#2c3f58]">
            Cancel
          </button>
          <button type="submit" className="px-4 py-1.5 rounded bg-[#00d2ff] text-[#0b1118] font-bold">
            Apply Settings
          </button>
        </div>
      </form>
    </div>
  );
};

interface AIAutomateModalProps {
  onClose: () => void;
  onApplyAll: () => void;
  summaryActions: string[];
}

export const AIAutomateModal: React.FC<AIAutomateModalProps> = ({ onClose, onApplyAll, summaryActions }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="AI Automate Engineering Review">
    <div className="w-full max-w-lg bg-[#111a24] border border-[#00d2ff] rounded p-5 space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-[#1e2b3d] pb-2.5">
        <h3 className="font-display text-base font-bold flex items-center gap-2 text-[#00d2ff]">
          <Sparkles className="w-4 h-4" /> AI Automate — Engineering Assumptions Review
        </h3>
        <button type="button" onClick={onClose} aria-label="Close AI Automate" className="text-[#8b9cb2] hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[#bbc9cf] leading-relaxed">
        Per engineering governance, AI Automate will not modify your BIM/MEP model without your explicit approval of the following calculated actions:
      </p>
      <ul className="space-y-1.5 bg-[#0b1118] border border-[#1e2b3d] rounded p-3 font-mono-tech text-[11px]">
        {summaryActions.map((act, idx) => (
          <li key={idx} className="flex items-start gap-2 text-[#69f6b9]">
            <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{act}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-1.5 rounded bg-[#17202b] border border-[#2c3f58]">
          Reject
        </button>
        <button
          type="button"
          onClick={() => {
            onApplyAll();
            onClose();
          }}
          className="px-4 py-1.5 chamfer-btn bg-[#00d2ff] text-[#0b1118] font-bold"
        >
          Approve &amp; Apply Changes
        </button>
      </div>
    </div>
  </div>
);

interface GlobalSearchModalProps {
  project: BIMProject;
  onSelectElement: (id: string, levelId: string) => void;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ project, onSelectElement, onClose }) => {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const matches = q
    ? project.elements.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          e.kind.toLowerCase().includes(q),
      )
    : project.elements.slice(0, 12);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Global BIM Search">
      <div className="w-full max-w-xl bg-[#111a24] border border-[#00d2ff]/60 rounded overflow-hidden text-xs">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1e2b3d] bg-[#0b1118]">
          <Search className="w-4 h-4 text-[#00d2ff]" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search elements, rooms, equipment, circuits, IDs..."
            className="flex-1 bg-transparent text-[#dae3f1] focus:outline-none text-sm"
          />
          <button type="button" onClick={onClose} aria-label="Close global search" className="text-[#8b9cb2] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-[#1e2b3d]">
          {matches.length === 0 ? (
            <div className="p-4 text-center text-[#8b9cb2]">No matching BIM objects found.</div>
          ) : (
            matches.slice(0, 25).map((el) => (
              <button
                key={el.id}
                type="button"
                onClick={() => {
                  onSelectElement(el.id, el.levelId);
                  onClose();
                }}
                className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-[#1b2636]"
              >
                <div>
                  <div className="font-medium text-[#dae3f1]">{el.name}</div>
                  <div className="font-mono-tech text-[10px] text-[#8b9cb2]">
                    {el.category} · {el.id}
                  </div>
                </div>
                <span className="font-mono-tech text-[10px] text-[#00d2ff]">SELECT</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
