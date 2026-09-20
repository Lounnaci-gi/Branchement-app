const test = require('node:test');
const assert = require('node:assert/strict');

const { peutCreerOuModifierDevis } = require('../utils/devisWorkflow');

test('la création d’un devis est refusée tant que le devis n’a pas été émis', () => {
  assert.equal(peutCreerOuModifierDevis('DEPOSEE', { existeDevis: false }), false);
  assert.equal(peutCreerOuModifierDevis('DEVIS_EMIS', { existeDevis: false }), true);
  assert.equal(peutCreerOuModifierDevis('DEVIS_PAYE', { existeDevis: false }), true);
});

test('la modification d’un devis existant est autorisée uniquement après émission', () => {
  assert.equal(peutCreerOuModifierDevis('DEPOSEE', { existeDevis: true }), false);
  assert.equal(peutCreerOuModifierDevis('DEVIS_EMIS', { existeDevis: true }), true);
  assert.equal(peutCreerOuModifierDevis('DEVIS_PAYE', { existeDevis: true }), true);
  assert.equal(peutCreerOuModifierDevis('TRAVAUX_EN_COURS', { existeDevis: true }), false);
});
