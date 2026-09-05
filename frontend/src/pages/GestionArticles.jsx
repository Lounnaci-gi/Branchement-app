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

const FAMILLE_VIDE = { libelle: '' };

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
  const [articles, setArticles] = useState([]);
  const [chargement, setChargement] = useState(true);

  // Recherche & Filtres (Logique Obat)
  const [recherche, setRecherche] = useState('');
  const [filtreFamille, setFiltreFamille] = useState('TOUS');
  const [filtreMode, setFiltreMode] = useState('TOUS'); // 'TOUS', 'FOURNITURE_POSE', 'PRESTATION'
  const [ongletPrincipal, setOngletPrincipal] = useState('catalogue'); // 'catalogue' ou 'familles'

  // Modales
  const [modalNouvelArticleOuvert, setModalNouvelArticleOuvert] = useState(false);
  const [modalFamilleOuvert, setModalFamilleOuvert] = useState(false);
  const [familleEnEdition, setFamilleEnEdition] = useState(null);

  const [modalTarifOuvert, setModalTarifOuvert] = useState(false);
  const [tarifEnEdition, setTarifEnEdition] = useState(null);

  // Formulaires
  const [form, setForm] = useState(FORMULAIRE_VIDE);
  const [erreurs, setErreurs] = useState({});
  const [envoi, setEnvoi] = useState(false);

  const [formFamille, setFormFamille] = useState(FAMILLE_VIDE);
  const [erreursFamille, setErreursFamille] = useState({});
  const [envoiFamille, setEnvoiFamille] = useState(false);

  const [formTarif, setFormTarif] = useState(TARIF_VIDE);
  const [erreursTarif, setErreursTarif] = useState({});
  const [envoiTarif, setEnvoiTarif] = useState(false);

  const agent = JSON.parse(localStorage.getItem('agent') || '{}');

  async function chargerDonnees() {
    setChargement(true);
    try {
      const [famillesResponse, articlesResponse] = await Promise.all([
        client.get('/referentiels/articles/familles'),
        client.get('/referentiels/articles')
      ]);
      setFamilles(famillesResponse.data || []);
      setArticles(articlesResponse.data || []);
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
        libelleFamille: fam.libelle
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
      const matchFamille = filtreFamille === 'TOUS' || art.codeFamille === filtreFamille;
      const matchMode = filtreMode === 'TOUS' || art.modePrix === filtreMode;
      const q = recherche.toLowerCase().trim();
      const matchTexte = !q || [
        art.libelle,
        art.code,
        art.matiere,
        art.couleur,
        art.libelleFamille
      ].some((v) => v?.toLowerCase().includes(q));

      return matchFamille && matchMode && matchTexte;
    });
  }, [tousLesArticles, filtreFamille, filtreMode, recherche]);

  // Regroupement par famille pour l'affichage catalogue
  const articlesParFamilleAffiches = useMemo(() => {
    const map = new Map();
    articlesFiltres.forEach((art) => {
      if (!map.has(art.codeFamille)) {
        map.set(art.codeFamille, {
          code: art.codeFamille,
          libelle: art.libelleFamille,
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
  // GESTION DES FAMILLES
  // -------------------------------------------------------------
  function ouvrirModalFamille(famille = null) {
    if (famille) {
      setFamilleEnEdition(famille.id_famille);
      setFormFamille({ libelle: famille.libelle });
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
      if (familleEnEdition) {
        await client.put(`/referentiels/articles/familles/${familleEnEdition}`, formFamille);
        await notifierSucces('Famille modifiée avec succès.');
      } else {
        await client.post('/referentiels/articles/familles', formFamille);
        await notifierSucces('Nouvelle famille créée.');
      }
      setModalFamilleOuvert(false);
      await chargerDonnees();
    } catch (error) {
      notifierErreur(error.response?.data?.erreur || 'Erreur lors de l’enregistrement de la famille.');
    } finally {
      setEnvoiFamille(false);
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
          <p style={{ color: '#64748B', marginTop: 8 }}>
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
          <div className="obat-stat-icon purple">🔧</div>
          <div>
            <div className="obat-stat-val">{totalFourniturePose}</div>
            <div className="obat-stat-lbl">Fournitures & Pose</div>
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

      {/* 3. BARRE DE RECHERCHE ET FILTRES FAMILLES */}
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
            <span className="obat-tag-count">{totalArticles}</span>
          </button>
          {familles.map((fam) => {
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
            <div className="obat-card-block" style={{ padding: 40, textAlign: 'center', color: '#64748B' }}>
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
                        const estPrestation = art.modePrix === 'PRESTATION';
                        const fourniture = Number(art.prixFourniture || 0);
                        const pose = Number(art.prixPose || 0);
                        const prixHT = estPrestation ? Number(art.prix || 0) : fourniture + pose;
                        const prixTTC = prixHT * (1 + (Number(art.tauxTva || 19) / 100));

                        return (
                          <tr key={art.code}>
                            <td>
                              <span>{art.code}</span>
                            </td>
                            <td className="obat-article-desc-cell">
                              <strong>{art.libelle}</strong>
                              <div className="obat-article-submeta">
                                {art.matiere && <span>Matière : {art.matiere}</span>}
                                {art.couleur && <span>Couleur : {art.couleur}</span>}
                                {art.avecDiametre && <span>Diamètre sélectionnable</span>}
                              </div>
                            </td>
                            <td className="center">
                              <span>{art.unite}</span>
                            </td>
                            <td className="center">
                              <span>
                                {estPrestation ? 'Prestation' : 'Fourniture + Pose'}
                              </span>
                            </td>
                            <td className="right obat-price-cell">
                              {estPrestation ? '—' : `${formaterNombre(fourniture)} DA`}
                            </td>
                            <td className="right obat-price-cell">
                              {estPrestation ? '—' : `${formaterNombre(pose)} DA`}
                            </td>
                            <td className="right obat-price-total">
                              {formaterNombre(prixHT)} DA
                            </td>
                            <td className="right obat-price-cell" style={{ color: '#059669' }}>
                              {formaterNombre(prixTTC)} DA
                            </td>
                            <td className="center">
                              <button
                                type="button"
                                className="obat-btn-action-sm"
                                onClick={() => ouvrirModificationTarif(art)}
                                title="Modifier le tarif de cet article"
                              >
                                ✎ Tarif
                              </button>
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

      {/* 6. VUE GESTION DES FAMILLES */}
      {ongletPrincipal === 'familles' && (
        <div className="obat-card-block">
          <div className="obat-card-header">
            <div className="obat-card-title">
              <span>📁</span> Liste des Familles d'articles ({familles.length})
            </div>
            <button
              type="button"
              className="obat-btn-primary"
              onClick={() => ouvrirModalFamille(null)}
            >
              + Ajouter une famille
            </button>
          </div>

          <table className="obat-articles-table">
            <thead>
              <tr>
                <th style={{ width: 140 }}>Code Famille</th>
                <th>Libellé de la famille</th>
                <th className="center" style={{ width: 140 }}>Articles associés</th>
                <th className="right" style={{ width: 140 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {familles.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: '#64748B', padding: 24 }}>
                    Aucune famille enregistrée.
                  </td>
                </tr>
              ) : (
                familles.map((fam) => {
                  const count = tousLesArticles.filter((a) => a.codeFamille === fam.code_famille).length;
                  return (
                    <tr key={fam.id_famille}>
                      <td>
                        <span>{fam.code_famille}</span>
                      </td>
                      <td>
                        <strong>{fam.libelle}</strong>
                      </td>
                      <td className="center">
                        <span>{count} article(s)</span>
                      </td>
                      <td className="right">
                        <button
                          type="button"
                          className="obat-btn-action-sm"
                          onClick={() => ouvrirModalFamille(fam)}
                        >
                          ✎ Modifier libellé
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
                  <label style={{ fontSize: 12.5, fontWeight: 700, display: 'block', marginBottom: 8, color: '#374151' }}>
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
                      style={{ background: '#F1F5F9', color: '#64748B' }}
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
                <p style={{ margin: '0 0 16px', fontSize: 13.5, color: '#475569' }}>
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
                  <label>Libellé de la famille d'articles *</label>
                  <input
                    type="text"
                    placeholder="Ex. Tuyauterie & Raccords PEHD"
                    value={formFamille.libelle}
                    onChange={(e) => setFormFamille({ libelle: e.target.value })}
                    maxLength={100}
                    autoFocus
                  />
                  {erreursFamille.libelle && (
                    <span className="obat-field-error">{erreursFamille.libelle}</span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: '#64748B', margin: '6px 0 0' }}>
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
    </div>
  );
}
