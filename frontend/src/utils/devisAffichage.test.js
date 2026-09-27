import test from 'node:test';
import assert from 'node:assert/strict';
import { getDevisTableColumns } from './devisAffichage.js';

test('les colonnes de prix sont masquées en mode quantitatif', () => {
  assert.deepEqual(
    getDevisTableColumns({ quantitatif: true, afficherColonneUnite: true }),
    ['N°', 'Désignation', 'Type', 'Qté', 'Unité']
  );

  assert.deepEqual(
    getDevisTableColumns({ quantitatif: false, afficherColonneUnite: true }),
    ['N°', 'Désignation', 'Type', 'Qté', 'Unité', 'Prix U. HT', 'Total HT']
  );
});
