export function getDevisTableColumns({ quantitatif = false, afficherColonneUnite = true } = {}) {
  return [
    'N°',
    'Désignation',
    'Type',
    'Qté',
    ...(afficherColonneUnite ? ['Unité'] : []),
    ...(!quantitatif ? ['Prix U. HT', 'Total HT'] : [])
  ];
}

export function isDevisQuantitatif(modeAffichage = 'estimatif') {
  return String(modeAffichage || 'estimatif').toLowerCase() === 'quantitatif';
}
