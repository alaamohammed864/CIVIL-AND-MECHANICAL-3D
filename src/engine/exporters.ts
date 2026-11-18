import { BIMElement, BIMProject, BOQLineItem } from '../types/bim';
import { formatCurrency } from '../data/libraries';

/**
 * Generates an AutoCAD-compatible ASCII DXF R12/2000 string from the current BIM/CAD project.
 */
export function exportProjectToDXF(project: BIMProject, activeLevelId?: string): string {
  const lines: string[] = [
    '0',
    'SECTION',
    '2',
    'HEADER',
    '9',
    '$INSUNITS',
    '70',
    project.unitSystem === 'metric' ? '6' : '2', // 6=meters, 2=feet
    '0',
    'ENDSEC',
    '0',
    'SECTION',
    '2',
    'ENTITIES',
  ];

  const addLine = (x1: number, y1: number, x2: number, y2: number, layer: string) => {
    lines.push(
      '0',
      'LINE',
      '8',
      layer,
      '10',
      x1.toFixed(4),
      '20',
      y1.toFixed(4),
      '30',
      '0.0',
      '11',
      x2.toFixed(4),
      '21',
      y2.toFixed(4),
      '31',
      '0.0',
    );
  };

  const addCircle = (cx: number, cy: number, r: number, layer: string) => {
    lines.push('0', 'CIRCLE', '8', layer, '10', cx.toFixed(4), '20', cy.toFixed(4), '30', '0.0', '40', r.toFixed(4));
  };

  project.elements.forEach((el) => {
    if (!el.visible) return;
    if (activeLevelId && el.levelId !== activeLevelId) return;
    const layer = project.layers.find((l) => l.id === el.layerId)?.name || '0';

    if (el.kind === 'wall' || el.kind === 'duct' || el.kind === 'cable' || el.kind === 'cold_pipe' || el.kind === 'hot_pipe' || el.kind === 'drain_pipe' || el.kind === 'fire_pipe' || el.kind === 'gas_pipe') {
      addLine(el.start.x, el.start.y, el.end.x, el.end.y, layer);
    } else if (el.kind === 'beam' && el.end) {
      addLine(el.start.x, el.start.y, el.end.x, el.end.y, layer);
    } else if (el.kind === 'column') {
      const hw = el.widthM / 2;
      const hd = el.depthM / 2;
      addLine(el.start.x - hw, el.start.y - hd, el.start.x + hw, el.start.y - hd, layer);
      addLine(el.start.x + hw, el.start.y - hd, el.start.x + hw, el.start.y + hd, layer);
      addLine(el.start.x + hw, el.start.y + hd, el.start.x - hw, el.start.y + hd, layer);
      addLine(el.start.x - hw, el.start.y + hd, el.start.x - hw, el.start.y - hd, layer);
    } else if (el.kind === 'line' && el.points.length >= 2) {
      addLine(el.points[0].x, el.points[0].y, el.points[1].x, el.points[1].y, layer);
    } else if (el.kind === 'circle' && el.points.length >= 1) {
      addCircle(el.points[0].x, el.points[0].y, el.radiusM || 1, layer);
    } else if ('position' in el) {
      const hw = el.widthM / 2;
      const hd = el.depthM / 2;
      addLine(el.position.x - hw, el.position.y - hd, el.position.x + hw, el.position.y - hd, layer);
      addLine(el.position.x + hw, el.position.y - hd, el.position.x + hw, el.position.y + hd, layer);
      addLine(el.position.x + hw, el.position.y + hd, el.position.x - hw, el.position.y + hd, layer);
      addLine(el.position.x - hw, el.position.y + hd, el.position.x - hw, el.position.y - hd, layer);
    }
  });

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n');
}

/**
 * Parses basic ASCII DXF LINE & CIRCLE entities into CAD Drafting2DElements.
 */
