// Ordre et apparence des statuts du pipeline — reflète le workflow métier ADE
export const ETAPES_PIPELINE = [
  { code: 'DEPOSEE', libelle: 'Déposée', abrev: 'Dépôt' },
  { code: 'ETUDE_EN_COURS', libelle: 'Étude en cours', abrev: 'Étude' },
  { code: 'ETUDE_TERMINEE', libelle: 'Étude terminée', abrev: 'Étude ✓' },
  { code: 'DEVIS_EMIS', libelle: 'Devis émis', abrev: 'Devis' },
  { code: 'DEVIS_PAYE', libelle: 'Devis payé', abrev: 'Payé' },
  { code: 'TRAVAUX_EN_COURS', libelle: 'Travaux en cours', abrev: 'Travaux' },
  { code: 'TRAVAUX_TERMINES', libelle: 'Travaux terminés', abrev: 'Travaux ✓' }
];

export const STATUTS_TERMINAUX = {
  REJETEE: { libelle: 'Rejetée', couleur: 'danger' },
  ANNULEE: { libelle: 'Annulée', couleur: 'muted' }
};

export function indexEtape(code) {
  return ETAPES_PIPELINE.findIndex((e) => e.code === code);
}

export function estStatutTerminalNegatif(code) {
  return Object.prototype.hasOwnProperty.call(STATUTS_TERMINAUX, code);
}

export const LIBELLES_STATUT = ETAPES_PIPELINE.reduce((acc, e) => {
  acc[e.code] = e.libelle;
  return acc;
}, { ...Object.fromEntries(Object.entries(STATUTS_TERMINAUX).map(([k, v]) => [k, v.libelle])) });
