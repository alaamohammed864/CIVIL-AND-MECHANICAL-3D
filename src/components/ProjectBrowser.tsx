import React, { useState } from 'react';
import {
  BIMElement,
  BIMProject,
  DisciplineCategory,
  VersionSnapshot,
} from '../types/bim';
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  History,
  Layers,
  Lock,
  MessageSquareWarning,
  Plus,
  Search,
  Trash2,
  Unlock,
} from 'lucide-react';

interface ProjectBrowserProps {
  project: BIMProject;
  activeLevelId: string;
  onSetActiveLevel: (id: string) => void;
  onAddLevel: () => void;
  onToggleLevelVis: (id: string) => void;
  onIsolateLevel: (id: string) => void;
  selectedIds: string[];
  onSelectIds: (ids: string[]) => void;
  onToggleElementVis: (id: string) => void;
  onToggleElementLock: (id: string) => void;
  onDeleteElements: (ids: string[]) => void;
  onToggleLayerVis: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
  onUpdateIssueStatus: (id: string, status: 'Open' | 'In Progress' | 'Resolved' | 'Closed') => void;
  onLocatePoint: (x: number, y: number, levelId: string) => void;
  versions: VersionSnapshot[];
  onCreateSnapshot: (desc: string) => void;
  onRestoreSnapshot: (snap: VersionSnapshot) => void;
}

