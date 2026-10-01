import assert from 'node:assert/strict';
import test from 'node:test';
import { determinerTypesDisponibles, normaliserTypeLigne } from './devisLigneTypes.js';

test('autorise tous les types pour une ligne libre dans l’éditeur', () => {
  assert.deepEqual(
    determinerTypesDisponibles({ estLigneLibre: true }, [], { autoriserTousLesTypes: true }),
    ['FP/', 'F/', 'P/', 'PR/']
  );
});

test('propose F/ et FP/ lorsque fourniture et pose sont tarifées', () => {
  assert.deepEqual(
    determinerTypesDisponibles({ prix_fourniture: 100, prix_pose: 50 }),
    ['F/', 'P/', 'FP/']
  );
});

test('normalise le type selon le choix de prix', () => {
  assert.equal(
    normaliserTypeLigne('PR/', 'FOURNITURE', 'FOURNITURE_POSE', { prix_fourniture: 100, prix_pose: 50 }),
    'F/'
  );
});
