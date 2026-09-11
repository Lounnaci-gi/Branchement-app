const test = require('node:test');
const assert = require('node:assert/strict');

const { normaliserTypeArticleTarif } = require('../routes/referentiels.normalisation');

test('normalise PR en prestation sans fournisseur ni pose', () => {
  const out = normaliserTypeArticleTarif({
    type_article: 'PR',
    mode_prix: 'FOURNITURE_POSE',
    prix_unitaire: '125',
    prix_fourniture: '20',
    prix_pose: '30'
  });

  assert.equal(out.mode_prix, 'PRESTATION');
  assert.equal(out.prix_unitaire, 125);
  assert.equal(out.prix_fourniture, null);
  assert.equal(out.prix_pose, null);
});

test('normalise F P FP en fourniture + pose', () => {
  const outF = normaliserTypeArticleTarif({
    type_article: 'F',
    mode_prix: 'PRESTATION',
    prix_unitaire: '999',
    prix_fourniture: '20',
    prix_pose: '30'
  });

  assert.equal(outF.mode_prix, 'FOURNITURE_POSE');
  assert.equal(outF.prix_fourniture, 20);
  assert.equal(outF.prix_pose, 0);

  const outP = normaliserTypeArticleTarif({
    type_article: 'P',
    mode_prix: 'PRESTATION',
    prix_unitaire: '999',
    prix_fourniture: '20',
    prix_pose: '30'
  });

  assert.equal(outP.mode_prix, 'FOURNITURE_POSE');
  assert.equal(outP.prix_fourniture, 0);
  assert.equal(outP.prix_pose, 30);

  const outFP = normaliserTypeArticleTarif({
    type_article: 'FP',
    mode_prix: 'PRESTATION',
    prix_unitaire: '999',
    prix_fourniture: '20',
    prix_pose: '30'
  });

  assert.equal(outFP.mode_prix, 'FOURNITURE_POSE');
  assert.equal(outFP.prix_fourniture, 20);
  assert.equal(outFP.prix_pose, 30);
});
