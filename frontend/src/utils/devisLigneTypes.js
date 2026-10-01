export function determinerTypesDisponibles(ligne, tousLesArticles = [], { autoriserTousLesTypes = false } = {}) {
  if (!ligne) {
    return autoriserTousLesTypes ? ['FP/', 'F/', 'P/', 'PR/'] : ['F/'];
  }

  const ref = Array.isArray(tousLesArticles)
    ? tousLesArticles.find((a) => a.code === (ligne.code || ligne.code_article))
    : null;

  if (autoriserTousLesTypes && (!ref || ligne.estLigneLibre)) {
    return ['FP/', 'F/', 'P/', 'PR/'];
  }

  const fRaw = ligne.prixFourniture ?? ligne.prix_fourniture ?? ref?.prixFourniture ?? null;
  const pRaw = ligne.prixPose ?? ligne.prix_pose ?? ref?.prixPose ?? null;
  const mode = String(ligne.modePrix ?? ligne.mode_prix ?? ref?.modePrix ?? '').trim().toUpperCase();
  const currentType = String(ligne.type ?? ligne.type_ligne ?? '').trim();

  const f = fRaw !== null && fRaw !== undefined ? Number(fRaw) : null;
  const p = pRaw !== null && pRaw !== undefined ? Number(pRaw) : null;

  const aFourniture = f !== null && f > 0;
  const aPose = p !== null && p > 0;
  const aLesDeux = aFourniture && aPose;

  const types = [];

  if (aFourniture) types.push('F/');
  if (aPose) types.push('P/');
  if (aLesDeux) types.push('FP/');

  const estPrestation = mode === 'PRESTATION'
    || (!aFourniture && !aPose && (
      currentType === 'PR/'
      || String(ligne.code || '').startsWith('PR')
      || String(ligne.typeTva ?? ligne.type_tva ?? '').toUpperCase() === 'PRESTATION'
    ));

  if (estPrestation && !aFourniture && !aPose) {
    types.push('PR/');
  }

  if (types.length === 0) {
    if (['F/', 'P/', 'FP/', 'PR/'].includes(currentType)) {
      types.push(currentType);
    } else {
      types.push('F/');
    }
  }

  return types;
}

export function normaliserTypeLigne(type, choixPrix, modePrix, article = null, tousLesArticles = [], options = {}) {
  const typesDispo = determinerTypesDisponibles(
    article || { type, choixPrix, modePrix },
    tousLesArticles,
    options
  );
  const str = String(type || '').trim();
  if (typesDispo.includes(str)) return str;
  if (choixPrix === 'FOURNITURE' && typesDispo.includes('F/')) return 'F/';
  if (choixPrix === 'POSE' && typesDispo.includes('P/')) return 'P/';
  if (choixPrix === 'FOURNITURE_POSE' && typesDispo.includes('FP/')) return 'FP/';
  if (typesDispo.includes('PR/')) return 'PR/';
  return typesDispo[0] || 'F/';
}
