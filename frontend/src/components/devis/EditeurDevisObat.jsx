import { useState, useEffect, useRef } from 'react';
import './EditeurDevisObat.css';
import client from '../../api/client';
import { notifierErreur, notifierSucces } from '../../utils/notifications';

const LIBELLES_UNITES = {
  U: 'U (Unité)',
  ML: 'ML (Mètre linéaire)',
  'M²': 'M² (Mètre carré)',
  M3: 'M3 (Mètre cube)',
  KG: 'KG (Kilogramme)',
  H: 'H (Heure)',
  FF: 'FF (Forfait)',
  ENS: 'ENS (Ensemble)'
};

function idCategorieGroupe(groupe) {
  return groupe?.id_categorie ?? groupe?.id_famille ?? '';
}

function idCategorieLigne(ligne) {
  return ligne?.id_categorie ?? ligne?.id_famille ?? '';
}

function formaterNombre(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const NOMBRES_EN_LETTRES = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'
];

function nombreEnLettresSousMille(nombre) {
  if (nombre < 17) return NOMBRES_EN_LETTRES[nombre];
  if (nombre < 20) return `dix-${NOMBRES_EN_LETTRES[nombre - 10]}`;
  if (nombre < 100) {
    const dizaine = Math.floor(nombre / 10);
    const unite = nombre % 10;
    if (dizaine === 7) return nombre === 71 ? 'soixante et onze' : `soixante-${nombreEnLettresSousMille(nombre - 60)}`;
    if (dizaine === 8) return nombre === 80 ? 'quatre-vingts' : `quatre-vingt-${nombreEnLettresSousMille(unite)}`;
    if (dizaine === 9) return `quatre-vingt-${nombreEnLettresSousMille(nombre - 80)}`;
    const dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
    if (unite === 0) return dizaines[dizaine];
    return unite === 1 ? `${dizaines[dizaine]} et un` : `${dizaines[dizaine]}-${NOMBRES_EN_LETTRES[unite]}`;
  }

  const centaines = Math.floor(nombre / 100);
  const reste = nombre % 100;
  const prefixe = centaines === 1 ? 'cent' : `${NOMBRES_EN_LETTRES[centaines]} cent`;
  if (reste === 0) return centaines === 1 ? prefixe : `${prefixe}s`;
  return `${prefixe} ${nombreEnLettresSousMille(reste)}`;
}

function nombreEnLettres(nombre) {
  const valeur = Math.max(0, Math.round((Number(nombre) || 0) * 100) / 100);
  const entier = Math.floor(valeur);
  const centimes = Math.round((valeur - entier) * 100);
  const millions = Math.floor(entier / 1000000);
  const resteMillions = entier % 1000000;
  const parties = [];

  if (millions > 0) parties.push(`${nombreEnLettresSousMille(millions)} million${millions > 1 ? 's' : ''}`);
  if (resteMillions > 0) {
    const milliersRestants = Math.floor(resteMillions / 1000);
    const resteFinal = resteMillions % 1000;
    if (milliersRestants > 0) parties.push(milliersRestants === 1 ? 'mille' : `${nombreEnLettresSousMille(milliersRestants)} mille`);
    if (resteFinal > 0) parties.push(nombreEnLettresSousMille(resteFinal));
  }
  if (parties.length === 0) parties.push('zéro');

  const texteEntier = `${parties.join(' ')} dinar${entier > 1 ? 's' : ''} algérien${entier > 1 ? 's' : ''}`;
  return centimes > 0
    ? `${texteEntier} et ${nombreEnLettresSousMille(centimes)} centime${centimes > 1 ? 's' : ''}`
    : texteEntier;
}

function normaliserQuantite(valeur) {
  const quantite = Number(valeur);
  if (!Number.isFinite(quantite) || quantite < 0) return 0;
  return Math.floor(quantite);
}

function normaliserPrix(valeur) {
  const prix = Number(valeur);
  return Number.isFinite(prix) && prix >= 0 ? prix : 0;
}

function numeroRomain(valeur) {
  const nombres = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let reste = valeur;
  return nombres.reduce((resultat, [nombre, symbole]) => {
    const repetitions = Math.floor(reste / nombre);
    reste %= nombre;
    return resultat + symbole.repeat(repetitions);
  }, '');
}

function numeroAlphabetique(index) {
  let reste = index + 1;
  let resultat = '';
  while (reste > 0) {
    reste -= 1;
    resultat = String.fromCharCode(65 + (reste % 26)) + resultat;
    reste = Math.floor(reste / 26);
  }
  return resultat;
}

function numeroSection(index, mode) {
  return mode === 'ALPHABETIQUE' ? numeroAlphabetique(index) : numeroRomain(index + 1);
}

function aTarifsFournitureEtPose(article) {
  if (!article) return false;
  const f = Number(article.prixFourniture ?? article.prix_fourniture ?? 0);
  const p = Number(article.prixPose ?? article.prix_pose ?? 0);
  return f > 0 && p > 0;
}

export function determinerTypesDisponibles(ligne, tousLesArticles = []) {
  if (!ligne) return ['FP/', 'F/', 'P/', 'PR/'];

  const ref = Array.isArray(tousLesArticles)
    ? tousLesArticles.find((a) => a.code === (ligne.code || ligne.code_article))
    : null;

  if (!ref || ligne.estLigneLibre) {
    return ['FP/', 'F/', 'P/', 'PR/'];
  }

  const fRaw = ligne.prixFourniture ?? ligne.prix_fourniture ?? ref?.prixFourniture ?? null;
  const pRaw = ligne.prixPose ?? ligne.prix_pose ?? ref?.prixPose ?? null;
  const mode = String(ligne.modePrix ?? ligne.mode_prix ?? ref?.modePrix ?? '').trim().toUpperCase();
  const currentType = String(ligne.type ?? ligne.type_ligne ?? '').trim();

  const f = fRaw !== null && fRaw !== undefined ? Number(fRaw) : null;
  const p = pRaw !== null && pRaw !== undefined ? Number(pRaw) : null;
  const aFourniture = f !== null && f > 0;
  const aPose = p !== null && p > 0;
  const aLesDeux = aFourniture && aPose;
  const types = [];

  if (aFourniture) types.push('F/');
  if (aPose) types.push('P/');
  if (aLesDeux) types.push('FP/');

  const estPrestation = mode === 'PRESTATION' || (!aFourniture && !aPose && (currentType === 'PR/' || String(ligne.code || '').startsWith('PR') || String(ligne.typeTva).toUpperCase() === 'PRESTATION'));

  if (estPrestation && !aFourniture && !aPose) {
    types.push('PR/');
  }

  if (types.length === 0) {
    if (['F/', 'P/', 'FP/', 'PR/'].includes(currentType)) {
      types.push(currentType);
    } else {
      types.push('F/');
    }
  }

  return types;
}

function obtenirCategorieArticle(article, tousLesArticles = []) {
  const code = article?.code || article?.code_article;
  const reference = tousLesArticles.find((item) => item.code === code);
  return article?.categorie || article?.libelleCategorie || article?.libelle_categorie || reference?.categorie || 'Sans catégorie';
}

function extraireTitreSection(libelle) {
  const valeur = String(libelle || '');
  const correspondance = valeur.match(/^\[([^\]]+)\]\s*(.*)$/s);
  return correspondance
    ? { titre: correspondance[1].trim(), libelle: correspondance[2].trim() }
    : { titre: '', libelle: valeur };
}

function obtenirLibelleLigne(ligne) {
  const valeur = ligne?.libelle ?? ligne?.designation ?? ligne?.description ?? '';
  return extraireTitreSection(valeur).libelle.trim();
}

