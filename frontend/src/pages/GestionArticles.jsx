import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import Breadcrumbs from '../components/Breadcrumbs';
import { notifierErreur, notifierSucces } from '../utils/notifications';
import './GestionArticles.css';

const UNITES = [
  { code: 'U', label: 'U (Unité)' },
  { code: 'ML', label: 'ML (Mètre linéaire)' },
  { code: 'M²', label: 'M² (Mètre carré)' },
  { code: 'M3', label: 'M3 (Mètre cube)' },
  { code: 'KG', label: 'KG (Kilogramme)' },
  { code: 'H', label: 'H (Heure)' },
  { code: 'FF', label: 'FF (Forfait)' }
];

const FORMULAIRE_VIDE = {
  id_famille: '',
  libelle: '',
  matiere: '',
  couleur: '',
  unite: 'U',
  mode_prix: 'FOURNITURE_POSE',
  prix_unitaire: '',
  prix_fourniture: '',
  prix_pose: '',
  type_tva: 'TRAVAUX',
  taux_tva: '19',
  avec_diametre: false
};

const FAMILLE_VIDE = { libelle: '', id_categorie: '' };
const CATEGORIE_VIDE = { libelle: '' };

const TARIF_VIDE = {
  code_article: '',
  mode_prix: 'FOURNITURE_POSE',
  prix_unitaire: '',
  prix_fourniture: '',
  prix_pose: '',
  type_tva: 'PRESTATION',
  taux_tva: '19',
  date_debut: new Date().toISOString().slice(0, 10)
};

