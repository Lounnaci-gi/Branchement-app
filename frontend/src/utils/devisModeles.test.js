import assert from 'node:assert/strict';
import test from 'node:test';
import { MODELE_DEVIS_DEFAUT, MODELES_DEVIS, estModeleDevisValide } from './devisModeles.js';

test('propose plusieurs modèles de devis distincts', () => {
  assert.equal(MODELES_DEVIS.length, 22);
  assert.ok(MODELES_DEVIS.every((modele) => modele.id && modele.label && modele.description));
  assert.equal(new Set(MODELES_DEVIS.map((modele) => modele.id)).size, MODELES_DEVIS.length);
});

test('valide uniquement un modèle connu', () => {
  assert.equal(estModeleDevisValide(MODELE_DEVIS_DEFAUT), true);
  assert.equal(estModeleDevisValide('professionnel'), true);
  assert.equal(estModeleDevisValide('chantier'), true);
  assert.equal(estModeleDevisValide('inexistant'), false);
});
