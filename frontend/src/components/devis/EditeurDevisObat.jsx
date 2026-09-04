import { useState, useEffect, useRef } from 'react';
import './EditeurDevisObat.css';

const LIBELLES_UNITES = {
  U: 'U (Unité)',
  ML: 'ML (Mètre linéaire)',
  'M²': 'M² (Mètre carré)',
  M3: 'M3 (Mètre cube)',
  KG: 'KG (Kilogramme)',
  H: 'H (Heure)',
  FF: 'FF (Forfait)'
};

function formaterNombre(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Modèles d'ouvrages types AEP (Spécifiques ADE pour eau potable)
const PACKS_OUVRAGES_AEP = [
  {
    id: 'pack_std_dn25',
    titre: 'Branchement Standard Particulier PEHD Ø25 (5m)',
    description: 'Tranchée ordinaire 5m, PEHD Ø25, collier de prise en charge, vanne d’arrêt, compteur DN15 et mise en eau.',
    sectionCible: 'Travaux de branchement standard',
    lignes: [
      { code: 'TERR-01', libelle: 'Fouille en tranchée ordinaire (larg. 0.40m, prof. 0.80m)', type: 'Main d’œuvre', quantite: 5, unite: 'ML', prix: 1400, marge: 15, tauxTva: 19 },
      { code: 'PEHD-25', libelle: 'Fourniture et pose de tube PEHD PN16 Ø25 mm', type: 'Fourniture', quantite: 5, unite: 'ML', prix: 450, marge: 20, tauxTva: 19, diametre: '25' },
      { code: 'COL-PRISE', libelle: 'Collier de prise en charge avec robinet de prise en charge', type: 'Fourniture', quantite: 1, unite: 'U', prix: 3800, marge: 18, tauxTva: 19 },
      { code: 'VANN-20', libelle: 'Vanne d’arrêt quart de tour avant compteur Ø20', type: 'Fourniture', quantite: 1, unite: 'U', prix: 2200, marge: 20, tauxTva: 19, diametre: '20' },
      { code: 'COMPT-15', libelle: 'Fourniture et pose compteur de vitesse DN15 avec clapet anti-pollution', type: 'Ouvrage', quantite: 1, unite: 'U', prix: 7500, marge: 15, tauxTva: 19, diametre: '15' },
      { code: 'REG-NICHE', libelle: 'Fourniture et scellement d’une niche/regard de comptage préfabriqué', type: 'Fourniture', quantite: 1, unite: 'U', prix: 6800, marge: 15, tauxTva: 19 },
      { code: 'MO-ESSAI', libelle: 'Raccordement sur conduite principale, mise en eau et épreuve d’étanchéité', type: 'Main d’œuvre', quantite: 1, unite: 'FF', prix: 5000, marge: 10, tauxTva: 19 }
    ]
  },
  {
    id: 'pack_collectif_dn40',
    titre: 'Branchement Gros Calibre PEHD Ø40 / Ø50 (Collectif)',
    description: 'Tranchée, conduite PEHD Ø40/50, vanne de sectionnement enterrée sous bouche à clé et batterie de compteurs.',
    sectionCible: 'Branchement gros calibre',
    lignes: [
      { code: 'TERR-02', libelle: 'Fouille en tranchée avec évacuation des déblais excédentaires', type: 'Main d’œuvre', quantite: 8, unite: 'ML', prix: 1800, marge: 15, tauxTva: 19 },
      { code: 'PEHD-40', libelle: 'Tube PEHD PN16 Ø40 mm bandes bleues AEP', type: 'Fourniture', quantite: 8, unite: 'ML', prix: 820, marge: 20, tauxTva: 19, diametre: '40' },
      { code: 'VANN-BAC', libelle: 'Vanne d’arrêt à opercule avec bouche à clé et tube allonge', type: 'Fourniture', quantite: 1, unite: 'U', prix: 14500, marge: 15, tauxTva: 19 },
      { code: 'CLAP-40', libelle: 'Clapet de non-retour à brides DN40', type: 'Fourniture', quantite: 1, unite: 'U', prix: 9200, marge: 18, tauxTva: 19, diametre: '40' },
      { code: 'MO-COLL', libelle: 'Pose spécialisée, percement et épreuve sous pression 10 bars', type: 'Main d’œuvre', quantite: 1, unite: 'FF', prix: 12000, marge: 10, tauxTva: 19 }
    ]
  },
  {
    id: 'pack_refection_voirie',
    titre: 'Pack Réfection de Chaussée / Enrobé à chaud',
    description: 'Découpe d’enrobé à la scie, remblai en tout-venant compacté et couche de roulement enrobé.',
    sectionCible: 'Voirie et génie civil',
    lignes: [
      { code: 'VOIR-DEC', libelle: 'Découpage du revêtement bitumineux à la disqueuse diamantée', type: 'Main d’œuvre', quantite: 6, unite: 'ML', prix: 650, marge: 15, tauxTva: 19 },
      { code: 'VOIR-REM', libelle: 'Remblaiement méthodique en tout-venant 0/31.5 et compactage par couches', type: 'Fourniture', quantite: 3, unite: 'M3', prix: 3200, marge: 20, tauxTva: 19 },
      { code: 'VOIR-ENR', libelle: 'Réfection définitive de la chaussée en béton bitumineux (enrobé à chaud)', type: 'Ouvrage', quantite: 4, unite: 'M²', prix: 4800, marge: 15, tauxTva: 19 }
    ]
  }
];

export default function EditeurDevisObat({
  demande,
  etude,
  devisInitial = null,
  articleFamilles = [],
  numeroDevisPreview = '',
  chargement = false,
  onEnregistrer,
  onFinaliser,
  onAnnuler
}) {
  // Mode de visualisation : 'edition' ou 'preview' (Comme dans la vidéo Obat 1:14)
  const [modeOnglet, setModeOnglet] = useState('edition');

  // Tiroir latéral "Bibliothèques" (Obat 4:25)
  const [drawerBiblioOuvert, setDrawerBiblioOuvert] = useState(false);
  const [ongletBiblio, setOngletBiblio] = useState('articles'); // 'articles' ou 'packs'
  const [filtreFamille, setFiltreFamille] = useState('TOUS');
  const [rechercheBiblio, setRechercheBiblio] = useState('');

  // Dropdown options
  const [menuOptionsOuvert, setMenuOptionsOuvert] = useState(false);
  const [modalFinaliserOuvert, setModalFinaliserOuvert] = useState(false);
  const [ventilationOuverte, setVentilationOuverte] = useState(false);

  // Options d'affichage Obat
  const [afficherColonneMarge, setAfficherColonneMarge] = useState(true);
  const [afficherColonneUnite, setAfficherColonneUnite] = useState(true);
  const [masquerDetailsOuvragesPreview, setMasquerDetailsOuvragesPreview] = useState(true);
  const [autoliquidationTva, setAutoliquidationTva] = useState(false); // Obat 8:18

  // Modal d'avertissement non bloquant (Vidéo Obat timestamp t=84s)
  const [modalAvertissementMentions, setModalAvertissementMentions] = useState(false);
  const [actionApresAvertissement, setActionApresAvertissement] = useState(null);

  // Modal de configuration d'un ouvrage (Obat 3:12)
  const [ouvrageEnConfig, setOuvrageEnConfig] = useState(null);

  // Données du document
  const [numeroDevis, setNumeroDevis] = useState(
    devisInitial?.numero_devis || numeroDevisPreview || 'DEV/2026/00001'
  );

  const aujourdhuiIso = new Date().toISOString().slice(0, 10);
  const validiteDefautIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [dateEmission, setDateEmission] = useState(
    devisInitial?.date_emission ? devisInitial.date_emission.slice(0, 10) : aujourdhuiIso
  );
  const [dateValidite, setDateValidite] = useState(validiteDefautIso);

  // Mentions d'exécution (Focus timestamp t=84s de la vidéo Obat)
  const [debutTravaux, setDebutTravaux] = useState('');
  const [enEditionDebutTravaux, setEnEditionDebutTravaux] = useState(false);
  const [survolDebutTravaux, setSurvolDebutTravaux] = useState(false);

  const [dureeEstimee, setDureeEstimee] = useState('');
  const [enEditionDuree, setEnEditionDuree] = useState(false);

  const refInputDebutTravaux = useRef(null);
  const refInputDuree = useRef(null);

  // Description optionnelle des travaux
  const [afficherDescription, setAfficherDescription] = useState(false);
  const [descriptionProjet, setDescriptionProjet] = useState('');

  // -------------------------------------------------------------
  // STRUCTURE EN SECTIONS ET SOUS-SECTIONS (Obat 1:47 - 2:05)
  // -------------------------------------------------------------
  const natureDefaut = demande?.type_autre || demande?.type_branchement || 'Branchement AEP';
  
  // Sections hiérarchiques
  const [sections, setSections] = useState(() => {
    // Si devis existant avec articles, regrouper ou créer une section initiale
    if (devisInitial?.articles && Array.isArray(devisInitial.articles) && devisInitial.articles.length > 0) {
      return [
        {
          id_section: 'sec_1',
          titre: `Travaux : ${natureDefaut}`,
          lignes: devisInitial.articles.map((art) => ({
            id_ligne: art.id_ligne || Math.random().toString(),
            code: art.code || art.code_article || '',
            libelle: art.libelle || '',
            type: art.type || (art.code?.includes('MO') ? 'Main d’œuvre' : 'Fourniture'),
            quantite: Number(art.quantite) || 1,
            unite: art.unite || 'U',
            prix: Number(art.prix ?? art.prix_unitaire ?? 0),
            marge: Number(art.marge || 0),
            tauxTva: Number(art.tauxTva ?? art.taux_tva ?? 19),
            typeTva: art.typeTva || 'PRESTATION',
            matiere: art.matiere || '',
            couleur: art.couleur || '',
            diametre: art.diametre || '',
            sousElements: art.sousElements || []
          }))
        }
      ];
    }
    // Devis vierge : créer une section par défaut
    return [
      {
        id_section: 'sec_1',
        titre: `1. Travaux de branchement AEP (${natureDefaut})`,
        lignes: []
      }
    ];
  });

  // Section active pour l'insertion
  const [idSectionActive, setIdSectionActive] = useState('sec_1');

  // Conditions & Paiement (Obat 5:54)
  const [modesPaiement, setModesPaiement] = useState({
    cheque: true,
    especes: true,
    virement: true
  });
  const [tauxAcompte, setTauxAcompte] = useState(30); // 30% par défaut
  const [editionAcompte, setEditionAcompte] = useState(false);

  // Retenue de garantie (Obat 6:43)
  const [aRetenueGarantie, setARetenueGarantie] = useState(false);
  const [tauxRetenueGarantie, setTauxRetenueGarantie] = useState(5); // 5%
  const [dureeRetenueMois, setDureeRetenueMois] = useState(12);

  // Remise globale
  const [aRemise, setARemise] = useState(false);
  const [tauxRemise, setTauxRemise] = useState(0);

  // Notes de bas de page & texte libre
  const [notesBasDePage, setNotesBasDePage] = useState(
    'Le présent devis est valable 30 jours à compter de sa date d’émission. Les travaux débuteront après accord et acquittement du montant convenu auprès de l’agence ADE.'
  );
  const [texteLibre, setTexteLibre] = useState('');
  const [afficherTexteLibre, setAfficherTexteLibre] = useState(false);

  // Coordonnées bancaires
  const [coordonneesBancaires, setCoordonneesBancaires] = useState({
    iban: 'DZ00 0000 1234 5678 9012 3456',
    bic: 'BNAALGDX (Compte ADE)'
  });
  const [enEditionBanque, setEnEditionBanque] = useState(false);

  // Gestion des déchets de chantier (Obat 7:06 - obligation BTP / travaux)
  const [gestionDechets, setGestionDechets] = useState({
    nature: 'Déblais terreux, gravats de tranchée et chutes PEHD',
    volume: '2.5 m³',
    centre: 'Centre d’enfouissement et de recyclage agréé'
  });
  const [enEditionDechets, setEnEditionDechets] = useState(false);

  // Modal finalisation paiement immédiat
  const [enregistrerPaiementDirect, setEnregistrerPaiementDirect] = useState(false);
  const [donneesPaiement, setDonneesPaiement] = useState({
    mode_paiement: 'Especes',
    date_paiement: aujourdhuiIso,
    numero_recu: '',
    numero_cheque: '',
    numero_versement: '',
    banque: ''
  });

  // Mise à jour si preview devis arrive
  useEffect(() => {
    if (numeroDevisPreview && !devisInitial?.numero_devis) {
      setNumeroDevis(numeroDevisPreview);
    }
  }, [numeroDevisPreview, devisInitial]);

  // Tous les articles aplatis du référentiel
  const tousLesArticles = articleFamilles.flatMap((f) =>
    (f.articles || []).map((art) => ({ ...art, famille: f.libelle || f.code }))
  );

  // Filtrage du tiroir bibliothèques
  const articlesFiltres = tousLesArticles.filter((art) => {
    const matchFamille = filtreFamille === 'TOUS' || art.famille === filtreFamille;
    const q = rechercheBiblio.toLowerCase().trim();
    const matchTexte = !q || [art.libelle, art.code, art.matiere, art.couleur].some((v) =>
      v?.toLowerCase().includes(q)
    );
    return matchFamille && matchTexte;
  });

  // -------------------------------------------------------------
  // ACTIONS SUR LES SECTIONS ET LIGNES
  // -------------------------------------------------------------
  function ajouterSection() {
    const nouveauNum = sections.length + 1;
    const nouvelle = {
      id_section: `sec_${Date.now()}`,
      titre: `${nouveauNum}. Nouvelle section de travaux`,
      lignes: []
    };
    setSections((prev) => [...prev, nouvelle]);
    setIdSectionActive(nouvelle.id_section);
  }

  function supprimerSection(idSection) {
    if (sections.length <= 1) {
      alert('Un devis doit comporter au moins une section.');
      return;
    }
    setSections((prev) => prev.filter((s) => s.id_section !== idSection));
  }

  function modifierTitreSection(idSection, nouveauTitre) {
    setSections((prev) =>
      prev.map((s) => (s.id_section === idSection ? { ...s, titre: nouveauTitre } : s))
    );
  }

  function ajouterLigneDansSection(idSection, article, categorie = 'Fourniture') {
    const targetId = idSection || idSectionActive || sections[0]?.id_section;
    const nouvelleLigne = {
      id_ligne: `lig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code: article?.code || (categorie === 'Main d’œuvre' ? 'MO-GEN' : `ART-${Date.now()}`),
      libelle: article?.libelle || `${categorie} standard`,
      type: article?.type || categorie,
      quantite: Number(article?.quantite) || 1,
      unite: article?.unite || (categorie === 'Main d’œuvre' ? 'H' : 'U'),
      prix: Number(article?.prix || 0),
      marge: Number(article?.marge || 0),
      tauxTva: autoliquidationTva ? 0 : Number(article?.tauxTva || 19),
      typeTva: article?.typeTva || 'PRESTATION',
      matiere: article?.matiere || '',
      couleur: article?.couleur || '',
      diametre: article?.diametre || '',
      sousElements: article?.sousElements || []
    };

    setSections((prev) =>
      prev.map((s) =>
        s.id_section === targetId ? { ...s, lignes: [...s.lignes, nouvelleLigne] } : s
      )
    );
  }

  function supprimerLigne(idSection, idLigne) {
    setSections((prev) =>
      prev.map((s) =>
        s.id_section === idSection
          ? { ...s, lignes: s.lignes.filter((l) => l.id_ligne !== idLigne) }
          : s
      )
    );
  }

  function modifierChampLigne(idSection, idLigne, champ, valeur) {
    setSections((prev) =>
      prev.map((s) =>
        s.id_section === idSection
          ? {
              ...s,
              lignes: s.lignes.map((l) => (l.id_ligne === idLigne ? { ...l, [champ]: valeur } : l))
            }
          : s
      )
    );
  }

  // Insérer un pack complet d'ouvrages types AEP
  function insererPackOuvrage(pack) {
    const secCible = {
      id_section: `sec_pack_${Date.now()}`,
      titre: pack.titre,
      lignes: pack.lignes.map((l) => ({
        ...l,
        id_ligne: `lig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tauxTva: autoliquidationTva ? 0 : l.tauxTva
      }))
    };
    setSections((prev) => [...prev, secCible]);
    setDrawerBiblioOuvert(false);
  }

  // Ouvrir le configurateur d'ouvrage (Obat 3:12)
  function ouvrirConfigurateurOuvrage(idSection, ligne) {
    const sousElementsInit = ligne.sousElements?.length > 0
      ? JSON.parse(JSON.stringify(ligne.sousElements))
      : [
          { id: 'se_1', libelle: `Fourniture composant : ${ligne.libelle}`, type: 'Fourniture', quantite: 1, unite: 'U', prixAchat: Math.round(ligne.prix * 0.7), marge: 20, verrouille: true },
          { id: 'se_2', libelle: `Main d'œuvre de pose & raccordement`, type: 'Main d’œuvre', quantite: 1, unite: 'H', prixAchat: Math.round(ligne.prix * 0.2), marge: 15, verrouille: true }
        ];

    setOuvrageEnConfig({
      idSection,
      idLigne: ligne.id_ligne,
      libelle: ligne.libelle,
      quantite: ligne.quantite,
      unite: ligne.unite,
      coefAjustement: 1.0,
      sousElements: sousElementsInit
    });
  }

  function appliquerConfigurationOuvrage() {
    if (!ouvrageEnConfig) return;
    const { idSection, idLigne, sousElements, coefAjustement } = ouvrageEnConfig;

    const prixVenteSousElements = sousElements.reduce((acc, se) => {
      const q = Number(se.quantite) || 1;
      const pa = Number(se.prixAchat) || 0;
      const marge = Number(se.marge) || 0;
      const pv = pa * (1 + marge / 100);
      return acc + q * pv;
    }, 0);

    const prixFinalUnitaire = Math.round(prixVenteSousElements * (Number(coefAjustement) || 1));

    setSections((prev) =>
      prev.map((s) =>
        s.id_section === idSection
          ? {
              ...s,
              lignes: s.lignes.map((l) =>
                l.id_ligne === idLigne
                  ? {
                      ...l,
                      prix: prixFinalUnitaire,
                      sousElements: sousElements
                    }
                  : l
              )
            }
          : s
      )
    );

    setOuvrageEnConfig(null);
  }

  // -------------------------------------------------------------
  // CALCULS FINANCIERS DU DEVIS
  // -------------------------------------------------------------
  const toutesLesLignes = sections.flatMap((s) => s.lignes);

  const totalNetHTBrut = toutesLesLignes.reduce((acc, l) => {
    const qte = Number(l.quantite) || 0;
    const pu = Number(l.prix) || 0;
    return acc + qte * pu;
  }, 0);

  const montantRemise = aRemise ? (totalNetHTBrut * (Number(tauxRemise) || 0)) / 100 : 0;
  const totalNetHT = Math.max(0, totalNetHTBrut - montantRemise);

  const totalTVA = autoliquidationTva
    ? 0
    : toutesLesLignes.reduce((acc, l) => {
        const qte = Number(l.quantite) || 0;
        const pu = Number(l.prix) || 0;
        const taux = Number(l.tauxTva) || 19;
        const ligneHT = qte * pu;
        const ligneApresRemise = aRemise ? ligneHT * (1 - (Number(tauxRemise) || 0) / 100) : ligneHT;
        return acc + ligneApresRemise * (taux / 100);
      }, 0);

  const totalTTC = totalNetHT + totalTVA;

  const montantRetenue = aRetenueGarantie ? (totalTTC * (Number(tauxRetenueGarantie) || 0)) / 100 : 0;
  const netAPayerTTC = Math.max(0, totalTTC - montantRetenue);

  const margeBruteHT = toutesLesLignes.reduce((acc, l) => {
    const qte = Number(l.quantite) || 0;
    const pu = Number(l.prix) || 0;
    const tauxMarge = Number(l.marge) || 0;
    return acc + qte * pu * (tauxMarge / 100);
  }, 0);

  const tauxMargeGlobal = totalNetHT > 0 ? (margeBruteHT / totalNetHT) * 100 : 0;

  const montantAcompte = (netAPayerTTC * (Number(tauxAcompte) || 0)) / 100;
  const montantReste = Math.max(0, netAPayerTTC - montantAcompte);

  // -------------------------------------------------------------
  // GESTION DE L'ENREGISTREMENT & AVERTISSEMENT NON-BLOQUANT (t=84s)
  // -------------------------------------------------------------
  function verifierAvantSauvegarde(estFinalisation = false) {
    if (toutesLesLignes.length === 0) {
      alert('Veuillez ajouter au moins un article ou un ouvrage dans le devis.');
      return;
    }

    // POINT CLÉ DE LA VIDÉO OBAT (Timestamp 1:24 / 84s) :
    const manqueMentions = !debutTravaux?.trim() || !dureeEstimee?.trim();

    if (manqueMentions) {
      setActionApresAvertissement(() => () => executerSauvegarde(estFinalisation));
      setModalAvertissementMentions(true);
      return;
    }

    executerSauvegarde(estFinalisation);
  }

  function executerSauvegarde(estFinalisation = false) {
    setModalAvertissementMentions(false);

    let ordreGlobal = 1;
    const articlesPayload = [];

    sections.forEach((sec) => {
      sec.lignes.forEach((l) => {
        articlesPayload.push({
          code: l.code,
          libelle: `[${sec.titre}] ${l.libelle}`,
          unite: l.unite,
          diametre: l.diametre || null,
          quantite: Number(l.quantite) || 1,
          prix: Number(l.prix) || 0,
          montantLigne: (Number(l.quantite) || 1) * (Number(l.prix) || 0),
          tauxTva: autoliquidationTva ? 0 : Number(l.tauxTva) || 19,
          typeTva: l.typeTva || 'PRESTATION',
          ordre: ordreGlobal++
        });
      });
    });

    const payload = {
      numero_devis: numeroDevis,
      montant: Math.round(netAPayerTTC * 100) / 100,
      total_ht: Math.round(totalNetHT * 100) / 100,
      total_tva: Math.round(totalTVA * 100) / 100,
      articles: articlesPayload,
      debut_travaux: debutTravaux || null,
      duree_estimee: dureeEstimee || null,
      paiementDirect: enregistrerPaiementDirect ? donneesPaiement : null
    };

    if (estFinalisation) {
      onFinaliser?.(payload);
    } else {
      onEnregistrer?.(payload);
    }
  }

  // Export CSV
  function exporterCsv() {
    const headers = ['Section', 'N°', 'Code', 'Désignation', 'Quantité', 'Unité', 'Prix U. HT', 'Marge %', 'TVA %', 'Total HT'];
    const rows = [];

    sections.forEach((sec) => {
      sec.lignes.forEach((l, idx) => {
        const q = Number(l.quantite) || 0;
        const p = Number(l.prix) || 0;
        rows.push([
          `"${sec.titre.replace(/"/g, '""')}"`,
          idx + 1,
          `"${l.code}"`,
          `"${l.libelle.replace(/"/g, '""')}"`,
          q,
          `"${l.unite}"`,
          p,
          Number(l.marge) || 0,
          autoliquidationTva ? 0 : Number(l.tauxTva) || 19,
          q * p
        ]);
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Devis_${numeroDevis.replace(/[\/\\]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setMenuOptionsOuvert(false);
  }

  // Coordonnées client
  const nomClient = demande?.est_personne_morale
    ? demande.raison_sociale
    : `${demande?.demandeur_nom || ''} ${demande?.demandeur_prenom || ''}`.trim() || 'Abonné Client';
  const adresseClient = demande?.demandeur_adresse || demande?.adresse_branchement || 'Adresse de raccordement';
  const communeClient = demande?.nom_commune || 'Commune de rattachement';
  const telClient = demande?.demandeur_telephone || 'Non renseigné';
  const numDemandeRef = demande?.numero_demande || 'DEM-2026';

  return (
    <div className="obat-devis-wrapper">
      {/* 1. TOPBAR DE COMMANDE */}
      <header className="obat-topbar">
        <div className="obat-topbar-left">
          <div className="obat-doc-title">
            <span className="obat-ade-badge">ADE</span>
            {modeOnglet === 'edition' ? 'Édition de Devis' : 'Aperçu du Devis'}
          </div>

          <nav className="obat-nav-tabs">
            <button
              type="button"
              className={`obat-nav-tab ${modeOnglet === 'edition' ? 'active' : ''}`}
              onClick={() => setModeOnglet('edition')}
            >
              <span>✏️</span> Mode Édition
            </button>
            <button
              type="button"
              className={`obat-nav-tab ${modeOnglet === 'preview' ? 'active' : ''}`}
              onClick={() => setModeOnglet('preview')}
            >
              <span>👁</span> Prévisualisation
            </button>
          </nav>
        </div>

        <div className="obat-topbar-right">
          {/* Badge statut mentions t=84s */}
          <div
            className={`obat-mention-status-pill ${debutTravaux && dureeEstimee ? 'ok' : 'warn'}`}
            title="Mentions d’exécution recommandées (début et durée)"
            onClick={() => {
              setEnEditionDebutTravaux(true);
              setEnEditionDuree(true);
            }}
          >
            {debutTravaux && dureeEstimee ? '✓ Mentions d’exécution OK' : '⚠️ Mentions à renseigner'}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="obat-btn-option"
              onClick={() => setMenuOptionsOuvert((prev) => !prev)}
            >
              Options ▾
            </button>
            {menuOptionsOuvert && (
              <div className="obat-dropdown-menu">
                <button
                  type="button"
                  className="obat-dropdown-item"
                  onClick={() => {
                    setAfficherColonneMarge((p) => !p);
                    setMenuOptionsOuvert(false);
                  }}
                >
                  {afficherColonneMarge ? '👁 Masquer la colonne Marge' : '👁 Afficher la colonne Marge'}
                </button>
                <button
                  type="button"
                  className="obat-dropdown-item"
                  onClick={() => {
                    setAutoliquidationTva((p) => !p);
                    setMenuOptionsOuvert(false);
                  }}
                >
                  {autoliquidationTva ? '✓ Désactiver Autoliquidation TVA' : '⚖️ Activer Autoliquidation TVA (0%)'}
                </button>
                <button
                  type="button"
                  className="obat-dropdown-item"
                  onClick={() => {
                    setMasquerDetailsOuvragesPreview((p) => !p);
                    setMenuOptionsOuvert(false);
                  }}
                >
                  {masquerDetailsOuvragesPreview ? 'Détailler les ouvrages en Preview' : 'Synthétiser les ouvrages en Preview'}
                </button>
                <div style={{ height: 1, background: '#E5E7EB', margin: '4px 0' }} />
                <button
                  type="button"
                  className="obat-dropdown-item"
                  onClick={exporterCsv}
                >
                  📊 Exporter en CSV
                </button>
                <button
                  type="button"
                  className="obat-dropdown-item"
                  onClick={() => {
                    window.print();
                    setMenuOptionsOuvert(false);
                  }}
                >
                  🖨 Imprimer
                </button>
              </div>
            )}
          </div>

          <button type="button" className="obat-btn-annuler" onClick={onAnnuler}>
            Annuler
          </button>

          <button
            type="button"
            className="obat-btn-enregistrer"
            disabled={chargement}
            onClick={() => verifierAvantSauvegarde(false)}
          >
            {chargement ? 'Enregistrement…' : 'Enregistrer 🡒'}
          </button>

          <button
            type="button"
            className="obat-btn-finaliser"
            disabled={chargement}
            onClick={() => verifierAvantSauvegarde(true)}
          >
            Finaliser le devis ▾
          </button>

          <button
            type="button"
            className="obat-btn-close"
            onClick={onAnnuler}
            title="Fermer"
          >
            ✕
          </button>
        </div>
      </header>

      {/* 2. ONGLET FLOTTANT ET TIROIR LATÉRAL */}
      {modeOnglet === 'edition' && (
        <button
          type="button"
          className="obat-floating-biblio-btn"
          onClick={() => setDrawerBiblioOuvert(true)}
        >
          <span>📚</span> Bibliothèques & Packs
        </button>
      )}

      {drawerBiblioOuvert && (
        <>
          <div
            className="obat-drawer-backdrop"
            onClick={() => setDrawerBiblioOuvert(false)}
          />
          <aside className="obat-drawer">
            <div className="obat-drawer-header">
              <h3>
                <span>📚</span> Bibliothèque d'éléments
              </h3>
              <button
                type="button"
                className="obat-btn-close"
                onClick={() => setDrawerBiblioOuvert(false)}
              >
                ✕
              </button>
            </div>

            {/* Onglets Articles vs Packs AEP */}
            <div className="obat-drawer-tabs">
              <button
                type="button"
                className={`obat-drawer-tab ${ongletBiblio === 'articles' ? 'active' : ''}`}
                onClick={() => setOngletBiblio('articles')}
              >
                Articles du Référentiel ({tousLesArticles.length})
              </button>
              <button
                type="button"
                className={`obat-drawer-tab ${ongletBiblio === 'packs' ? 'active' : ''}`}
                onClick={() => setOngletBiblio('packs')}
              >
                📦 Packs Ouvrages AEP ({PACKS_OUVRAGES_AEP.length})
              </button>
            </div>

            {ongletBiblio === 'articles' ? (
              <>
                <div className="obat-drawer-search">
                  <input
                    type="text"
                    placeholder="Rechercher par nom, code, matière, diamètre…"
                    value={rechercheBiblio}
                    onChange={(e) => setRechercheBiblio(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="obat-familles-tags">
                  <button
                    type="button"
                    className={`obat-famille-tag ${filtreFamille === 'TOUS' ? 'active' : ''}`}
                    onClick={() => setFiltreFamille('TOUS')}
                  >
                    Tous
                  </button>
                  {articleFamilles.map((f) => (
                    <button
                      key={f.code || f.id_famille}
                      type="button"
                      className={`obat-famille-tag ${filtreFamille === (f.libelle || f.code) ? 'active' : ''}`}
                      onClick={() => setFiltreFamille(f.libelle || f.code)}
                    >
                      {f.libelle || f.code}
                    </button>
                  ))}
                </div>

                <div className="obat-drawer-list">
                  {articlesFiltres.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '30px 10px', fontSize: 13 }}>
                      Aucun article trouvé pour cette recherche.
                    </div>
                  ) : (
                    articlesFiltres.map((art) => (
                      <div key={art.code} className="obat-drawer-item">
                        <div className="obat-item-info">
                          <div className="obat-item-name" title={art.libelle}>
                            {art.libelle}
                          </div>
                          <div className="obat-item-sub">
                            {art.code} · {LIBELLES_UNITES[art.unite] || art.unite || 'U'}
                            {art.matiere ? ` · ${art.matiere}` : ''}
                            {art.diametre ? ` · Ø ${art.diametre}` : ''}
                          </div>
                        </div>
                        <div className="obat-item-action">
                          <div className="obat-item-price">{formaterNombre(art.prix)} DA</div>
                          <button
                            type="button"
                            className="obat-item-add-btn"
                            onClick={() =>
                              ajouterLigneDansSection(
                                idSectionActive,
                                art,
                                art.famille?.includes('MO') ? 'Main d’œuvre' : 'Fourniture'
                              )
                            }
                          >
                            + Insérer
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="obat-drawer-list">
                <div style={{ padding: '8px 14px', fontSize: 12, color: '#64748B', background: '#F8FAFC' }}>
                  Ces packs regroupent l’ensemble des fournitures et prestations standard d’un branchement eau potable selon les normes ADE.
                </div>
                {PACKS_OUVRAGES_AEP.map((pack) => (
                  <div key={pack.id} className="obat-pack-card">
                    <div className="obat-pack-header">
                      <div className="obat-pack-title">📦 {pack.titre}</div>
                      <span className="obat-pack-count">{pack.lignes.length} éléments</span>
                    </div>
                    <p className="obat-pack-desc">{pack.description}</p>
                    <div className="obat-pack-footer">
                      <div className="obat-pack-total">
                        Total estimé :{' '}
                        <strong>
                          {formaterNombre(
                            pack.lignes.reduce((acc, l) => acc + (l.quantite * l.prix), 0)
                          )}{' '}
                          DA HT
                        </strong>
                      </div>
                      <button
                        type="button"
                        className="obat-btn-add-pack"
                        onClick={() => insererPackOuvrage(pack)}
                      >
                        + Insérer ce pack
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </aside>
        </>
      )}

      {/* 3. ESPACE DE TRAVAIL CENTRAL */}
      <main className="obat-workspace">
        <div className={`obat-sheet ${modeOnglet === 'preview' ? 'obat-sheet-preview' : ''}`}>
          
          {/* EN-TÊTE DU DOCUMENT */}
          <div className="obat-sheet-header">
            <div className="obat-sheet-header-left">
              <div className="obat-ade-corp-header">
                <span className="obat-corp-tag">Algérienne Des Eaux</span>
                <span className="obat-corp-sub">Direction de Distribution · Service Raccordement AEP</span>
              </div>

              <h1 className="obat-sheet-numero">
                Devis n° {numeroDevis}
              </h1>

              <div className="obat-meta-row">
                <span className="label">En date du</span>
                {modeOnglet === 'edition' ? (
                  <input
                    type="date"
                    value={dateEmission}
                    onChange={(e) => setDateEmission(e.target.value)}
                    style={{ padding: '2px 6px', border: '1px solid #D1D5DB', borderRadius: 4, fontSize: 13 }}
                  />
                ) : (
                  <strong>{new Date(dateEmission).toLocaleDateString('fr-FR')}</strong>
                )}
              </div>

              <div className="obat-meta-row">
                <span className="label">Validité jusqu’au</span>
                {modeOnglet === 'edition' ? (
                  <input
                    type="date"
                    value={dateValidite}
                    onChange={(e) => setDateValidite(e.target.value)}
                    style={{ padding: '2px 6px', border: '1px solid #D1D5DB', borderRadius: 4, fontSize: 13 }}
                  />
                ) : (
                  <strong>{new Date(dateValidite).toLocaleDateString('fr-FR')}</strong>
                )}
              </div>

              {/* MENTIONS LÉGALES DE DÉBUT ET DURÉE (t=84s) */}
              <div className="obat-meta-row obat-meta-mandatory">
                <span className="label">
                  Début des travaux <span className="obat-req-star">*</span>
                </span>
                <span
                  className="obat-tooltip-badge"
                  onMouseEnter={() => setSurvolDebutTravaux(true)}
                  onMouseLeave={() => setSurvolDebutTravaux(false)}
                >
                  {modeOnglet === 'edition' ? (
                    enEditionDebutTravaux ? (
                      <input
                        ref={refInputDebutTravaux}
                        type="text"
                        placeholder="ex: 10 jours après validation"
                        value={debutTravaux}
                        onChange={(e) => setDebutTravaux(e.target.value)}
                        onBlur={() => setEnEditionDebutTravaux(false)}
                        autoFocus
                        style={{ padding: '3px 8px', border: '1.5px solid #1991EB', borderRadius: 4, fontSize: 13, width: 220 }}
                      />
                    ) : (
                      <button
                        type="button"
                        className={`obat-link-action ${!debutTravaux ? 'obat-link-empty' : ''}`}
                        onClick={() => setEnEditionDebutTravaux(true)}
                      >
                        {debutTravaux || 'définir (mention légale)'}
                      </button>
                    )
                  ) : (
                    <strong>{debutTravaux || 'Dès encaissement du montant du devis'}</strong>
                  )}

                  {survolDebutTravaux && !enEditionDebutTravaux && (
                    <div className="obat-info-bubble">
                      ℹ️ Ceci est une mention recommandée/légale sur les devis de travaux
                    </div>
                  )}
                </span>
              </div>

              <div className="obat-meta-row obat-meta-mandatory">
                <span className="label">
                  Durée estimée à <span className="obat-req-star">*</span>
                </span>
                {modeOnglet === 'edition' ? (
                  enEditionDuree ? (
                    <input
                      ref={refInputDuree}
                      type="text"
                      placeholder="ex: 5 jours ouvrés"
                      value={dureeEstimee}
                      onChange={(e) => setDureeEstimee(e.target.value)}
                      onBlur={() => setEnEditionDuree(false)}
                      autoFocus
                      style={{ padding: '3px 8px', border: '1.5px solid #1991EB', borderRadius: 4, fontSize: 13, width: 180 }}
                    />
                  ) : (
                    <button
                      type="button"
                      className={`obat-link-action ${!dureeEstimee ? 'obat-link-empty' : ''}`}
                      onClick={() => setEnEditionDuree(true)}
                    >
                      {dureeEstimee || 'définir la durée estimée'}
                    </button>
                  )
                ) : (
                  <strong>{dureeEstimee || '3 à 5 jours ouvrés'}</strong>
                )}
              </div>

              {modeOnglet === 'edition' && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="obat-desc-toggle"
                    onClick={() => setAfficherDescription((prev) => !prev)}
                  >
                    <span>👁</span> {afficherDescription ? 'Masquer la description générale' : '+ Ajouter une description générale'}
                  </button>
                  {afficherDescription && (
                    <textarea
                      className="obat-desc-textarea"
                      placeholder="Description globale du projet de branchement (ex: pose sous trottoir, terrain rocheux, etc.)…"
                      value={descriptionProjet}
                      onChange={(e) => setDescriptionProjet(e.target.value)}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="obat-sheet-header-right">
              <div className="obat-client-box">
                <div className="obat-client-box-header">
                  <span>DESTINATAIRE</span>
                  <span className="obat-client-badge">Dossier N° {numDemandeRef}</span>
                </div>
                <div className="obat-client-name">{nomClient}</div>
                <div className="obat-client-line">{adresseClient}</div>
                <div className="obat-client-line">{communeClient}</div>
                <div className="obat-client-line" style={{ marginTop: 4, color: '#6B7280', fontSize: 12 }}>
                  📞 {telClient}
                </div>
              </div>

              <div className="obat-object-banner">
                <span className="label">OBJET :</span>
                <strong>Branchement au réseau de distribution d'eau potable</strong>
              </div>
            </div>
          </div>

          {/* 4. SECTIONS ET LIGNES DU DEVIS */}
          <div className="obat-sections-container">
            {sections.map((section, sIdx) => {
              const totalSectionHT = section.lignes.reduce(
                (acc, l) => acc + (Number(l.quantite) || 0) * (Number(l.prix) || 0),
                0
              );

              return (
                <div
                  key={section.id_section}
                  className={`obat-section-block ${idSectionActive === section.id_section ? 'active-section' : ''}`}
                  onClick={() => setIdSectionActive(section.id_section)}
                >
                  <div className="obat-section-bar">
                    <div className="obat-section-bar-left">
                      <span className="obat-section-icon">📁</span>
                      {modeOnglet === 'edition' ? (
                        <input
                          type="text"
                          className="obat-section-title-input"
                          value={section.titre}
                          onChange={(e) => modifierTitreSection(section.id_section, e.target.value)}
                          placeholder="Titre de la section..."
                        />
                      ) : (
                        <h3 className="obat-section-preview-title">{section.titre}</h3>
                      )}
                    </div>

                    <div className="obat-section-bar-right">
                      <span className="obat-section-subtotal-badge">
                        Sous-total : <strong>{formaterNombre(totalSectionHT)} DA HT</strong>
                      </span>
                      {modeOnglet === 'edition' && sections.length > 1 && (
                        <button
                          type="button"
                          className="obat-btn-del-section"
                          onClick={(e) => {
                            e.stopPropagation();
                            supprimerSection(section.id_section);
                          }}
                          title="Supprimer cette section"
                        >
                          ✕ Supprimer section
                        </button>
                      )}
                    </div>
                  </div>

                  <table className="obat-table">
                    <thead>
                      <tr>
                        <th className="center obat-col-num">N°</th>
                        <th className="obat-col-desig">Désignation</th>
                        <th className="center obat-col-type">Type</th>
                        <th className="center obat-col-qte">Qté</th>
                        {afficherColonneUnite && <th className="center obat-col-unite">Unité</th>}
                        <th className="right obat-col-pu">Prix U. HT</th>
                        {afficherColonneMarge && modeOnglet === 'edition' && (
                          <th className="center obat-col-marge">Marge</th>
                        )}
                        <th className="center obat-col-tva">TVA</th>
                        <th className="right obat-col-total">Total HT</th>
                        {modeOnglet === 'edition' && <th className="center obat-col-del" />}
                      </tr>
                    </thead>
                    <tbody>
                      {section.lignes.length === 0 ? (
                        <tr>
                          <td
                            colSpan={modeOnglet === 'edition' ? (afficherColonneMarge ? 10 : 9) : 8}
                            className="obat-table-empty"
                          >
                            Cette section est vide. Cliquez sur "+ Fourniture", "+ Main d'œuvre" ou ouvrez la "Bibliothèque".
                          </td>
                        </tr>
                      ) : (
                        section.lignes.map((ligne, lIdx) => {
                          const qte = Number(ligne.quantite) || 0;
                          const pu = Number(ligne.prix) || 0;
                          const ligneHT = qte * pu;
                          const estOuvrage = ligne.type === 'Ouvrage' || ligne.sousElements?.length > 0;

                          return (
                            <tr key={ligne.id_ligne || lIdx} className={estOuvrage ? 'obat-tr-ouvrage' : ''}>
                              <td className="center obat-col-num">{lIdx + 1}</td>
                              <td className="obat-col-desig">
                                {modeOnglet === 'edition' ? (
                                  <div>
                                    <input
                                      type="text"
                                      value={ligne.libelle}
                                      onChange={(e) => modifierChampLigne(section.id_section, ligne.id_ligne, 'libelle', e.target.value)}
                                      style={{ fontWeight: estOuvrage ? 700 : 500 }}
                                    />
                                    <div className="obat-line-subdetail">
                                      <small>{ligne.code}</small>
                                      {ligne.matiere && <small> · {ligne.matiere}</small>}
                                      {ligne.diametre && <small> · Ø {ligne.diametre}</small>}
                                      {estOuvrage && (
                                        <button
                                          type="button"
                                          className="obat-btn-cfg-ouvrage"
                                          onClick={() => ouvrirConfigurateurOuvrage(section.id_section, ligne)}
                                        >
                                          ⚙️ Configurer mes éléments d'ouvrage ({ligne.sousElements?.length || 2})
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <strong>{ligne.libelle}</strong>
                                    <div style={{ fontSize: 11.5, color: '#64748B' }}>
                                      {ligne.code}
                                      {ligne.diametre ? ` · Ø ${ligne.diametre} mm` : ''}
                                      {ligne.matiere ? ` · ${ligne.matiere}` : ''}
                                    </div>
                                    {!masquerDetailsOuvragesPreview && estOuvrage && ligne.sousElements?.length > 0 && (
                                      <div className="obat-preview-sous-elements">
                                        {ligne.sousElements.map((se) => (
                                          <div key={se.id} className="obat-se-preview-row">
                                            <span>↳ {se.libelle}</span>
                                            <span>
                                              {se.quantite} {se.unite}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="center obat-col-type">
                                <span className={`obat-type-tag ${ligne.type === 'Main d’œuvre' ? 'mo' : ligne.type === 'Ouvrage' ? 'ouv' : 'fourn'}`}>
                                  {ligne.type === 'Main d’œuvre' ? 'MO' : ligne.type === 'Ouvrage' ? 'OUV' : 'FOURN'}
                                </span>
                              </td>
                              <td className="center obat-col-qte">
                                {modeOnglet === 'edition' ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={ligne.quantite}
                                    onChange={(e) => modifierChampLigne(section.id_section, ligne.id_ligne, 'quantite', e.target.value)}
                                    style={{ textAlign: 'center', fontWeight: 600 }}
                                  />
                                ) : (
                                  <span>{ligne.quantite}</span>
                                )}
                              </td>
                              {afficherColonneUnite && (
                                <td className="center obat-col-unite">
                                  {modeOnglet === 'edition' ? (
                                    <select
                                      value={ligne.unite}
                                      onChange={(e) => modifierChampLigne(section.id_section, ligne.id_ligne, 'unite', e.target.value)}
                                      style={{ textAlign: 'center' }}
                                    >
                                      <option value="U">U</option>
                                      <option value="ML">ML</option>
                                      <option value="M²">M²</option>
                                      <option value="M3">M3</option>
                                      <option value="H">H</option>
                                      <option value="FF">FF</option>
                                    </select>
                                  ) : (
                                    <span>{ligne.unite}</span>
                                  )}
                                </td>
                              )}
                              <td className="right obat-col-pu">
                                {modeOnglet === 'edition' ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="10"
                                    value={ligne.prix}
                                    onChange={(e) => modifierChampLigne(section.id_section, ligne.id_ligne, 'prix', e.target.value)}
                                    style={{ textAlign: 'right' }}
                                  />
                                ) : (
                                  <span>{formaterNombre(ligne.prix)} DA</span>
                                )}
                              </td>
                              {afficherColonneMarge && modeOnglet === 'edition' && (
                                <td className="center obat-col-marge">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={ligne.marge || 0}
                                    onChange={(e) => modifierChampLigne(section.id_section, ligne.id_ligne, 'marge', e.target.value)}
                                    style={{ textAlign: 'center', width: 45 }}
                                  />
                                  <span style={{ fontSize: 10 }}>%</span>
                                </td>
                              )}
                              <td className="center obat-col-tva">
                                {autoliquidationTva ? (
                                  <span className="obat-tva-zero">0% (Auto)</span>
                                ) : modeOnglet === 'edition' ? (
                                  <select
                                    value={ligne.tauxTva}
                                    onChange={(e) => modifierChampLigne(section.id_section, ligne.id_ligne, 'tauxTva', e.target.value)}
                                    style={{ textAlign: 'center' }}
                                  >
                                    <option value="19">19%</option>
                                    <option value="9">9%</option>
                                    <option value="0">0%</option>
                                  </select>
                                ) : (
                                  <span>{ligne.tauxTva}%</span>
                                )}
                              </td>
                              <td className="right obat-col-total">
                                <strong>{formaterNombre(ligneHT)} DA</strong>
                              </td>
                              {modeOnglet === 'edition' && (
                                <td className="center obat-col-del">
                                  <button
                                    type="button"
                                    className="obat-btn-del"
                                    onClick={() => supprimerLigne(section.id_section, ligne.id_ligne)}
                                    title="Supprimer la ligne"
                                  >
                                    ✕
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>

                  {modeOnglet === 'edition' && (
                    <div className="obat-section-add-actions">
                      <button
                        type="button"
                        className="obat-btn-quick-add"
                        onClick={() => {
                          setIdSectionActive(section.id_section);
                          setDrawerBiblioOuvert(true);
                        }}
                      >
                        + Insérer depuis la Bibliothèque
                      </button>
                      <button
                        type="button"
                        className="obat-btn-quick-add"
                        onClick={() =>
                          ajouterLigneDansSection(section.id_section, { libelle: 'Fourniture standard', prix: 1000, unite: 'U' }, 'Fourniture')
                        }
                      >
                        + Fourniture libre
                      </button>
                      <button
                        type="button"
                        className="obat-btn-quick-add"
                        onClick={() =>
                          ajouterLigneDansSection(section.id_section, { libelle: 'Main d’œuvre de pose / raccordement', prix: 3500, unite: 'H' }, 'Main d’œuvre')
                        }
                      >
                        + Main d'œuvre
                      </button>
                      <button
                        type="button"
                        className="obat-btn-quick-add"
                        onClick={() =>
                          ajouterLigneDansSection(section.id_section, { libelle: 'Ouvrage complet de raccordement', prix: 15000, unite: 'U' }, 'Ouvrage')
                        }
                      >
                        + Ouvrage composé
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 5. BARRE D'AJOUT DE SECTION GLOBALE */}
          {modeOnglet === 'edition' && (
            <div className="obat-add-elements-wrapper">
              <div className="obat-add-toolbar">
                <div className="obat-add-group-left">
                  <button
                    type="button"
                    className="obat-btn-add-element"
                    onClick={ajouterSection}
                  >
                    + Ajouter une Section
                  </button>
                  <button
                    type="button"
                    className="obat-btn-add-element"
                    onClick={() => {
                      setOngletBiblio('packs');
                      setDrawerBiblioOuvert(true);
                    }}
                  >
                    📦 Packs AEP Types
                  </button>
                </div>

                <div className="obat-add-group-right">
                  <button
                    type="button"
                    className="obat-btn-add-secondary"
                    onClick={() => setAfficherTexteLibre((p) => !p)}
                  >
                    {afficherTexteLibre ? 'Masquer texte libre' : '+ Texte libre'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 6. CONDITIONS DE PAIEMENT & RÉCAPITULATIF */}
          <div className="obat-bottom-grid">
            <div className="obat-bottom-left">
              <div className="obat-block-title-row">
                <span className="obat-block-title">Conditions de règlement & Acompte</span>
                {modeOnglet === 'edition' && (
                  <button
                    type="button"
                    className="obat-link-action"
                    onClick={() => setEditionAcompte((prev) => !prev)}
                  >
                    Modifier acompte
                  </button>
                )}
              </div>

              <div className="obat-payment-methods">
                <span>Modes acceptés :</span>
                {modeOnglet === 'edition' ? (
                  <>
                    <span
                      className={`obat-payment-pill ${modesPaiement.especes ? 'selected' : ''}`}
                      onClick={() => setModesPaiement((p) => ({ ...p, especes: !p.especes }))}
                    >
                      💵 Espèces en caisse
                    </span>
                    <span
                      className={`obat-payment-pill ${modesPaiement.cheque ? 'selected' : ''}`}
                      onClick={() => setModesPaiement((p) => ({ ...p, cheque: !p.cheque }))}
                    >
                      🧾 Chèque bancaire
                    </span>
                    <span
                      className={`obat-payment-pill ${modesPaiement.virement ? 'selected' : ''}`}
                      onClick={() => setModesPaiement((p) => ({ ...p, virement: !p.virement }))}
                    >
                      🏦 Virement / CCP
                    </span>
                  </>
                ) : (
                  <strong>
                    {[
                      modesPaiement.especes ? 'Espèces' : null,
                      modesPaiement.cheque ? 'Chèque' : null,
                      modesPaiement.virement ? 'Virement / Versement CCP' : null
                    ].filter(Boolean).join(', ')}
                  </strong>
                )}
              </div>

              <div className="obat-acompte-row">
                Acompte de{' '}
                {editionAcompte && modeOnglet === 'edition' ? (
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={tauxAcompte}
                    onChange={(e) => setTauxAcompte(e.target.value)}
                    style={{ width: 55, textAlign: 'center', padding: '1px 4px', fontSize: 13 }}
                  />
                ) : (
                  `${Number(tauxAcompte).toFixed(2)} %`
                )}{' '}
                à la validation soit <strong>{formaterNombre(montantAcompte)} DA TTC</strong>
              </div>

              <div className="obat-retenue-row">
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {modeOnglet === 'edition' && (
                    <input
                      type="checkbox"
                      checked={aRetenueGarantie}
                      onChange={(e) => setARetenueGarantie(e.target.checked)}
                    />
                  )}
                  <span>Retenue de garantie :</span>
                </label>
                {aRetenueGarantie ? (
                  <span>
                    <strong>{tauxRetenueGarantie} %</strong> ({formaterNombre(montantRetenue)} DA) pendant {dureeRetenueMois} mois
                  </span>
                ) : (
                  <span style={{ color: '#9CA3AF' }}>Aucune</span>
                )}
              </div>

              <div className="obat-reste-row">
                Solde restant à l’achèvement : <strong>{formaterNombre(montantReste)} DA TTC</strong>
              </div>

              {afficherTexteLibre && (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    placeholder="Saisissez des clauses particulières ou mentions spécifiques…"
                    value={texteLibre}
                    onChange={(e) => setTexteLibre(e.target.value)}
                    style={{ width: '100%', padding: '6px 8px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 4 }}
                  />
                </div>
              )}

              <div className="obat-bank-card">
                <div className="obat-bank-header">COORDONNÉES BANCAIRES POUR RÈGLEMENT</div>
                {enEditionBanque && modeOnglet === 'edition' ? (
                  <div style={{ display: 'grid', gap: 6, marginTop: 4 }}>
                    <input
                      type="text"
                      value={coordonneesBancaires.iban}
                      onChange={(e) => setCoordonneesBancaires({ ...coordonneesBancaires, iban: e.target.value })}
                      placeholder="IBAN / RIP"
                      style={{ width: '100%', padding: '3px 6px', fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={coordonneesBancaires.bic}
                      onChange={(e) => setCoordonneesBancaires({ ...coordonneesBancaires, bic: e.target.value })}
                      placeholder="Banque / Agence"
                      style={{ width: '100%', padding: '3px 6px', fontSize: 12 }}
                    />
                    <button
                      type="button"
                      className="obat-link-action"
                      onClick={() => setEnEditionBanque(false)}
                    >
                      Enregistrer coordonnées
                    </button>
                  </div>
                ) : (
                  <div onClick={() => modeOnglet === 'edition' && setEnEditionBanque(true)} style={{ cursor: modeOnglet === 'edition' ? 'pointer' : 'default' }}>
                    <div><strong>RIP :</strong> {coordonneesBancaires.iban}</div>
                    <div><strong>Banque :</strong> {coordonneesBancaires.bic}</div>
                  </div>
                )}
              </div>

              <div className="obat-dechets-card">
                <div className="obat-dechets-header">
                  <span>♻️ GESTION DES DÉCHETS DE CHANTIER (BTP / AEP)</span>
                  {modeOnglet === 'edition' && (
                    <button
                      type="button"
                      className="obat-link-action"
                      onClick={() => setEnEditionDechets((p) => !p)}
                    >
                      {enEditionDechets ? 'Fermer' : 'Modifier'}
                    </button>
                  )}
                </div>
                {enEditionDechets && modeOnglet === 'edition' ? (
                  <div style={{ display: 'grid', gap: 4, marginTop: 4 }}>
                    <input
                      type="text"
                      value={gestionDechets.nature}
                      onChange={(e) => setGestionDechets({ ...gestionDechets, nature: e.target.value })}
                      placeholder="Nature des déchets"
                      style={{ fontSize: 11.5, padding: '2px 4px' }}
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                      <input
                        type="text"
                        value={gestionDechets.volume}
                        onChange={(e) => setGestionDechets({ ...gestionDechets, volume: e.target.value })}
                        placeholder="Volume estimé"
                        style={{ fontSize: 11.5, padding: '2px 4px' }}
                      />
                      <input
                        type="text"
                        value={gestionDechets.centre}
                        onChange={(e) => setGestionDechets({ ...gestionDechets, centre: e.target.value })}
                        placeholder="Centre de collecte"
                        style={{ fontSize: 11.5, padding: '2px 4px' }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="obat-dechets-body">
                    <div>• <strong>Nature :</strong> {gestionDechets.nature}</div>
                    <div>• <strong>Volume prévisionnel :</strong> {gestionDechets.volume} | <strong>Filière :</strong> {gestionDechets.centre}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="obat-bottom-right">
              <div className="obat-remise-link-row">
                {aRemise && modeOnglet === 'edition' ? (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <span>Remise accordée (%) :</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={tauxRemise}
                      onChange={(e) => setTauxRemise(e.target.value)}
                      style={{ width: 50, textAlign: 'center', padding: '2px 4px' }}
                    />
                    <button
                      type="button"
                      className="obat-link-action"
                      onClick={() => {
                        setARemise(false);
                        setTauxRemise(0);
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                ) : modeOnglet === 'edition' ? (
                  <button
                    type="button"
                    className="obat-link-action"
                    onClick={() => setARemise(true)}
                  >
                    + Accorder une remise globale
                  </button>
                ) : null}
              </div>

              <div className="obat-summary-card">
                <div className="obat-summary-line">
                  <span>Total Net HT</span>
                  <strong>{formaterNombre(totalNetHT)} DA</strong>
                </div>

                {aRemise && (
                  <div className="obat-summary-line" style={{ color: '#D32F2F' }}>
                    <span>Remise ({tauxRemise} %)</span>
                    <strong>- {formaterNombre(montantRemise)} DA</strong>
                  </div>
                )}

                <div className="obat-summary-line">
                  <span>
                    Total TVA {autoliquidationTva ? '(Autoliquidation 0%)' : '(19%)'}
                  </span>
                  <strong>{formaterNombre(totalTVA)} DA</strong>
                </div>

                <div className="obat-summary-line obat-summary-total-ttc">
                  <span>Total TTC</span>
                  <strong>{formaterNombre(totalTTC)} DA</strong>
                </div>

                {aRetenueGarantie && (
                  <div className="obat-summary-line" style={{ color: '#D97706' }}>
                    <span>Retenue de garantie ({tauxRetenueGarantie}%)</span>
                    <strong>- {formaterNombre(montantRetenue)} DA</strong>
                  </div>
                )}

                {afficherColonneMarge && (
                  <div className="obat-summary-line obat-summary-marge">
                    <span>Marge estimée ({formaterNombre(tauxMargeGlobal)}%)</span>
                    <span>{formaterNombre(margeBruteHT)} DA HT</span>
                  </div>
                )}

                <div className="obat-net-payer-banner">
                  <div className="net-label">NET À PAYER</div>
                  <div className="net-valeur">{formaterNombre(netAPayerTTC)} DA TTC</div>
                </div>
              </div>

              {modeOnglet === 'preview' && (
                <div className="obat-bon-pour-accord">
                  <div className="obat-accord-title">BON POUR ACCORD ET ACCEPTATION DU DEVIS</div>
                  <p className="obat-accord-text">
                    Le soussigné déclare accepter expressément les travaux décrits ci-dessus, ainsi que le coût et les conditions d’exécution.
                  </p>
                  <div className="obat-accord-signatures">
                    <div className="obat-sign-box">
                      <span>Pour l'Algérienne Des Eaux</span>
                      <small>Visa et Cachet de l'Agence</small>
                    </div>
                    <div className="obat-sign-box">
                      <span>L'Abonné(e) / Le Demandeur</span>
                      <small>Mention manuscrite « Lu et approuvé » + Date et signature</small>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* NOTES DE BAS DE PAGE */}
          <footer className="obat-footer-notes">
            <h4>Dispositions légales et notes d'information</h4>
            {modeOnglet === 'edition' ? (
              <textarea
                rows={2}
                value={notesBasDePage}
                onChange={(e) => setNotesBasDePage(e.target.value)}
              />
            ) : (
              <p style={{ margin: 0, fontSize: 11.5, color: '#4B5563' }}>{notesBasDePage}</p>
            )}
            {autoliquidationTva && (
              <div className="obat-mention-autoliquidation">
                * Autoliquidation de la taxe sur la valeur ajoutée (TVA) : travaux réalisés en sous-traitance, taxe due par le preneur assujetti.
              </div>
            )}
          </footer>
        </div>
      </main>

      {/* 7. VENTILATION TVA */}
      <button
        type="button"
        className="obat-bottom-ventilation-btn"
        onClick={() => setVentilationOuverte((prev) => !prev)}
      >
        ▲ Ventilation fiscale
      </button>

      {ventilationOuverte && (
        <div className="obat-ventilation-popover">
          <div className="obat-ventilation-header">
            <span>Ventilation TVA & Bases</span>
            <button
              type="button"
              onClick={() => setVentilationOuverte(false)}
              className="obat-btn-close-sm"
            >
              ✕
            </button>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Base HT (19%) :</span>
              <strong>{formaterNombre(autoliquidationTva ? 0 : totalNetHT)} DA</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Montant TVA :</span>
              <strong>{formaterNombre(totalTVA)} DA</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #E5E7EB', paddingTop: 4, fontWeight: 700 }}>
              <span>Total TTC :</span>
              <strong>{formaterNombre(totalTTC)} DA</strong>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODALE D'AVERTISSEMENT NON-BLOQUANTE (VIDÉO OBAT t=84s) */}
      {modalAvertissementMentions && (
        <div className="obat-modal-overlay">
          <div className="obat-modal-card obat-warning-card">
            <div className="obat-warning-header">
              <span className="obat-warn-icon">⚠️</span>
              <h3>Mentions obligatoires non renseignées</h3>
            </div>

            <p className="obat-warning-text">
              Vous n'avez pas renseigné le <strong>début prévisionnel des travaux</strong> et/ou la <strong>durée estimée du chantier</strong>.
            </p>
            <div className="obat-warning-callout">
              <strong>Extrait tutoriel Obat :</strong>
              <p>
                Ces mentions légales permettent au client et aux équipes techniques de planifier l'intervention.
                Cependant, <strong>cet avertissement n'est pas bloquant</strong> : vous pouvez continuer l'enregistrement ou renseigner ces informations maintenant.
              </p>
            </div>

            <div className="obat-modal-actions">
              <button
                type="button"
                className="obat-btn-action-primary"
                onClick={() => {
                  setModalAvertissementMentions(false);
                  setEnEditionDebutTravaux(true);
                  setEnEditionDuree(true);
                  setTimeout(() => {
                    refInputDebutTravaux.current?.focus();
                  }, 100);
                }}
              >
                ✏️ Renseigner maintenant
              </button>

              <button
                type="button"
                className="obat-btn-action-secondary"
                onClick={() => {
                  if (actionApresAvertissement) {
                    actionApresAvertissement();
                  }
                }}
              >
                Continuer sans renseigner 🡒
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. MODALE CONFIGURATEUR D'OUVRAGE AVEC CADENAS (OBAT 3:12) */}
      {ouvrageEnConfig && (
        <div className="obat-modal-overlay">
          <div className="obat-modal-card obat-config-ouvrage-card">
            <div className="obat-config-header">
              <div>
                <span className="obat-tag-badge">Ouvrage composé</span>
                <h3>{ouvrageEnConfig.libelle}</h3>
              </div>
              <button
                type="button"
                className="obat-btn-close"
                onClick={() => setOuvrageEnConfig(null)}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 13, color: '#64748B', margin: '6px 0 14px' }}>
              Décomposez cet ouvrage en fournitures et main d’œuvre. Cliquez sur le cadenas 🔒 pour déverrouiller et ajuster un composant.
            </p>

            <div className="obat-ouvrage-items-list">
              <table className="obat-ouvrage-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Composant</th>
                    <th className="center">Qté</th>
                    <th className="center">Unité</th>
                    <th className="right">P. Achat HT</th>
                    <th className="center">Marge %</th>
                    <th className="center">Verrou</th>
                    <th className="center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {ouvrageEnConfig.sousElements.map((se, sIdx) => (
                    <tr key={se.id || sIdx} className={se.verrouille ? 'is-locked' : 'is-unlocked'}>
                      <td>
                        <span className={`obat-type-tag ${se.type === 'Main d’œuvre' ? 'mo' : 'fourn'}`}>
                          {se.type}
                        </span>
                      </td>
                      <td>
                        {se.verrouille ? (
                          <span>{se.libelle}</span>
                        ) : (
                          <input
                            type="text"
                            value={se.libelle}
                            onChange={(e) => {
                              const val = e.target.value;
                              setOuvrageEnConfig((prev) => ({
                                ...prev,
                                sousElements: prev.sousElements.map((item, i) => (i === sIdx ? { ...item, libelle: val } : item))
                              }));
                            }}
                            style={{ width: '100%', fontSize: 12.5 }}
                          />
                        )}
                      </td>
                      <td className="center">
                        {se.verrouille ? (
                          se.quantite
                        ) : (
                          <input
                            type="number"
                            value={se.quantite}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setOuvrageEnConfig((prev) => ({
                                ...prev,
                                sousElements: prev.sousElements.map((item, i) => (i === sIdx ? { ...item, quantite: val } : item))
                              }));
                            }}
                            style={{ width: 45, textAlign: 'center' }}
                          />
                        )}
                      </td>
                      <td className="center">{se.unite}</td>
                      <td className="right">
                        {se.verrouille ? (
                          `${formaterNombre(se.prixAchat)} DA`
                        ) : (
                          <input
                            type="number"
                            value={se.prixAchat}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setOuvrageEnConfig((prev) => ({
                                ...prev,
                                sousElements: prev.sousElements.map((item, i) => (i === sIdx ? { ...item, prixAchat: val } : item))
                              }));
                            }}
                            style={{ width: 75, textAlign: 'right' }}
                          />
                        )}
                      </td>
                      <td className="center">
                        {se.verrouille ? (
                          `${se.marge}%`
                        ) : (
                          <input
                            type="number"
                            value={se.marge}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setOuvrageEnConfig((prev) => ({
                                ...prev,
                                sousElements: prev.sousElements.map((item, i) => (i === sIdx ? { ...item, marge: val } : item))
                              }));
                            }}
                            style={{ width: 45, textAlign: 'center' }}
                          />
                        )}
                      </td>
                      <td className="center">
                        <button
                          type="button"
                          className={`obat-padlock-btn ${se.verrouille ? 'locked' : 'unlocked'}`}
                          title={se.verrouille ? 'Cliquer pour déverrouiller et modifier' : 'Cliquer pour verrouiller'}
                          onClick={() => {
                            setOuvrageEnConfig((prev) => ({
                              ...prev,
                              sousElements: prev.sousElements.map((item, i) => (i === sIdx ? { ...item, verrouille: !item.verrouille } : item))
                            }));
                          }}
                        >
                          {se.verrouille ? '🔒' : '🔓'}
                        </button>
                      </td>
                      <td className="center">
                        <button
                          type="button"
                          className="obat-btn-del"
                          onClick={() => {
                            setOuvrageEnConfig((prev) => ({
                              ...prev,
                              sousElements: prev.sousElements.filter((_, i) => i !== sIdx)
                            }));
                          }}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                type="button"
                className="obat-btn-add-subelement"
                onClick={() => {
                  setOuvrageEnConfig((prev) => ({
                    ...prev,
                    sousElements: [
                      ...prev.sousElements,
                      {
                        id: `se_${Date.now()}`,
                        libelle: 'Nouveau composant de l’ouvrage',
                        type: 'Fourniture',
                        quantite: 1,
                        unite: 'U',
                        prixAchat: 1000,
                        marge: 20,
                        verrouille: false
                      }
                    ]
                  }));
                }}
              >
                + Ajouter un composant à cet ouvrage
              </button>
            </div>

            <div className="obat-ouvrage-summary-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Coefficient d'ajustement :</span>
                <input
                  type="number"
                  step="0.05"
                  min="0.5"
                  max="3"
                  value={ouvrageEnConfig.coefAjustement}
                  onChange={(e) => setOuvrageEnConfig({ ...ouvrageEnConfig, coefAjustement: e.target.value })}
                  style={{ width: 60, textAlign: 'center', padding: '3px 6px', border: '1px solid #D1D5DB', borderRadius: 4 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="obat-btn-annuler"
                  onClick={() => setOuvrageEnConfig(null)}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className="obat-btn-action-primary"
                  onClick={appliquerConfigurationOuvrage}
                >
                  ✓ Valider et recalculer l’ouvrage
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. MODAL FINALISER */}
      {modalFinaliserOuvert && (
        <div className="obat-modal-overlay" onClick={() => setModalFinaliserOuvert(false)}>
          <div className="obat-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Finaliser et émettre le devis</h3>
            <p>
              Le devis <strong>{numeroDevis}</strong> d’un montant de{' '}
              <strong>{formaterNombre(netAPayerTTC)} DA TTC</strong> est prêt à être émis.
            </p>

            <div style={{ marginBottom: 18, background: '#F8FAFC', padding: 14, borderRadius: 6, border: '1px solid #E2E8F0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={enregistrerPaiementDirect}
                  onChange={(e) => setEnregistrerPaiementDirect(e.target.checked)}
                />
                Enregistrer également le règlement immédiat (en caisse ou virement)
              </label>

              {enregistrerPaiementDirect && (
                <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Mode de règlement :</label>
                      <select
                        value={donneesPaiement.mode_paiement}
                        onChange={(e) => setDonneesPaiement({ ...donneesPaiement, mode_paiement: e.target.value })}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #D1D5DB' }}
                      >
                        <option value="Especes">💵 Espèces en caisse</option>
                        <option value="Cheque">🧾 Chèque bancaire</option>
                        <option value="Versement_bancaire">🏦 Versement bancaire / CCP</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Date du paiement :</label>
                      <input
                        type="date"
                        value={donneesPaiement.date_paiement}
                        onChange={(e) => setDonneesPaiement({ ...donneesPaiement, date_paiement: e.target.value })}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #D1D5DB' }}
                      />
                    </div>
                  </div>

                  {donneesPaiement.mode_paiement === 'Especes' && (
                    <div>
                      <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>N° Reçu de caisse :</label>
                      <input
                        type="text"
                        placeholder="ex: REC-2026-001"
                        value={donneesPaiement.numero_recu}
                        onChange={(e) => setDonneesPaiement({ ...donneesPaiement, numero_recu: e.target.value })}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #D1D5DB' }}
                      />
                    </div>
                  )}

                  {donneesPaiement.mode_paiement === 'Cheque' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>N° Chèque :</label>
                        <input
                          type="text"
                          placeholder="ex: CHQ-8899"
                          value={donneesPaiement.numero_cheque}
                          onChange={(e) => setDonneesPaiement({ ...donneesPaiement, numero_cheque: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #D1D5DB' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Banque :</label>
                        <input
                          type="text"
                          placeholder="ex: BNA"
                          value={donneesPaiement.banque}
                          onChange={(e) => setDonneesPaiement({ ...donneesPaiement, banque: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #D1D5DB' }}
                        />
                      </div>
                    </div>
                  )}

                  {donneesPaiement.mode_paiement === 'Versement_bancaire' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>N° Bordereau :</label>
                        <input
                          type="text"
                          placeholder="ex: VRS-5544"
                          value={donneesPaiement.numero_versement}
                          onChange={(e) => setDonneesPaiement({ ...donneesPaiement, numero_versement: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #D1D5DB' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 4 }}>Banque / CCP :</label>
                        <input
                          type="text"
                          placeholder="ex: BNA / CCP POSTE"
                          value={donneesPaiement.banque}
                          onChange={(e) => setDonneesPaiement({ ...donneesPaiement, banque: e.target.value })}
                          style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #D1D5DB' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="obat-btn-annuler"
                onClick={() => setModalFinaliserOuvert(false)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="obat-btn-finaliser"
                onClick={() => {
                  setModalFinaliserOuvert(false);
                  verifierAvantSauvegarde(true);
                }}
              >
                ✓ Confirmer et émettre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