export const ProjectBrowser: React.FC<ProjectBrowserProps> = ({
  project,
  activeLevelId,
  onSetActiveLevel,
  onAddLevel,
  onToggleLevelVis,
  onIsolateLevel,
  selectedIds,
  onSelectIds,
  onToggleElementVis,
  onToggleElementLock,
  onDeleteElements,
  onToggleLayerVis,
  onToggleLayerLock,
  onUpdateIssueStatus,
  onLocatePoint,
  versions,
  onCreateSnapshot,
  onRestoreSnapshot,
}) => {
  const [tab, setTab] = useState<'tree' | 'layers' | 'issues'>('tree');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [expandedLevels, setExpandedLevels] = useState<Record<string, boolean>>({
    'lvl-00': true,
    'lvl-01': true,
    'lvl-02': true,
  });
  const [snapshotNote, setSnapshotNote] = useState('');

  const categories: DisciplineCategory[] = [
    'Architecture',
    'Structure',
    'HVAC',
    'Electrical',
    'Plumbing',
    'Fire Protection',
    'Gas',
    'Elevator',
    'Drafting',
  ];

  const filterMatch = (el: BIMElement) => {
    if (categoryFilter !== 'ALL' && el.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return el.name.toLowerCase().includes(q) || el.kind.toLowerCase().includes(q) || el.id.toLowerCase().includes(q);
    }
    return true;
  };

  return (
    <aside
      className="w-full md:w-68 h-full shrink-0 flex flex-col bg-[#111a24] dark:bg-[#111a24] bg-white md:border-r border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200 select-none overflow-hidden"
      aria-label="Project Browser"
    >
      {/* Tabs */}
      <div className="flex border-b border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200 bg-[#0d151f] dark:bg-[#0d151f] bg-slate-50">
        <button
          type="button"
          onClick={() => setTab('tree')}
          className={`flex-1 py-2 px-1.5 text-[10px] font-mono-tech uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap ${
            tab === 'tree'
              ? 'border-[#00d2ff] text-[#00d2ff] bg-[#17202b] dark:bg-[#17202b] bg-white'
              : 'border-transparent text-[#8b9cb2] hover:text-[#dae3f1]'
          }`}
        >
          Model Tree
        </button>
        <button
          type="button"
          onClick={() => setTab('layers')}
          className={`flex-1 py-2 px-1.5 text-[10px] font-mono-tech uppercase tracking-wider border-b-2 transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${
            tab === 'layers'
              ? 'border-[#00d2ff] text-[#00d2ff] bg-[#17202b] dark:bg-[#17202b] bg-white'
              : 'border-transparent text-[#8b9cb2] hover:text-[#dae3f1]'
          }`}
        >
          <Layers className="w-3 h-3 shrink-0" /> Layers
        </button>
        <button
          type="button"
          onClick={() => setTab('issues')}
          className={`flex-1 py-2 px-1.5 text-[10px] font-mono-tech uppercase tracking-wider border-b-2 transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${
            tab === 'issues'
              ? 'border-[#00d2ff] text-[#00d2ff] bg-[#17202b] dark:bg-[#17202b] bg-white'
              : 'border-transparent text-[#8b9cb2] hover:text-[#dae3f1]'
          }`}
        >
          <MessageSquareWarning className="w-3 h-3 shrink-0" /> Issues ({project.issues.length})
        </button>
      </div>

      {tab === 'tree' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search & Discipline Filter */}
          <div className="p-2.5 border-b border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8b9cb2] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter elements..."
                aria-label="Filter model tree elements"
                className="w-full pl-8 pr-2 py-1 text-xs bg-[#0b1118] dark:bg-[#0b1118] bg-slate-100 border border-[#2c3f58] dark:border-[#2c3f58] border-slate-300 rounded text-[#dae3f1] dark:text-[#dae3f1] text-slate-900 focus:outline-none focus:border-[#00d2ff]"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by engineering discipline"
                className="flex-1 px-2 py-1 text-[11px] font-mono-tech bg-[#0b1118] dark:bg-[#0b1118] bg-slate-100 border border-[#2c3f58] dark:border-[#2c3f58] border-slate-300 rounded text-[#bbc9cf] dark:text-[#bbc9cf] text-slate-700"
              >
                <option value="ALL">ALL DISCIPLINES ({project.elements.length})</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onAddLevel}
                title="Add Building Level"
                aria-label="Add Building Level"
                className="px-2 py-1 bg-[#17202b] dark:bg-[#17202b] bg-slate-200 border border-[#2c3f58] rounded text-[#00d2ff] hover:bg-[#243348] text-xs flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Lvl
              </button>
            </div>
          </div>

          {/* Hierarchical Level -> Category -> Element Tree */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 text-xs">
            {project.levels.map((lvl) => {
              const isActive = lvl.id === activeLevelId;
              const isExpanded = expandedLevels[lvl.id] ?? true;
              const lvlElements = project.elements.filter((e) => e.levelId === lvl.id && filterMatch(e));

              return (
                <div key={lvl.id} className="border border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200 rounded bg-[#131c26]/70 dark:bg-[#131c26]/70 bg-slate-50">
                  <div
                    className={`flex items-center justify-between px-2 py-1.5 rounded-t ${
                      isActive ? 'bg-[#1b2636] dark:bg-[#1b2636] bg-sky-50 border-b border-[#00d2ff]/40' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedLevels((prev) => ({ ...prev, [lvl.id]: !isExpanded }))}
                      className="p-0.5 text-[#8b9cb2] hover:text-white"
                      aria-label={`Toggle expand ${lvl.name}`}
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetActiveLevel(lvl.id)}
                      className="flex-1 text-left px-1.5 truncate font-medium"
                    >
                      <span className={isActive ? 'text-[#00d2ff]' : ''}>{lvl.name}</span>
                      <span className="ml-1.5 text-[10px] font-mono-tech text-[#8b9cb2]">
                        +{lvl.elevationM.toFixed(1)}m
                      </span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onIsolateLevel(lvl.id)}
                        title="Isolate Level"
                        aria-label={`Isolate ${lvl.name}`}
                        className="px-1 py-0.5 text-[9px] font-mono-tech text-[#8b9cb2] hover:text-[#00d2ff]"
                      >
                        ISO
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleLevelVis(lvl.id)}
                        aria-label={`Toggle visibility ${lvl.name}`}
                        className="p-0.5 text-[#8b9cb2] hover:text-[#dae3f1]"
                      >
                        {lvl.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-[#ef4444]" />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-1 space-y-0.5 max-h-60 overflow-y-auto">
                      {lvlElements.length === 0 ? (
                        <div className="px-2 py-1.5 text-[11px] text-[#8b9cb2] italic">No matching elements</div>
                      ) : (
                        lvlElements.map((el) => {
                          const isSel = selectedIds.includes(el.id);
                          return (
                            <div
                              key={el.id}
                              className={`flex items-center justify-between px-1.5 py-1 rounded-sm text-[11px] ${
                                isSel
                                  ? 'bg-[#243348] text-[#00d2ff]'
                                  : 'hover:bg-[#1b2636] dark:hover:bg-[#1b2636] hover:bg-slate-200/70'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => onSelectIds([el.id])}
                                className="flex-1 text-left truncate pr-1"
                              >
                                <span className="font-mono-tech text-[9px] text-[#8b9cb2] mr-1.5 uppercase">
                                  {el.kind.slice(0, 4)}
                                </span>
                                <span>{el.name}</span>
                              </button>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => onToggleElementVis(el.id)}
                                  aria-label={`Toggle visibility ${el.name}`}
                                  className="text-[#8b9cb2] hover:text-white"
                                >
                                  {el.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-[#ef4444]" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onToggleElementLock(el.id)}
                                  aria-label={`Toggle lock ${el.name}`}
                                  className="text-[#8b9cb2] hover:text-white"
                                >
                                  {el.locked ? <Lock className="w-3 h-3 text-[#ff9f1c]" /> : <Unlock className="w-3 h-3" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteElements([el.id])}
                                  aria-label={`Delete ${el.name}`}
                                  className="text-[#8b9cb2] hover:text-[#ef4444]"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'layers' && (
        <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 text-xs">
          <div className="text-[10px] font-mono-tech uppercase text-[#8b9cb2] pb-1 border-b border-[#1e2b3d]">
            CAD / BIM Discipline Layers
          </div>
          {project.layers.map((lay) => (
            <div
              key={lay.id}
              className="flex items-center justify-between px-2 py-1.5 rounded bg-[#17202b] dark:bg-[#17202b] bg-slate-100 border border-[#1e2b3d] dark:border-[#1e2b3d] border-slate-200"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: lay.color }} />
                <span className="font-mono-tech text-[11px] truncate">{lay.name}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleLayerVis(lay.id)}
                  aria-label={`Toggle layer ${lay.name}`}
                  className="text-[#8b9cb2] hover:text-white"
                >
                  {lay.visible ? <Eye className="w-3.5 h-3.5 text-[#10b981]" /> : <EyeOff className="w-3.5 h-3.5 text-[#ef4444]" />}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleLayerLock(lay.id)}
                  aria-label={`Lock layer ${lay.name}`}
                  className="text-[#8b9cb2] hover:text-white"
                >
                  {lay.locked ? <Lock className="w-3.5 h-3.5 text-[#ff9f1c]" /> : <Unlock className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'issues' && (
        <div className="flex-1 overflow-y-auto p-2.5 space-y-3 text-xs">
          <div className="space-y-2">
            <div className="text-[10px] font-mono-tech uppercase text-[#8b9cb2]">Active Markups &amp; RFIs</div>
            {project.issues.map((iss) => (
              <div
                key={iss.id}
                className="p-2 rounded bg-[#17202b] dark:bg-[#17202b] bg-slate-100 border border-[#2c3f58] dark:border-[#2c3f58] border-slate-300 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-tech text-[10px] text-[#00d2ff] font-semibold">{iss.id}</span>
                  <span
                    className={`font-mono-tech text-[10px] ${
                      iss.priority === 'Critical'
                        ? 'text-[#ef4444]'
                        : iss.priority === 'High'
                          ? 'text-[#ff9f1c]'
                          : 'text-[#10b981]'
                    }`}
                  >
                    [{iss.priority.toUpperCase()}]
                  </span>
                </div>
                <div className="font-medium leading-snug">{iss.title}</div>
                <p className="text-[11px] text-[#8b9cb2]">{iss.comment}</p>
                <div className="flex items-center justify-between pt-1">
                  <select
                    value={iss.status}
                    onChange={(e) =>
                      onUpdateIssueStatus(iss.id, e.target.value as 'Open' | 'In Progress' | 'Resolved' | 'Closed')
                    }
                    aria-label={`Status for ${iss.id}`}
                    className="px-1.5 py-0.5 text-[10px] font-mono-tech bg-[#0b1118] border border-[#2c3f58] rounded text-[#dae3f1]"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => onLocatePoint(iss.position.x, iss.position.y, iss.levelId)}
                    className="px-2 py-0.5 text-[10px] font-mono-tech bg-[#243348] text-[#00d2ff] rounded hover:bg-[#00d2ff] hover:text-[#0b1118]"
                  >
                    LOCATE
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Version Control History */}
          <div className="pt-2 border-t border-[#1e2b3d] space-y-2">
            <div className="flex items-center gap-1.5 text-[10px] font-mono-tech uppercase text-[#8b9cb2]">
              <History className="w-3 h-3" /> Version Control
            </div>
            <div className="flex gap-1">
              <input
                type="text"
                value={snapshotNote}
                onChange={(e) => setSnapshotNote(e.target.value)}
                placeholder="Commit note..."
                className="flex-1 px-2 py-1 text-[11px] bg-[#0b1118] border border-[#2c3f58] rounded text-[#dae3f1]"
              />
              <button
                type="button"
                onClick={() => {
                  onCreateSnapshot(snapshotNote || 'Design checkpoint');
                  setSnapshotNote('');
                }}
                className="px-2 py-1 text-[10px] font-mono-tech bg-[#00d2ff] text-[#0b1118] font-semibold rounded"
              >
                COMMIT
              </button>
            </div>
            {versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between px-2 py-1.5 rounded bg-[#0b1118] border border-[#1e2b3d] text-[11px]"
              >
                <div className="truncate pr-2">
                  <div className="font-mono-tech text-[#69f6b9]">
                    {v.version} · {v.elementCount} objs
                  </div>
                  <div className="text-[10px] text-[#8b9cb2] truncate">{v.description}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onRestoreSnapshot(v)}
                  className="px-1.5 py-0.5 text-[10px] font-mono-tech border border-[#2c3f58] rounded text-[#00d2ff] hover:bg-[#243348]"
                >
                  RESTORE
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};
