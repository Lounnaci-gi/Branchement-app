import test from 'node:test';
import assert from 'node:assert/strict';

import { normaliserNumeroContratAbonnement } from './impressionContratAbonnement.js';

test('le numéro de contrat suit le format xxxx/yyyy et ignore le dossier et le devis', () => {
  const annee = new Date().getFullYear();
  const demande = { numero_demande: 'D-2026-1234' };
  const devis = { numero_devis: 'DV-2026-5678' };
  const travaux = { numero_abonne: '2458' };

  const numero = normaliserNumeroContratAbonnement(demande, travaux, devis);

  assert.match(numero, new RegExp(`^\\d{4}/${annee}$`));
  assert.doesNotMatch(numero, /D-2026-1234|DV-2026-5678/);
});