function normaliserMotRecherche(valeur) {
  return String(valeur || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Modèles d'ouvrages types AEP (Spécifiques ADE pour eau potable)
const PACKS_OUVRAGES_AEP = [
  {
    id: 'pack_std_dn25',
    titre: 'Branchement Standard Particulier PEHD Ø25 (5m)',
    description: 'Tranchée ordinaire 5m, PEHD Ø25, collier de prise en charge, vanne d’arrêt, compteur DN15 et mise en eau.',
    sectionCible: 'Travaux de branchement standard',
    lignes: [
      { code: 'TERR-01', libelle: 'Fouille en tranchée ordinaire (larg. 0.40m, prof. 0.80m)', type: 'P/', quantite: 5, unite: 'ML', prix: 1400, marge: 15, tauxTva: 19 },
      { code: 'PEHD-25', libelle: 'Fourniture et pose de tube PEHD PN16 Ø25 mm', type: 'FP/', quantite: 5, unite: 'ML', prix: 450, marge: 20, tauxTva: 19, diametre: '25' },
      { code: 'COL-PRISE', libelle: 'Collier de prise en charge avec robinet de prise en charge', type: 'F/', quantite: 1, unite: 'U', prix: 3800, marge: 18, tauxTva: 19 },
      { code: 'VANN-20', libelle: 'Vanne d’arrêt quart de tour avant compteur Ø20', type: 'F/', quantite: 1, unite: 'U', prix: 2200, marge: 20, tauxTva: 19, diametre: '20' },
      { code: 'COMPT-15', libelle: 'Fourniture et pose compteur de vitesse DN15 avec clapet anti-pollution', type: 'FP/', quantite: 1, unite: 'U', prix: 7500, marge: 15, tauxTva: 19, diametre: '15' },
      { code: 'REG-NICHE', libelle: 'Fourniture et scellement d’une niche/regard de comptage préfabriqué', type: 'F/', quantite: 1, unite: 'U', prix: 6800, marge: 15, tauxTva: 19 },
      { code: 'MO-ESSAI', libelle: 'Raccordement sur conduite principale, mise en eau et épreuve d’étanchéité', type: 'P/', quantite: 1, unite: 'FF', prix: 5000, marge: 10, tauxTva: 19 }
    ]
  },
  {
    id: 'pack_collectif_dn40',
    titre: 'Branchement Gros Calibre PEHD Ø40 / Ø50 (Collectif)',
    description: 'Tranchée, conduite PEHD Ø40/50, vanne de sectionnement enterrée sous bouche à clé et batterie de compteurs.',
    sectionCible: 'Branchement gros calibre',
    lignes: [
      { code: 'TERR-02', libelle: 'Fouille en tranchée avec évacuation des déblais excédentaires', type: 'P/', quantite: 8, unite: 'ML', prix: 1800, marge: 15, tauxTva: 19 },
      { code: 'PEHD-40', libelle: 'Tube PEHD PN16 Ø40 mm bandes bleues AEP', type: 'F/', quantite: 8, unite: 'ML', prix: 820, marge: 20, tauxTva: 19, diametre: '40' },
      { code: 'VANN-BAC', libelle: 'Vanne d’arrêt à opercule avec bouche à clé et tube allonge', type: 'F/', quantite: 1, unite: 'U', prix: 14500, marge: 15, tauxTva: 19 },
      { code: 'CLAP-40', libelle: 'Clapet de non-retour à brides DN40', type: 'F/', quantite: 1, unite: 'U', prix: 9200, marge: 18, tauxTva: 19, diametre: '40' },
      { code: 'MO-COLL', libelle: 'Pose spécialisée, percement et épreuve sous pression 10 bars', type: 'P/', quantite: 1, unite: 'FF', prix: 12000, marge: 10, tauxTva: 19 }
    ]
  },
  {
    id: 'pack_refection_voirie',
    titre: 'Pack Réfection de Chaussée / Enrobé à chaud',
    description: 'Découpe d’enrobé à la scie, remblai en tout-venant compacté et couche de roulement enrobé.',
    sectionCible: 'Voirie et génie civil',
    lignes: [
      { code: 'VOIR-DEC', libelle: 'Découpage du revêtement bitumineux à la disqueuse diamantée', type: 'P/', quantite: 6, unite: 'ML', prix: 650, marge: 15, tauxTva: 19 },
      { code: 'VOIR-REM', libelle: 'Remblaiement méthodique en tout-venant 0/31.5 et compactage par couches', type: 'F/', quantite: 3, unite: 'M3', prix: 3200, marge: 20, tauxTva: 19 },
      { code: 'VOIR-ENR', libelle: 'Réfection définitive de la chaussée en béton bitumineux (enrobé à chaud)', type: 'FP/', quantite: 4, unite: 'M²', prix: 4800, marge: 15, tauxTva: 19 }
    ]
  }
];

export default function EditeurDevisObat({
  demande,
  devisInitial = null,
  articleCategories = [],
  tvaPrestation = 19,
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
  const [filtreCategorie, setFiltreCategorie] = useState('TOUS');
  const [rechercheBiblio, setRechercheBiblio] = useState('');
  const [recherchesLignes, setRecherchesLignes] = useState({});
  const [suggestionsLignes, setSuggestionsLignes] = useState({});

  // Dropdown options
  const [menuOptionsOuvert, setMenuOptionsOuvert] = useState(false);
  const [modalFinaliserOuvert, setModalFinaliserOuvert] = useState(false);
  const [ventilationOuverte, setVentilationOuverte] = useState(false);

  // Options d'affichage Obat
  const [afficherColonneUnite, setAfficherColonneUnite] = useState(true);
  const [modeNumerotationSections, setModeNumerotationSections] = useState('ROMAIN');
  const [masquerDetailsOuvragesPreview, setMasquerDetailsOuvragesPreview] = useState(true);
  const [autoliquidationTva, setAutoliquidationTva] = useState(false); // Obat 8:18

  // Modal d'avertissement non bloquant (Vidéo Obat timestamp t=84s)
  const [modalAvertissementMentions, setModalAvertissementMentions] = useState(false);
  const [actionApresAvertissement, setActionApresAvertissement] = useState(null);

  // Modal de configuration d'un ouvrage (Obat 3:12)
  const [ouvrageEnConfig, setOuvrageEnConfig] = useState(null);

  // Modal de sélection de catégorie pour les articles libres (avant sauvegarde)
  const [modalCategorieOuvert, setModalCategorieOuvert] = useState(false);
  // { id_ligne, libelle, unite, prix, type, tauxTva } pour chaque ligne libre
  const [lignesLibresAPersister, setLignesLibresAPersister] = useState([]);
  // { [id_ligne]: id_categorie }
  const [categoriesChoisies, setCategoriesChoisies] = useState({});
  // callback à appeler une fois les articles enregistrés
  const [callbackApresEnregistrement, setCallbackApresEnregistrement] = useState(null);
  const [enregistrementEnCours, setEnregistrementEnCours] = useState(false);

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
  const natureTravauxObjet = String(demande?.type_autre || '').trim();
  const typeBranchementObjet = String(demande?.type_branchement || '').trim();
  const natureDefaut = natureTravauxObjet || typeBranchementObjet || 'Branchement AEP';
  const objetDevis = [natureTravauxObjet || 'Branchement d’eau potable', typeBranchementObjet]
    .filter(Boolean)
    .filter((valeur, index, liste) =>
      liste.findIndex((item) => item.toLowerCase() === valeur.toLowerCase()) === index
    )
    .join(' - ');
  
  // Sections hiérarchiques
  const [sections, setSections] = useState(() => {
    // Si devis existant avec articles, regrouper ou créer une section initiale
    if (devisInitial?.articles && Array.isArray(devisInitial.articles) && devisInitial.articles.length > 0) {
      const references = articleCategories.flatMap((groupe) =>
        (groupe.articles || []).map((article) => ({
          ...article,
          categorie: groupe.libelle_categorie || groupe.libelle || 'Sans catégorie'
        }))
      );
      const lignesParCategorie = new Map();

      devisInitial.articles.forEach((art) => {
        const categorie = obtenirCategorieArticle(art, references);
        const designation = extraireTitreSection(art.libelle);
        const cleSection = designation.titre || categorie;
        const ligne = (() => {
            const typesDispo = determinerTypesDisponibles(art);
            const typeLigne = typesDispo.includes(art.type || art.type_ligne)
              ? (art.type || art.type_ligne)
              : typesDispo[0];
            return {
              id_ligne: art.id_ligne || Math.random().toString(),
              code: art.code || art.code_article || '',
              libelle: obtenirLibelleLigne(art),
              type: typeLigne,
              quantite: Number(art.quantite) || 1,
              unite: art.unite || 'U',
              prix: Number(art.prix ?? art.prix_unitaire ?? 0),
              marge: Number(art.marge || 0),
              tauxTva: Number(art.tauxTva ?? art.taux_tva ?? 19),
              typeTva: art.typeTva || 'PRESTATION',
              matiere: art.matiere || '',
              couleur: art.couleur || '',
              diametre: art.diametre || '',
              modePrix: art.modePrix || art.mode_prix || 'PRESTATION',
              prixFourniture: art.prixFourniture != null ? Number(art.prixFourniture) : (art.prix_fourniture != null ? Number(art.prix_fourniture) : null),
              prixPose: art.prixPose != null ? Number(art.prixPose) : (art.prix_pose != null ? Number(art.prix_pose) : null),
              choixPrix: art.choixPrix || art.choix_prix || 'FOURNITURE_POSE',
              categorie,
              sousElements: art.sousElements || []
            };
        })();
        if (!lignesParCategorie.has(cleSection)) {
          lignesParCategorie.set(cleSection, { titre: designation.titre || categorie, categorie, lignes: [] });
        }
        lignesParCategorie.get(cleSection).lignes.push(ligne);
      });

      return Array.from(lignesParCategorie.values()).map((section, index) => ({
        id_section: `sec_${index + 1}`,
        titre: section.titre,
        categorie: section.categorie,
        lignes: section.lignes
      }));
    }
    // Devis vierge : créer une section par défaut
    return [
      {
        id_section: 'sec_1',
        titre: `Travaux de branchement AEP (${natureDefaut})`,
        categorie: 'Sans catégorie',
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

  // Catégories locales synchronisées avec les props et mises à jour en direct lors d'ajouts
  const [categoriesLocales, setCategoriesLocales] = useState(articleCategories);

  useEffect(() => {
    setCategoriesLocales(articleCategories);
  }, [articleCategories]);

  // Tous les articles aplatis du référentiel
  const tousLesArticles = categoriesLocales.flatMap((f) =>
    (f.articles || []).map((art) => ({
      ...art,
      categorieRef: f.libelle || f.code,
      categorie: f.libelle_categorie || f.libelle || 'Sans catégorie'
    }))
  );

  useEffect(() => {
    const minuteur = setTimeout(() => {
      const resultat = {};
      Object.entries(recherchesLignes).forEach(([idLigne, recherche]) => {
        const motsRecherches = normaliserMotRecherche(recherche).split(/\s+/).filter((mot) => mot.length >= 2);
        if (motsRecherches.length === 0) return;
        resultat[idLigne] = tousLesArticles
          .filter((article) => {
            const texteArticle = normaliserMotRecherche([
              article.libelle,
              article.code,
              article.matiere,
              article.couleur,
              article.categorie
            ].filter(Boolean).join(' '));
            return motsRecherches.every((mot) => texteArticle.includes(mot));
          })
          .slice(0, 8);
      });
      setSuggestionsLignes(resultat);
    }, 300);

    return () => clearTimeout(minuteur);
  }, [recherchesLignes, tousLesArticles]);

  // -------------------------------------------------------------
  // AJOUT D'UNE NOUVELLE LIGNE / ARTICLE VIDE DANS LE DEVIS
  // -------------------------------------------------------------
  function ajouterLigneVide(idSection) {
    let targetId = idSection || idSectionActive;

    const sectionCible = sections.find((section) => section.id_section === targetId);
    if (sectionCible?.lignes.some((ligne) => ligne.estLigneLibre)) {
      notifierErreur("Enregistrez l'article en cours avant d'en créer un autre.");
      return;
    }

    setSections((prev) => {
      let updated = [...prev];
      if (updated.length === 0) {
        const nouvelleSec = {
          id_section: `sec_${Date.now()}`,
          titre: 'Section 1',
          description: '',
          lignes: []
        };
        updated = [nouvelleSec];
        targetId = nouvelleSec.id_section;
      } else if (!targetId || !updated.some((s) => s.id_section === targetId)) {
        targetId = updated[0].id_section;
      }

      const refUnique = `ART-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
      const nouvelleLigne = {
        id_ligne: `lig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        code: refUnique,
        libelle: '',
        type: 'FP/',
        quantite: 1,
        unite: 'U',
        prix: 0,
        marge: 0,
        tauxTva: autoliquidationTva ? 0 : 19,
        typeTva: 'TRAVAUX',
        matiere: '',
        couleur: '',
        diametre: '',
        modePrix: 'FOURNITURE_POSE',
        prixFourniture: 0,
        prixPose: 0,
        choixPrix: 'FOURNITURE_POSE',
        categorie: 'Sans catégorie',
        id_categorie: '',
        sousElements: [],
        estLigneLibre: true
      };

      return updated.map((s) =>
        s.id_section === targetId ? { ...s, lignes: [...s.lignes, nouvelleLigne] } : s
      );
    });

    if (targetId) {
      setIdSectionActive(targetId);
    }
  }

  // Filtrage du tiroir bibliothèques
  const articlesFiltres = tousLesArticles.filter((art) => {
    const matchCategorie = filtreCategorie === 'TOUS' || art.categorieRef === filtreCategorie;
    const q = rechercheBiblio.toLowerCase().trim();
    const matchTexte = !q || [art.libelle, art.code, art.matiere, art.couleur].some((v) =>
      v?.toLowerCase().includes(q)
    );
    return matchCategorie && matchTexte;
  });

  // Ensemble des codes d'articles déjà présents dans l'ensemble du devis
  const codesArticlesDansDevis = new Set(
    sections
      .flatMap((s) => s.lignes.map((l) => (l.code || l.code_article || '').trim().toUpperCase()))
      .filter(Boolean)
  );

  // Enrichir les lignes existantes si les tarifs fourniture/pose manquaient
  useEffect(() => {
    if (tousLesArticles.length === 0) return;
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        lignes: s.lignes.map((l) => {
          const ref = tousLesArticles.find((a) => a.code === l.code);
          if (!ref) return l;
          const f = ref.prixFourniture != null ? Number(ref.prixFourniture) : (l.prixFourniture != null ? Number(l.prixFourniture) : null);
          const p = ref.prixPose != null ? Number(ref.prixPose) : (l.prixPose != null ? Number(l.prixPose) : null);
          const aLesDeux = f !== null && p !== null && f > 0 && p > 0;
          const mode = ref.modePrix || l.modePrix;
          const temp = { ...l, prixFourniture: f, prixPose: p, modePrix: mode };
          const typesDispo = determinerTypesDisponibles(temp, tousLesArticles);
          const typeLigne = typesDispo.includes(l.type) ? l.type : typesDispo[0];
          return {
            ...l,
            modePrix: mode,
            prixFourniture: f,
            prixPose: p,
            choixPrix: l.choixPrix || (aLesDeux ? 'FOURNITURE_POSE' : null),
            type: typeLigne
          };
        })
      }))
    );
  }, [articleCategories]);

  // -------------------------------------------------------------
  // ACTIONS SUR LES SECTIONS ET LIGNES
  // -------------------------------------------------------------
  function ajouterSection() {
    const nouvelleSec = {
      id_section: `sec_${Date.now()}`,
      titre: 'Nouvelle section de travaux',
      lignes: []
    };
    setSections((prev) => [...prev, nouvelleSec]);
    setIdSectionActive(nouvelleSec.id_section);
  }

  function supprimerSection(idSection) {
    if (sections.length <= 1) {
      alert('Un devis doit comporter au moins une section.');
      return;
    }
    setSections((prev) => prev.filter((s) => s.id_section !== idSection));
  }

  function ajouterLigneDansSection(idSection, article, categorie = 'Fourniture', choixPrixInitial = null) {
    const codeArticle = (article?.code || article?.code_article || '').trim().toUpperCase();
    if (codeArticle) {
      const dejaPresent = sections.some((s) =>
        s.lignes.some((l) => (l.code || l.code_article || '').trim().toUpperCase() === codeArticle)
      );
      if (dejaPresent) {
        notifierErreur(`L'article « ${article?.libelle || codeArticle} » est déjà présent dans le devis. Un devis ne peut pas comporter le même article plusieurs fois.`);
        return;
      }
    }

    const ref = tousLesArticles.find((a) => a.code === (article?.code || article?.code_article));
    const categorieLigne = obtenirCategorieArticle(article, tousLesArticles);
    let targetId = sections.find((section) => section.categorie === categorieLigne)?.id_section;
    let f = article?.prixFourniture != null ? Number(article.prixFourniture) : (article?.prix_fourniture != null ? Number(article.prix_fourniture) : (ref?.prixFourniture != null ? Number(ref.prixFourniture) : null));
    let p = article?.prixPose != null ? Number(article.prixPose) : (article?.prix_pose != null ? Number(article.prix_pose) : (ref?.prixPose != null ? Number(ref.prixPose) : null));
    let modePrix = article?.modePrix || article?.mode_prix || ref?.modePrix || null;

    if (categorie === 'PR/' || article?.modePrix === 'PRESTATION' || categorie === 'Prestation') {
      modePrix = 'PRESTATION';
      f = null;
      p = null;
    } else if (categorie === 'P/' && p == null) {
      p = Number(article?.prix || 3500);
      modePrix = 'FOURNITURE_POSE';
    } else if (categorie === 'F/' && f == null) {
      f = Number(article?.prix || 1000);
      modePrix = 'FOURNITURE_POSE';
    } else if (categorie === 'FP/' && (f == null || p == null)) {
      const basePrix = Number(article?.prix || 15000);
      f = Math.round(basePrix * 0.65);
      p = basePrix - f;
      modePrix = 'FOURNITURE_POSE';
    }

    const aLesDeux = f !== null && p !== null && f > 0 && p > 0;
    if (!modePrix) {
      modePrix = aLesDeux ? 'FOURNITURE_POSE' : (f > 0 || p > 0 ? 'FOURNITURE_POSE' : 'PRESTATION');
    }

    const tempArticle = {
      ...article,
      prixFourniture: f,
      prixPose: p,
      modePrix: modePrix,
      code: article?.code || article?.code_article || ref?.code
    };
    const typesDispo = determinerTypesDisponibles(tempArticle, tousLesArticles);

    let choixPrix = choixPrixInitial || article?.choixPrix || (aLesDeux ? 'FOURNITURE_POSE' : null);
    let prixCalcule = Number(article?.prix || 0);
    let typeCalcule = typesDispo[0] || 'F/';

    if (aLesDeux) {
      if (choixPrix === 'FOURNITURE' && typesDispo.includes('F/')) {
        prixCalcule = f;
        typeCalcule = 'F/';
      } else if (choixPrix === 'POSE' && typesDispo.includes('P/')) {
        prixCalcule = p;
        typeCalcule = 'P/';
      } else {
        choixPrix = 'FOURNITURE_POSE';
        prixCalcule = f + p;
        typeCalcule = 'FP/';
      }
    } else if (typesDispo.includes('PR/')) {
      typeCalcule = 'PR/';
      prixCalcule = Number(article?.prix || ref?.prix || 5000);
    } else if (typesDispo.includes(categorie)) {
      typeCalcule = categorie;
      prixCalcule = categorie === 'P/' ? (p || prixCalcule) : (f || prixCalcule);
    } else if (typesDispo.length > 0) {
      typeCalcule = typesDispo[0];
    }

    const nouvelleLigne = {
      id_ligne: `lig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code: article?.code || (typeCalcule === 'P/' ? 'MO-GEN' : `ART-${Date.now()}`),
      libelle: article?.libelle || `${typeCalcule === 'P/' ? 'Pose' : typeCalcule === 'PR/' ? 'Prestation' : 'Fourniture'} standard`,
      type: typeCalcule,
      quantite: Number(article?.quantite) || 1,
      unite: article?.unite || (typeCalcule === 'P/' ? 'H' : 'U'),
      prix: prixCalcule,
      marge: Number(article?.marge || 0),
      tauxTva: autoliquidationTva ? 0 : Number(article?.tauxTva || 19),
      typeTva: article?.typeTva || 'PRESTATION',
      matiere: article?.matiere || '',
      couleur: article?.couleur || '',
      diametre: article?.diametre || '',
      modePrix: article?.modePrix || article?.mode_prix || (aLesDeux ? 'FOURNITURE_POSE' : 'PRESTATION'),
      prixFourniture: f,
      prixPose: p,
      choixPrix: choixPrix,
      categorie: categorieLigne,
      sousElements: article?.sousElements || []
    };

    setSections((prev) =>
      (() => {
        let sectionsAjour = [...prev];
        if (!targetId || !sectionsAjour.some((section) => section.id_section === targetId)) {
          targetId = `sec_cat_${Date.now()}`;
          sectionsAjour.push({
            id_section: targetId,
            titre: categorieLigne,
            categorie: categorieLigne,
            lignes: []
          });
        }
        return sectionsAjour.map((s) =>
          s.id_section === targetId ? { ...s, lignes: [...s.lignes, nouvelleLigne] } : s
        );
      })()
    );
    setIdSectionActive(targetId);
  }

  function changerChoixPrixLigne(idSection, idLigne, nouveauChoix) {
    setSections((prev) =>
      prev.map((s) =>
        s.id_section === idSection
          ? {
              ...s,
              lignes: s.lignes.map((l) => {
                if (l.id_ligne !== idLigne) return l;
                const f = Number(l.prixFourniture || 0);
                const p = Number(l.prixPose || 0);
                let nouveauPrix = f + p;
                let nouveauType = 'FP/';

                if (nouveauChoix === 'FOURNITURE') {
                  nouveauPrix = f;
                  nouveauType = 'F/';
                } else if (nouveauChoix === 'POSE') {
                  nouveauPrix = p;
                  nouveauType = 'P/';
                } else {
                  nouveauPrix = f + p;
                  nouveauType = 'FP/';
                }

                return {
                  ...l,
                  choixPrix: nouveauChoix,
                  prix: nouveauPrix,
                  type: nouveauType
                };
              })
            }
          : s
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

  function ouvrirEnregistrementLigneLibre(ligne) {
    if (!ligne.estLigneLibre) {
      notifierErreur("Cet article existe déjà dans le référentiel.");
      return;
    }

    if (!ligne.libelle?.trim()) {
      notifierErreur("Veuillez renseigner la désignation de l'article avant de l'enregistrer.");
      return;
    }

    setLignesLibresAPersister([ligne]);
    setCategoriesChoisies({ [ligne.id_ligne]: idCategorieLigne(ligne) });
    setCallbackApresEnregistrement(null);
    setModalCategorieOuvert(true);
  }

  function modifierChampLigne(idSection, idLigne, champ, valeur) {
    setSections((prev) =>
      prev.map((s) =>
        s.id_section === idSection
          ? {
              ...s,
              lignes: s.lignes.map((l) => {
                if (l.id_ligne !== idLigne) return l;
                const maj = {
                  ...l,
                  [champ]: champ === 'quantite'
                    ? normaliserQuantite(valeur)
                    : champ === 'prix'
                      ? normaliserPrix(valeur)
                      : valeur
                };
                if (champ === 'type') {
                  if (valeur === 'PR/') {
                    maj.modePrix = 'PRESTATION';
                    maj.typeTva = 'PRESTATION';
                    maj.choixPrix = null;
                  } else if (valeur === 'F/') {
                    maj.modePrix = 'FOURNITURE_POSE';
                    maj.typeTva = 'TRAVAUX';
                    maj.choixPrix = 'FOURNITURE';
                  } else if (valeur === 'P/') {
                    maj.modePrix = 'FOURNITURE_POSE';
                    maj.typeTva = 'TRAVAUX';
                    maj.choixPrix = 'POSE';
                  } else if (valeur === 'FP/') {
                    maj.modePrix = 'FOURNITURE_POSE';
                    maj.typeTva = 'TRAVAUX';
                    maj.choixPrix = 'FOURNITURE_POSE';
                  }
                }
                return maj;
              })
            }
          : s
      )
    );
  }

  function selectionnerSuggestionArticle(idSection, idLigne, article) {
    const codeArticle = String(article.code || article.code_article || '').trim().toUpperCase();
    const categorieArticle = obtenirCategorieArticle(article, tousLesArticles);

    const dejaPresent = sections.some((section) => section.lignes.some((ligne) => (
      ligne.id_ligne !== idLigne &&
      String(ligne.code || ligne.code_article || '').trim().toUpperCase() === codeArticle
    )));

    if (dejaPresent) {
      notifierErreur(`L'article « ${article.libelle || codeArticle} » est déjà présent dans le devis.`);
      return;
    }

    const ligneBase = sections
      .flatMap((section) => section.lignes)
      .find((ligne) => ligne.id_ligne === idLigne) || {};
    const modePrix = article.modePrix || (article.typeTva === 'PRESTATION' ? 'PRESTATION' : 'FOURNITURE_POSE');
    const estPrestation = modePrix === 'PRESTATION';
    const ligneSelectionnee = {
      ...ligneBase,
      code: article.code,
      libelle: article.libelle,
      unite: article.unite || 'U',
      modePrix,
      type: estPrestation ? 'PR/' : 'FP/',
      typeTva: estPrestation ? 'PRESTATION' : 'TRAVAUX',
      tauxTva: estPrestation ? tvaPrestation : (Number(article.tauxTva) || 19),
      prix: Number(article.prix) || 0,
      prixFourniture: article.prixFourniture ?? null,
      prixPose: article.prixPose ?? null,
      choixPrix: estPrestation ? null : 'FOURNITURE_POSE',
      categorie: categorieArticle,
      estLigneLibre: false
    };
    const sectionExistante = sections.find((section) => section.categorie === categorieArticle);
    const idSectionCategorie = sectionExistante?.id_section || `sec_cat_${Date.now()}`;

    setSections((prev) => {
      const sectionsSansLigne = prev
        .map((section) => ({
          ...section,
          lignes: section.lignes.filter((ligne) => ligne.id_ligne !== idLigne)
        }))
        .filter((section) => section.lignes.length > 0 || section.id_section === idSection);
      const indexSection = sectionsSansLigne.findIndex((section) => section.id_section === idSectionCategorie);

      if (indexSection >= 0) {
        sectionsSansLigne[indexSection] = {
          ...sectionsSansLigne[indexSection],
          titre: categorieArticle,
          categorie: categorieArticle,
          lignes: [...sectionsSansLigne[indexSection].lignes, ligneSelectionnee]
        };
        return sectionsSansLigne;
      }

      return [
        ...sectionsSansLigne,
        { id_section: idSectionCategorie, titre: categorieArticle, categorie: categorieArticle, lignes: [ligneSelectionnee] }
      ];
    });
    setIdSectionActive(idSectionCategorie);
    setRecherchesLignes((prev) => ({ ...prev, [idLigne]: '' }));
    setSuggestionsLignes((prev) => ({ ...prev, [idLigne]: [] }));
  }

  function modifierDesignationLigne(idSection, idLigne, valeur) {
    setSections((prev) => prev.map((section) => (
      section.id_section !== idSection
        ? section
        : {
            ...section,
            lignes: section.lignes.map((ligne) => {
              if (ligne.id_ligne !== idLigne) return ligne;
              if (valeur.trim()) return { ...ligne, libelle: valeur };
              return {
                ...ligne,
                libelle: '',
                quantite: '',
                prix: '',
                marge: '',
                tauxTva: ''
              };
            })
          }
    )));
  }

  // Insérer un pack complet d'ouvrages types AEP
  function insererPackOuvrage(pack) {
    const codesExistants = new Set(
      sections
        .flatMap((s) => s.lignes.map((l) => (l.code || l.code_article || '').trim().toUpperCase()))
        .filter(Boolean)
    );
    const doublons = pack.lignes.filter((l) =>
      codesExistants.has((l.code || '').trim().toUpperCase())
    );

    if (doublons.length > 0) {
      const liste = doublons.map((d) => d.libelle || d.code).join(', ');
      notifierErreur(`Impossible d'insérer ce pack : les articles suivants sont déjà présents dans le devis : ${liste}.`);
      return;
    }

    const lignesParCategorie = new Map();
    pack.lignes.map((l) => ({
        ...l,
        id_ligne: `lig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        tauxTva: autoliquidationTva ? 0 : l.tauxTva,
        categorie: obtenirCategorieArticle(l, tousLesArticles)
      }))
      .forEach((ligne) => {
        if (!lignesParCategorie.has(ligne.categorie)) lignesParCategorie.set(ligne.categorie, []);
        lignesParCategorie.get(ligne.categorie).push(ligne);
      });

    const sectionsPack = Array.from(lignesParCategorie.entries()).map(([categorie, lignes], index) => ({
      id_section: `sec_pack_${Date.now()}_${index}`,
      titre: categorie,
      categorie,
      lignes
    }));

    setSections((prev) => {
      const sectionsAjour = [...prev];
      sectionsPack.forEach((sectionPack) => {
        const sectionExistante = sectionsAjour.find((section) => section.categorie === sectionPack.categorie);
        if (sectionExistante) {
          sectionExistante.lignes = [...sectionExistante.lignes, ...sectionPack.lignes];
        } else {
          sectionsAjour.push(sectionPack);
        }
      });
      return sectionsAjour;
    });
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

  function obtenirTauxTvaLigne(ligne) {
    if (ligne.type === 'PR/') return autoliquidationTva ? 0 : Number(tvaPrestation) || 19;
    return autoliquidationTva ? 0 : Number(ligne.tauxTva) || 19;
  }

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
        const taux = obtenirTauxTvaLigne(l);
        const ligneHT = qte * pu;
        const ligneApresRemise = aRemise ? ligneHT * (1 - (Number(tauxRemise) || 0) / 100) : ligneHT;
        return acc + ligneApresRemise * (taux / 100);
      }, 0);

  const totalTTC = totalNetHT + totalTVA;

  const montantRetenue = aRetenueGarantie ? (totalTTC * (Number(tauxRetenueGarantie) || 0)) / 100 : 0;
  const netAPayerTTC = Math.max(0, totalTTC - montantRetenue);

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

    // Vérification que tous les articles ont une désignation
    const ligneSansLibelle = toutesLesLignes.find((l) => !obtenirLibelleLigne(l));
    if (ligneSansLibelle) {
      notifierErreur(`Veuillez renseigner la désignation de l'article ${ligneSansLibelle.code ? `« ${ligneSansLibelle.code} »` : ''} avant d'enregistrer.`);
      return;
    }

    // Unicité des articles dans le devis
    const codesRencontres = new Set();
    const doublons = [];
    for (const l of toutesLesLignes) {
      const code = (l.code || l.code_article || '').trim().toUpperCase();
      if (code) {
        if (codesRencontres.has(code)) {
          doublons.push(l.libelle || code);
        } else {
          codesRencontres.add(code);
        }
      }
    }
    if (doublons.length > 0) {
      notifierErreur(`Le devis contient des articles en double (${doublons.join(', ')}). Un même article ne peut pas figurer plusieurs fois dans le devis.`);
      return;
    }

    // Détection des lignes libres à enregistrer dans le référentiel
    const libres = toutesLesLignes.filter((l) => l.estLigneLibre && l.libelle?.trim());
    if (libres.length > 0) {
      const init = {};
      libres.forEach((l) => { init[l.id_ligne] = idCategorieLigne(l); });
      setLignesLibresAPersister(libres);
      setCategoriesChoisies(init);
      setCallbackApresEnregistrement(() => (sectionsUpdated) => {
        // POINT CLÉ DE LA VIDÉO OBAT (Timestamp 1:24 / 84s) :
        const manqueMentions = !debutTravaux?.trim() || !dureeEstimee?.trim();
        if (manqueMentions) {
          setActionApresAvertissement(() => () => executerSauvegarde(estFinalisation, sectionsUpdated));
          setModalAvertissementMentions(true);
          return;
        }
        executerSauvegarde(estFinalisation, sectionsUpdated);
      });
      setModalCategorieOuvert(true);
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

  // Enregistre les articles libres dans le référentiel puis appelle le callback
  async function enregistrerArticlesLibresPuisSauvegarder() {
    const nonChoisies = lignesLibresAPersister.filter((l) => !categoriesChoisies[l.id_ligne]);
    if (nonChoisies.length > 0) {
      notifierErreur(`Veuillez choisir une catégorie pour : ${nonChoisies.map((l) => l.libelle).join(', ')}`);
      return;
    }

    setEnregistrementEnCours(true);
    const codesNouveaux = {}; // id_ligne -> code_article retourné par l'API

    try {
      for (const ligne of lignesLibresAPersister) {
        const idCategorie = Number(categoriesChoisies[ligne.id_ligne]);
        const type = (ligne.type || 'FP/').trim();
        let mode_prix = 'FOURNITURE_POSE';
        let type_tva = 'TRAVAUX';
        if (type === 'PR/' || ligne.typeTva === 'PRESTATION') {
          mode_prix = 'PRESTATION';
          type_tva = 'PRESTATION';
        }

        const uniteNorm = ['U','ML','M²','M3','KG','H','FF','ENS'].includes(ligne.unite)
          ? ligne.unite : 'U';

        const prix = Number(ligne.prix) || 0;
        let prix_fourniture = null;
        let prix_pose = null;

        if (mode_prix === 'FOURNITURE_POSE') {
          if (type === 'F/') {
            prix_fourniture = prix;
            prix_pose = 0;
          } else if (type === 'P/') {
            prix_fourniture = 0;
            prix_pose = prix;
          } else {
            // FP/
            const f = Number(ligne.prixFourniture);
            const p = Number(ligne.prixPose);
            if (!isNaN(f) && !isNaN(p) && f >= 0 && p >= 0 && (f + p === prix)) {
              prix_fourniture = f;
              prix_pose = p;
            } else {
              prix_fourniture = Math.round(prix * 0.6 * 100) / 100;
              prix_pose = Math.round((prix - prix_fourniture) * 100) / 100;
            }
          }
        }

        const payload = {
          id_categorie: idCategorie,
          libelle: ligne.libelle.trim(),
          matiere: ligne.matiere || '',
          couleur: '',
          unite: uniteNorm,
          mode_prix,
          prix_unitaire: prix,
          prix_fourniture,
          prix_pose,
          type_tva,
          taux_tva: Number(ligne.tauxTva) || 19
        };

        const res = await client.post('/referentiels/articles', payload);
        if (res.data?.code_article) {
          codesNouveaux[ligne.id_ligne] = res.data.code_article;
          // Ajouter également au catalogue local
          setCategoriesLocales((prev) =>
            prev.map((f) =>
              Number(idCategorieGroupe(f)) === idCategorie
                ? { ...f, articles: [...(f.articles || []), res.data] }
                : f
            )
          );
        }
      }

      // Mettre à jour les codes des lignes libres dans les sections
      let sectionsAjour = sections;
      if (Object.keys(codesNouveaux).length > 0) {
        sectionsAjour = sections.map((sec) => ({
          ...sec,
          lignes: sec.lignes.map((l) =>
            codesNouveaux[l.id_ligne]
              ? { ...l, code: codesNouveaux[l.id_ligne], estLigneLibre: false, id_categorie: categoriesChoisies[l.id_ligne] }
              : l
          )
        }));
        setSections(sectionsAjour);
      }

      setModalCategorieOuvert(false);
      notifierSucces(`${lignesLibresAPersister.length} article(s) enregistré(s) dans le référentiel.`);

      // Poursuivre immédiatement la sauvegarde du devis avec les codes officiels
      if (callbackApresEnregistrement) {
        callbackApresEnregistrement(sectionsAjour);
      }
    } catch (err) {
      const msg = err.response?.data?.erreur || "Erreur lors de l'enregistrement d'un article.";
      notifierErreur(msg);
    } finally {
      setEnregistrementEnCours(false);
    }
  }

  function executerSauvegarde(estFinalisation = false, sectionsOverride = null) {
    setModalAvertissementMentions(false);

    let ordreGlobal = 1;
    const articlesPayload = [];
    const sourceSections = sectionsOverride || sections;

    sourceSections.forEach((sec) => {
      sec.lignes.forEach((l) => {
        const quantite = normaliserQuantite(l.quantite);
        const prix = normaliserPrix(l.prix);
        articlesPayload.push({
          code: l.code,
          libelle: `[${sec.titre}] ${obtenirLibelleLigne(l)}`,
          unite: l.unite,
          diametre: l.diametre || null,
          quantite,
          prix,
          montantLigne: quantite * prix,
          tauxTva: obtenirTauxTvaLigne(l),
          type: l.type || 'F/',
          type_ligne: l.type || 'F/',
          typeTva: l.typeTva || 'PRESTATION',
          choixPrix: l.choixPrix || (aTarifsFournitureEtPose(l) ? 'FOURNITURE_POSE' : null),
          prixFourniture: l.prixFourniture != null ? Number(l.prixFourniture) : null,
          prixPose: l.prixPose != null ? Number(l.prixPose) : null,
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
    const headers = ['Section', 'N°', 'Code', 'Désignation', 'Quantité', 'Unité', 'Prix U. HT', 'Total HT'];
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
  const sectionsAffichees = modeOnglet === 'preview'
    ? sections.filter((section) => section.lignes.length > 0)
    : sections;

  return (
    <div className="obat-devis-wrapper">
      {/* 1. TOPBAR DE COMMANDE */}
      <header className="obat-topbar">
        <div className="obat-topbar-left">
          <div className="obat-doc-title">
            {modeOnglet === 'edition' ? 'Édition de Devis' : 'Aperçu du Devis'}
          </div>

          <nav className="obat-nav-tabs">
            <button
              type="button"
              className={`obat-nav-tab ${modeOnglet === 'edition' ? 'active' : ''}`}
              onClick={() => setModeOnglet('edition')}
            >
              Mode Édition
            </button>
            <button
              type="button"
              className={`obat-nav-tab ${modeOnglet === 'preview' ? 'active' : ''}`}
              onClick={() => setModeOnglet('preview')}
            >
              Prévisualisation
            </button>
          </nav>
        </div>

        <div className="obat-topbar-right">
          {/* Statut des mentions d'execution */}
          <div
            className={`obat-mention-status-pill ${debutTravaux && dureeEstimee ? 'ok' : 'warn'}`}
            title="Mentions d’exécution recommandées (début et durée)"
            onClick={() => {
              setEnEditionDebutTravaux(true);
              setEnEditionDuree(true);
            }}
          >
            {debutTravaux && dureeEstimee ? 'Mentions d’exécution OK' : 'Mentions à renseigner'}
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
                    setAutoliquidationTva((p) => !p);
                    setMenuOptionsOuvert(false);
                  }}
                >
                  {autoliquidationTva ? 'Désactiver Autoliquidation TVA' : 'Activer Autoliquidation TVA (0%)'}
                </button>
                <button
                  type="button"
                  className="obat-dropdown-item"
                  onClick={() => {
                    setAfficherColonneUnite((p) => !p);
                    setMenuOptionsOuvert(false);
                  }}
                >
                  {afficherColonneUnite ? 'Masquer la colonne Unité' : 'Afficher la colonne Unité'}
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
                  Exporter en CSV
                </button>
                <button
                  type="button"
                  className="obat-dropdown-item"
                  onClick={() => {
                    window.print();
                    setMenuOptionsOuvert(false);
                  }}
                >
                  Imprimer
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="obat-btn-creer-article-biblio"
                  onClick={() => {
                    ajouterLigneVide(idSectionActive);
                    setDrawerBiblioOuvert(false);
                  }}
                  title="Ajouter une nouvelle ligne vide dans le devis"
                >
                  + Ligne vide dans devis
                </button>
                <button
                  type="button"
                  className="obat-btn-close"
                  onClick={() => setDrawerBiblioOuvert(false)}
                >
                  ✕
                </button>
              </div>
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
                Packs Ouvrages AEP ({PACKS_OUVRAGES_AEP.length})
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
                    className={`obat-famille-tag ${filtreCategorie === 'TOUS' ? 'active' : ''}`}
                    onClick={() => setFiltreCategorie('TOUS')}
                  >
                    Tous
                  </button>
                  {articleCategories.map((f) => (
                    <button
                      key={f.code || idCategorieGroupe(f)}
                      type="button"
                      className={`obat-famille-tag ${filtreCategorie === (f.libelle || f.code) ? 'active' : ''}`}
                      onClick={() => setFiltreCategorie(f.libelle || f.code)}
                    >
                      {f.libelle || f.code}
                    </button>
                  ))}
                </div>

                <div className="obat-drawer-list">
                  {articlesFiltres.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '30px 10px', fontSize: 13 }}>
                      <p style={{ margin: '0 0 12px' }}>Aucun article trouvé pour cette recherche.</p>
                      <button
                        type="button"
                        className="obat-btn-creer-article-biblio"
                        onClick={() => {
                          ajouterLigneVide(idSectionActive);
                          setDrawerBiblioOuvert(false);
                        }}
                      >
                        + Insérer une ligne vide dans le devis
                      </button>
                    </div>
                  ) : (
                    articlesFiltres.map((art) => {
                      const aLesDeux = aTarifsFournitureEtPose(art);
                      const prixTotalFP = aLesDeux ? (Number(art.prixFourniture) + Number(art.prixPose)) : Number(art.prix);
                      const codeArt = (art.code || art.code_article || '').trim().toUpperCase();
                      const estDejaDansDevis = Boolean(codeArt && codesArticlesDansDevis.has(codeArt));

                      return (
                        <div key={art.code} className={`obat-drawer-item ${estDejaDansDevis ? 'deja-ajoute' : ''}`}>
                          <div className="obat-item-info">
                            <div className="obat-item-name" title={art.libelle}>
                              {art.libelle}
                            </div>
                            <div className="obat-item-sub">
                              {art.code} · {LIBELLES_UNITES[art.unite] || art.unite || 'U'}
                              {art.matiere ? ` · ${art.matiere}` : ''}
                              {art.diametre ? ` · Ø ${art.diametre}` : ''}
                            </div>
                            {aLesDeux && (
                              <div className="obat-item-tarifs-breakdown">
                                <span>Fourniture : {formaterNombre(art.prixFourniture)} DA</span>
                                <span> · </span>
                                <span>Pose : {formaterNombre(art.prixPose)} DA</span>
                              </div>
                            )}
                          </div>
                          <div className="obat-item-action">
                            <div className="obat-item-price">{formaterNombre(prixTotalFP)} DA</div>
                            {estDejaDansDevis ? (
                              <span title="Cet article est déjà présent dans le devis">
                                Déjà dans le devis
                              </span>
                            ) : aLesDeux ? (
                              <div className="obat-drawer-split-actions">
                                <button
                                  type="button"
                                  className="obat-item-add-btn"
                                  onClick={() =>
                                    ajouterLigneDansSection(idSectionActive, art, 'FP/', 'FOURNITURE_POSE')
                                  }
                                  title="Insérer avec fourniture et pose"
                                >
                                  + FP/ Les deux
                                </button>
                                <div className="obat-sub-actions">
                                  <button
                                    type="button"
                                    className="obat-item-sub-btn"
                                    onClick={() =>
                                      ajouterLigneDansSection(idSectionActive, art, 'F/', 'FOURNITURE')
                                    }
                                    title="Insérer uniquement la fourniture"
                                  >
                                    + F/ Fourn.
                                  </button>
                                  <button
                                    type="button"
                                    className="obat-item-sub-btn"
                                    onClick={() =>
                                      ajouterLigneDansSection(idSectionActive, art, 'P/', 'POSE')
                                    }
                                    title="Insérer uniquement la pose"
                                  >
                                    + P/ Pose
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="obat-item-add-btn"
                                onClick={() =>
                                  ajouterLigneDansSection(
                                    idSectionActive,
                                    art,
                                    art.modePrix === 'PRESTATION' ? 'PR/' : (art.prixPose && !art.prixFourniture ? 'P/' : 'F/')
                                  )
                                }
                              >
                                + Insérer
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="obat-drawer-list">
                <div className="obat-pack-intro" style={{ padding: '8px 14px', fontSize: 12, color: '#64748B', background: '#F8FAFC' }}>
                  Ces packs regroupent l’ensemble des fournitures et prestations standard d’un branchement eau potable selon les normes ADE.
                </div>
                {PACKS_OUVRAGES_AEP.map((pack) => {
                  const packDoublons = pack.lignes.filter((l) =>
                    codesArticlesDansDevis.has((l.code || '').trim().toUpperCase())
                  );
                  const packADoublons = packDoublons.length > 0;
                  return (
                    <div key={pack.id} className={`obat-pack-card ${packADoublons ? 'deja-ajoute' : ''}`}>
                      <div className="obat-pack-header">
                        <div className="obat-pack-title">{pack.titre}</div>
                        <span className="obat-pack-count">{pack.lignes.length} éléments</span>
                      </div>
                      <p className="obat-pack-desc">{pack.description}</p>
                      {packADoublons && (
                        <div className="obat-pack-warning" style={{ fontSize: 11, color: '#DC2626', marginBottom: 8, fontWeight: 500 }}>
                          Contient des articles déjà dans le devis ({packDoublons.length})
                        </div>
                      )}
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
                          disabled={packADoublons}
                          style={packADoublons ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                          onClick={() => insererPackOuvrage(pack)}
                        >
                          {packADoublons ? 'Articles déjà présents' : '+ Insérer ce pack'}
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                  className="obat-tooltip"
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
                    {afficherDescription ? 'Masquer la description générale' : '+ Ajouter une description générale'}
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
                  <span>Dossier N° {numDemandeRef}</span>
                </div>
                <div className="obat-client-name">{nomClient}</div>
                <div className="obat-client-line">{adresseClient}</div>
                <div className="obat-client-line">{communeClient}</div>
                <div className="obat-client-line obat-client-phone">
                  📞 {telClient}
                </div>
              </div>

              <div className="obat-object-banner">
                <span className="label">OBJET :</span>
                <strong>{objetDevis}</strong>
              </div>
            </div>
          </div>

          {/* 4. SECTIONS ET LIGNES DU DEVIS */}
          <div className="obat-sections-container">
            <table className="obat-table obat-columns-header">
              <thead>
                <tr>
                  <th className="center obat-col-num">N°</th>
                  <th className="obat-col-desig">Désignation</th>
                  <th className="center obat-col-type">Type</th>
                  <th className="center obat-col-qte">Qté</th>
                  {afficherColonneUnite && <th className="center obat-col-unite">Unité</th>}
                  <th className="right obat-col-pu">Prix U. HT</th>
                  <th className="right obat-col-total">Total HT</th>
                  {modeOnglet === 'edition' && <th className="center obat-col-del" />}
                </tr>
              </thead>
            </table>
            {sectionsAffichees.map((section, sIdx) => {
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
                      <span className="obat-section-number">
                        {numeroSection(sIdx, modeNumerotationSections)} -
                      </span>
                      <h3
                        className={modeOnglet === 'edition' ? 'obat-section-title-fixed' : 'obat-section-preview-title'}
                      >
                        {section.titre}
                      </h3>
                    </div>

                    <div className="obat-section-bar-right">
                      <span>
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
                    <tbody>
                      {section.lignes.length === 0 ? (
                        <tr>
                          <td
                            colSpan={modeOnglet === 'edition' ? (afficherColonneUnite ? 8 : 7) : (afficherColonneUnite ? 7 : 6)}
                            className={`obat-table-empty ${modeOnglet === 'edition' ? 'is-clickable' : ''}`}
                            onClick={() => {
                              if (modeOnglet !== 'edition') return;
                              ajouterLigneVide(section.id_section);
                            }}
                            onKeyDown={(e) => {
                              if (modeOnglet !== 'edition' || !['Enter', ' '].includes(e.key)) return;
                              e.preventDefault();
                              ajouterLigneVide(section.id_section);
                            }}
                            tabIndex={modeOnglet === 'edition' ? 0 : undefined}
                            role={modeOnglet === 'edition' ? 'button' : undefined}
                            aria-label={modeOnglet === 'edition' ? 'Créer un nouvel article dans cette section' : undefined}
                          >
                            Cette section est vide. Cliquez pour créer un nouvel article.
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
                                    <div className="obat-line-designation-editor">
                                      <input
                                        type="text"
                                        placeholder="Désignation de l'article…"
                                        value={ligne.libelle}
                                        onChange={(e) => {
                                          const valeur = e.target.value;
                                          modifierDesignationLigne(section.id_section, ligne.id_ligne, valeur);
                                          setRecherchesLignes((prev) => ({ ...prev, [ligne.id_ligne]: valeur }));
                                        }}
                                        style={{ fontWeight: estOuvrage ? 700 : 500 }}
                                        autoFocus={ligne.estLigneLibre && !ligne.libelle}
                                      />
                                      {(suggestionsLignes[ligne.id_ligne] || []).length > 0 && (
                                        <div className="obat-line-suggestions" role="listbox">
                                          {suggestionsLignes[ligne.id_ligne].map((article) => (
                                            <button
                                              key={article.code}
                                              type="button"
                                              className="obat-line-suggestion"
                                              onClick={() => selectionnerSuggestionArticle(section.id_section, ligne.id_ligne, article)}
                                              role="option"
                                            >
                                              <span className="obat-line-suggestion-name">{article.libelle}</span>
                                              <span className="obat-line-suggestion-meta">
                                                {article.code} · {LIBELLES_UNITES[article.unite] || article.unite || 'U'}
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {estOuvrage && (
                                        <button
                                          type="button"
                                          className="obat-btn-cfg-ouvrage"
                                          onClick={() => ouvrirConfigurateurOuvrage(section.id_section, ligne)}
                                        >
                                          Configurer mes éléments d'ouvrage ({ligne.sousElements?.length || 2})
                                        </button>
                                      )}
                                  </div>
                                ) : (
                                  <div>
                                    <strong>{ligne.libelle || <span style={{ color: '#94A3B8', fontStyle: 'italic' }}>Sans désignation</span>}</strong>
                                    <div style={{ fontSize: 11.5, color: '#64748B' }}>
                                      {ligne.code}
                                      {ligne.matiere ? ` · ${ligne.matiere}` : ''}
                                    </div>
                                    {aTarifsFournitureEtPose(ligne) && (
                                      <div style={{ marginTop: 3 }}>
                                        <span>
                                          {ligne.choixPrix === 'FOURNITURE'
                                            ? `Fourniture seule (${formaterNombre(ligne.prixFourniture)} DA)`
                                            : ligne.choixPrix === 'POSE'
                                            ? `Pose seule (${formaterNombre(ligne.prixPose)} DA)`
                                            : `Fourniture & Pose (${formaterNombre(Number(ligne.prixFourniture) + Number(ligne.prixPose))} DA)`}
                                        </span>
                                      </div>
                                    )}
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
                                {modeOnglet === 'edition' ? (() => {
                                  const typesDispo = determinerTypesDisponibles(ligne, tousLesArticles);
                                  const typeActuel = typesDispo.includes(ligne.type) ? ligne.type : typesDispo[0];
                                  return (
                                    <select
                                      className={`obat-select-type-tag ${
                                        typeActuel === 'P/' ? 'p' : typeActuel === 'PR/' ? 'pr' : typeActuel === 'FP/' ? 'fp' : 'f'
                                      }`}
                                      value={typeActuel}
                                      disabled={typesDispo.length <= 1}
                                      style={{
                                        cursor: typesDispo.length > 1 ? 'pointer' : 'default',
                                        opacity: 1
                                      }}
                                      onChange={(e) => {
                                        const nType = e.target.value;
                                        if (aTarifsFournitureEtPose(ligne)) {
                                          if (nType === 'F/') changerChoixPrixLigne(section.id_section, ligne.id_ligne, 'FOURNITURE');
                                          else if (nType === 'P/') changerChoixPrixLigne(section.id_section, ligne.id_ligne, 'POSE');
                                          else if (nType === 'FP/') changerChoixPrixLigne(section.id_section, ligne.id_ligne, 'FOURNITURE_POSE');
                                          else modifierChampLigne(section.id_section, ligne.id_ligne, 'type', nType);
                                        } else {
                                          modifierChampLigne(section.id_section, ligne.id_ligne, 'type', nType);
                                        }
                                      }}
                                      title={
                                        typesDispo.length <= 1
                                          ? `Tarif unique disponible : ${typeActuel}`
                                          : 'Changer le type de tarif appliqué'
                                      }
                                    >
                                      {typesDispo.map((t) => (
                                        <option key={t} value={t}>
                                          {t}
                                        </option>
                                      ))}
                                    </select>
                                  );
                                })() : (() => {
                                  const typesDispo = determinerTypesDisponibles(ligne, tousLesArticles);
                                  const typeActuel = typesDispo.includes(ligne.type) ? ligne.type : typesDispo[0];
                                  return (
                                    <span className={`obat-type-tag ${
                                      typeActuel === 'P/' ? 'p' : typeActuel === 'PR/' ? 'pr' : typeActuel === 'FP/' ? 'fp' : 'f'
                                    }`}>
                                      {typeActuel}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="center obat-col-qte">
                                {modeOnglet === 'edition' ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
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
                                      <option value="KG">KG</option>
                                      <option value="ENS">ENS</option>
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
                                    value={normaliserPrix(ligne.prix)}
                                    onChange={(e) => modifierChampLigne(section.id_section, ligne.id_ligne, 'prix', e.target.value)}
                                    style={{ textAlign: 'right' }}
                                  />
                                ) : (
                                  <span>{formaterNombre(ligne.prix)} DA</span>
                                )}
                              </td>
                              <td className="right obat-col-total">
                                <strong>{formaterNombre(ligneHT)} DA</strong>
                              </td>
                              {modeOnglet === 'edition' && (
                                <td className="center obat-col-del">
                                  <div className="obat-line-actions">
                                    {ligne.estLigneLibre && (
                                      <button
                                        type="button"
                                        className="obat-btn-save-line"
                                        onClick={() => ouvrirEnregistrementLigneLibre(ligne)}
                                        title="Valider et enregistrer l'article"
                                        aria-label="Valider et enregistrer l'article"
                                      >
                                        <svg
                                          width="16"
                                          height="16"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth="2.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          aria-hidden="true"
                                        >
                                          <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="obat-btn-del"
                                      onClick={() => supprimerLigne(section.id_section, ligne.id_ligne)}
                                      title="Supprimer la ligne"
                                      aria-label="Supprimer la ligne"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                      {modeOnglet === 'edition' && section.lignes.length > 0 && (
                        <tr
                          className={`obat-table-add-row ${section.lignes.some((ligne) => ligne.estLigneLibre) ? 'is-disabled' : ''}`}
                          onClick={() => {
                            if (section.lignes.some((ligne) => ligne.estLigneLibre)) return;
                            ajouterLigneVide(section.id_section);
                          }}
                          onKeyDown={(e) => {
                            if (!['Enter', ' '].includes(e.key) || section.lignes.some((ligne) => ligne.estLigneLibre)) return;
                            e.preventDefault();
                            ajouterLigneVide(section.id_section);
                          }}
                          tabIndex={section.lignes.some((ligne) => ligne.estLigneLibre) ? -1 : 0}
                          role="button"
                          aria-disabled={section.lignes.some((ligne) => ligne.estLigneLibre)}
                          aria-label={section.lignes.some((ligne) => ligne.estLigneLibre)
                            ? "Enregistrez d'abord l'article en cours avant d'en créer un autre"
                            : 'Créer un autre article dans cette section'}
                        >
                          <td colSpan={afficherColonneUnite ? 8 : 7}>
                            {section.lignes.some((ligne) => ligne.estLigneLibre)
                              ? "Enregistrez l'article en cours avant d'en créer un autre"
                              : 'Cliquez ici pour créer un autre article'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

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
                    className="obat-btn-add-element obat-btn-primary-add"
                    onClick={() => ajouterLigneVide(idSectionActive)}
                    title="Ajouter un article dans la section active"
                  >
                    + Ajouter un article
                  </button>
                  <button
                    type="button"
                    className="obat-btn-add-element"
                    onClick={() => setDrawerBiblioOuvert(true)}
                    title="Insérer un article depuis la bibliothèque dans la section active"
                  >
                    📚 Insérer depuis la Bibliothèque
                  </button>
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
                    Packs AEP Types
                  </button>
                </div>

                <div className="obat-add-group-right">
                  <label className="obat-numbering-control">
                    Numérotation
                    <select
                      value={modeNumerotationSections}
                      onChange={(e) => setModeNumerotationSections(e.target.value)}
                      aria-label="Style de numérotation des sections"
                    >
                      <option value="ROMAIN">I, II, III</option>
                      <option value="ALPHABETIQUE">A, B, C</option>
                    </select>
                  </label>
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
                  modeOnglet === 'edition' ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={tauxRetenueGarantie}
                        onChange={(e) => setTauxRetenueGarantie(e.target.value)}
                        style={{ width: 45, textAlign: 'center', padding: '1px 4px', fontSize: 13 }}
                      />
                      % ({formaterNombre(montantRetenue)} DA) pendant
                      <input
                        type="number"
                        min="1"
                        max="36"
                        value={dureeRetenueMois}
                        onChange={(e) => setDureeRetenueMois(e.target.value)}
                        style={{ width: 45, textAlign: 'center', padding: '1px 4px', fontSize: 13 }}
                      />
                      mois
                    </span>
                  ) : (
                    <span>
                      <strong>{tauxRetenueGarantie} %</strong> ({formaterNombre(montantRetenue)} DA) pendant {dureeRetenueMois} mois
                    </span>
                  )
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
                  <span>GESTION DES DÉCHETS DE CHANTIER (BTP / AEP)</span>
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

                <div className="obat-net-payer-banner">
                  <div className="net-label">NET À PAYER</div>
                  <div className="net-valeur">{formaterNombre(netAPayerTTC)} DA TTC</div>
                </div>

                <div className="obat-amount-words">
                  <span>Montant en lettres</span>
                  <strong>{nombreEnLettres(netAPayerTTC)}</strong>
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

      {/* 7b. MODAL DE SÉLECTION DE FAMILLE POUR LES ARTICLES LIBRES */}
      {modalCategorieOuvert && (
        <div className="obat-modal-overlay">
          <form
            className="obat-modal-card obat-family-modal"
            style={{ maxWidth: 680, width: '95%' }}
            onSubmit={(e) => {
              e.preventDefault();
              enregistrerArticlesLibresPuisSauvegarder();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: 6 }}>Choisir la catégorie de l'article</h3>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
              Sélectionnez la catégorie d'appartenance avant d'enregistrer cet article dans le référentiel.
            </p>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 16 }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Désignation</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center' }}>Unité</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Prix U. HT</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', minWidth: 180 }}>Catégorie *</th>
                </tr>
              </thead>
              <tbody>
                {lignesLibresAPersister.map((ligne) => (
                  <tr key={ligne.id_ligne} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 500 }}>{ligne.libelle}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', color: '#64748B' }}>{ligne.unite}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', color: '#1E293B', fontWeight: 600 }}>
                      {Number(ligne.prix).toLocaleString('fr-DZ', { minimumFractionDigits: 2 })} DA
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      <select
                        value={categoriesChoisies[ligne.id_ligne] || ''}
                        onChange={(e) => setCategoriesChoisies((prev) => ({ ...prev, [ligne.id_ligne]: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '5px 8px',
                          border: categoriesChoisies[ligne.id_ligne] ? '1px solid #CBD5E1' : '2px solid #F97316',
                          borderRadius: 4,
                          fontSize: 12,
                          background: '#FFF'
                        }}
                      >
                        <option value="">— Choisir une catégorie —</option>
                        {categoriesLocales.map((f) => (
                          <option key={idCategorieGroupe(f)} value={idCategorieGroupe(f)}>
                            {f.libelle || f.code}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="obat-btn-annuler"
                onClick={() => setModalCategorieOuvert(false)}
                disabled={enregistrementEnCours}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="obat-btn-action-primary"
                disabled={enregistrementEnCours || lignesLibresAPersister.some((l) => !categoriesChoisies[l.id_ligne])}
                style={{ minWidth: 180 }}
              >
                {enregistrementEnCours
                  ? 'Enregistrement…'
                  : `Enregistrer et continuer`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 8. MODALE D'AVERTISSEMENT NON-BLOQUANTE (VIDÉO OBAT t=84s) */}
      {modalAvertissementMentions && (
        <div className="obat-modal-overlay">
          <div className="obat-modal-card obat-warning-card">
            <div className="obat-warning-header">
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
                Renseigner maintenant
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
                <span>Ouvrage composé</span>
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
              Décomposez cet ouvrage en fournitures et main d’œuvre. Déverrouillez pour ajuster un composant.
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
                            min="0"
                            step="1"
                            value={se.quantite}
                            onChange={(e) => {
                              const val = normaliserQuantite(e.target.value);
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
                            min="0"
                            step="any"
                            value={se.prixAchat}
                            onChange={(e) => {
                              const val = normaliserPrix(e.target.value);
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
                          {se.verrouille ? 'Verrouillé' : 'Déverrouillé'}
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
                  Valider et recalculer l’ouvrage
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
                Confirmer et émettre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
