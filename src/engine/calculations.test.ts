import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDucts,
  calculateElectricalCircuits,
  calculateEnergyAnalysis,
  calculatePipes,
  calculateRoomsHVAC,
  detectClashes,
  distance2D,
  generateBOQ,
  polygonArea2D,
} from './calculations';
import { createSeedProject } from './seedProject';

test('polygonArea2D and distance2D compute exact geometry', () => {
  assert.equal(distance2D({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  assert.equal(
    polygonArea2D([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ]),
    50,
  );
});

test('HVAC room load calculation produces positive sensible, latent, and airflow results', () => {
  const proj = createSeedProject('Oil & Gas Facility');
  const results = calculateRoomsHVAC(proj);
  assert.ok(results.length >= 3);
  for (const r of results) {
    assert.ok(r.areaM2 > 0);
    assert.ok(r.totalCoolingLoadKW > r.sensibleLoadKW);
    assert.ok(r.requiredAirflowLs > 0);
    assert.ok(r.steps.length >= 4);
  }
});

test('Duct, electrical, and pipe calculations flag violations accurately', () => {
  const proj = createSeedProject('Oil & Gas Facility');
  const ducts = calculateDucts(proj);
  const circuits = calculateElectricalCircuits(proj);
  const pipes = calculatePipes(proj);

  assert.ok(ducts.length > 0);
  assert.ok(circuits.length > 0);
  assert.ok(pipes.length > 0);

  // Seed project intentionally contains a long/undersized feeder cable to demonstrate voltage drop warning/fail
  const hasDropIssue = circuits.some((c) => c.voltageDropPct > 3.0);
  assert.equal(hasDropIssue, true);
});

test('Clash detection identifies intentional MEP vs Structure clashes in seed model', () => {
  const proj = createSeedProject('Oil & Gas Facility');
  const clashes = detectClashes(proj);
  assert.ok(clashes.length >= 1, 'Expected at least 1 spatial clash in seed BIM model');
  assert.ok(clashes[0].clearanceMm < 0);
});

test('Energy analysis and BOQ generator compute consistent totals', () => {
  const proj = createSeedProject('Oil & Gas Facility');
  const energy = calculateEnergyAnalysis(proj);
  assert.ok(energy.totalFloorAreaM2 > 50);
  assert.ok(energy.euiKWhM2Yr > 20);
  assert.ok(['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(energy.rating));

  const boq = generateBOQ(proj);
  assert.ok(boq.length >= 5);
  const totalCost = boq.reduce((acc, item) => acc + item.totalUSD, 0);
  assert.ok(totalCost > 50000);
});