function formaterNombre(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GestionArticles() {
  const [familles, setFamilles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [chargement, setChargement] = useState(true);

  // Recherche & Filtres (Logique Obat)
  const [recherche, setRecherche] = useState('');
  const [filtreFamille, setFiltreFamille] = useState('TOUS');
  const [filtreCategorie, setFiltreCategorie] = useState('TOUS');
  const [filtreMode, setFiltreMode] = useState('TOUS'); // 'TOUS', 'FOURNITURE_POSE', 'PRESTATION'
  const [ongletPrincipal, setOngletPrincipal] = useState('catalogue'); // 'catalogue' ou 'familles'
  const [categorieSelectionnee, setCategorieSelectionnee] = useState(null);

  // Modales
  const [modalNouvelArticleOuvert, setModalNouvelArticleOuvert] = useState(false);
  const [modalFamilleOuvert, setModalFamilleOuvert] = useState(false);
  const [familleEnEdition, setFamilleEnEdition] = useState(null);

  const [modalCategorieOuvert, setModalCategorieOuvert] = useState(false);
  const [categorieEnEdition, setCategorieEnEdition] = useState(null);

  const [modalTarifOuvert, setModalTarifOuvert] = useState(false);
  const [tarifEnEdition, setTarifEnEdition] = useState(null);

  // Formulaires
  const [form, setForm] = useState(FORMULAIRE_VIDE);
  const [erreurs, setErreurs] = useState({});
  const [envoi, setEnvoi] = useState(false);

  const [formFamille, setFormFamille] = useState(FAMILLE_VIDE);
  const [erreursFamille, setErreursFamille] = useState({});
  const [envoiFamille, setEnvoiFamille] = useState(false);

  const [formCategorie, setFormCategorie] = useState(CATEGORIE_VIDE);
  const [erreursCategorie, setErreursCategorie] = useState({});
  const [envoiCategorie, setEnvoiCategorie] = useState(false);

  const [formTarif, setFormTarif] = useState(TARIF_VIDE);
  const [erreursTarif, setErreursTarif] = useState({});
  const [envoiTarif, setEnvoiTarif] = useState(false);

  // Modification directe dans le tableau (sans formulaire modal)
  const [articleEnEditionCode, setArticleEnEditionCode] = useState(null);
  const [formInlineTarif, setFormInlineTarif] = useState(null);
  const [envoiInlineTarif, setEnvoiInlineTarif] = useState(false);

  const agent = JSON.parse(localStorage.getItem('agent') || '{}');

  async function chargerDonnees() {
    setChargement(true);
    try {
      const [famillesResponse, articlesResponse, categoriesResponse] = await Promise.all([
        client.get('/referentiels/articles/familles'),
        client.get('/referentiels/articles'),
        client.get('/referentiels/articles/categories')
      ]);
      setFamilles(famillesResponse.data || []);
      setArticles(articlesResponse.data || []);
      setCategories(categoriesResponse.data || []);
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || 'Impossible de charger le référentiel.');
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    if (agent.role !== 'admin') return;
    chargerDonnees();
  }, []);

  // Tous les articles aplatis pour calculs et filtrage
  const tousLesArticles = useMemo(() => {
    return articles.flatMap((fam) =>
      (fam.articles || []).map((art) => ({
        ...art,
        codeFamille: fam.code,
        libelleFamille: fam.libelle,
        idCategorie: fam.id_categorie,
        libelleCategorie: fam.libelle_categorie
      }))
    );
  }, [articles]);

  // Statistiques Obat
  const totalArticles = tousLesArticles.length;
  const totalFourniturePose = tousLesArticles.filter((a) => a.modePrix === 'FOURNITURE_POSE').length;
  const totalPrestations = tousLesArticles.filter((a) => a.modePrix === 'PRESTATION').length;

  // Filtrage dynamique des articles (comme dans EditeurDevisObat)
  const articlesFiltres = useMemo(() => {
    return tousLesArticles.filter((art) => {
      const matchCategorie = filtreCategorie === 'TOUS' || art.idCategorie === Number(filtreCategorie);
      const matchFamille = filtreFamille === 'TOUS' || art.codeFamille === filtreFamille;
      const matchMode = filtreMode === 'TOUS' || art.modePrix === filtreMode;
      const q = recherche.toLowerCase().trim();
      const matchTexte = !q || [
        art.libelle,
        art.code,
        art.matiere,
        art.couleur,
        art.libelleFamille,
        art.libelleCategorie
      ].some((v) => v?.toLowerCase().includes(q));

      return matchCategorie && matchFamille && matchMode && matchTexte;
    });
  }, [tousLesArticles, filtreCategorie, filtreFamille, filtreMode, recherche]);

  // Regroupement par famille pour l'affichage catalogue
  const articlesParFamilleAffiches = useMemo(() => {
    const map = new Map();
    articlesFiltres.forEach((art) => {
      if (!map.has(art.codeFamille)) {
        map.set(art.codeFamille, {
          code: art.codeFamille,
          libelle: art.libelleFamille,
          idCategorie: art.idCategorie,
          libelleCategorie: art.libelleCategorie,
          articles: []
        });
      }
      map.get(art.codeFamille).articles.push(art);
    });
    return Array.from(map.values());
  }, [articlesFiltres]);

  // -------------------------------------------------------------
  // GESTION DES ARTICLES
  // -------------------------------------------------------------
  function modifier(champ, valeur) {
    setForm((ancien) => {
      if (champ !== 'mode_prix') return { ...ancien, [champ]: valeur };
      return valeur === 'PRESTATION'
        ? { ...ancien, mode_prix: valeur, prix_fourniture: '', prix_pose: '', type_tva: 'PRESTATION' }
        : { ...ancien, mode_prix: valeur, prix_unitaire: '', type_tva: 'TRAVAUX' };
    });
    setErreurs((anciennes) => ({ ...anciennes, [champ]: undefined }));
  }

  function validerArticle() {
    const err = {};
    if (!form.id_famille) err.id_famille = 'Veuillez sélectionner une famille.';
    if (!form.libelle.trim()) err.libelle = 'La désignation de l’article est requise.';
    if (form.mode_prix === 'PRESTATION') {
      if (form.prix_unitaire === '' || Number(form.prix_unitaire) < 0) {
        err.prix_unitaire = 'Précisez un prix de prestation valide.';
      }
    } else {
      if (form.prix_fourniture === '' || Number(form.prix_fourniture) < 0) {
        err.prix_fourniture = 'Précisez le prix de fourniture HT.';
      }
      if (form.prix_pose === '' || Number(form.prix_pose) < 0) {
        err.prix_pose = 'Précisez le prix de pose HT.';
      }
    }
    return err;
  }

  async function enregistrerArticle(e) {
    e.preventDefault();
    const err = validerArticle();
    setErreurs(err);
    if (Object.keys(err).length > 0) return;

    setEnvoi(true);
    try {
      await client.post('/referentiels/articles', form);
      await chargerDonnees();
      setModalNouvelArticleOuvert(false);
      setForm(FORMULAIRE_VIDE);
      await notifierSucces('Article ajouté avec succès à la bibliothèque !');
    } catch (error) {
      notifierErreur(error.response?.data?.erreur || 'Erreur lors de la création de l’article.');
    } finally {
      setEnvoi(false);
    }
  }

  // -------------------------------------------------------------
  // GESTION DES TARIFS
  // -------------------------------------------------------------
  function ouvrirModificationTarif(article) {
    setTarifEnEdition(article);
    setFormTarif({
      code_article: article.code,
      mode_prix: article.modePrix,
      prix_unitaire: article.modePrix === 'PRESTATION' ? String(article.prix ?? '') : '',
      prix_fourniture: article.modePrix === 'FOURNITURE_POSE' ? String(article.prixFourniture ?? '') : '',
      prix_pose: article.modePrix === 'FOURNITURE_POSE' ? String(article.prixPose ?? '') : '',
      type_tva: article.typeTva || 'PRESTATION',
      taux_tva: String(article.tauxTva ?? 19),
      date_debut: new Date().toISOString().slice(0, 10)
    });
    setErreursTarif({});
    setModalTarifOuvert(true);
  }

  async function enregistrerTarif(e) {
    e.preventDefault();
    const err = {};
    if (formTarif.mode_prix === 'PRESTATION') {
      if (formTarif.prix_unitaire === '' || Number(formTarif.prix_unitaire) < 0) {
        err.prix_unitaire = 'Précisez un tarif unitaire.';
      }
    } else {
      if (formTarif.prix_fourniture === '' || Number(formTarif.prix_fourniture) < 0) {
        err.prix_fourniture = 'Précisez la fourniture.';
      }
      if (formTarif.prix_pose === '' || Number(formTarif.prix_pose) < 0) {
        err.prix_pose = 'Précisez la pose.';
      }
    }
    setErreursTarif(err);
    if (Object.keys(err).length > 0) return;

    setEnvoiTarif(true);
    try {
      await client.post('/referentiels/articles/tarifs', formTarif);
      await chargerDonnees();
      setModalTarifOuvert(false);
      setTarifEnEdition(null);
      await notifierSucces('Nouveau tarif appliqué avec succès !');
    } catch (error) {
      notifierErreur(error.response?.data?.erreur || 'Erreur lors de la mise à jour du tarif.');
    } finally {
      setEnvoiTarif(false);
    }
  }

  // -------------------------------------------------------------
  // MODIFICATION DU TARIF DIRECTEMENT DANS LE TABLEAU (SANS FORMULAIRE)
  // -------------------------------------------------------------
  function demarrerEditionInline(article) {
    setArticleEnEditionCode(article.code);
    setFormInlineTarif({
      code_article: article.code,
      libelle: article.libelle || '',
      matiere: article.matiere || '',
      couleur: article.couleur || '',
      avec_diametre: Boolean(article.avecDiametre),
      unite: article.unite || 'U',
      mode_prix: article.modePrix || 'FOURNITURE_POSE',
      prix_unitaire: article.modePrix === 'PRESTATION' ? String(article.prix ?? '') : '',
      prix_fourniture: article.modePrix === 'FOURNITURE_POSE' ? String(article.prixFourniture ?? '') : '',
      prix_pose: article.modePrix === 'FOURNITURE_POSE' ? String(article.prixPose ?? '') : '',
      type_tva: article.typeTva || 'PRESTATION',
      taux_tva: Number(article.tauxTva ?? 19)
    });
  }

  function annulerEditionInline() {
    setArticleEnEditionCode(null);
    setFormInlineTarif(null);
  }

  async function enregistrerTarifInline(article) {
    if (!formInlineTarif) return;
    const libelle = String(formInlineTarif.libelle || '').trim();
    if (!libelle) {
      notifierErreur('La désignation de l’article est requise.');
      return;
    }

    const mode = formInlineTarif.mode_prix;
    const prix = Number(formInlineTarif.prix_unitaire);
    const fourniture = Number(formInlineTarif.prix_fourniture);
    const pose = Number(formInlineTarif.prix_pose);

    if (mode === 'PRESTATION') {
      if (!Number.isFinite(prix) || prix < 0) {
        notifierErreur('Veuillez saisir un prix unitaire valide.');
        return;
      }
    } else {
      if (!Number.isFinite(fourniture) || fourniture < 0) {
        notifierErreur('Veuillez saisir un prix de fourniture valide.');
        return;
      }
      if (!Number.isFinite(pose) || pose < 0) {
        notifierErreur('Veuillez saisir un prix de pose valide.');
        return;
      }
    }

    // Applicable à compter de la date de modification (date du jour)
    const dateAujourdhui = new Date().toISOString().slice(0, 10);
    const payload = {
      libelle,
      unite: formInlineTarif.unite || 'U',
      matiere: formInlineTarif.matiere || '',
      couleur: formInlineTarif.couleur || '',
      avec_diametre: Boolean(formInlineTarif.avec_diametre),
      mode_prix: formInlineTarif.mode_prix,
      prix_unitaire: mode === 'PRESTATION' ? prix : fourniture + pose,
      prix_fourniture: mode === 'FOURNITURE_POSE' ? fourniture : null,
      prix_pose: mode === 'FOURNITURE_POSE' ? pose : null,
      type_tva: formInlineTarif.type_tva || 'PRESTATION',
      taux_tva: formInlineTarif.taux_tva || 19,
      date_debut: dateAujourdhui
    };

    setEnvoiInlineTarif(true);
    try {
      await client.put(`/referentiels/articles/${encodeURIComponent(formInlineTarif.code_article)}`, payload);
      await chargerDonnees();
      setArticleEnEditionCode(null);
      setFormInlineTarif(null);
      const dateFormatee = new Date().toLocaleDateString('fr-FR');
      await notifierSucces(`Article « ${libelle} » mis à jour avec succès (applicable à compter du ${dateFormatee}).`);
    } catch (error) {
      notifierErreur(error.response?.data?.erreur || 'Erreur lors de la mise à jour de l’article.');
    } finally {
      setEnvoiInlineTarif(false);
    }
  }

  // -------------------------------------------------------------
  // GESTION DES FAMILLES
  // -------------------------------------------------------------
  function ouvrirModalFamille(famille = null) {
    if (famille) {
      setFamilleEnEdition(famille.id_famille);
      setFormFamille({ libelle: famille.libelle, id_categorie: famille.id_categorie || '' });
    } else {
      setFamilleEnEdition(null);
      setFormFamille(FAMILLE_VIDE);
    }
    setErreursFamille({});
    setModalFamilleOuvert(true);
  }

  async function enregistrerFamille(e) {
    e.preventDefault();
    if (!formFamille.libelle.trim()) {
      setErreursFamille({ libelle: 'Le libellé de la famille est obligatoire.' });
      return;
    }

    setEnvoiFamille(true);
    try {
      const payload = {
        libelle: formFamille.libelle,
        id_categorie: formFamille.id_categorie || null
      };
      if (familleEnEdition) {
        await client.put(`/referentiels/articles/familles/${familleEnEdition}`, payload);
        await notifierSucces('Famille modifiée avec succès.');
      } else {
        await client.post('/referentiels/articles/familles', payload);
        await notifierSucces('Nouvelle famille créée.');
      }
      setModalFamilleOuvert(false);
      await chargerDonnees();
    } catch (error) {
      notifierErreur(error.response?.data?.erreur || 'Erreur lors de l\'enregistrement de la famille.');
    } finally {
      setEnvoiFamille(false);
    }
  }

  // -------------------------------------------------------------
  // GESTION DES CATEGORIES
  // -------------------------------------------------------------
  function ouvrirModalCategorie(categorie = null) {
    if (categorie) {
      setCategorieEnEdition(categorie.id_categorie);
      setFormCategorie({ libelle: categorie.libelle });
    } else {
      setCategorieEnEdition(null);
      setFormCategorie(CATEGORIE_VIDE);
    }
    setErreursCategorie({});
    setModalCategorieOuvert(true);
  }

  async function enregistrerCategorie(e) {
    e.preventDefault();
    if (!formCategorie.libelle.trim()) {
      setErreursCategorie({ libelle: 'Le libellé de la catégorie est obligatoire.' });
      return;
    }

    setEnvoiCategorie(true);
    try {
      if (categorieEnEdition) {
        await client.put(`/referentiels/articles/categories/${categorieEnEdition}`, formCategorie);
        await notifierSucces('Catégorie modifiée avec succès.');
      } else {
        await client.post('/referentiels/articles/categories', formCategorie);
        await notifierSucces('Nouvelle catégorie créée.');
      }
      setModalCategorieOuvert(false);
      await chargerDonnees();
    } catch (error) {
      notifierErreur(error.response?.data?.erreur || 'Erreur lors de l\'enregistrement de la catégorie.');
    } finally {
      setEnvoiCategorie(false);
    }
  }

  // Calculs en direct pour la modale article (Signature Obat)
  const calculArticleLive = useMemo(() => {
    if (form.mode_prix === 'PRESTATION') {
      const ht = Number(form.prix_unitaire) || 0;
      const tva = ht * (Number(form.taux_tva || 19) / 100);
      return { fourniture: 0, pose: 0, totalHT: ht, totalTVA: tva, totalTTC: ht + tva };
    }
    const fourniture = Number(form.prix_fourniture) || 0;
    const pose = Number(form.prix_pose) || 0;
    const ht = fourniture + pose;
    const tva = ht * (Number(form.taux_tva || 19) / 100);
    return { fourniture, pose, totalHT: ht, totalTVA: tva, totalTTC: ht + tva };
  }, [form]);

  // Calculs en direct pour la modale tarif
  const calculTarifLive = useMemo(() => {
    if (formTarif.mode_prix === 'PRESTATION') {
      const ht = Number(formTarif.prix_unitaire) || 0;
      const tva = ht * (Number(formTarif.taux_tva || 19) / 100);
      return { fourniture: 0, pose: 0, totalHT: ht, totalTVA: tva, totalTTC: ht + tva };
    }
    const fourniture = Number(formTarif.prix_fourniture) || 0;
    const pose = Number(formTarif.prix_pose) || 0;
    const ht = fourniture + pose;
    const tva = ht * (Number(formTarif.taux_tva || 19) / 100);
    return { fourniture, pose, totalHT: ht, totalTVA: tva, totalTTC: ht + tva };
  }, [formTarif]);

  if (agent.role !== 'admin') {
    return (
      <div className="obat-articles-wrapper">
        <Breadcrumbs items={[{ label: 'Tableau de bord', path: '/' }, { label: 'Articles de devis' }]} />
        <div className="obat-card-block" style={{ padding: 32, textAlign: 'center', maxWidth: 600, margin: '40px auto' }}>
          <h2>Accès restreint</h2>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 8 }}>
            Seuls les administrateurs de l'ADE sont habilités à modifier le référentiel des articles et tarifs de chiffrage.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="obat-articles-wrapper">
      <Breadcrumbs items={[{ label: 'Tableau de bord', path: '/', icon: '⌂' }, { label: 'Bibliothèque d’articles' }]} />

      {/* 1. EN-TÊTE DE LA BIBLIOTHÈQUE (STYLE OBAT) */}
      <header className="obat-articles-header">
        <div className="obat-articles-title-block">
          <span>ADE</span>
          <h1>Bibliothèque d'Articles & Tarifs</h1>
          <p className="obat-articles-subtitle">
            Gérez les fournitures, canalisations, robinetteries, compteurs et prestations de main d’œuvre utilisés dans les devis.
          </p>
        </div>

        <div className="obat-articles-header-actions">
          <button
            type="button"
            className="obat-btn-secondary"
            onClick={() => ouvrirModalFamille(null)}
          >
            📁 + Nouvelle famille
          </button>
          <button
            type="button"
            className="obat-btn-primary"
            onClick={() => {
              setForm(FORMULAIRE_VIDE);
              setErreurs({});
              setModalNouvelArticleOuvert(true);
            }}
          >
            ✨ + Nouvel article
          </button>
        </div>
      </header>

      {/* 2. STATISTIQUES GLOBALES */}
      <div className="obat-stats-grid">
        <div className="obat-stat-card">
          <div className="obat-stat-icon blue">📦</div>
          <div>
            <div className="obat-stat-val">{totalArticles}</div>
            <div className="obat-stat-lbl">Articles au catalogue</div>
          </div>
        </div>

        <div className="obat-stat-card">
          <div className="obat-stat-icon green">📁</div>
          <div>
            <div className="obat-stat-val">{familles.length}</div>
            <div className="obat-stat-lbl">Familles de matériels</div>
          </div>
        </div>

        <div className="obat-stat-card">
          <div className="obat-stat-icon purple">🗂️</div>
          <div>
            <div className="obat-stat-val">{categories.length}</div>
            <div className="obat-stat-lbl">Catégories</div>
          </div>
        </div>

        <div className="obat-stat-card">
          <div className="obat-stat-icon amber">⚡</div>
          <div>
            <div className="obat-stat-val">{totalPrestations}</div>
            <div className="obat-stat-lbl">Prestations & Essais</div>
          </div>
        </div>
      </div>

      {/* 3. BARRE DE RECHERCHE ET FILTRES */}
      <div className="obat-filter-panel">
        <div className="obat-search-row">
          <div className="obat-search-input-wrap">
            <span className="obat-search-icon">🔍</span>
            <input
              type="text"
              className="obat-search-input"
              placeholder="Rechercher par désignation, code article, matière (PEHD, PVC), couleur…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
            />
          </div>

          <select
            className="obat-mode-select"
            value={filtreCategorie}
            onChange={(e) => {
              setFiltreCategorie(e.target.value);
              setFiltreFamille('TOUS'); // reset famille when category changes
            }}
          >
            <option value="TOUS">Toutes les catégories</option>
            {categories.map((cat) => (
              <option key={cat.id_categorie} value={cat.id_categorie}>{cat.libelle}</option>
            ))}
          </select>

          <select
            className="obat-mode-select"
            value={filtreMode}
            onChange={(e) => setFiltreMode(e.target.value)}
          >
            <option value="TOUS">Tous les modes de prix</option>
            <option value="FOURNITURE_POSE">Fourniture + Pose</option>
            <option value="PRESTATION">Prestation unique</option>
          </select>
        </div>

        {/* Pilules de familles d'articles */}
        <div className="obat-tags-row">
          <button
            type="button"
            className={`obat-tag-pill ${filtreFamille === 'TOUS' ? 'active' : ''}`}
            onClick={() => setFiltreFamille('TOUS')}
          >
            Toutes les familles
            <span className="obat-tag-count">{articlesFiltres.length}</span>
          </button>
          {familles
            .filter((fam) => filtreCategorie === 'TOUS' || fam.id_categorie === Number(filtreCategorie))
            .map((fam) => {
              const countFamille = tousLesArticles.filter((a) => a.codeFamille === fam.code_famille).length;
              return (
                <button
                  key={fam.id_famille}
                  type="button"
                  className={`obat-tag-pill ${filtreFamille === fam.code_famille ? 'active' : ''}`}
                  onClick={() => setFiltreFamille(fam.code_famille)}
                >
                  {fam.libelle}
                  <span className="obat-tag-count">{countFamille}</span>
                </button>
              );
            })}
        </div>
      </div>

      {/* 4. ONGLETS PRINCIPAUX */}
      <div className="obat-main-tabs">
        <button
          type="button"
          className={`obat-main-tab ${ongletPrincipal === 'catalogue' ? 'active' : ''}`}
          onClick={() => setOngletPrincipal('catalogue')}
        >
          📦 Catalogue des articles ({articlesFiltres.length})
        </button>
        <button
          type="button"
          className={`obat-main-tab ${ongletPrincipal === 'familles' ? 'active' : ''}`}
          onClick={() => setOngletPrincipal('familles')}
        >
          📁 Familles & Catégories ({familles.length})
        </button>
      </div>

      {/* 5. VUE CATALOGUE D'ARTICLES */}
      {ongletPrincipal === 'catalogue' && (
        <>
          {articlesFiltres.length === 0 ? (
            <div className="obat-card-block" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
              <h3>Aucun article ne correspond à votre recherche</h3>
              <p style={{ fontSize: 13 }}>Essayez de modifier votre mot-clé ou réinitialisez les filtres.</p>
              <button
                type="button"
                className="obat-btn-secondary"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setRecherche('');
                  setFiltreFamille('TOUS');
                  setFiltreCategorie('TOUS');
                  setFiltreMode('TOUS');
                }}
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            articlesParFamilleAffiches.map((groupe) => (
              <div key={groupe.code} className="obat-card-block">
                <div className="obat-card-header">
                  <div className="obat-card-title">
                    <span>📁</span> {groupe.libelle}
                    {groupe.libelleCategorie && (
                      <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'var(--color-primary-selection)', borderRadius: 4, padding: '2px 7px' }}>
                        🗂️ {groupe.libelleCategorie}
                      </span>
                    )}
                  </div>
                  <span>{groupe.articles.length} articles</span>
                </div>

                <div className="tableau-responsive">
                  <table className="obat-articles-table">
                    <thead>
                      <tr>
                        <th style={{ width: 110 }}>Code</th>
                        <th>Désignation & Caractéristiques</th>
                        <th className="center" style={{ width: 70 }}>Unité</th>
                        <th className="center" style={{ width: 140 }}>Type</th>
                        <th className="right" style={{ width: 120 }}>Fourniture HT</th>
                        <th className="right" style={{ width: 120 }}>Pose HT</th>
                        <th className="right" style={{ width: 130 }}>Total Net HT</th>
                        <th className="right" style={{ width: 130 }}>TTC (19%)</th>
                        <th className="center" style={{ width: 130 }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupe.articles.map((art) => {
                        const enEdition = articleEnEditionCode === art.code;
                        const estPrestation = art.modePrix === 'PRESTATION';

                        let fournitureAffichee = Number(art.prixFourniture || 0);
                        let poseAffichee = Number(art.prixPose || 0);
                        let prixHTAffiche = estPrestation ? Number(art.prix || 0) : fournitureAffichee + poseAffichee;
                        let tauxTva = Number(art.tauxTva || 19);

                        if (enEdition && formInlineTarif) {
                          if (estPrestation) {
                            prixHTAffiche = Number(formInlineTarif.prix_unitaire) || 0;
                          } else {
                            fournitureAffichee = Number(formInlineTarif.prix_fourniture) || 0;
                            poseAffichee = Number(formInlineTarif.prix_pose) || 0;
                            prixHTAffiche = fournitureAffichee + poseAffichee;
                          }
                        }

                        const prixTTCAffiche = prixHTAffiche * (1 + (tauxTva / 100));

                        return (
                          <tr key={art.code} className={enEdition ? 'obat-row-editing' : ''}>
                            <td>
                              <span>{art.code}</span>
                            </td>
                            <td className="obat-article-desc-cell">
                              {enEdition && formInlineTarif ? (
                                <div className="obat-inline-desc-editor">
                                  <input
                                    type="text"
                                    className="obat-inline-text-input"
                                    value={formInlineTarif.libelle}
                                    onChange={(e) =>
                                      setFormInlineTarif({
                                        ...formInlineTarif,
                                        libelle: e.target.value
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') enregistrerTarifInline(art);
                                      if (e.key === 'Escape') annulerEditionInline();
                                    }}
                                    placeholder="Désignation de l’article *"
                                    title="Désignation de l’article"
                                    autoFocus
                                  />
                                  <div className="obat-inline-caracts-row">
                                    <input
                                      type="text"
                                      className="obat-inline-subinput"
                                      value={formInlineTarif.matiere}
                                      onChange={(e) =>
                                        setFormInlineTarif({
                                          ...formInlineTarif,
                                          matiere: e.target.value
                                        })
                                      }
                                      placeholder="Matière"
                                      title="Matière (ex: PEHD, Fonte, Laiton...)"
                                    />
                                    <input
                                      type="text"
                                      className="obat-inline-subinput"
                                      value={formInlineTarif.couleur}
                                      onChange={(e) =>
                                        setFormInlineTarif({
                                          ...formInlineTarif,
                                          couleur: e.target.value
                                        })
                                      }
                                      placeholder="Couleur"
                                      title="Couleur (ex: Bleu, Noir...)"
                                    />
                                    <label className="obat-inline-checkbox-label" title="Diamètre sélectionnable lors du chiffrage de devis">
                                      <input
                                        type="checkbox"
                                        checked={formInlineTarif.avec_diametre}
                                        onChange={(e) =>
                                          setFormInlineTarif({
                                            ...formInlineTarif,
                                            avec_diametre: e.target.checked
                                          })
                                        }
                                      />
                                      <span>Ø sélec.</span>
                                    </label>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <strong>{art.libelle}</strong>
                                  <div className="obat-article-submeta">
                                    {art.matiere && <span>Matière : {art.matiere}</span>}
                                    {art.couleur && <span>Couleur : {art.couleur}</span>}
                                    {art.avecDiametre && <span>Diamètre sélectionnable</span>}
                                  </div>
                                </>
                              )}
                            </td>
                            <td className="center">
                              {enEdition && formInlineTarif ? (
                                <select
                                  className="obat-inline-select"
                                  value={formInlineTarif.unite}
                                  onChange={(e) =>
                                    setFormInlineTarif({
                                      ...formInlineTarif,
                                      unite: e.target.value
                                    })
                                  }
                                  title="Unité de mesure"
                                >
                                  {['U', 'ML', 'M²', 'M3', 'KG', 'H', 'FF', 'ENS'].map((u) => (
                                    <option key={u} value={u}>{u}</option>
                                  ))}
                                </select>
                              ) : (
                                <span>{art.unite}</span>
                              )}
                            </td>
                            <td className="center">
                              <span>
                                {estPrestation ? 'Prestation' : 'Fourniture + Pose'}
                              </span>
                            </td>
                            <td className="right obat-price-cell">
                              {estPrestation ? (
                                '—'
                              ) : enEdition ? (
                                <div className="obat-inline-input-wrapper">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="obat-inline-input"
                                    value={formInlineTarif.prix_fourniture}
                                    onChange={(e) =>
                                      setFormInlineTarif({
                                        ...formInlineTarif,
                                        prix_fourniture: e.target.value
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') enregistrerTarifInline(art);
                                      if (e.key === 'Escape') annulerEditionInline();
                                    }}
                                    autoFocus
                                    title="Prix Fourniture HT"
                                  />
                                  <span className="obat-inline-unit">DA</span>
                                </div>
                              ) : (
                                `${formaterNombre(fournitureAffichee)} DA`
                              )}
                            </td>
                            <td className="right obat-price-cell">
                              {estPrestation ? (
                                '—'
                              ) : enEdition ? (
                                <div className="obat-inline-input-wrapper">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="obat-inline-input"
                                    value={formInlineTarif.prix_pose}
                                    onChange={(e) =>
                                      setFormInlineTarif({
                                        ...formInlineTarif,
                                        prix_pose: e.target.value
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') enregistrerTarifInline(art);
                                      if (e.key === 'Escape') annulerEditionInline();
                                    }}
                                    title="Prix Pose HT"
                                  />
                                  <span className="obat-inline-unit">DA</span>
                                </div>
                              ) : (
                                `${formaterNombre(poseAffichee)} DA`
                              )}
                            </td>
                            <td className="right obat-price-total">
                              {estPrestation && enEdition ? (
                                <div className="obat-inline-input-wrapper">
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    className="obat-inline-input"
                                    value={formInlineTarif.prix_unitaire}
                                    onChange={(e) =>
                                      setFormInlineTarif({
                                        ...formInlineTarif,
                                        prix_unitaire: e.target.value
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') enregistrerTarifInline(art);
                                      if (e.key === 'Escape') annulerEditionInline();
                                    }}
                                    autoFocus
                                    title="Prix Prestation HT"
                                  />
                                  <span className="obat-inline-unit">DA</span>
                                </div>
                              ) : (
                                `${formaterNombre(prixHTAffiche)} DA`
                              )}
                            </td>
                            <td className="right obat-price-cell" style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                              {formaterNombre(prixTTCAffiche)} DA
                            </td>
                            <td className="center">
                              {enEdition ? (
                                <div className="obat-actions-inline-group">
                                  <button
                                    type="button"
                                    className="obat-btn-action-icon obat-btn-save"
                                    onClick={() => enregistrerTarifInline(art)}
                                    disabled={envoiInlineTarif}
                                    title="Enregistrer (applicable dès la date de modification)"
                                    aria-label="Enregistrer le tarif"
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
                                  <button
                                    type="button"
                                    className="obat-btn-action-icon obat-btn-cancel"
                                    onClick={annulerEditionInline}
                                    disabled={envoiInlineTarif}
                                    title="Annuler"
                                    aria-label="Annuler la modification"
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
                                      <line x1="18" y1="6" x2="6" y2="18" />
                                      <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="obat-btn-action-icon"
                                  onClick={() => demarrerEditionInline(art)}
                                  title="Modifier le tarif directement dans le tableau"
                                  aria-label={`Modifier le tarif de ${art.libelle}`}
                                >
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                  </svg>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* 6. VUE GESTION DES FAMILLES & CATEGORIES */}
      {ongletPrincipal === 'familles' && (
        <>
          {/* Section Catégories */}
          <div className="obat-card-block">
            <div className="obat-card-header">
              <div className="obat-card-title">
                <span>🗂️</span> Catégories d'articles ({categories.length})
              </div>
              <button
                type="button"
                className="obat-btn-primary"
                onClick={() => ouvrirModalCategorie(null)}
              >
                + Ajouter une catégorie
              </button>
            </div>

            <table className="obat-articles-table">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Code</th>
                  <th>Libellé de la catégorie</th>
                  <th className="center" style={{ width: 140 }}>Familles associées</th>
                  <th className="center" style={{ width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>
                      Aucune catégorie enregistrée.
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => {
                    const countFam = familles.filter((f) => f.id_categorie === cat.id_categorie).length;
                    return (
                      <tr
                        key={cat.id_categorie}
                        className={categorieSelectionnee === cat.id_categorie ? 'obat-category-row-selected' : 'obat-category-row'}
                        onClick={() => setCategorieSelectionnee((ancienne) => (
                          ancienne === cat.id_categorie ? null : cat.id_categorie
                        ))}
                      >
                        <td><span>{cat.code_categorie}</span></td>
                        <td><strong>{cat.libelle}</strong></td>
                        <td className="center"><span>{countFam} famille(s)</span></td>
                        <td className="center">
                          <button
                            type="button"
                            className="obat-btn-action-icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              ouvrirModalCategorie(cat);
                            }}
                            title="Modifier le libellé de la catégorie"
                            aria-label={`Modifier la catégorie ${cat.libelle}`}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Section Familles */}
          <div className="obat-card-block">
            <div className="obat-card-header">
              <div className="obat-card-title">
                <span>📁</span> {categorieSelectionnee
                  ? `Familles de la catégorie (${familles.filter((fam) => fam.id_categorie === categorieSelectionnee).length})`
                  : `Familles d'articles (${familles.length})`}
              </div>
              <div className="obat-articles-header-actions">
                {categorieSelectionnee && (
                  <button
                    type="button"
                    className="obat-btn-secondary"
                    onClick={() => setCategorieSelectionnee(null)}
                  >
                    Toutes les familles
                  </button>
                )}
                <button
                  type="button"
                  className="obat-btn-primary"
                  onClick={() => ouvrirModalFamille(null)}
                >
                  + Ajouter une famille
                </button>
              </div>
            </div>

            <table className="obat-articles-table">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Code Famille</th>
                  <th>Libellé de la famille</th>
                  <th style={{ width: 180 }}>Catégorie</th>
                  <th className="center" style={{ width: 140 }}>Articles associés</th>
                  <th className="center" style={{ width: 90 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {familles.filter((fam) => !categorieSelectionnee || fam.id_categorie === categorieSelectionnee).length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 24 }}>
                      {categorieSelectionnee ? 'Aucune famille associée à cette catégorie.' : 'Aucune famille enregistrée.'}
                    </td>
                  </tr>
                ) : (
                  familles.filter((fam) => !categorieSelectionnee || fam.id_categorie === categorieSelectionnee).map((fam) => {
                    const count = tousLesArticles.filter((a) => a.codeFamille === fam.code_famille).length;
                    return (
                      <tr
                        key={fam.id_famille}
                        className={filtreFamille === fam.code_famille ? 'obat-family-row-selected' : 'obat-family-row'}
                        onClick={() => {
                          setFiltreFamille(fam.code_famille);
                          setFiltreCategorie('TOUS');
                          setFiltreMode('TOUS');
                          setRecherche('');
                          setOngletPrincipal('catalogue');
                        }}
                      >
                        <td><span>{fam.code_famille}</span></td>
                        <td><strong>{fam.libelle}</strong></td>
                        <td>
                          {fam.libelle_categorie
                            ? <span style={{ fontSize: 12, color: 'var(--color-primary)', background: 'var(--color-primary-selection)', borderRadius: 4, padding: '2px 7px', fontWeight: 500 }}>🗂️ {fam.libelle_categorie}</span>
                            : <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>— Non classée</span>
                          }
                        </td>
                        <td className="center"><span>{count} article(s)</span></td>
                        <td className="center">
                          <button
                            type="button"
                            className="obat-btn-action-icon"
                            onClick={(event) => {
                              event.stopPropagation();
                              ouvrirModalFamille(fam);
                            }}
                            title="Modifier la famille"
                            aria-label={`Modifier la famille ${fam.libelle}`}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* -------------------------------------------------------------
          7. MODALE NOUVEL ARTICLE (STYLE OBAT AVEC CALCUL EN DIRECT)
          ------------------------------------------------------------- */}
      {modalNouvelArticleOuvert && (
        <div className="obat-modal-overlay" onClick={() => setModalNouvelArticleOuvert(false)}>
          <div className="obat-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="obat-modal-header">
              <h3>✨ Ajouter un nouvel article au référentiel</h3>
              <button
                type="button"
                className="obat-btn-close-sm"
                onClick={() => setModalNouvelArticleOuvert(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={enregistrerArticle} noValidate>
              <div className="obat-modal-body">
                <div className="obat-form-grid-2">
                  <div className="obat-form-group">
                    <label>Famille d'articles *</label>
                    <select
                      value={form.id_famille}
                      onChange={(e) => modifier('id_famille', e.target.value)}
                    >
                      <option value="">Sélectionner une famille...</option>
                      {familles.map((f) => (
                        <option key={f.id_famille} value={f.id_famille}>
                          {f.libelle}
                        </option>
                      ))}
                    </select>
                    {erreurs.id_famille && <span className="obat-field-error">{erreurs.id_famille}</span>}
                  </div>

                  <div className="obat-form-group">
                    <label>Unité de mesure *</label>
                    <select
                      value={form.unite}
                      onChange={(e) => modifier('unite', e.target.value)}
                    >
                      {UNITES.map((u) => (
                        <option key={u.code} value={u.code}>
                          {u.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="obat-form-group">
                  <label>Désignation complète de l'article *</label>
                  <input
                    type="text"
                    placeholder="Ex. Tube PEHD PN16 Ø25 mm bandes bleues AEP"
                    value={form.libelle}
                    onChange={(e) => modifier('libelle', e.target.value)}
                  />
                  {erreurs.libelle && <span className="obat-field-error">{erreurs.libelle}</span>}
                </div>

                <div className="obat-form-grid-2">
                  <div className="obat-form-group">
                    <label>Matière (optionnel)</label>
                    <input
                      type="text"
                      placeholder="Ex. PEHD 100, Laiton, Fonte"
                      value={form.matiere}
                      onChange={(e) => modifier('matiere', e.target.value)}
                    />
                  </div>

                  <div className="obat-form-group">
                    <label>Couleur (optionnel)</label>
                    <input
                      type="text"
                      placeholder="Ex. Noir bandes bleues"
                      value={form.couleur}
                      onChange={(e) => modifier('couleur', e.target.value)}
                    />
                  </div>
                </div>

                {/* Sélecteur de mode de prix Obat */}
                <div style={{ margin: '12px 0 16px' }}>
                  <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 8, color: 'var(--color-text)' }}>
                    Structure de tarification :
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 6,
                        border: form.mode_prix === 'FOURNITURE_POSE' ? '2px solid #1991EB' : '1px solid #CBD5E1',
                        background: form.mode_prix === 'FOURNITURE_POSE' ? '#EFF6FF' : '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 600
                      }}
                    >
                      <input
                        type="radio"
                        name="mode_prix"
                        checked={form.mode_prix === 'FOURNITURE_POSE'}
                        onChange={() => modifier('mode_prix', 'FOURNITURE_POSE')}
                      />
                      Fourniture + Pose (BTP/Travaux)
                    </label>

                    <label
                      style={{
                        flex: 1,
                        padding: '10px 14px',
                        borderRadius: 6,
                        border: form.mode_prix === 'PRESTATION' ? '2px solid #1991EB' : '1px solid #CBD5E1',
                        background: form.mode_prix === 'PRESTATION' ? '#EFF6FF' : '#FFFFFF',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 13,
                        fontWeight: 600
                      }}
                    >
                      <input
                        type="radio"
                        name="mode_prix"
                        checked={form.mode_prix === 'PRESTATION'}
                        onChange={() => modifier('mode_prix', 'PRESTATION')}
                      />
                      Prestation unique / Forfait
                    </label>
                  </div>
                </div>

                {/* Saisie des montants */}
                {form.mode_prix === 'FOURNITURE_POSE' ? (
                  <div className="obat-form-grid-2">
                    <div className="obat-form-group">
                      <label>Prix de fourniture HT (DA) *</label>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        placeholder="Ex: 450"
                        value={form.prix_fourniture}
                        onChange={(e) => modifier('prix_fourniture', e.target.value)}
                      />
                      {erreurs.prix_fourniture && <span className="obat-field-error">{erreurs.prix_fourniture}</span>}
                    </div>

                    <div className="obat-form-group">
                      <label>Prix de pose HT (DA) *</label>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        placeholder="Ex: 250"
                        value={form.prix_pose}
                        onChange={(e) => modifier('prix_pose', e.target.value)}
                      />
                      {erreurs.prix_pose && <span className="obat-field-error">{erreurs.prix_pose}</span>}
                    </div>
                  </div>
                ) : (
                  <div className="obat-form-group">
                    <label>Prix de prestation HT (DA) *</label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      placeholder="Ex: 5000"
                      value={form.prix_unitaire}
                      onChange={(e) => modifier('prix_unitaire', e.target.value)}
                    />
                    {erreurs.prix_unitaire && <span className="obat-field-error">{erreurs.prix_unitaire}</span>}
                  </div>
                )}

                <div className="obat-form-grid-2">
                  <div className="obat-form-group">
                    <label>Régime TVA appliqué</label>
                    <input
                      type="text"
                      disabled
                      value={form.mode_prix === 'PRESTATION' ? 'TVA Prestation (19%)' : 'TVA Travaux (19%)'}
                      style={{ background: 'var(--color-surface-sunken)', color: 'var(--color-text-muted)' }}
                    />
                  </div>

                  <div className="obat-form-group">
                    <label>Taux de TVA (%)</label>
                    <input
                      type="number"
                      value={form.taux_tva}
                      onChange={(e) => modifier('taux_tva', e.target.value)}
                    />
                  </div>
                </div>

                {/* Encadré de simulation live du prix de vente Obat */}
                <div className="obat-live-price-box">
                  <div className="obat-live-price-header">SIMULATION DU CHIFFRAGE DANS LE DEVIS</div>
                  {form.mode_prix === 'FOURNITURE_POSE' && (
                    <>
                      <div className="obat-live-price-row">
                        <span>Fourniture unitaire :</span>
                        <strong>{formaterNombre(calculArticleLive.fourniture)} DA HT</strong>
                      </div>
                      <div className="obat-live-price-row">
                        <span>Pose unitaire :</span>
                        <strong>{formaterNombre(calculArticleLive.pose)} DA HT</strong>
                      </div>
                    </>
                  )}
                  <div className="obat-live-price-row">
                    <span>Total Net HT unitaire :</span>
                    <strong>{formaterNombre(calculArticleLive.totalHT)} DA HT</strong>
                  </div>
                  <div className="obat-live-price-row">
                    <span>TVA ({form.taux_tva || 19}%) :</span>
                    <strong>{formaterNombre(calculArticleLive.totalTVA)} DA</strong>
                  </div>

                  <div className="obat-live-price-total-banner">
                    <span>PRIX DE VENTE TTC</span>
                    <span className="amount">{formaterNombre(calculArticleLive.totalTTC)} DA TTC</span>
                  </div>
                </div>
              </div>

              <div className="obat-modal-footer">
                <button
                  type="button"
                  className="obat-btn-secondary"
                  onClick={() => setModalNouvelArticleOuvert(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="obat-btn-primary"
                  disabled={envoi}
                >
                  {envoi ? 'Création en cours…' : '✓ Enregistrer l’article'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          8. MODALE MODIFIER LE TARIF (STYLE OBAT)
          ------------------------------------------------------------- */}
      {modalTarifOuvert && tarifEnEdition && (
        <div className="obat-modal-overlay" onClick={() => setModalTarifOuvert(false)}>
          <div className="obat-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="obat-modal-header">
              <div>
                <span>{tarifEnEdition.code}</span>
                <h3 style={{ marginTop: 4 }}>Modifier le tarif de l'article</h3>
              </div>
              <button
                type="button"
                className="obat-btn-close-sm"
                onClick={() => setModalTarifOuvert(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={enregistrerTarif} noValidate>
              <div className="obat-modal-body">
                <p style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--color-text-muted)' }}>
                  <strong>{tarifEnEdition.libelle}</strong>
                </p>

                <div className="obat-form-grid-2">
                  <div className="obat-form-group">
                    <label>Structure de prix</label>
                    <select
                      value={formTarif.mode_prix}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormTarif((ancien) => ({
                          ...ancien,
                          mode_prix: val,
                          prix_unitaire: val === 'PRESTATION' ? ancien.prix_unitaire : '',
                          prix_fourniture: val === 'FOURNITURE_POSE' ? ancien.prix_fourniture : '',
                          prix_pose: val === 'FOURNITURE_POSE' ? ancien.prix_pose : ''
                        }));
                      }}
                    >
                      <option value="FOURNITURE_POSE">Fourniture + Pose</option>
                      <option value="PRESTATION">Prestation unique</option>
                    </select>
                  </div>

                  <div className="obat-form-group">
                    <label>Applicable à compter du *</label>
                    <input
                      type="date"
                      value={formTarif.date_debut}
                      onChange={(e) => setFormTarif({ ...formTarif, date_debut: e.target.value })}
                    />
                  </div>
                </div>

                {formTarif.mode_prix === 'FOURNITURE_POSE' ? (
                  <div className="obat-form-grid-2">
                    <div className="obat-form-group">
                      <label>Nouveau prix Fourniture HT (DA) *</label>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={formTarif.prix_fourniture}
                        onChange={(e) => setFormTarif({ ...formTarif, prix_fourniture: e.target.value })}
                      />
                      {erreursTarif.prix_fourniture && (
                        <span className="obat-field-error">{erreursTarif.prix_fourniture}</span>
                      )}
                    </div>

                    <div className="obat-form-group">
                      <label>Nouveau prix Pose HT (DA) *</label>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={formTarif.prix_pose}
                        onChange={(e) => setFormTarif({ ...formTarif, prix_pose: e.target.value })}
                      />
                      {erreursTarif.prix_pose && (
                        <span className="obat-field-error">{erreursTarif.prix_pose}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="obat-form-group">
                    <label>Nouveau prix Prestation HT (DA) *</label>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={formTarif.prix_unitaire}
                      onChange={(e) => setFormTarif({ ...formTarif, prix_unitaire: e.target.value })}
                    />
                    {erreursTarif.prix_unitaire && (
                      <span className="obat-field-error">{erreursTarif.prix_unitaire}</span>
                    )}
                  </div>
                )}

                <div className="obat-form-group">
                  <label>Taux de TVA (%)</label>
                  <input
                    type="number"
                    value={formTarif.taux_tva}
                    onChange={(e) => setFormTarif({ ...formTarif, taux_tva: e.target.value })}
                  />
                </div>

                {/* Live simulation */}
                <div className="obat-live-price-box">
                  <div className="obat-live-price-header">NOUVEAU MONTANT D'APPLICATION</div>
                  <div className="obat-live-price-row">
                    <span>Nouveau Net HT :</span>
                    <strong>{formaterNombre(calculTarifLive.totalHT)} DA HT</strong>
                  </div>
                  <div className="obat-live-price-row">
                    <span>TVA calculée :</span>
                    <strong>{formaterNombre(calculTarifLive.totalTVA)} DA</strong>
                  </div>
                  <div className="obat-live-price-total-banner">
                    <span>NOUVEAU TOTAL TTC</span>
                    <span className="amount">{formaterNombre(calculTarifLive.totalTTC)} DA TTC</span>
                  </div>
                </div>
              </div>

              <div className="obat-modal-footer">
                <button
                  type="button"
                  className="obat-btn-secondary"
                  onClick={() => setModalTarifOuvert(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="obat-btn-primary"
                  disabled={envoiTarif}
                >
                  {envoiTarif ? 'Application…' : '✓ Appliquer le tarif'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          9. MODALE FAMILLE (AJOUT / MODIFICATION)
          ------------------------------------------------------------- */}
      {modalFamilleOuvert && (
        <div className="obat-modal-overlay" onClick={() => setModalFamilleOuvert(false)}>
          <div className="obat-modal-card" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="obat-modal-header">
              <h3>{familleEnEdition ? 'Modifier la famille' : 'Créer une nouvelle famille'}</h3>
              <button
                type="button"
                className="obat-btn-close-sm"
                onClick={() => setModalFamilleOuvert(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={enregistrerFamille} noValidate>
              <div className="obat-modal-body">
                <div className="obat-form-group">
                  <label>Catégorie *</label>
                  <select
                    value={formFamille.id_categorie}
                    onChange={(e) => setFormFamille({ ...formFamille, id_categorie: e.target.value })}
                  >
                    <option value="">— Sans catégorie —</option>
                    {categories.map((cat) => (
                      <option key={cat.id_categorie} value={cat.id_categorie}>{cat.libelle}</option>
                    ))}
                  </select>
                </div>
                <div className="obat-form-group">
                  <label>Libellé de la famille d'articles *</label>
                  <input
                    type="text"
                    placeholder="Ex. Tuyauterie & Raccords PEHD"
                    value={formFamille.libelle}
                    onChange={(e) => setFormFamille({ ...formFamille, libelle: e.target.value })}
                    maxLength={100}
                    autoFocus
                  />
                  {erreursFamille.libelle && (
                    <span className="obat-field-error">{erreursFamille.libelle}</span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
                  Le code unique (ex: FAM-01) sera automatiquement attribué par le système.
                </p>
              </div>

              <div className="obat-modal-footer">
                <button
                  type="button"
                  className="obat-btn-secondary"
                  onClick={() => setModalFamilleOuvert(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="obat-btn-primary"
                  disabled={envoiFamille}
                >
                  {envoiFamille ? 'Enregistrement…' : '✓ Enregistrer la famille'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          10. MODALE CATEGORIE (AJOUT / MODIFICATION)
          ------------------------------------------------------------- */}
      {modalCategorieOuvert && (
        <div className="obat-modal-overlay" onClick={() => setModalCategorieOuvert(false)}>
          <div className="obat-modal-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="obat-modal-header">
              <h3>{categorieEnEdition ? 'Modifier la catégorie' : 'Créer une nouvelle catégorie'}</h3>
              <button
                type="button"
                className="obat-btn-close-sm"
                onClick={() => setModalCategorieOuvert(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={enregistrerCategorie} noValidate>
              <div className="obat-modal-body">
                <div className="obat-form-group">
                  <label>Libellé de la catégorie *</label>
                  <input
                    type="text"
                    placeholder="Ex. Canalisations & Raccords"
                    value={formCategorie.libelle}
                    onChange={(e) => setFormCategorie({ libelle: e.target.value })}
                    maxLength={100}
                    autoFocus
                  />
                  {erreursCategorie.libelle && (
                    <span className="obat-field-error">{erreursCategorie.libelle}</span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '6px 0 0' }}>
                  Le code unique (ex: CAT-1) sera automatiquement attribué par le système.
                </p>
              </div>

              <div className="obat-modal-footer">
                <button
                  type="button"
                  className="obat-btn-secondary"
                  onClick={() => setModalCategorieOuvert(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="obat-btn-primary"
                  disabled={envoiCategorie}
                >
                  {envoiCategorie ? 'Enregistrement…' : '✓ Enregistrer la catégorie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

