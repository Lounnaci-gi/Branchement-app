function peutCreerOuModifierDevis(statutActuel) {
  const statut = String(statutActuel || '').trim();
  return ['DEVIS_EMIS', 'DEVIS_PAYE'].includes(statut);
}

function tousLesDevisSontPayes(devis) {
  return Array.isArray(devis)
    && devis.length > 0
    && devis.every((item) => item.statut_paiement === 'PAYE');
}

function tousLesDevisOntDesArticles(devis) {
  return Array.isArray(devis)
    && devis.length > 0
    && devis.every((item) => Number(item.nombre_articles) > 0);
}

module.exports = {
  peutCreerOuModifierDevis,
  tousLesDevisSontPayes,
  tousLesDevisOntDesArticles
};
