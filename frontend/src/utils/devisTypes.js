function clesStockageDevisTypes() {
  try {
    const agent = JSON.parse(sessionStorage.getItem('agent') || '{}');
    return [...new Set([`devis-types:${agent.id_agent || 'local'}`, 'devis-types'])];
  } catch {
    return ['devis-types:local', 'devis-types'];
  }
}

function lireDevisTypesLocaux(cles) {
  const modeles = cles.flatMap((cle) => {
    try {
      const valeur = JSON.parse(localStorage.getItem(cle) || '[]');
      return Array.isArray(valeur) ? valeur : [];
    } catch {
      return [];
    }
  });
  return modeles.filter((modele, index, liste) => (
    modele?.id && liste.findIndex((element) => element?.id === modele.id) === index
  ));
}

export async function chargerDevisTypes(client) {
  const cles = clesStockageDevisTypes();
  const modelesLocaux = lireDevisTypesLocaux(cles);

  if (modelesLocaux.length > 0) {
    for (const [index, modele] of modelesLocaux.entries()) {
      await client.post('/referentiels/devis-types', {
        cle_client: String(modele.cle_client || modele.id || `legacy_${index}`),
        nom: modele.nom,
        sections: modele.sections
      });
    }
    cles.forEach((cle) => localStorage.removeItem(cle));
  }

  const response = await client.get('/referentiels/devis-types');
  return Array.isArray(response.data) ? response.data : [];
}