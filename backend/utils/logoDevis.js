const TAILLE_MAX_LOGO = 512 * 1024;

const SIGNATURES = {
  'image/png': (contenu) => contenu.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  'image/jpeg': (contenu) => contenu.length >= 3 && contenu[0] === 255 && contenu[1] === 216 && contenu[2] === 255,
  'image/webp': (contenu) => contenu.length >= 12 && contenu.toString('ascii', 0, 4) === 'RIFF' && contenu.toString('ascii', 8, 12) === 'WEBP'
};

function decoderLogo(image) {
  const correspondance = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(image || '');
  if (!correspondance) {
    throw new Error('Choisissez une image PNG, JPEG ou WebP valide.');
  }

  const typeMime = correspondance[1].toLowerCase();
  const contenuBase64 = correspondance[2];
  const contenu = Buffer.from(contenuBase64, 'base64');
  if (!contenu.length || contenu.length > TAILLE_MAX_LOGO || contenu.toString('base64') !== contenuBase64) {
    throw new Error('Le logo doit peser au maximum 512 Ko.');
  }
  if (!SIGNATURES[typeMime](contenu)) {
    throw new Error('Le contenu du fichier ne correspond pas à son format d’image.');
  }

  return { typeMime, contenu };
}

module.exports = { decoderLogo, TAILLE_MAX_LOGO };