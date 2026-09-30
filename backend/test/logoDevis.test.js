const test = require('node:test');
const assert = require('node:assert/strict');
const { decoderLogo, TAILLE_MAX_LOGO } = require('../utils/logoDevis');

function dataUrl(typeMime, contenu) {
  return `data:${typeMime};base64,${contenu.toString('base64')}`;
}

test('décode une image PNG valide', () => {
  const contenu = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const logo = decoderLogo(dataUrl('image/png', contenu));

  assert.equal(logo.typeMime, 'image/png');
  assert.deepEqual(logo.contenu, contenu);
});

test('accepte les signatures JPEG et WebP', () => {
  const images = [
    ['image/jpeg', Buffer.from([255, 216, 255, 0])],
    ['image/webp', Buffer.from('RIFF0000WEBP', 'ascii')]
  ];

  for (const [typeMime, contenu] of images) {
    assert.equal(decoderLogo(dataUrl(typeMime, contenu)).typeMime, typeMime);
  }
});

test('rejette les formats non autorisés et les signatures incohérentes', () => {
  assert.throws(() => decoderLogo('data:image/svg+xml;base64,PHN2Zz4='), /PNG, JPEG ou WebP/);
  assert.throws(() => decoderLogo(dataUrl('image/png', Buffer.from('not a png'))), /ne correspond pas/);
});

test('rejette les images supérieures à 512 Ko', () => {
  const contenu = Buffer.alloc(TAILLE_MAX_LOGO + 1);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(contenu);

  assert.throws(() => decoderLogo(dataUrl('image/png', contenu)), /512 Ko/);
});