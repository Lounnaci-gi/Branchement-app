import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import Breadcrumbs from '../components/Breadcrumbs';
import DocumentDevis from '../components/devis/DocumentDevis';
import SelecteurModeleDevis from '../components/devis/SelecteurModeleDevis';
import { notifierErreur } from '../utils/notifications';
import { obtenirCategorieArticle } from '../utils/devisDocumentFormat';
import { enregistrerModeleDevisPrefere, lireModeleDevisPrefere } from '../utils/devisModeles';

export default function AffichageDevis() {
  const { id, idDevis } = useParams();
  const [fiche, setFiche] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [catalogueArticles, setCatalogueArticles] = useState([]);
  const [logoDevis, setLogoDevis] = useState('/ade.png');
  const [modele, setModele] = useState(lireModeleDevisPrefere);

  useEffect(() => {
    client.get(`/demandes/${id}`)
      .then((res) => setFiche(res.data))
      .catch((err) => notifierErreur(err.response?.data?.erreur || 'Impossible de charger le devis.'))
      .finally(() => setChargement(false));

    client.get('/referentiels/articles')
      .then((res) => setCatalogueArticles(res.data || []))
      .catch(() => setCatalogueArticles([]));

    client.get('/parametres/logo-devis')
      .then((res) => setLogoDevis(res.data.logo || '/ade.png'))
      .catch(() => setLogoDevis('/ade.png'));
  }, [id]);

  useEffect(() => {
    function actualiser() {
      setModele(lireModeleDevisPrefere());
    }
    window.addEventListener('devis-modele-change', actualiser);
    window.addEventListener('storage', actualiser);
    return () => {
      window.removeEventListener('devis-modele-change', actualiser);
      window.removeEventListener('storage', actualiser);
    };
  }, []);

  if (chargement) return <div className="page" aria-busy="true"><div className="squelette squelette-titre" /></div>;
  if (!fiche) return <div className="page etat-erreur"><h1>Dossier introuvable</h1><Link to="/demandes" className="btn btn-primary">Retour aux demandes</Link></div>;

  const devis = fiche.devis?.find((item) => String(item.id_devis) === String(idDevis));
  if (!devis) return <div className="page etat-erreur"><h1>Devis introuvable</h1><Link to={`/demandes/${id}`} className="btn btn-primary">Retour au dossier</Link></div>;

  const demande = fiche.demande;
  const nature = demande.type_autre || demande.type_branchement || 'Branchement d’eau potable';

  const mapCategories = new Map();
  for (const famille of catalogueArticles) {
    for (const article of famille.articles || []) {
      const code = String(article.code || article.code_article || '').trim().toUpperCase();
      if (!code) continue;
      mapCategories.set(code, article.libelleCategorie || famille.libelle_categorie || famille.libelleCategorie || 'Sans catégorie');
    }
  }

  const articlesAvecCategorie = (Array.isArray(devis.articles) ? devis.articles : []).map((art) => ({
    ...art,
    categorie: obtenirCategorieArticle(art, mapCategories)
  }));

  const articlesParCategorie = new Map();
  articlesAvecCategorie.forEach((art) => {
    const categorie = art.categorie || 'Sans catégorie';
    if (!articlesParCategorie.has(categorie)) {
      articlesParCategorie.set(categorie, []);
    }
    articlesParCategorie.get(categorie).push(art);
  });

  const categoriesTriees = Array.from(articlesParCategorie.keys()).sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  const aDesArticles = articlesAvecCategorie.length > 0;
  const totalHtArticles = aDesArticles
    ? articlesAvecCategorie.reduce((sum, a) => sum + Number(a.montantLigne || (a.quantite * a.prix) || 0), 0)
    : Number(devis.montant);
  const totalTvaArticles = aDesArticles
    ? articlesAvecCategorie.reduce((sum, a) => sum + (Number(a.quantite || 0) * Number(a.prix || 0) * (Number(a.tauxTva ?? 19) / 100)), 0)
    : 0;

  function choisirModele(idModele) {
    setModele(enregistrerModeleDevisPrefere(idModele));
  }

  return (
    <div className="page page-affichage-devis">
      <div className="no-print">
        <Breadcrumbs items={[
          { label: 'Demandes', path: '/demandes' },
          { label: demande.numero_demande, path: `/demandes/${id}` },
          { label: devis.numero_devis }
        ]} />
        <div className="page-header devis-affichage-entete" style={{ marginBottom: 20 }}>
          <div>
            <h1>Devis {devis.numero_devis}</h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>Consultation du devis</p>
          </div>
          <div className="devis-affichage-actions">
            <div className="devis-modele-controle">
              <span>Modèle du devis</span>
              <SelecteurModeleDevis variant="dense" valeur={modele} onChange={choisirModele} />
            </div>
            <div className="devis-affichage-boutons">
              <Link to={`/demandes/${id}`} className="btn btn-secondary">Retour au dossier</Link>
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimer</button>
            </div>
          </div>
        </div>
      </div>

      <DocumentDevis
        modele={modele}
        logoDevis={logoDevis}
        demande={demande}
        devis={devis}
        nature={nature}
        aDesArticles={aDesArticles}
        categoriesTriees={categoriesTriees}
        articlesParCategorie={articlesParCategorie}
        totalHtArticles={totalHtArticles}
        totalTvaArticles={totalTvaArticles}
      />
    </div>
  );
}
