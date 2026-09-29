const test = require('node:test');
const assert = require('node:assert/strict');

const {
  peutCreerOuModifierDevis,
  tousLesDevisSontPayes,
  tousLesDevisOntDesArticles
} = require('../utils/devisWorkflow');

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

test('le statut payé exige au moins un devis et tous les devis payés', () => {
  assert.equal(tousLesDevisSontPayes([]), false);
  assert.equal(tousLesDevisSontPayes([{ statut_paiement: 'NON_PAYE' }]), false);
  assert.equal(tousLesDevisSontPayes([{ statut_paiement: 'PAYE' }]), true);
  assert.equal(tousLesDevisSontPayes([
    { statut_paiement: 'PAYE' },
    { statut_paiement: 'NON_PAYE' }
  ]), false);
});

test('le statut payé refuse tout devis sans article', () => {
  assert.equal(tousLesDevisOntDesArticles([]), false);
  assert.equal(tousLesDevisOntDesArticles([{ nombre_articles: 0 }]), false);
  assert.equal(tousLesDevisOntDesArticles([{ nombre_articles: 1 }]), true);
  assert.equal(tousLesDevisOntDesArticles([
    { nombre_articles: 2 },
    { nombre_articles: 0 }
  ]), false);
});
