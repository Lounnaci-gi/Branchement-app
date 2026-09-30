export function getDevisTableColumns({ quantitatif = false, afficherColonneUnite = true } = {}) {
  return [
    'N°',
    'Désignation',
    'Qté',
    ...(afficherColonneUnite ? ['Unité'] : []),
    ...(!quantitatif ? ['Prix U. HT', 'Total HT'] : [])
  ];
}

export function isDevisQuantitatif(modeAffichage = 'estimatif') {
  return String(modeAffichage || 'estimatif').toLowerCase() === 'quantitatif';
}

export function obtenirPrefixeTypeDevis(type) {
  const prefixe = String(type || '').trim().toUpperCase();
  return ['F/', 'P/', 'FP/', 'PR/'].includes(prefixe) ? prefixe : '';
}

export function retirerPrefixeTypeDesignation(type, designation) {
  const valeur = String(designation ?? '');
  if (!obtenirPrefixeTypeDevis(type)) return valeur;
  return valeur.replace(/^(?:FP\/|PR\/|F\/|P\/)\s*/i, '');
}

export function formaterDesignationAvecType(type, designation) {
  const prefixe = obtenirPrefixeTypeDevis(type);
  const valeur = retirerPrefixeTypeDesignation(type, designation).trim();
  if (!prefixe) return valeur;
  return valeur ? `${prefixe} ${valeur}` : prefixe;
}
