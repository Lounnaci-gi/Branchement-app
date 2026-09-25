function peutCreerOuModifierDevis(statutActuel) {
  const statut = String(statutActuel || '').trim();
  return ['DEVIS_EMIS', 'DEVIS_PAYE'].includes(statut);
}

module.exports = {
  peutCreerOuModifierDevis
};