export function importDXFEntities(dxfText: string, levelId: string): BIMElement[] {
  const tokens = dxfText.split(/\r?\n/).map((s) => s.trim());
  const imported: BIMElement[] = [];
  let i = 0;
  let seq = 1;

  while (i < tokens.length - 1) {
    if (tokens[i] === '0' && tokens[i + 1] === 'LINE') {
      let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
      i += 2;
      while (i < tokens.length - 1 && tokens[i] !== '0') {
        const code = tokens[i];
        const val = parseFloat(tokens[i + 1]);
        if (code === '10' && !Number.isNaN(val)) x1 = val;
        if (code === '20' && !Number.isNaN(val)) y1 = val;
        if (code === '11' && !Number.isNaN(val)) x2 = val;
        if (code === '21' && !Number.isNaN(val)) y2 = val;
        i += 2;
      }
      imported.push({
        id: `dxf-line-${Date.now()}-${seq++}`,
        kind: 'line',
        category: 'Drafting',
        name: `DXF Line ${seq}`,
        levelId,
        layerId: 'lay-draft',
        points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
        visible: true,
        locked: false,
      });
      continue;
    }
    if (tokens[i] === '0' && tokens[i + 1] === 'CIRCLE') {
      let cx = 0, cy = 0, r = 1;
      i += 2;
      while (i < tokens.length - 1 && tokens[i] !== '0') {
        const code = tokens[i];
        const val = parseFloat(tokens[i + 1]);
        if (code === '10' && !Number.isNaN(val)) cx = val;
        if (code === '20' && !Number.isNaN(val)) cy = val;
        if (code === '40' && !Number.isNaN(val)) r = val;
        i += 2;
      }
      imported.push({
        id: `dxf-circle-${Date.now()}-${seq++}`,
        kind: 'circle',
        category: 'Drafting',
        name: `DXF Circle ${seq}`,
        levelId,
        layerId: 'lay-draft',
        points: [{ x: cx, y: cy }],
        radiusM: r,
        visible: true,
        locked: false,
      });
      continue;
    }
    i += 1;
  }
  return imported;
}

/**
 * Generates an ISO-10303-21 IFC4 STEP file preserving Project, Site, Building, Storeys, Walls, Slabs, Spaces, and MEP Segments.
 */
