export const MODELE_DEVIS_DEFAUT = 'classique';

export const MODELES_DEVIS = [
  {
    id: 'classique',
    label: 'Classique ADE',
    description: 'Vagues en en-tête et pied, encadré client, totaux à droite, case signature.'
  },
  {
    id: 'institutionnel',
    label: 'Marine',
    description: 'Bandeau ondulé bleu nuit, tableau contrasté, pied « Merci beaucoup ».'
  },
  {
    id: 'moderne',
    label: 'Mint',
    description: 'Grand titre Devis, fond vert pâle, bon pour accord, pied d’agence.'
  },
  {
    id: 'compact',
    label: 'Épuré',
    description: 'DEVIS n° en grand, logo rond, fiche méta, barre cyan en bas de page.'
  },
  {
    id: 'prestige',
    label: 'Prestige',
    description: 'Anthracite et or, en-tête éditorial et mise en page structurée.'
  },
  {
    id: 'rubis',
    label: 'Rubis',
    description: 'Bandeau rouge profond, client mis en avant et totaux contrastés.'
  },
  {
    id: 'graphite',
    label: 'Graphite',
    description: 'Noir et blanc, repères numérotés et présentation très lisible.'
  },
  {
    id: 'lagon',
    label: 'Lagon',
    description: 'Accents turquoise, blocs aérés et tableau léger.'
  },
  {
    id: 'sienne',
    label: 'Sienne',
    description: 'Terracotta, filet chaleureux et mise en page artisanale.'
  },
  {
    id: 'azur',
    label: 'Azur',
    description: 'Bleu lumineux, fiche client en colonne et lignes alternées.'
  },
  {
    id: 'corporate',
    label: 'Corporate',
    description: 'Bandeau bleu professionnel, blocs client et projet, totaux alignés.'
  },
  {
    id: 'professionnel',
    label: 'Professionnel',
    description: 'Mise en page claire, repères bleus, tableau lisible et total mis en évidence.'
  },
  {
    id: 'chantier',
    label: 'Chantier',
    description: 'En-tête client et devis, lignes hiérarchisées, TVA détaillée et zone d’accord.'
  },
  {
    id: 'navy-corner',
    label: 'Marine angulaire',
    description: 'Angle bleu nuit, cartouche de référence et visa encadré.'
  },
  {
    id: 'cyan-groupe',
    label: 'Turquoise groupé',
    description: 'Accents turquoise, sections aérées et totaux soulignés.'
  },
  {
    id: 'atelier',
    label: 'Atelier',
    description: 'Bleu clair, informations d’intervention et présentation aérée.'
  },
  {
    id: 'quantitatif',
    label: 'Quantitatif',
    description: 'Présentation technique compacte avec lignes numérotées.'
  },
  {
    id: 'structure',
    label: 'Structure',
    description: 'Catégories marquées, sous-totaux visuels et tableau hiérarchisé.'
  },
  {
    id: 'orange',
    label: 'Orange professionnel',
    description: 'Cadres fins, TVA détaillée par article et pied de page structuré.'
  },
  {
    id: 'minimal-turquoise',
    label: 'Minimal turquoise',
    description: 'Présentation épurée, repères turquoise et en-tête compact.'
  },
  {
    id: 'ecobat',
    label: 'ÉcoBat',
    description: 'Accents végétaux, titre affirmé et totaux bleu-vert.'
  },
  {
    id: 'avenant',
    label: 'Avenant',
    description: 'Référence au devis, projet et zone de validation en bleu.'
  }
];

export function estModeleDevisValide(id) {
  return MODELES_DEVIS.some((modele) => modele.id === id);
}

function cleStockageModeleDevis() {
  try {
    const agent = JSON.parse(sessionStorage.getItem('agent') || '{}');
    return `devis-modele:${agent.id_agent || 'local'}`;
  } catch {
    return 'devis-modele:local';
  }
}

export function lireModeleDevisPrefere() {
  try {
    const valeur = localStorage.getItem(cleStockageModeleDevis());
    return estModeleDevisValide(valeur) ? valeur : MODELE_DEVIS_DEFAUT;
  } catch {
    return MODELE_DEVIS_DEFAUT;
  }
}

export function enregistrerModeleDevisPrefere(id) {
  const modele = estModeleDevisValide(id) ? id : MODELE_DEVIS_DEFAUT;
  localStorage.setItem(cleStockageModeleDevis(), modele);
  window.dispatchEvent(new CustomEvent('devis-modele-change', { detail: { modele } }));
  return modele;
}
