const PACKS_OUVRAGES_AEP = [
  {
    id: 'pack_std_dn25',
    titre: 'Branchement Standard Particulier PEHD Ø25 (5m)',
    description: 'Tranchée ordinaire 5m, PEHD Ø25, collier de prise en charge, vanne d’arrêt, compteur DN15 et mise en eau.',
    sectionCible: 'Travaux de branchement standard',
    lignes: [
      { code: 'TERR-01', libelle: 'Fouille en tranchée ordinaire (larg. 0.40m, prof. 0.80m)', categorie: 'Travaux & Terrassement', type: 'P/', quantite: 5, unite: 'ML', prix: 1400, marge: 15, tauxTva: 19 },
      { code: 'PEHD-25', libelle: 'Fourniture et pose de tube PEHD PN16 Ø25 mm', categorie: 'Canalisations & Raccords', type: 'FP/', quantite: 5, unite: 'ML', prix: 450, marge: 20, tauxTva: 19, diametre: '25' },
      { code: 'COL-PRISE', libelle: 'Collier de prise en charge avec robinet de prise en charge', categorie: 'Robinetterie & Accessoires', type: 'F/', quantite: 1, unite: 'U', prix: 3800, marge: 18, tauxTva: 19 },
      { code: 'VANN-20', libelle: 'Vanne d’arrêt quart de tour avant compteur Ø20', categorie: 'Robinetterie & Accessoires', type: 'F/', quantite: 1, unite: 'U', prix: 2200, marge: 20, tauxTva: 19, diametre: '20' },
      { code: 'COMPT-15', libelle: 'Fourniture et pose compteur de vitesse DN15 avec clapet anti-pollution', categorie: 'Comptage', type: 'FP/', quantite: 1, unite: 'U', prix: 7500, marge: 15, tauxTva: 19, diametre: '15' },
      { code: 'REG-NICHE', libelle: 'Fourniture et scellement d’une niche/regard de comptage préfabriqué', categorie: 'Comptage', type: 'F/', quantite: 1, unite: 'U', prix: 6800, marge: 15, tauxTva: 19 },
      { code: 'MO-ESSAI', libelle: 'Raccordement sur conduite principale, mise en eau et épreuve d’étanchéité', categorie: 'Frais & Prestations', type: 'P/', quantite: 1, unite: 'FF', prix: 5000, marge: 10, tauxTva: 19 }
    ]
  },
  {
    id: 'pack_collectif_dn40',
    titre: 'Branchement Gros Calibre PEHD Ø40 / Ø50 (Collectif)',
    description: 'Tranchée, conduite PEHD Ø40/50, vanne de sectionnement enterrée sous bouche à clé et batterie de compteurs.',
    sectionCible: 'Branchement gros calibre',
    lignes: [
      { code: 'TERR-02', libelle: 'Fouille en tranchée avec évacuation des déblais excédentaires', categorie: 'Travaux & Terrassement', type: 'P/', quantite: 8, unite: 'ML', prix: 1800, marge: 15, tauxTva: 19 },
      { code: 'PEHD-40', libelle: 'Tube PEHD PN16 Ø40 mm bandes bleues AEP', categorie: 'Canalisations & Raccords', type: 'F/', quantite: 8, unite: 'ML', prix: 820, marge: 20, tauxTva: 19, diametre: '40' },
      { code: 'VANN-BAC', libelle: 'Vanne d’arrêt à opercule avec bouche à clé et tube allonge', categorie: 'Robinetterie & Accessoires', type: 'F/', quantite: 1, unite: 'U', prix: 14500, marge: 15, tauxTva: 19 },
      { code: 'CLAP-40', libelle: 'Clapet de non-retour à brides DN40', categorie: 'Robinetterie & Accessoires', type: 'F/', quantite: 1, unite: 'U', prix: 9200, marge: 18, tauxTva: 19, diametre: '40' },
      { code: 'MO-COLL', libelle: 'Pose spécialisée, percement et épreuve sous pression 10 bars', categorie: 'Frais & Prestations', type: 'P/', quantite: 1, unite: 'FF', prix: 12000, marge: 10, tauxTva: 19 }
    ]
  },
  {
    id: 'pack_refection_voirie',
    titre: 'Pack Réfection de Chaussée / Enrobé à chaud',
    description: 'Découpe d’enrobé à la scie, remblai en tout-venant compacté et couche de roulement enrobé.',
    sectionCible: 'Voirie et génie civil',
    lignes: [
      { code: 'VOIR-DEC', libelle: 'Découpage du revêtement bitumineux à la disqueuse diamantée', categorie: 'Travaux & Terrassement', type: 'P/', quantite: 6, unite: 'ML', prix: 650, marge: 15, tauxTva: 19 },
      { code: 'VOIR-REM', libelle: 'Remblaiement méthodique en tout-venant 0/31.5 et compactage par couches', categorie: 'Travaux & Terrassement', type: 'F/', quantite: 3, unite: 'M3', prix: 3200, marge: 20, tauxTva: 19 },
      { code: 'VOIR-ENR', libelle: 'Réfection définitive de la chaussée en béton bitumineux (enrobé à chaud)', categorie: 'Travaux & Terrassement', type: 'FP/', quantite: 4, unite: 'M²', prix: 4800, marge: 15, tauxTva: 19 }
    ]
  }
];

export default PACKS_OUVRAGES_AEP;