import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import Breadcrumbs from '../components/Breadcrumbs';
import { demanderConfirmation, notifierErreur, notifierSucces } from '../utils/notifications';
import './GestionArticles.css';

const UNITES = [
  { code: 'U', label: 'U (Unité)' },
  { code: 'ML', label: 'ML (Mètre linéaire)' },
  { code: 'M²', label: 'M² (Mètre carré)' },
  { code: 'M3', label: 'M3 (Mètre cube)' },
  { code: 'KG', label: 'KG (Kilogramme)' },
  { code: 'H', label: 'H (Heure)' },
  { code: 'FF', label: 'FF (Forfait)' },
  { code: 'ENS', label: 'ENS (Ensemble)' }
];

const FORMULAIRE_VIDE = {
  code_article: '',
  id_categorie: '',
  libelle: '',
  matiere: '',
  couleur: '',
  unite: 'U',
  mode_prix: 'FOURNITURE_POSE',
  type_article: 'FP',
  prix_unitaire: '',
  prix_fourniture: '',
  prix_pose: '',
  type_tva: 'TRAVAUX',
  taux_tva: '19'
};

const CATEGORIE_VIDE = { libelle: '' };

function dateLocaleYYYYMMDD(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formaterNombre(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('fr-DZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pagesVisibles(pageActuelle, totalPages) {
  if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (pageActuelle <= 2) return [1, 2, '...', totalPages];
  if (pageActuelle >= totalPages - 1) return [1, '...', totalPages - 1, totalPages];
  return [1, '...', pageActuelle, '...', totalPages];
}

function typeArticleDepuisTarifs(article) {
  if (article.modePrix === 'PRESTATION') return 'PR';
  const fourniture = Number(article.prixFourniture || 0);
  const pose = Number(article.prixPose || 0);
  return `${fourniture > 0 ? 'F' : ''}${pose > 0 ? 'P' : ''}` || 'FP';
}

function typeArticleDepuisFormulaire(form) {
  if (form.mode_prix === 'PRESTATION') return 'PR';
  const fourniture = Number(form.prix_fourniture) > 0;
  const pose = Number(form.prix_pose) > 0;
  if (fourniture && pose) return 'FP';
  if (fourniture) return 'F';
  if (pose) return 'P';
  return 'FP';
}

export default function GestionArticles() {
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [parametresTva, setParametresTva] = useState({ prestation: 19, travaux: 19 });

  // Recherche & Filtres (Logique Obat)
  const [recherche, setRecherche] = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState('TOUS');
  const [filtreMode, setFiltreMode] = useState('TOUS');
  const [ongletPrincipal, setOngletPrincipal] = useState('catalogue');
  const [pagesParCategorie, setPagesParCategorie] = useState({});
  const ARTICLES_PAR_PAGE = 20;

  const [modalNouvelArticleOuvert, setModalNouvelArticleOuvert] = useState(false);
  const [modalCategorieOuvert, setModalCategorieOuvert] = useState(false);
  const [categorieEnEdition, setCategorieEnEdition] = useState(null);

  const [form, setForm] = useState(FORMULAIRE_VIDE);
  const [erreurs, setErreurs] = useState({});
  const [envoi, setEnvoi] = useState(false);

  const [formCategorie, setFormCategorie] = useState(CATEGORIE_VIDE);
  const [erreursCategorie, setErreursCategorie] = useState({});
  const [envoiCategorie, setEnvoiCategorie] = useState(false);

  const agent = JSON.parse(localStorage.getItem('agent') || '{}');

  async function chargerDonnees() {
    setChargement(true);
    try {
      const [articlesResponse, categoriesResponse, tvaResponse] = await Promise.all([
        client.get('/referentiels/articles'),
        client.get('/referentiels/articles/categories'),
        client.get('/parametres/tva')
      ]);
      setArticles(articlesResponse.data || []);
      setCategories(categoriesResponse.data || []);
      setParametresTva({
        prestation: Number.isFinite(Number(tvaResponse.data?.tvaPrestation)) ? Number(tvaResponse.data.tvaPrestation) : 19,
        travaux: Number.isFinite(Number(tvaResponse.data?.tvaTravaux)) ? Number(tvaResponse.data.tvaTravaux) : 19
      });
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
    return articles.flatMap((categorie) =>
      (categorie.articles || []).map((art) => ({
        ...art,
        idCategorie: categorie.id_categorie ?? categorie.idCategorie,
        codeCategorie: categorie.code ?? categorie.code_categorie,
        libelleCategorie: categorie.libelle_categorie || categorie.libelle,
        categorieLabel: categorie.libelle_categorie || categorie.libelle
      }))
    );
  }, [articles]);

  // Statistiques Obat
  const totalArticles = tousLesArticles.length;
  const totalPrestations = tousLesArticles.filter((a) => a.modePrix === 'PRESTATION').length;

  // Filtrage dynamique des articles par catégorie et mode
  const articlesFiltres = useMemo(() => {
    return tousLesArticles.filter((art) => {
      const matchCategorie = filtreCategorie === 'TOUS' || Number(art.idCategorie) === Number(filtreCategorie);
      const matchMode = filtreMode === 'TOUS' || art.modePrix === filtreMode;
      const q = recherche.toLowerCase().trim();
      const matchTexte = !q || [
        art.libelle,
        art.code,
        art.matiere,
        art.couleur,
        art.categorieLabel,
        art.libelleCategorie
      ].some((v) => v?.toLowerCase().includes(q));

      return matchCategorie && matchMode && matchTexte;
    });
  }, [tousLesArticles, filtreCategorie, filtreMode, recherche]);

  // Regroupement par catégorie pour l'affichage du catalogue
  const articlesParCategorieAffiches = useMemo(() => {
    const map = new Map();
    articlesFiltres.forEach((art) => {
      const codeCategorie = art.codeCategorie || String(art.idCategorie || 'CAT-SANS-CATEGORIE');
      if (!map.has(codeCategorie)) {
        map.set(codeCategorie, {
          code: codeCategorie,
          libelle: art.categorieLabel || art.libelleCategorie || 'Sans catégorie',
          idCategorie: art.idCategorie,
          libelleCategorie: art.libelleCategorie || art.categorieLabel || 'Sans catégorie',
          articles: []
        });
      }
      const groupe = map.get(codeCategorie);
      groupe.articles.push(art);
    });
    return Array.from(map.values());
  }, [articlesFiltres]);

  useEffect(() => {
    setPagesParCategorie((pagesAnciens) => {
      const pagesCalcules = {};
      articlesParCategorieAffiches.forEach((groupe) => {
        const totalPagesGroupe = Math.max(1, Math.ceil(groupe.articles.length / ARTICLES_PAR_PAGE));
        const pageActuel = Number(pagesAnciens[groupe.code] || 1);
        pagesCalcules[groupe.code] = Math.min(pageActuel, totalPagesGroupe);
      });
      return pagesCalcules;
    });
  }, [articlesParCategorieAffiches]);

  useEffect(() => {
    setPagesParCategorie({});
  }, [recherche, filtreCategorie, filtreMode]);

  // -------------------------------------------------------------
  // GESTION DES ARTICLES
  // -------------------------------------------------------------
  function modifier(champ, valeur) {
    setForm((ancien) => {
      if (champ === 'mode_prix') {
        return valeur === 'PRESTATION'
          ? { ...ancien, mode_prix: valeur, type_article: 'PR', prix_fourniture: '', prix_pose: '', type_tva: 'PRESTATION', taux_tva: String(parametresTva.prestation) }
          : { ...ancien, mode_prix: valeur, type_article: 'FP', prix_unitaire: '', type_tva: 'TRAVAUX', taux_tva: String(parametresTva.travaux) };
      }
      if (champ === 'type_tva') {
        return {
          ...ancien,
          type_tva: valeur,
          taux_tva: String(valeur === 'PRESTATION' ? parametresTva.prestation : parametresTva.travaux)
        };
      }
      return { ...ancien, [champ]: valeur };
    });
    setErreurs((anciennes) => ({ ...anciennes, [champ]: undefined }));
  }

  function validerArticle() {
    const err = {};
    if (!form.id_categorie) err.id_categorie = 'Veuillez sélectionner une catégorie.';
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

  function ouvrirFormulaireModificationArticle(article) {
    setForm({
      code_article: article.code,
      id_categorie: article.id_categorie ? String(article.id_categorie) : (article.idCategorie ? String(article.idCategorie) : ''),
      libelle: article.libelle || '',
      matiere: article.matiere || '',
      couleur: article.couleur || '',
      unite: article.unite || 'U',
      mode_prix: article.modePrix || 'FOURNITURE_POSE',
      type_article: typeArticleDepuisTarifs(article),
      prix_unitaire: article.modePrix === 'PRESTATION' ? String(article.prix ?? '') : '',
      prix_fourniture: article.modePrix === 'FOURNITURE_POSE' ? String(article.prixFourniture ?? '') : '',
      prix_pose: article.modePrix === 'FOURNITURE_POSE' ? String(article.prixPose ?? '') : '',
      type_tva: article.typeTva || (article.modePrix === 'PRESTATION' ? 'PRESTATION' : 'TRAVAUX'),
      taux_tva: String(article.tauxTva ?? parametresTva.travaux)
    });
    setErreurs({});
    setModalNouvelArticleOuvert(true);
  }

  async function supprimerArticle(article) {
    const confirme = await demanderConfirmation(`Supprimer l’article « ${article.libelle} » ?`);
    if (!confirme) return;

    try {
      await client.delete(`/referentiels/articles/${encodeURIComponent(article.code)}`);
      await chargerDonnees();
      notifierSucces('Article supprimé avec succès.');
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || 'Impossible de supprimer l’article.');
    }
  }

  async function enregistrerArticle(e) {
    e.preventDefault();
    const err = validerArticle();
    setErreurs(err);
    if (Object.keys(err).length > 0) return;

    setEnvoi(true);
    try {
      if (form.code_article) {
        const payload = {
          id_categorie: Number(form.id_categorie),
          libelle: form.libelle,
          unite: form.unite,
          matiere: form.matiere,
          couleur: form.couleur,
          mode_prix: form.mode_prix,
          prix_unitaire: form.mode_prix === 'PRESTATION' ? Number(form.prix_unitaire) : (Number(form.prix_fourniture) || 0) + (Number(form.prix_pose) || 0),
          prix_fourniture: form.mode_prix === 'FOURNITURE_POSE' ? (form.prix_fourniture === '' ? null : Number(form.prix_fourniture)) : null,
          prix_pose: form.mode_prix === 'FOURNITURE_POSE' ? (form.prix_pose === '' ? null : Number(form.prix_pose)) : null,
          type_tva: form.mode_prix === 'PRESTATION' ? 'PRESTATION' : 'TRAVAUX',
          taux_tva: Number(form.taux_tva),
          date_debut: dateLocaleYYYYMMDD(),
          type_article: typeArticleDepuisFormulaire(form)
        };

        await client.put(`/referentiels/articles/${encodeURIComponent(form.code_article)}`, payload);
        await chargerDonnees();
        setModalNouvelArticleOuvert(false);
        setForm({ ...FORMULAIRE_VIDE, taux_tva: String(parametresTva.travaux) });
        await notifierSucces('Article mis à jour avec succès dans la bibliothèque !');
      } else {
        await client.post('/referentiels/articles', {
          ...form,
          type_tva: form.mode_prix === 'PRESTATION' ? 'PRESTATION' : 'TRAVAUX'
        });
        await chargerDonnees();
        setModalNouvelArticleOuvert(false);
        setForm({ ...FORMULAIRE_VIDE, taux_tva: String(parametresTva.travaux) });
        await notifierSucces('Article ajouté avec succès à la bibliothèque !');
      }
    } catch (error) {
      notifierErreur(error.response?.data?.erreur || (form.code_article ? 'Erreur lors de la mise à jour de l’article.' : 'Erreur lors de la création de l’article.'));
    } finally {
      setEnvoi(false);
    }
  }

  // -------------------------------------------------------------
  // GESTION DES CATÉGORIES
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

  async function supprimerCategorie(categorie) {
    const confirme = await demanderConfirmation(`Supprimer la catégorie « ${categorie.libelle} » ?`);
    if (!confirme) return;

    try {
      await client.delete(`/referentiels/articles/categories/${categorie.id_categorie}`);
      await chargerDonnees();
      await notifierSucces('Catégorie supprimée avec succès.');
    } catch (error) {
      notifierErreur(error.response?.data?.erreur || 'Erreur lors de la suppression de la catégorie.');
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
      <Breadcrumbs items={[{ label: 'Tableau de bord', path: '/' }, { label: 'Bibliothèque d’articles' }]} />

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
            className="obat-btn-primary"
            onClick={() => {
              setForm({ ...FORMULAIRE_VIDE, code_article: '', taux_tva: String(parametresTva.travaux) });
              setErreurs({});
              setModalNouvelArticleOuvert(true);
            }}
          >
            + Nouvel article
          </button>
        </div>
      </header>

      {/* 2. STATISTIQUES GLOBALES */}
      <div className="obat-stats-grid">
        <div className="obat-stat-card">
          <div className="obat-stat-icon blue" />
          <div>
            <div className="obat-stat-val">{totalArticles}</div>
            <div className="obat-stat-lbl">Articles au catalogue</div>
          </div>
        </div>

        <div className="obat-stat-card">
          <div className="obat-stat-icon purple" />
          <div>
            <div className="obat-stat-val">{categories.length}</div>
            <div className="obat-stat-lbl">Catégories</div>
          </div>
        </div>

        <div className="obat-stat-card">
          <div className="obat-stat-icon amber" />
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
            onChange={(e) => setFiltreCategorie(e.target.value)}
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

      </div>

      {/* 4. ONGLETS PRINCIPAUX */}
      <div className="obat-main-tabs">
        <button
          type="button"
          className={`obat-main-tab ${ongletPrincipal === 'catalogue' ? 'active' : ''}`}
          onClick={() => setOngletPrincipal('catalogue')}
        >
          Catalogue des articles ({articlesFiltres.length})
        </button>
        <button
          type="button"
          className={`obat-main-tab ${ongletPrincipal === 'categories' ? 'active' : ''}`}
          onClick={() => setOngletPrincipal('categories')}
        >
          Catégories ({categories.length})
        </button>
      </div>

      {/* 5. VUE CATALOGUE D'ARTICLES */}
      {ongletPrincipal === 'catalogue' && (
        <>
          {chargement ? (
            <div className="obat-card-block" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} aria-hidden="true" />
              <p style={{ fontSize: 13, margin: 0 }}>Chargement de la bibliothèque d’articles…</p>
            </div>
          ) : articlesFiltres.length === 0 ? (
            <div className="obat-card-block" style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <h3>Aucun article ne correspond à votre recherche</h3>
              <p style={{ fontSize: 13 }}>Essayez de modifier votre mot-clé ou réinitialisez les filtres.</p>
              <button
                type="button"
                className="obat-btn-secondary"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setRecherche('');
                  setFiltreCategorie('TOUS');
                  setFiltreMode('TOUS');
                }}
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <>
              {articlesParCategorieAffiches.map((groupe) => {
                const totalPagesGroupe = Math.max(1, Math.ceil(groupe.articles.length / ARTICLES_PAR_PAGE));
                const pageGroupe = Math.min(Math.max(1, Number(pagesParCategorie[groupe.code] || 1)), totalPagesGroupe);
                const pageStart = (pageGroupe - 1) * ARTICLES_PAR_PAGE;
                const articlesPage = groupe.articles.slice(pageStart, pageStart + ARTICLES_PAR_PAGE);

                return (
                  <div key={groupe.code} className="obat-card-block">
                    <div className="obat-card-header">
                      <div className="obat-card-title">
                        {groupe.libelle}
                        {groupe.libelleCategorie && (
                          <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: 'var(--color-primary)', background: 'var(--color-primary-selection)', borderRadius: 4, padding: '2px 7px' }}>
                            {groupe.libelleCategorie}
                          </span>
                        )}
                      </div>
                      <span>
                        {articlesPage.length} / {groupe.articles.length} articles affichés · page {pageGroupe}/{totalPagesGroupe}
                      </span>
                    </div>

                    {totalPagesGroupe > 1 && (
                      <div className="obat-pagination">
                        <button
                          type="button"
                          className="obat-pagination-nav"
                          aria-label="Page précédente"
                          onClick={() => setPagesParCategorie((pagesAnciens) => ({
                            ...pagesAnciens,
                            [groupe.code]: Math.max(1, (Number(pagesAnciens[groupe.code] || 1) - 1))
                          }))}
                          disabled={pageGroupe === 1}
                        >
                          Précédent
                        </button>

                        {pagesVisibles(pageGroupe, totalPagesGroupe).map((numeroPage, index) => (
                          numeroPage === '...' ? (
                            <span
                              key={`${groupe.code}-ellipsis-${index}`}
                              className="obat-pagination-ellipsis"
                            >
                              ...
                            </span>
                          ) : (
                            <button
                              key={`${groupe.code}-${numeroPage}`}
                              type="button"
                              className={`obat-pagination-page${numeroPage === pageGroupe ? ' is-active' : ''}`}
                              aria-current={numeroPage === pageGroupe ? 'page' : undefined}
                              aria-label={`Aller à la page ${numeroPage}`}
                              onClick={() => setPagesParCategorie((pagesAnciens) => ({
                                ...pagesAnciens,
                                [groupe.code]: numeroPage
                              }))}
                            >
                              {numeroPage}
                            </button>
                          )
                        ))}

                        <span className="obat-pagination-status" aria-live="polite">
                          Page {pageGroupe} sur {totalPagesGroupe}
                        </span>

                        <button
                          type="button"
                          className="obat-pagination-nav"
                          aria-label="Page suivante"
                          onClick={() => setPagesParCategorie((pagesAnciens) => ({
                            ...pagesAnciens,
                            [groupe.code]: Math.min(totalPagesGroupe, (Number(pagesAnciens[groupe.code] || 1) + 1))
                          }))}
                          disabled={pageGroupe === totalPagesGroupe}
                        >
                          Suivant
                        </button>
                      </div>
                    )}

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
                            <th className="center" style={{ width: 130 }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {articlesPage.map((art) => {
                          const estPrestation = art.modePrix === 'PRESTATION';
                          const fournitureAffichee = Number(art.prixFourniture || 0);
                          const poseAffichee = Number(art.prixPose || 0);
                          const prixHTAffiche = estPrestation ? Number(art.prix || 0) : fournitureAffichee + poseAffichee;
                          const typeArticle = typeArticleDepuisTarifs(art);
                          return (
                            <tr key={art.code}>
                              <td><span>{art.code}</span></td>
                              <td className="obat-article-desc-cell">
                                <strong>{art.libelle}</strong>
                                <div className="obat-article-submeta">
                                  {art.matiere && <span>Matière : {art.matiere}</span>}
                                  {art.couleur && <span>Couleur : {art.couleur}</span>}
                                </div>
                              </td>
                              <td className="center"><span>{art.unite}</span></td>
                              <td className="center"><span>{typeArticle}</span></td>
                              <td className="right obat-price-cell">
                                {estPrestation ? '—' : formaterNombre(fournitureAffichee) + ' DA'}
                              </td>
                              <td className="right obat-price-cell">
                                {estPrestation ? '—' : formaterNombre(poseAffichee) + ' DA'}
                              </td>
                              <td className="right obat-price-total">
                                {formaterNombre(prixHTAffiche) + ' DA'}
                              </td>
                              <td className="center">
                                <div className="obat-actions-inline-group">
                                  <button
                                    type="button"
                                    className="obat-btn-action-icon"
                                    onClick={() => ouvrirFormulaireModificationArticle(art)}
                                    title="Modifier l'article"
                                    aria-label={'Modifier ' + art.libelle}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    className="obat-btn-action-icon obat-btn-delete"
                                    onClick={() => supprimerArticle(art)}
                                    title="Supprimer l'article"
                                    aria-label={'Supprimer ' + art.libelle}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      <line x1="10" y1="11" x2="10" y2="17" />
                                      <line x1="14" y1="11" x2="14" y2="17" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {/* 6. VUE GESTION DES CATÉGORIES */}
      {ongletPrincipal === 'categories' && (
        <div className="obat-card-block">
          <div className="obat-card-header">
            <div className="obat-card-title">
              Catégories d'articles ({categories.length})
            </div>
            <button
              type="button"
              className="obat-btn-primary"
              onClick={() => ouvrirModalCategorie(null)}
            >
              + Ajouter une catégorie
            </button>
          </div>

          <table className="obat-articles-table categories-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Code</th>
                <th>Catégorie</th>
                <th className="center" style={{ width: 160 }}>Articles</th>
                <th className="center" style={{ width: 110 }}>Actions</th>
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
                  const countArticles = tousLesArticles.filter((article) => Number(article.idCategorie) === Number(cat.id_categorie)).length;
                  return (
                    <tr
                      key={cat.id_categorie}
                      className="obat-category-row"
                    >
                      <td><span className="category-code">{cat.code_categorie}</span></td>
                      <td><strong className="category-label">{cat.libelle}</strong></td>
                      <td className="center"><span className="category-family-count">{countArticles} article(s)</span></td>
                      <td className="center category-actions">
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
                        <button
                          type="button"
                          className="obat-btn-action-icon"
                          onClick={(event) => {
                            event.stopPropagation();
                            supprimerCategorie(cat);
                          }}
                          title="Supprimer la catégorie"
                          aria-label={`Supprimer la catégorie ${cat.libelle}`}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
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
      )}

      {/* -------------------------------------------------------------
          7. MODALE NOUVEL ARTICLE (STYLE OBAT AVEC CALCUL EN DIRECT)
          ------------------------------------------------------------- */}
      {modalNouvelArticleOuvert && (
        <div className="obat-modal-overlay" onClick={() => setModalNouvelArticleOuvert(false)}>
          <div className="obat-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="obat-modal-header">
              <h3>{form.code_article ? 'Modifier l’article du référentiel' : 'Ajouter un nouvel article au référentiel'}</h3>
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
                    <label>Catégorie *</label>
                    <select
                      value={form.id_categorie}
                      onChange={(e) => modifier('id_categorie', e.target.value)}
                    >
                      <option value="">Sélectionner une catégorie...</option>
                      {categories.map((cat) => (
                        <option key={cat.id_categorie} value={cat.id_categorie}>
                          {cat.libelle}
                        </option>
                      ))}
                    </select>
                    {erreurs.id_categorie && <span className="obat-field-error">{erreurs.id_categorie}</span>}
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
                      className={`obat-pricing-option ${form.mode_prix === 'FOURNITURE_POSE' ? 'active' : ''}`}
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
                      className={`obat-pricing-option ${form.mode_prix === 'PRESTATION' ? 'active' : ''}`}
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
                    <select
                      value={form.type_tva}
                      onChange={(e) => modifier('type_tva', e.target.value)}
                    >
                      <option value="PRESTATION">
                        TVA Prestation ({form.type_tva === 'PRESTATION' ? form.taux_tva : parametresTva.prestation}%)
                      </option>
                      <option value="TRAVAUX">
                        TVA Travaux ({form.type_tva === 'TRAVAUX' ? form.taux_tva : parametresTva.travaux}%)
                      </option>
                    </select>
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
                <div className="obat-live-price-box">
                  <div className="obat-live-price-header">MONTANT CALCULÉ</div>
                  <div className="obat-live-price-row">
                    <span>Net HT :</span>
                    <strong>{formaterNombre(calculArticleLive.totalHT)} DA HT</strong>
                  </div>
                  <div className="obat-live-price-row">
                    <span>TVA calculée :</span>
                    <strong>{formaterNombre(calculArticleLive.totalTVA)} DA</strong>
                  </div>
                  <div className="obat-live-price-total-banner">
                    <span>TOTAL TTC</span>
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
                  {envoi
                    ? (form.code_article ? 'Mise à jour…' : 'Création en cours…')
                    : (form.code_article ? 'Enregistrer les modifications' : 'Enregistrer l’article')}
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
                  {envoiCategorie ? 'Enregistrement…' : 'Enregistrer la catégorie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

