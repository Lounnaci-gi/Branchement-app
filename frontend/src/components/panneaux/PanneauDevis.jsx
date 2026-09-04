import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import { notifierErreur, notifierSucces } from '../../utils/notifications';
import InputDate from '../InputDate';
import './PanneauDevis.css';

const LIBELLES_UNITES = {
  U: 'U (Unité)',
  ML: 'ML (Mètre linéaire)',
  'M²': 'M² (Mètre carré)',
  M3: 'M3 (Mètre cube)',
  KG: 'KG (Kilogramme)'
};

export function determinerTypesDisponibles(ligne, tousLesArticles = []) {
  if (!ligne) return ['F/'];

  const ref = Array.isArray(tousLesArticles)
    ? tousLesArticles.find((a) => a.code === (ligne.code || ligne.code_article))
    : null;

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

function normaliserTypeLigne(type, choixPrix, modePrix, article = null, tousLesArticles = []) {
  const typesDispo = determinerTypesDisponibles(article || { type, choixPrix, modePrix }, tousLesArticles);
  const str = String(type || '').trim();
  if (typesDispo.includes(str)) return str;
  if (choixPrix === 'FOURNITURE' && typesDispo.includes('F/')) return 'F/';
  if (choixPrix === 'POSE' && typesDispo.includes('P/')) return 'P/';
  if (choixPrix === 'FOURNITURE_POSE' && typesDispo.includes('FP/')) return 'FP/';
  if (typesDispo.includes('PR/')) return 'PR/';
  return typesDispo[0] || 'F/';
}

function aTarifsFournitureEtPose(article) {
  if (!article) return false;
  const f = Number(article.prixFourniture ?? article.prix_fourniture ?? 0);
  const p = Number(article.prixPose ?? article.prix_pose ?? 0);
  return f > 0 && p > 0;
}

function prixArticle(article) {
  if (!article) return 0;
  if (aTarifsFournitureEtPose(article)) {
    if (article.choixPrix === 'FOURNITURE' || article.type === 'F/') return Number(article.prixFourniture || 0);
    if (article.choixPrix === 'POSE' || article.type === 'P/') return Number(article.prixPose || 0);
    return Number(article.prixFourniture || 0) + Number(article.prixPose || 0);
  }
  if (article.modePrix === 'FOURNITURE_POSE') {
    return Number(article.prixFourniture || 0) + Number(article.prixPose || 0);
  }
  return Number(article.prix || 0);
}

function tvaArticle(article) {
  return prixArticle(article) * (Number(article.tauxTva ?? 19) / 100);
}

export function estimerMontantDevis(demande, etude) {
  if (!demande || !etude) return 0;

  const texteType = String(demande.type_branchement || demande.type_autre || '').trim().toLowerCase();
  const distance = Number(etude.distance_reseau_m ?? 0) || 0;
  const diametreTexte = String(etude.diametre_conduite ?? '').replace(/[^\d.]/g, '');
  const diametre = Number(diametreTexte) || 0;

  const tarifsParUsage = {
    domestique: { base: 18000, distance: 75, diametre: { 20: 210, 25: 260, 32: 320, 40: 420, 50: 510, 63: 620, 80: 760, 100: 920, 110: 1040, 125: 1180, 150: 1360 } },
    administratif: { base: 26000, distance: 110, diametre: { 20: 310, 25: 390, 32: 470, 40: 630, 50: 760, 63: 910, 80: 1080, 100: 1280, 110: 1450, 125: 1640, 150: 1870 } },
    commercial: { base: 31000, distance: 130, diametre: { 20: 410, 25: 500, 32: 610, 40: 820, 50: 990, 63: 1180, 80: 1380, 100: 1630, 110: 1880, 125: 2160, 150: 2450 } },
    industriel: { base: 44000, distance: 160, diametre: { 20: 520, 25: 640, 32: 780, 40: 980, 50: 1200, 63: 1450, 80: 1740, 100: 2080, 110: 2380, 125: 2710, 150: 3050 } },
    extension: { base: 34000, distance: 95, diametre: { 20: 290, 25: 350, 32: 420, 40: 560, 50: 690, 63: 830, 80: 980, 100: 1150, 110: 1290, 125: 1460, 150: 1660 } },
    renovation: { base: 22000, distance: 80, diametre: { 20: 250, 25: 300, 32: 370, 40: 500, 50: 620, 63: 740, 80: 900, 100: 1060, 110: 1200, 125: 1360, 150: 1560 } },
    resiliation: { base: 22000, distance: 82, diametre: { 20: 250, 25: 300, 32: 370, 40: 500, 50: 620, 63: 740, 80: 900, 100: 1060, 110: 1200, 125: 1360, 150: 1560 } }
  };

  let profil = 'domestique';
  if (texteType.includes('administratif')) profil = 'administratif';
  else if (texteType.includes('commercial')) profil = 'commercial';
  else if (texteType.includes('industriel')) profil = 'industriel';
  else if (texteType.includes('extension') || texteType.includes('réseau')) profil = 'extension';
  else if (texteType.includes('rénovation') || texteType.includes('résiliation')) profil = 'renovation';

  const tarif = tarifsParUsage[profil];
  const diametreReference = Object.keys(tarif.diametre).map(Number).sort((a, b) => a - b).find((valeur) => diametre <= valeur) || 150;
  const coutDiametre = tarif.diametre[diametreReference] || tarif.diametre[150] || 0;
  const montant = tarif.base + (distance * tarif.distance) + coutDiametre;

  return Math.max(0, Math.round(montant / 100) * 100);
}

export default function PanneauDevis({
  idDemande,
  demande,
  devis,
  etude,
  onAfficherDevis,
  demandeVerrouillee = false,
  onEnregistre,
  ouvrirFormulaire = false,
  onFormulaireOuvert,
  formulaireUniquement = false,
  onAnnule,
  afficherActionsCreation = false,
  afficherResumeDemande = true,
  masquerArticlesSelectionnes = false
}) {
  const navigate = useNavigate();
  const devisListe = Array.isArray(devis) ? devis : (devis ? [devis] : []);
  const etudeRenseignee = Boolean(
    etude && (
      etude.date_visite ||
      etude.faisabilite ||
      (etude.distance_reseau_m !== null && etude.distance_reseau_m !== undefined) ||
      etude.diametre_conduite ||
      etude.observations
    )
  );
  const [devisSelectionne, setDevisSelectionne] = useState(null);
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({
    montant: ''
  });
  const [paiement, setPaiement] = useState({
    mode_paiement: 'Especes',
    date_paiement: new Date().toISOString().slice(0, 10),
    numero_recu: '',
    numero_cheque: '',
    numero_versement: '',
    banque: ''
  });
  const [envoi, setEnvoi] = useState(false);
  const [banques, setBanques] = useState([]);

  const [enregistrerPaiement, setEnregistrerPaiement] = useState(false);
  const [numeroDevisPreview, setNumeroDevisPreview] = useState('');
  const [articleFamilles, setArticleFamilles] = useState([]);
  const [articlesSelectionnes, setArticlesSelectionnes] = useState({});
  const [lignesDevis, setLignesDevis] = useState([]);
  const [rechercheArticle, setRechercheArticle] = useState('');
  const [suggestionsFiltrees, setSuggestionsFiltrees] = useState([]);
  const [suggestionVisible, setSuggestionVisible] = useState(false);

  const tousLesArticles = articleFamilles.flatMap((f) => f.articles);

  const devisActuel = devisListe.find((item) => item.id_devis === devisSelectionne) || null;
  const montantTotalCumule = devisListe.reduce((acc, curr) => acc + (Number(curr.montant) || 0), 0);
  const montantEstime = estimerMontantDevis({ type_branchement: etude?.type_branchement, type_autre: etude?.type_autre }, etude);

  const totalArticles = lignesDevis.reduce((acc, ligne) => acc + (Number(ligne.quantite) || 0) * prixArticle(ligne), 0);
  const totalTvaPrestation = lignesDevis.reduce((acc, ligne) => {
    const qte = Number(ligne.quantite) || 0;
    return acc + (ligne.typeTva === 'TRAVAUX' ? 0 : qte * tvaArticle(ligne));
  }, 0);
  const totalTvaTravaux = lignesDevis.reduce((acc, ligne) => {
    const qte = Number(ligne.quantite) || 0;
    return acc + (ligne.typeTva === 'TRAVAUX' ? qte * tvaArticle(ligne) : 0);
  }, 0);
  const totalTva = totalTvaPrestation + totalTvaTravaux;
  const totalTTC = totalArticles + totalTva;

  function ajusterArticle(articleCode, delta) {
    setArticlesSelectionnes((prev) => {
      const actuel = Number(prev[articleCode] || 0);
      const next = Math.max(0, actuel + delta);
      return { ...prev, [articleCode]: next };
    });
  }

  function rechercherArticles(valeur) {
    setRechercheArticle(valeur);
    if (!valeur.trim()) {
      setSuggestionsFiltrees([]);
      setSuggestionVisible(false);
      return;
    }
    const q = valeur.toLowerCase();
    const filtres = tousLesArticles.filter(
      (a) => [a.libelle, a.code, a.matiere, a.couleur].some((valeurArticle) => valeurArticle?.toLowerCase().includes(q))
    ).slice(0, 10);
    setSuggestionsFiltrees(filtres);
    setSuggestionVisible(true);
  }

  function ajouterArticle(article) {
    setLignesDevis((prev) => {
      const existe = prev.find((l) => l.code === article.code);
      if (existe) {
        return prev.map((l) =>
          l.code === article.code ? { ...l, quantite: String(Number(l.quantite || 0) + 1) } : l
        );
      }
      const aLesDeux = aTarifsFournitureEtPose(article);
      const choixInitial = article.choixPrix || (aLesDeux ? 'FOURNITURE_POSE' : null);
      const typeInitial = normaliserTypeLigne(article.type, choixInitial, article.modePrix);
      return [
        ...prev,
        {
          ...article,
          quantite: '1',
          diametre: '',
          choixPrix: choixInitial,
          type: typeInitial
        }
      ];
    });
    setRechercheArticle('');
    setSuggestionsFiltrees([]);
    setSuggestionVisible(false);
  }

  function changerChoixPrix(code, nouveauChoix) {
    setLignesDevis((prev) =>
      prev.map((l) => {
        if (l.code !== code) return l;
        let nouveauType = l.type;
        if (nouveauChoix === 'FOURNITURE') nouveauType = 'F/';
        else if (nouveauChoix === 'POSE') nouveauType = 'P/';
        else if (nouveauChoix === 'FOURNITURE_POSE') nouveauType = 'FP/';
        return { ...l, choixPrix: nouveauChoix, type: nouveauType };
      })
    );
  }

  function changerTypeLigne(code, nouveauType) {
    setLignesDevis((prev) =>
      prev.map((l) => {
        if (l.code !== code) return l;
        let nouveauChoix = l.choixPrix;
        if (aTarifsFournitureEtPose(l)) {
          if (nouveauType === 'F/') nouveauChoix = 'FOURNITURE';
          else if (nouveauType === 'P/') nouveauChoix = 'POSE';
          else if (nouveauType === 'FP/') nouveauChoix = 'FOURNITURE_POSE';
        }
        return { ...l, type: nouveauType, choixPrix: nouveauChoix };
      })
    );
  }

  function supprimerLigne(code) {
    setLignesDevis((prev) => prev.filter((l) => l.code !== code));
  }

  function changerQuantite(code, valeur) {
    setLignesDevis((prev) =>
      prev.map((l) => (l.code === code ? { ...l, quantite: valeur } : l))
    );
  }

  function changerDiametre(code, valeur) {
    setLignesDevis((prev) =>
      prev.map((l) => (l.code === code ? { ...l, diametre: valeur } : l))
    );
  }

  useEffect(() => {
    client.get('/referentiels/banques').then((res) => setBanques(res.data)).catch(() => setBanques([]));
    client.get('/referentiels/articles')
      .then((res) => setArticleFamilles(Array.isArray(res.data) ? res.data : []))
      .catch(() => setArticleFamilles([]));
  }, []);

  useEffect(() => {
    if (!ouvert || devisActuel || !idDemande) {
      setNumeroDevisPreview(devisActuel?.numero_devis || '');
      return;
    }

    let ignore = false;
    client.get(`/demandes/${idDemande}/devis/preview`)
      .then((res) => {
        if (!ignore) setNumeroDevisPreview(res.data.numero_devis || '');
      })
      .catch(() => {
        if (!ignore) setNumeroDevisPreview('');
      });

    return () => {
      ignore = true;
    };
  }, [ouvert, devisActuel, idDemande]);

  useEffect(() => {
    if (!devisActuel) {
      setForm({ montant: '' });
      setLignesDevis([]);
      setEnregistrerPaiement(false);
      setPaiement({
        mode_paiement: 'Especes',
        date_paiement: new Date().toISOString().slice(0, 10),
        numero_recu: '',
        numero_cheque: '',
        numero_versement: '',
        banque: ''
      });
      return;
    }
    setForm({ montant: devisActuel.montant || '' });
    setLignesDevis(
      Array.isArray(devisActuel.articles)
        ? devisActuel.articles.map((art) => {
            const ref = tousLesArticles.find((a) => a.code === (art.code || art.code_article));
            const f = art.prixFourniture ?? art.prix_fourniture ?? ref?.prixFourniture ?? null;
            const p = art.prixPose ?? art.prix_pose ?? ref?.prixPose ?? null;
            const aLesDeux = f !== null && p !== null && Number(f) > 0 && Number(p) > 0;
            const choix = art.choixPrix || art.choix_prix || (aLesDeux ? 'FOURNITURE_POSE' : null);
            const typeLigne = normaliserTypeLigne(art.type || art.type_ligne, choix, art.modePrix || art.mode_prix);
            return {
              ...art,
              modePrix: art.modePrix || art.mode_prix || (aLesDeux ? 'FOURNITURE_POSE' : 'PRESTATION'),
              prixFourniture: f != null ? Number(f) : null,
              prixPose: p != null ? Number(p) : null,
              choixPrix: choix,
              type: typeLigne
            };
          })
        : []
    );
    setEnregistrerPaiement(devisActuel.statut_paiement === 'PAYE');
    setPaiement({
      mode_paiement: devisActuel.mode_paiement === 'Virement' ? 'Versement_bancaire' : (devisActuel.mode_paiement || 'Especes'),
      date_paiement: devisActuel.date_paiement?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      numero_recu: devisActuel.numero_recu || '',
      numero_cheque: devisActuel.numero_cheque || '',
      numero_versement: devisActuel.numero_versement || '',
      banque: devisActuel.banque?.toUpperCase() || ''
    });
  }, [devisActuel, ouvert]);

  useEffect(() => {
    if (tousLesArticles.length === 0 || lignesDevis.length === 0) return;
    setLignesDevis((prev) =>
      prev.map((l) => {
        if (l.prixFourniture != null && l.prixPose != null) return l;
        const ref = tousLesArticles.find((a) => a.code === l.code);
        if (!ref || ref.prixFourniture == null || ref.prixPose == null) return l;
        const f = Number(ref.prixFourniture);
        const p = Number(ref.prixPose);
        const aLesDeux = f > 0 && p > 0;
        const choix = l.choixPrix || (aLesDeux ? 'FOURNITURE_POSE' : null);
        const typeLigne = normaliserTypeLigne(l.type || l.type_ligne, choix, ref.modePrix || l.modePrix);
        return {
          ...l,
          modePrix: ref.modePrix || l.modePrix,
          prixFourniture: f,
          prixPose: p,
          choixPrix: choix,
          type: typeLigne
        };
      })
    );
  }, [articleFamilles]);

  useEffect(() => {
    if (!ouvert || devisActuel?.statut_paiement === 'PAYE') return;
    if (lignesDevis.length > 0 && totalTTC > 0) {
      setForm((prev) => ({ ...prev, montant: String(Math.round(totalTTC * 100) / 100) }));
    }
  }, [ouvert, devisActuel, totalTTC, lignesDevis.length]);

  useEffect(() => {
    if (!ouvrirFormulaire || demandeVerrouillee) return;
    setDevisSelectionne(null);
    setForm({ montant: '' });
    setLignesDevis([]);
    setEnregistrerPaiement(false);
    setPaiement({
      mode_paiement: 'Especes',
      date_paiement: new Date().toISOString().slice(0, 10),
      numero_recu: '',
      numero_cheque: '',
      numero_versement: '',
      banque: ''
    });
    setOuvert(true);
    onFormulaireOuvert?.();
  }, [ouvrirFormulaire, demandeVerrouillee, onFormulaireOuvert]);

  function ouvrirAjoutDevisComplementaire() {
    if (demandeVerrouillee) {
      notifierErreur('Cette demande est scellée : les modifications sont interdites.');
      return;
    }
    setDevisSelectionne(null);
    setForm({ montant: '' });
    setLignesDevis([]);
    setEnregistrerPaiement(false);
    setOuvert(true);
  }

  function ouvrirModification(item) {
    if (demandeVerrouillee) {
      notifierErreur('Cette demande est scellée : les modifications sont interdites.');
      return;
    }
    setDevisSelectionne(item.id_devis);
    setOuvert(true);
  }

  function fermerFormulaire() {
    if (formulaireUniquement) {
      onAnnule?.();
      return;
    }
    setOuvert(false);
    setDevisSelectionne(null);
  }

  async function enregistrer(e) {
    e.preventDefault();
    if (demandeVerrouillee) {
      await notifierErreur('Cette demande est scellée : les modifications sont interdites.');
      return;
    }
    const montantTotalArticles = totalTTC > 0 ? (Math.round(totalTTC * 100) / 100) : (Number(form.montant) || 0);
    if (lignesDevis.length === 0 && montantTotalArticles <= 0) {
      await notifierErreur('Veuillez ajouter au moins un article pour calculer le montant du devis.');
      return;
    }
    if (montantTotalArticles <= 0) {
      await notifierErreur('Le montant total calculé du devis doit être supérieur à 0.');
      return;
    }
    if (devisActuel?.statut_paiement === 'PAYE' && Number(montantTotalArticles) !== Number(devisActuel.montant)) {
      await notifierErreur('Le montant d’un devis réglé ne peut pas être modifié.');
      return;
    }
    if (enregistrerPaiement && devisActuel?.date_emission && paiement.date_paiement < devisActuel.date_emission?.slice(0, 10)) {
      await notifierErreur('La date de paiement doit être supérieure ou égale à la date d’émission du devis.');
      return;
    }
    setEnvoi(true);
    try {
      const articlesPayload = lignesDevis.map((l) => {
        const pu = prixArticle(l);
        const qte = Number(l.quantite) || 1;
        const aLesDeux = aTarifsFournitureEtPose(l);
        const typeLigne = l.type || normaliserTypeLigne(l.type, l.choixPrix, l.modePrix);
        return {
          code: l.code,
          libelle: l.libelle,
          unite: l.unite,
          diametre: l.diametre || null,
          quantite: qte,
          prix: pu,
          montantLigne: qte * pu,
          type: typeLigne,
          type_ligne: typeLigne,
          typeTva: l.typeTva || 'PRESTATION',
          tauxTva: Number(l.tauxTva ?? 19),
          choixPrix: l.choixPrix || (aLesDeux ? 'FOURNITURE_POSE' : null),
          prixFourniture: l.prixFourniture != null ? Number(l.prixFourniture) : null,
          prixPose: l.prixPose != null ? Number(l.prixPose) : null
        };
      });

      const resDevis = await client.put(`/demandes/${idDemande}/devis`, {
        montant: montantTotalArticles,
        id_devis: devisActuel?.id_devis,
        articles: articlesPayload
      });

      const idDevisEnregistre = devisActuel?.id_devis || resDevis.data?.id_devis;

      if (enregistrerPaiement && idDevisEnregistre) {
        await client.patch(`/demandes/${idDemande}/devis/paiement`, {
          ...paiement,
          id_devis: idDevisEnregistre
        });
      }

      setOuvert(false);
      setDevisSelectionne(null);
      onEnregistre();
      await notifierSucces(
        devisActuel
          ? 'Devis mis à jour avec succès.'
          : devisListe.length > 0
            ? 'Devis complémentaire ajouté avec succès.'
            : 'Devis initial enregistré avec succès.'
      );
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || "Erreur lors de l'enregistrement du devis.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="card panneau-devis">
      {/* En-tête principal du panneau */}
      <div className="panneau-devis-header">
        <div className="panneau-devis-titre-wrap">
          <div className="panneau-devis-icon">💳</div>
          <div>
            <h3 style={{ margin: 0 }}>Devis & Paiement</h3>
            {devisListe.length > 0 && (
              <div className="panneau-devis-total-badge">
                <span>{devisListe.length} {devisListe.length > 1 ? 'devis enregistrés' : 'devis enregistré'}</span>
                <span>•</span>
                <span>Total : <span className="panneau-devis-total-valeur">{montantTotalCumule.toLocaleString('fr-DZ')} DA</span></span>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {afficherActionsCreation && !demandeVerrouillee && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate(`/demandes/${idDemande}/devis/nouveau`)}
              title="Ouvrir l'éditeur de devis structuré inspiré d'Obat"
            >
              <span>✨</span> Éditeur Devis Obat
            </button>
          )}
          {afficherActionsCreation && !demandeVerrouillee && devisListe.length > 0 && !ouvert && (
            <button type="button" className="btn btn-secondary" onClick={ouvrirAjoutDevisComplementaire}>
              <span>+</span> Devis complémentaire
            </button>
          )}
          {afficherActionsCreation && !demandeVerrouillee && devisListe.length === 0 && !ouvert && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setDevisSelectionne(null);
                setForm({ montant: '' });
                setLignesDevis([]);
                setOuvert(true);
              }}
            >
              <span>✎</span> Saisie rapide
            </button>
          )}
          {ouvert && (
            <button type="button" className="btn btn-secondary" onClick={fermerFormulaire}>
              ✕ Fermer
            </button>
          )}
        </div>
      </div>

      {/* Liste des devis émis */}
      {!ouvert && !formulaireUniquement && (
        <div className="devis-liste-container">
          {devisListe.map((item, index) => {
            const estPaye = item.statut_paiement === 'PAYE';
            return (
              <div className="devis-card-item" key={item.id_devis}>
                <div className="devis-card-left">
                  <span className={`devis-type-tag ${index === 0 ? 'initial' : 'complementaire'}`}>
                    {index === 0 ? 'Devis initial' : `Complémentaire N°${index}`}
                  </span>
                  <div className="devis-numero-box">
                    <span className="devis-numero-libelle">Référence</span>
                    <span className="mono devis-numero-valeur">{item.numero_devis}</span>
                  </div>
                </div>

                <div className="devis-card-montant">
                  <span className="devis-numero-libelle">Montant</span>
                  <span className="devis-montant-chiffre">{Number(item.montant).toLocaleString('fr-DZ')} DA</span>
                  {Array.isArray(item.articles) && item.articles.length > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {item.articles.length} article{item.articles.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {item.date_emission && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="devis-numero-libelle">Émis le</span>
                    <span style={{ fontSize: 13.5, color: 'var(--color-text)' }}>
                      {new Date(item.date_emission).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                )}

                <div>
                  <span className={`devis-statut-pill ${estPaye ? 'paye' : 'impaye'}`}>
                    {estPaye ? '✓ Réglé' : '⏳ Impayé'}
                    {estPaye && item.date_paiement && (
                      <span style={{ opacity: 0.8, fontSize: 11 }}>
                        ({new Date(item.date_paiement).toLocaleDateString('fr-FR')})
                      </span>
                    )}
                  </span>
                </div>

                <div className="devis-card-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => onAfficherDevis?.(item.id_devis)}
                    title="Afficher le devis dans une page dédiée"
                  >
                    <span>👁</span> Afficher
                  </button>
                  {!demandeVerrouillee && !estPaye && (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => navigate(`/demandes/${idDemande}/devis/nouveau?id_devis=${item.id_devis}`)}
                        title="Ouvrir dans l'éditeur de devis complet inspiré d'Obat"
                      >
                        <span>✏️</span> Éditeur complet
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => ouvrirModification(item)}
                        title="Modifier ou régler ce devis impayé"
                      >
                        <span>💳</span> Régler / Rapide
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {devisListe.length === 0 && (
            <div className="devis-empty-state">
              <div className="devis-empty-icon">📑</div>
              <div className="devis-empty-text">
                {demandeVerrouillee
                  ? 'Demande scellée — aucune modification de devis n’est autorisée.'
                  : 'Aucun devis n\'a encore été émis pour ce dossier.'}
              </div>
              {afficherActionsCreation && !demandeVerrouillee && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setDevisSelectionne(null);
                    setForm({ montant: '' });
                    setLignesDevis([]);
                    setOuvert(true);
                  }}
                >
                  + Émettre le premier devis
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Formulaire de création / modification */}
      {ouvert && (
        <form onSubmit={enregistrer} className="form-devis-container">
          <div className="form-devis-entete">
            <h4>
              <span>{devisActuel ? '✎' : devisListe.length > 0 ? '➕' : '📄'}</span>
              {devisActuel
                ? `Modifier le devis (${devisActuel.numero_devis})`
                : devisListe.length > 0
                  ? 'Ajout d’un devis complémentaire'
                  : 'Émission du devis initial'}
            </h4>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: 12 }}
              onClick={fermerFormulaire}
            >
              Annuler
            </button>
          </div>

          {afficherResumeDemande && <div style={{ marginBottom: 18, padding: '12px 14px', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-surface-sunken)' }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Abonné</div>
            <div style={{ fontWeight: 700 }}>{demande?.est_personne_morale ? demande.raison_sociale : `${demande?.demandeur_nom || ''} ${demande?.demandeur_prenom || ''}`.trim() || '—'}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lieu des travaux</div>
            <div style={{ fontWeight: 600 }}>{demande?.adresse_branchement || '—'}</div>
            <div style={{ color: 'var(--color-text-muted)' }}>{demande?.nom_commune || 'Commune non renseignée'} · {demande?.type_autre || demande?.type_branchement || 'Nature non renseignée'}</div>
          </div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div className="champ" style={{ margin: 0 }}>
              <label>N° DE DEVIS</label>
              <div
                className="mono"
                style={{
                  minHeight: 40,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  background: 'var(--color-surface-sunken)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  color: 'var(--color-text)'
                }}
              >
                {devisActuel?.numero_devis || numeroDevisPreview || 'Sera généré automatiquement'}
              </div>
            </div>

            <div className="champ" style={{ margin: 0 }}>
              <label>MONTANT GLOBAL DU DEVIS (TTC)</label>
              <div
                style={{
                  minHeight: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 14px',
                  background: 'var(--color-surface-sunken)',
                  border: (totalTTC > 0 || Number(form.montant) > 0) ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 800,
                  fontSize: 16,
                  color: (totalTTC > 0 || Number(form.montant) > 0) ? 'var(--color-primary)' : 'var(--color-text-muted)'
                }}
              >
                <span>{(totalTTC > 0 ? totalTTC : (Number(form.montant) || 0)).toLocaleString('fr-DZ')} DA</span>
                <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  {totalTTC > 0 ? 'Addition de tous les articles' : (lignesDevis.length === 0 ? 'Ajoutez des articles ci-dessous' : '')}
                </span>
              </div>
            </div>
          </div>

          <div className="champ" style={{ marginTop: 18, gridColumn: '1 / -1' }}>
            <label>ARTICLES / PIÈCES</label>

            {/* Barre de recherche + autocomplétion */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input
                type="text"
                placeholder={tousLesArticles.length === 0 ? 'Chargement du référentiel…' : 'Rechercher un article par nom ou code…'}
                value={rechercheArticle}
                disabled={tousLesArticles.length === 0}
                onChange={(e) => rechercherArticles(e.target.value)}
                onBlur={() => setTimeout(() => setSuggestionVisible(false), 150)}
                onFocus={() => rechercheArticle.trim() && setSuggestionVisible(suggestionsFiltrees.length > 0)}
                style={{ width: '100%' }}
                autoComplete="off"
              />
              {suggestionVisible && suggestionsFiltrees.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', maxHeight: 280, overflowY: 'auto'
                }}>
                  {suggestionsFiltrees.map((article) => (
                    <button
                      key={article.code}
                      type="button"
                      onMouseDown={() => ajouterArticle(article)}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        width: '100%', padding: '9px 14px', background: 'none', border: 'none',
                        borderBottom: '1px solid var(--color-border)', cursor: 'pointer',
                        textAlign: 'left', gap: 12
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{article.libelle}</span>
                          {article.avecDiametre && (
                            <span style={{
                              fontSize: 10.5,
                              background: 'var(--color-surface-sunken)',
                              border: '1px solid var(--color-border)',
                              color: 'var(--color-primary)',
                              padding: '1px 5px',
                              borderRadius: 4,
                              fontWeight: 600
                            }}>
                              Ø Diamètre
                            </span>
                          )}
                        </div>
                        <small style={{ color: 'var(--color-text-muted)' }}>
                          {article.code} · {LIBELLES_UNITES[article.unite] || article.unite}
                          {article.matiere ? ` · ${article.matiere}` : ''}
                          {article.couleur ? ` · ${article.couleur}` : ''}
                          {aTarifsFournitureEtPose(article) ? (
                            <span style={{ display: 'block', color: 'var(--color-primary)' }}>
                              F {Number(article.prixFourniture).toLocaleString('fr-DZ')} + P {Number(article.prixPose).toLocaleString('fr-DZ')} DA
                            </span>
                          ) : null}
                        </small>
                      </div>
                      <span style={{ fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--color-primary)' }}>
                        {prixArticle(article).toLocaleString('fr-DZ')} DA
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {suggestionVisible && suggestionsFiltrees.length === 0 && rechercheArticle.trim() && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: 8, padding: '10px 14px', color: 'var(--color-text-muted)', fontSize: 13
                }}>
                  Aucun article trouvé pour « {rechercheArticle} »
                </div>
              )}
            </div>

            {/* Tableau des lignes saisies */}
            {lignesDevis.length > 0 ? (() => {
              const auMoinsUnAvecDiametre = lignesDevis.some((l) => l.avecDiametre);
              const colonnesGrille = auMoinsUnAvecDiametre
                ? 'minmax(150px, 1fr) 68px 90px 80px 85px 110px 36px'
                : 'minmax(150px, 1fr) 68px 80px 85px 110px 36px';

              return (
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                {/* En-tête */}
                <div style={{
                  display: 'grid', gridTemplateColumns: colonnesGrille,
                  gap: 8, padding: '8px 12px', background: 'var(--color-surface-sunken)',
                  borderBottom: '1px solid var(--color-border)',
                  fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em'
                }}>
                  <span>Article</span>
                  <span style={{ textAlign: 'center' }}>Type</span>
                  {auMoinsUnAvecDiametre && <span style={{ textAlign: 'center' }}>Diamètre</span>}
                  <span style={{ textAlign: 'center' }}>Qté</span>
                  <span style={{ textAlign: 'right' }}>P.U.</span>
                  <span style={{ textAlign: 'right' }}>Montant HT</span>
                  <span />
                </div>

                {/* Lignes */}
                {lignesDevis.map((ligne) => {
                  const qte = Number(ligne.quantite) || 0;
                  const pu = prixArticle(ligne);
                  const montantLigne = qte * pu;
                  return (
                    <div
                      key={ligne.code}
                      style={{
                        display: 'grid', gridTemplateColumns: colonnesGrille,
                        gap: 8, padding: '10px 12px', alignItems: 'center',
                        borderBottom: '1px solid var(--color-border)'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{ligne.libelle}</div>
                        <small style={{ color: 'var(--color-text-muted)' }}>
                          {ligne.code} · {LIBELLES_UNITES[ligne.unite] || ligne.unite}
                          {ligne.modePrix === 'FOURNITURE_POSE' && !aTarifsFournitureEtPose(ligne)
                            ? ` · F ${Number(ligne.prixFourniture || 0).toLocaleString('fr-DZ')} + P ${Number(ligne.prixPose || 0).toLocaleString('fr-DZ')} DA`
                            : null}
                        </small>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {(() => {
                          const typesDispo = determinerTypesDisponibles(ligne, tousLesArticles);
                          const typeActuel = typesDispo.includes(ligne.type) ? ligne.type : typesDispo[0];
                          return (
                            <select
                              value={typeActuel}
                              disabled={typesDispo.length <= 1}
                              onChange={(e) => changerTypeLigne(ligne.code, e.target.value)}
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                padding: '3px 4px',
                                borderRadius: 4,
                                border: '1px solid var(--color-border)',
                                background:
                                  typeActuel === 'F/' ? '#EFF6FF' :
                                  typeActuel === 'P/' ? '#FFFBEB' :
                                  typeActuel === 'FP/' ? '#ECFDF5' : '#F5F3FF',
                                color:
                                  typeActuel === 'F/' ? '#1D4ED8' :
                                  typeActuel === 'P/' ? '#B45309' :
                                  typeActuel === 'FP/' ? '#047857' : '#6D28D9',
                                cursor: typesDispo.length > 1 ? 'pointer' : 'default',
                                opacity: 1
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
                        })()}
                      </div>
                      {auMoinsUnAvecDiametre && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {ligne.avecDiametre ? (
                            <input
                              type="text"
                              list="liste-diametres"
                              placeholder="ex: 20 mm"
                              value={ligne.diametre || ''}
                              onChange={(e) => changerDiametre(ligne.code, e.target.value)}
                              style={{ width: 84, textAlign: 'center', padding: '4px 6px', fontSize: 12.5 }}
                            />
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>—</span>
                          )}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '2px 7px', fontSize: 14 }}
                          onClick={() => changerQuantite(ligne.code, String(Math.max(0, (Number(ligne.quantite) || 0) - 1)))}
                        >−</button>
                        <input
                          type="number"
                          min="0"
                          value={ligne.quantite}
                          onChange={(e) => changerQuantite(ligne.code, e.target.value)}
                          style={{ width: 44, textAlign: 'center', fontWeight: 700, padding: '4px 6px' }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary"
                          style={{ padding: '2px 7px', fontSize: 14 }}
                          onClick={() => changerQuantite(ligne.code, String((Number(ligne.quantite) || 0) + 1))}
                        >+</button>
                      </div>
                      <span style={{ textAlign: 'right', color: 'var(--color-text-muted)', fontSize: 12.5 }}>
                        {pu.toLocaleString('fr-DZ')} DA
                      </span>
                      <strong style={{ textAlign: 'right' }}>
                        {montantLigne.toLocaleString('fr-DZ')} DA
                      </strong>
                      <button
                        type="button"
                        onClick={() => supprimerLigne(ligne.code)}
                        title="Supprimer cette ligne"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--color-danger, #e53e3e)', fontSize: 16, padding: 0, lineHeight: 1
                        }}
                      >×</button>
                    </div>
                  );
                })}

                {/* Récapitulatif */}
                <div style={{ padding: '10px 12px', background: 'var(--color-surface-sunken)', display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text-muted)' }}>
                    <span>Total HT</span><span>{totalArticles.toLocaleString('fr-DZ')} DA</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text-muted)' }}>
                    <span>TVA Prestation</span><span>{totalTvaPrestation.toLocaleString('fr-DZ')} DA</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--color-text-muted)' }}>
                    <span>TVA Travaux</span><span>{totalTvaTravaux.toLocaleString('fr-DZ')} DA</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14, marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
                    <span>Total TTC</span><span style={{ color: 'var(--color-primary)' }}>{totalTTC.toLocaleString('fr-DZ')} DA</span>
                  </div>
                </div>
              </div>
              );
            })() : (
              <div style={{
                padding: '18px 14px', textAlign: 'center', color: 'var(--color-text-muted)',
                border: '1px dashed var(--color-border)', borderRadius: 10, fontSize: 13
              }}>
                Aucun article ajouté — recherchez un article ci-dessus pour commencer.
              </div>
            )}
          </div>

          {/* Section carte interactive pour l'encaissement / paiement */}
          <div className={`paiement-toggle-card ${enregistrerPaiement ? 'actif' : ''}`}>
            <label
              htmlFor="enregistrer-paiement"
              className="paiement-toggle-header"
            >
              <div className="paiement-toggle-left">
                <div className="paiement-toggle-icon">
                  {enregistrerPaiement ? '✅' : '💳'}
                </div>
                <div className="paiement-toggle-text">
                  <span className="paiement-toggle-titre">
                    Enregistrer le règlement de ce devis
                  </span>
                  <span className="paiement-toggle-description">
                    Activez cette option pour consigner immédiatement le paiement (espèces, chèque ou virement)
                  </span>
                </div>
              </div>

              <div className="custom-switch">
                <input
                  type="checkbox"
                  id="enregistrer-paiement"
                  checked={enregistrerPaiement}
                  onChange={(e) => setEnregistrerPaiement(e.target.checked)}
                />
                <span className="custom-switch-slider"></span>
              </div>
            </label>

            {/* Détails du paiement si le switch est activé */}
            {enregistrerPaiement && (
              <div className="paiement-details-content">
                <div className="champ">
                  <label id="mode-paiement-label">MODE DE RÈGLEMENT *</label>
                  <div className="mode-paiement-badges" role="radiogroup" aria-labelledby="mode-paiement-label">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paiement.mode_paiement === 'Especes'}
                      className={`mode-paiement-btn ${paiement.mode_paiement === 'Especes' ? 'selectionne' : ''}`}
                      onClick={() => setPaiement({ ...paiement, mode_paiement: 'Especes' })}
                    >
                      <span aria-hidden="true">💵</span> Espèces
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paiement.mode_paiement === 'Cheque'}
                      className={`mode-paiement-btn ${paiement.mode_paiement === 'Cheque' ? 'selectionne' : ''}`}
                      onClick={() => setPaiement({ ...paiement, mode_paiement: 'Cheque' })}
                    >
                      <span aria-hidden="true">🧾</span> Chèque
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={paiement.mode_paiement === 'Versement_bancaire'}
                      className={`mode-paiement-btn ${paiement.mode_paiement === 'Versement_bancaire' ? 'selectionne' : ''}`}
                      onClick={() => setPaiement({ ...paiement, mode_paiement: 'Versement_bancaire' })}
                    >
                      <span aria-hidden="true">🏦</span> Versement bancaire
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <div className="champ" style={{ margin: 0 }}>
                    <label>DATE DU PAIEMENT *</label>
                    <InputDate
                      required
                      min={devisActuel?.date_emission?.slice(0, 10)}
                      value={paiement.date_paiement}
                      onChange={(val) => setPaiement({ ...paiement, date_paiement: val })}
                    />
                  </div>

                  {paiement.mode_paiement === 'Especes' && (
                    <div className="champ" style={{ margin: 0 }}>
                      <label>N° DE REÇU DE CAISSE *</label>
                      <input
                        required
                        value={paiement.numero_recu}
                        onChange={(e) => setPaiement({ ...paiement, numero_recu: e.target.value })}
                        placeholder="ex: REC-2026-00123"
                      />
                    </div>
                  )}

                  {paiement.mode_paiement === 'Cheque' && (
                    <>
                      <div className="champ" style={{ margin: 0 }}>
                        <label>N° DE CHÈQUE *</label>
                        <input
                          required
                          value={paiement.numero_cheque}
                          onChange={(e) => setPaiement({ ...paiement, numero_cheque: e.target.value })}
                          placeholder="ex: CHQ-889900"
                        />
                      </div>
                      <div className="champ" style={{ margin: 0 }}>
                        <label>BANQUE ÉMETTRICE *</label>
                        <input
                          required
                          list="banques-enregistrees"
                          value={paiement.banque}
                          onChange={(e) => setPaiement({ ...paiement, banque: e.target.value.toUpperCase() })}
                          style={{ textTransform: 'uppercase' }}
                          placeholder="ex: BNA, BEA, CPA, BDL..."
                        />
                      </div>
                    </>
                  )}

                  {paiement.mode_paiement === 'Versement_bancaire' && (
                    <>
                      <div className="champ" style={{ margin: 0 }}>
                        <label>N° DE BORDEREAU / VERSEMENT *</label>
                        <input
                          required
                          value={paiement.numero_versement}
                          onChange={(e) => setPaiement({ ...paiement, numero_versement: e.target.value })}
                          placeholder="ex: VRS-554433"
                        />
                      </div>
                      <div className="champ" style={{ margin: 0 }}>
                        <label>BANQUE / CCP *</label>
                        <input
                          required
                          list="banques-enregistrees"
                          value={paiement.banque}
                          onChange={(e) => setPaiement({ ...paiement, banque: e.target.value.toUpperCase() })}
                          style={{ textTransform: 'uppercase' }}
                          placeholder="ex: BNA, CPA, ALGERIE POSTE..."
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Boutons d'action du formulaire */}
          <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={envoi}
              onClick={fermerFormulaire}
            >
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" disabled={envoi}>
              <span>{envoi ? '⏳' : '✓'}</span>
              {envoi
                ? 'Enregistrement...'
                : devisActuel
                  ? (enregistrerPaiement && devisActuel.statut_paiement !== 'PAYE' ? 'Enregistrer & Valider le paiement' : 'Mettre à jour le devis')
                  : (enregistrerPaiement ? 'Enregistrer le devis & son paiement' : 'Enregistrer le devis')}
            </button>
          </div>
        </form>
      )}

      <datalist id="banques-enregistrees">
        {banques.map((banque) => <option key={banque} value={banque} />)}
      </datalist>

      <datalist id="liste-diametres">
        <option value="15 mm" />
        <option value="20 mm" />
        <option value="25 mm" />
        <option value="32 mm" />
        <option value="40 mm" />
        <option value="50 mm" />
        <option value="63 mm" />
        <option value="80 mm" />
        <option value="100 mm" />
        <option value="110 mm" />
        <option value="125 mm" />
        <option value="160 mm" />
      </datalist>
    </div>
  );
}