export function exportProjectToIFC(project: BIMProject): string {
  let stepId = 1;
  const rows: string[] = [];
  const nextId = () => `#${stepId++}`;

  const personId = nextId();
  const orgId = nextId();
  const appId = nextId();
  const ownerHistId = nextId();
  const ctxId = nextId();
  const projId = nextId();
  const siteId = nextId();
  const bldgId = nextId();

  rows.push(`${personId}=IFCPERSON($,'${project.branding.designerName}',$,$,$,$,$,$);`);
  rows.push(`${orgId}=IFCORGANIZATION($,'${project.branding.organizationName}',$,$,$);`);
  rows.push(`${appId}=IFCAPPLICATION(${orgId},'2026.1','${project.branding.platformTitle}','4MCLOUD');`);
  rows.push(`${ownerHistId}=IFCOWNERHISTORY(${personId},${appId},$,.NOCHANGE.,$,$,$,${Math.floor(Date.now() / 1000)});`);
  rows.push(`${ctxId}=IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#9999,$);`);
  rows.push(`${projId}=IFCPROJECT('${project.id}',${ownerHistId},'${project.name}','${project.projectNumber}',$,$,$,(${ctxId}),$);`);
  rows.push(`${siteId}=IFCSITE('${project.id}-SITE',${ownerHistId},'${project.location}',$,$,$,$,$,.ELEMENT.,$,$,$,$,$);`);
  rows.push(`${bldgId}=IFCBUILDING('${project.id}-BLDG',${ownerHistId},'${project.name}',$,$,$,$,$,.ELEMENT.,$,$,$);`);

  const storeyMap = new Map<string, string>();
  project.levels.forEach((lvl) => {
    const sid = nextId();
    storeyMap.set(lvl.id, sid);
    rows.push(`${sid}=IFCBUILDINGSTOREY('${lvl.id}',${ownerHistId},'${lvl.name}',$,$,$,$,$,.ELEMENT.,${lvl.elevationM.toFixed(3)});`);
  });

  rows.push(`${nextId()}=IFCRELAGGREGATES('REL-PROJ-SITE',${ownerHistId},$,$,${projId},(${siteId}));`);
  rows.push(`${nextId()}=IFCRELAGGREGATES('REL-SITE-BLDG',${ownerHistId},$,$,${siteId},(${bldgId}));`);
  rows.push(`${nextId()}=IFCRELAGGREGATES('REL-BLDG-STOREYS',${ownerHistId},$,$,${bldgId},(${Array.from(storeyMap.values()).join(',')}));`);

  const storeyChildren = new Map<string, string[]>();
  project.elements.forEach((el) => {
    const sid = storeyMap.get(el.levelId);
    if (!sid) return;
    const eid = nextId();
    const list = storeyChildren.get(sid) || [];
    list.push(eid);
    storeyChildren.set(sid, list);

    if (el.kind === 'wall') {
      rows.push(`${eid}=IFCWALLSTANDARDCASE('${el.id}',${ownerHistId},'${el.name}','U=${el.uValue};FR=${el.fireRating}',$,$,$,'${el.id}');`);
    } else if (el.kind === 'door') {
      rows.push(`${eid}=IFCDOOR('${el.id}',${ownerHistId},'${el.name}','${el.widthM}x${el.heightM}',$,$,$,'${el.id}',${el.heightM.toFixed(2)},${el.widthM.toFixed(2)});`);
    } else if (el.kind === 'window') {
      rows.push(`${eid}=IFCWINDOW('${el.id}',${ownerHistId},'${el.name}','SHGC=${el.shgc}',$,$,$,'${el.id}',${el.heightM.toFixed(2)},${el.widthM.toFixed(2)});`);
    } else if (el.kind === 'slab' || el.kind === 'roof') {
      const entity = el.kind === 'roof' ? 'IFCROOF' : 'IFCSLAB';
      rows.push(`${eid}=${entity}('${el.id}',${ownerHistId},'${el.name}',$,$,$,$,'${el.id}',.FLOOR.);`);
    } else if (el.kind === 'column') {
      rows.push(`${eid}=IFCCOLUMN('${el.id}',${ownerHistId},'${el.name}',$,$,$,$,'${el.id}');`);
    } else if (el.kind === 'beam') {
      rows.push(`${eid}=IFCBEAM('${el.id}',${ownerHistId},'${el.name}',$,$,$,$,'${el.id}');`);
    } else if (el.kind === 'room') {
      rows.push(`${eid}=IFCSPACE('${el.id}',${ownerHistId},'${el.roomNumber}','${el.name}',$,$,$,'${el.id}',.ELEMENT.,.INTERNAL.,$);`);
    } else if (el.kind === 'duct') {
      rows.push(`${eid}=IFCDUCTSEGMENT('${el.id}',${ownerHistId},'${el.name}','${el.airflowLs || 0} L/s',$,$,$,'${el.id}',.RIGIDSEGMENT.);`);
    } else if (el.kind === 'cold_pipe' || el.kind === 'hot_pipe' || el.kind === 'drain_pipe' || el.kind === 'fire_pipe' || el.kind === 'gas_pipe') {
      rows.push(`${eid}=IFCPIPESEGMENT('${el.id}',${ownerHistId},'${el.name}','DN${el.pipeDiaMm || 32}',$,$,$,'${el.id}',.RIGIDSEGMENT.);`);
    } else {
      rows.push(`${eid}=IFCBUILDINGELEMENTPROXY('${el.id}',${ownerHistId},'${el.name}','${el.category}',$,$,$,'${el.id}',$);`);
    }
  });

  storeyChildren.forEach((children, sid) => {
    if (children.length > 0) {
      rows.push(`${nextId()}=IFCRELCONTAINEDINSPATIALSTRUCTURE('${sid}-REL',${ownerHistId},$,$,(${children.join(',')}),${sid});`);
    }
  });

  return [
    'ISO-10303-21;',
    'HEADER;',
    `FILE_DESCRIPTION(('ViewDefinition [CoordinationView_V2.0]'),'2;1');`,
    `FILE_NAME('${project.projectNumber}.ifc','${new Date().toISOString()}',('${project.branding.designerName}'),('${project.branding.organizationName}'),'4M ENGINEERING CLOUD IFC4 Exporter','4M Cloud','');`,
    `FILE_SCHEMA(('IFC4'));`,
    'ENDSEC;',
    'DATA;',
    ...rows,
    'ENDSEC;',
    'END-ISO-10303-21;',
  ].join('\n');
}

export function exportBOQToCSV(boq: BOQLineItem[], project: BIMProject): string {
  const header = ['Item No', 'Category', 'Description', 'Unit', 'Quantity', `Unit Price (${project.currency})`, `Total (${project.currency})`, 'Notes'];
  const rows = boq.map((item) => [
    item.itemNo,
    item.category,
    `"${item.description.replace(/"/g, '""')}"`,
    item.unit,
    item.quantity.toString(),
    `"${formatCurrency(item.unitPriceUSD, project.currency)}"`,
    `"${formatCurrency(item.totalUSD, project.currency)}"`,
    `"${item.notes.replace(/"/g, '""')}"`,
  ]);
  return [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
