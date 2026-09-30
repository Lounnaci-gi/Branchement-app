import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formaterDesignationAvecType,
  getDevisTableColumns,
  retirerPrefixeTypeDesignation
} from './devisAffichage.js';

test('les colonnes de prix sont masquées en mode quantitatif', () => {
  assert.deepEqual(
    getDevisTableColumns({ quantitatif: true, afficherColonneUnite: true }),
    ['N°', 'Désignation', 'Qté', 'Unité']
  );

  assert.deepEqual(
    getDevisTableColumns({ quantitatif: false, afficherColonneUnite: true }),
    ['N°', 'Désignation', 'Qté', 'Unité', 'Prix U. HT', 'Total HT']
  );
});

test('préfixe la désignation selon le type tarifaire sans répéter un ancien préfixe', () => {
  assert.equal(formaterDesignationAvecType('F/', 'Compteur DN 15 mm'), 'F/ Compteur DN 15 mm');
  assert.equal(formaterDesignationAvecType('P/', 'F/ Compteur DN 15 mm'), 'P/ Compteur DN 15 mm');
  assert.equal(formaterDesignationAvecType('FP/', 'Compteur DN 15 mm'), 'FP/ Compteur DN 15 mm');
  assert.equal(formaterDesignationAvecType('PR/', 'Compteur DN 15 mm'), 'PR/ Compteur DN 15 mm');
  assert.equal(retirerPrefixeTypeDesignation('F/', 'F/ Compteur DN 15 mm'), 'Compteur DN 15 mm');
});
