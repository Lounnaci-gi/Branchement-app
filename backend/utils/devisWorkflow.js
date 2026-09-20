function peutCreerOuModifierDevis(statutActuel, { existeDevis = false } = {}) {
  const statut = String(statutActuel || '').trim();
  const statutsAutorises = ['DEVIS_EMIS', 'DEVIS_PAYE'];

  if (existeDevis) {
    return statutsAutorises.includes(statut);
  }

  return statutsAutorises.includes(statut);
}

module.exports = {
  peutCreerOuModifierDevis
};
