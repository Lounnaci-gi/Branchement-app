import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import Breadcrumbs from '../components/Breadcrumbs';
import { notifierErreur } from '../utils/notifications';

function nomAbonne(demande) {
  if (demande.est_personne_morale) return demande.raison_sociale || '—';
  return `${demande.demandeur_nom || ''} ${demande.demandeur_prenom || ''}`.trim() || '—';
}

export function determinerTypesDisponibles(ligne) {
  if (!ligne) return ['F/'];

  const fRaw = ligne.prixFourniture ?? ligne.prix_fourniture ?? null;
  const pRaw = ligne.prixPose ?? ligne.prix_pose ?? null;
  const mode = String(ligne.modePrix ?? ligne.mode_prix ?? '').trim().toUpperCase();
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

function normaliserTypeLigne(type, choixPrix, modePrix, article = null) {
  const typesDispo = determinerTypesDisponibles(article || { type, choixPrix, modePrix });
  const str = String(type || '').trim();
  if (typesDispo.includes(str)) return str;
  if (choixPrix === 'FOURNITURE' && typesDispo.includes('F/')) return 'F/';
  if (choixPrix === 'POSE' && typesDispo.includes('P/')) return 'P/';
  if (choixPrix === 'FOURNITURE_POSE' && typesDispo.includes('FP/')) return 'FP/';
  if (typesDispo.includes('PR/')) return 'PR/';
  return typesDispo[0] || 'F/';
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

function formaterMontant(valeur) {
  const montant = Number(valeur);
  return (Number.isFinite(montant) ? montant : 0).toLocaleString('fr-DZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function nombreEnLettresSousMille(nombre) {
  const nombres = [
    'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'
  ];

  if (nombre < 17) return nombres[nombre] ?? 'zéro';
  if (nombre < 20) return `dix-${nombres[nombre - 10]}`;
  if (nombre < 100) {
    const dizaine = Math.floor(nombre / 10);
    const unite = nombre % 10;
    const dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

    if (dizaine === 7) return nombre === 71 ? 'soixante et onze' : `soixante-${nombreEnLettresSousMille(nombre - 60)}`;
    if (dizaine === 8) return nombre === 80 ? 'quatre-vingts' : `quatre-vingt-${nombreEnLettresSousMille(unite)}`;
    if (dizaine === 9) return `quatre-vingt-${nombreEnLettresSousMille(nombre - 80)}`;
    if (unite === 0) return dizaines[dizaine];
    return unite === 1 ? `${dizaines[dizaine]} et un` : `${dizaines[dizaine]}-${nombres[unite]}`;
  }

  const centaines = Math.floor(nombre / 100);
  const reste = nombre % 100;
  const prefixe = centaines === 1 ? 'cent' : `${nombres[centaines]} cent`;
  if (reste === 0) return centaines === 1 ? prefixe : `${prefixe}s`;
  return `${prefixe} ${nombreEnLettresSousMille(reste)}`;
}

function montantEnLettres(valeur) {
  const montant = Math.max(0, Math.round((Number(valeur) || 0) * 100) / 100);
  const entier = Math.floor(montant);
  const centimes = Math.round((montant - entier) * 100);
  const millions = Math.floor(entier / 1000000);
  const resteMillions = entier % 1000000;
  const parties = [];

  if (millions > 0) {
    parties.push(`${nombreEnLettresSousMille(millions)} million${millions > 1 ? 's' : ''}`);
  }

  if (resteMillions > 0) {
    const milliers = Math.floor(resteMillions / 1000);
    const reste = resteMillions % 1000;
    if (milliers > 0) {
      parties.push(milliers === 1 ? 'mille' : `${nombreEnLettresSousMille(milliers)} mille`);
    }
    if (reste > 0) {
      parties.push(nombreEnLettresSousMille(reste));
    }
  }

  if (parties.length === 0) {
    parties.push('zéro');
  }

  const texte = `${parties.join(' ')} dinar${entier > 1 ? 's' : ''}`;
  if (centimes > 0) {
    return `${texte} et ${nombreEnLettresSousMille(centimes)} centime${centimes > 1 ? 's' : ''}`;
  }
  return texte;
}

function libelleArticleSansCategorie(libelle) {
  return String(libelle || '—').replace(/^\s*\[[^\]]+\]\s*/, '').trim() || '—';
}

function obtenirCategorieArticle(art, mapCategories = new Map()) {
  const libelles = [
    art?.categorie,
    art?.libelleCategorie,
    art?.libelle_categorie,
    art?.categorie_article,
    art?.libelleCategorieArticle,
    art?.categorieArticle,
    art?.categorie_libelle
  ].filter(Boolean);

  if (libelles.length > 0) return libelles[0];

  const codeArticle = String(art?.code || art?.code_article || '').trim().toUpperCase();
  if (codeArticle && mapCategories.has(codeArticle)) return mapCategories.get(codeArticle);

  return 'Sans catégorie';
}

export default function AffichageDevis() {
  const { id, idDevis } = useParams();
  const [fiche, setFiche] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [catalogueArticles, setCatalogueArticles] = useState([]);

  useEffect(() => {
    client.get(`/demandes/${id}`)
      .then((res) => setFiche(res.data))
      .catch((err) => notifierErreur(err.response?.data?.erreur || 'Impossible de charger le devis.'))
      .finally(() => setChargement(false));

    client.get('/referentiels/articles')
      .then((res) => setCatalogueArticles(res.data || []))
      .catch(() => setCatalogueArticles([]));
  }, [id]);

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

  return (
    <div className="page page-affichage-devis">
      <div className="no-print">
        <Breadcrumbs items={[
          { label: 'Demandes', path: '/demandes' },
          { label: demande.numero_demande, path: `/demandes/${id}` },
          { label: devis.numero_devis }
        ]} />
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div>
            <h1>Devis {devis.numero_devis}</h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>Consultation du devis</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to={`/demandes/${id}`} className="btn btn-secondary">Retour au dossier</Link>
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>Imprimer</button>
          </div>
        </div>
      </div>

      <article className="devis-document">
        <header className="devis-document-entete">
          <div className="devis-institution">
            <div className="devis-republique">الجمهورية الجزائرية الديمقراطية الشعبية</div>
            <strong>République Algérienne Démocratique et Populaire</strong>
            <span>Ministère des ressources en eau</span>
            <b>E.P. ALGÉRIENNE DES EAUX</b>
          </div>
          <img className="devis-logo" src="/ade.png" alt="Logo ADE" />
          <div className="devis-agence">
            <strong>Zone d’Alger</strong>
            <span>Unité de Médéa</span>
            <b>{demande.nom_agence || 'Agence'}</b>
          </div>
        </header>

        <div className="devis-document-title">
          <div>
            <span>DEVIS QUANTITATIF ET ESTIMATIF</span>
            <small>{devis.numero_devis} du : {new Date(devis.date_emission).toLocaleDateString('fr-FR')}</small>
          </div>
        </div>

        <section className="devis-client-box devis-client-box-droite">
          <div>
            <span>Doit :</span>
            <strong>Nom &amp; prénom : {nomAbonne(demande)}</strong>
            <small>N° téléphone : {demande.telephone || demande.telephone_secondaire || 'Non renseigné'}</small>
          </div>
          <div>
            <span>Adresse des travaux :</span>
            <strong>Adresse : {demande.adresse_branchement || '—'}</strong>
            <small>Commune : {demande.nom_commune || 'Non renseignée'}</small>
          </div>
        </section>

        <div className="devis-objet"><b>Objet :</b> {nature}</div>

        <table className="devis-articles-table">
          <thead>
            <tr>
              <th className="col-desig">Désignation des travaux</th>
              <th className="col-type">Type</th>
              <th className="col-unite">Unité</th>
              <th className="col-qte">Qtité</th>
              <th className="col-pu">P.U.</th>
              <th className="col-total">Montant HT</th>
            </tr>
          </thead>
          <tbody>
            {aDesArticles ? (
              categoriesTriees.flatMap((categorie, categorieIndex) => {
                const articles = articlesParCategorie.get(categorie) || [];
                return [
                  <tr key={`categorie-${categorie}`}>
                    <td colSpan="6" className="devis-categorie-header">
                      <strong>{numeroRomain(categorieIndex + 1)} - {categorie}</strong>
                    </td>
                  </tr>,
                  ...articles.map((art) => {
                    const codeType = normaliserTypeLigne(art.type || art.type_ligne, art.choixPrix || art.choix_prix, art.modePrix || art.mode_prix, art);
                    return (
                      <tr key={art.id_ligne || art.code}>
                      <td className="col-desig">
                        <strong>{libelleArticleSansCategorie(art.libelle)}</strong>
                        {art.code ? <small className="devis-article-meta">{art.code}</small> : null}
                        {(art.matiere || art.couleur) ? <small className="devis-article-meta">{[art.matiere, art.couleur].filter(Boolean).join(' · ')}</small> : null}
                      </td>
                      <td className="col-type">
                        <span>{codeType}</span>
                      </td>
                      <td className="col-unite">{art.unite || 'U'}</td>
                      <td className="col-qte">{art.quantite}</td>
                      <td className="col-pu">{formaterMontant(art.prix)}</td>
                      <td className="col-total">{formaterMontant(art.montantLigne || (art.quantite * art.prix))}</td>
                    </tr>
                  );
                })
                ];
              })
            ) : (
              <tr>
                <td className="col-desig">Prestations et fournitures relatives aux travaux</td>
                <td className="col-type">
                  <span>FP/</span>
                </td>
                <td className="col-unite">U</td>
                <td className="col-qte">1</td>
                <td className="col-pu">{formaterMontant(devis.montant)}</td>
                <td className="col-total">{formaterMontant(devis.montant)}</td>
              </tr>
            )}
          </tbody>
        </table>

        <section className="devis-totaux">
          <div><span>Total HT</span><strong>{formaterMontant(totalHtArticles)} DA</strong></div>
          {totalTvaArticles > 0 ? (
            <div><span>TVA</span><strong>{formaterMontant(totalTvaArticles)} DA</strong></div>
          ) : (
            <div><span>TVA applicable</span><strong>Selon la catégorie de prestation</strong></div>
          )}
          <div className="devis-total-ttc"><span>Total du devis (TTC)</span><strong>{formaterMontant(devis.montant)} DA</strong></div>
        </section>
        <p className="devis-total-ttc-lettres">Le montant de devis est arrêté à la somme de : <strong>{montantEnLettres(devis.montant)}</strong></p>
        <p className="devis-validite">Le présent devis est valable pour une durée de 01 mois.</p>
        <footer className="devis-signature">LE CHEF D’AGENCE COMMERCIALE</footer>
      </article>

      <style>{`@media print {
        @page { margin: 5mm; size: A4 portrait; }
        html, body, #root, .app-shell, .app-content, main {
          display: block !important;
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
        }
        .no-print {
          display: none !important;
        }
        .page {
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          max-width: none !important;
        }
        .page-affichage-devis {
          padding: 0 !important;
          margin: 0 !important;
          background: #fff !important;
          border: none !important;
          outline: none !important;
          box-sizing: border-box !important;
          box-shadow: none !important;
        }
        .card,
        .devis-document {
          box-shadow: none !important;
          border: none !important;
          outline: none !important;
          margin: 0 !important;
          max-width: none !important;
          background: #fff !important;
        }
        .devis-document {
          width: 100% !important;
          max-width: 100% !important;
          padding: 8mm 10mm 6mm !important;
          zoom: 0.88;
          transform-origin: top left;
        }
        .devis-document * {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
        .devis-document-entete {
          gap: 8px !important;
          padding-bottom: 8px !important;
        }
        .devis-institution, .devis-agence {
          font-size: 9px !important;
          gap: 2px !important;
        }
        .devis-logo { width: 90px !important; height: 90px !important; }
        .devis-document-title {
          margin: 10px 0 8px !important;
          padding-bottom: 4px !important;
        }
        .devis-document-title span {
          font-size: 14px !important;
        }
        .devis-document-title small {
          font-size: 11px !important;
        }
        .devis-client-box {
          margin-bottom: 8px !important;
        }
        .devis-client-box > div {
          min-height: 52px !important;
          padding: 6px 8px !important;
        }
        .devis-objet {
          margin: 8px 0 10px !important;
          font-size: 12px !important;
        }
        .devis-articles-table {
          font-size: 10px !important;
          margin: 0 !important;
        }
        .devis-articles-table th,
        .devis-articles-table td {
          padding: 4px 4px !important;
        }
        .devis-articles-table .devis-categorie-header {
          font-size: 10px !important;
        }
        .devis-totaux {
          margin-top: 8px !important;
          width: 48% !important;
          font-size: 11px !important;
        }
        .devis-total-ttc-lettres {
          margin: 6px 0 6px !important;
          font-size: 10px !important;
          color: #111827 !important;
        }
        .devis-total-ttc-lettres strong {
          color: #111827 !important;
        }
        .devis-validite {
          margin: 0 0 10px !important;
          font-size: 10px !important;
        }
        .devis-signature {
          font-size: 11px !important;
        }
      }
      @media print {
        :root[data-theme='dark'] body,
        :root[data-theme='dark'] .app-shell,
        :root[data-theme='dark'] .app-content,
        :root[data-theme='dark'] main,
        :root[data-theme='dark'] .page,
        :root[data-theme='dark'] .page-affichage-devis,
        :root[data-theme='dark'] .app-topbar {
          background: #141b2a !important;
          color: #e8edf5 !important;
        }
        :root[data-theme='dark'] .sidebar {
          background: #1a2235 !important;
          color: #e8edf5 !important;
          border-color: #2a3550 !important;
        }
        :root[data-theme='dark'] .devis-document {
          background: #141b2a !important;
          color: #e8edf5 !important;
          border-color: #e8edf5 !important;
        }
        :root[data-theme='dark'] .devis-document-entete,
        :root[data-theme='dark'] .devis-document-title,
        :root[data-theme='dark'] .devis-client-box,
        :root[data-theme='dark'] .devis-client-box > div + div,
        :root[data-theme='dark'] .devis-articles-table th,
        :root[data-theme='dark'] .devis-articles-table td,
        :root[data-theme='dark'] .devis-totaux,
        :root[data-theme='dark'] .devis-totaux div {
          border-color: #e8edf5 !important;
        }
        :root[data-theme='dark'] .devis-articles-table th,
        :root[data-theme='dark'] .devis-articles-table .devis-categorie-header,
        :root[data-theme='dark'] .devis-total-ttc {
          background: #202a40 !important;
          color: #e8edf5 !important;
        }
        :root[data-theme='dark'] .devis-article-meta,
        :root[data-theme='dark'] .devis-document small {
          color: #aebbd0 !important;
        }
      }
      .devis-document { max-width: 920px; margin: 0 auto; padding: 24px 28px 30px; color: var(--color-text, #111); background: var(--color-surface, #fff); border: none !important; border-radius: 0; box-shadow: none !important; }
      .devis-document-entete { display: grid; grid-template-columns: 1fr 82px 1fr; align-items: center; gap: 16px; padding-bottom: 15px; border-bottom: none; }
      .devis-institution, .devis-agence { display: flex; flex-direction: column; gap: 4px; font-size: 11px; }
      .devis-institution strong { font-size: 12px; }
      .devis-institution b { font-size: 13px; margin-top: 5px; }
      .devis-republique { font-weight: 700; font-size: 12px; }
      .devis-logo { width: 105px; height: 105px; object-fit: contain; justify-self: center; }
      .devis-agence { text-align: right; font-size: 12px; }
      .devis-agence b { margin-top: 8px; border-top: none; padding-top: 7px; }
      .devis-document-title { display: flex; justify-content: space-between; align-items: end; margin: 18px 0 14px; border-bottom: none; padding-bottom: 7px; }
      .devis-document-title div { display: flex; flex-direction: column; gap: 5px; }
      .devis-document-title span { font-size: 17px; font-weight: 800; text-decoration: underline; }
      .devis-document-title small { font-size: 12px; font-weight: 700; }
      .devis-client-box { display: grid; grid-template-columns: 1fr 1fr; border: none; margin-bottom: 15px; border-radius: 0; overflow: hidden; }
      .devis-client-box-droite { width: 42%; margin-left: auto; grid-template-columns: 1fr; border-radius: 0; overflow: hidden; }
      .devis-client-box-droite > div { min-height: 0; padding: 4px 10px; }
      .devis-client-box-droite > div + div { padding-top: 0; }
      .devis-client-box-droite strong { font-size: 12px; }
      .devis-client-box-droite small { font-size: 10px; }
      .devis-client-box > div { display: flex; flex-direction: column; gap: 5px; min-height: 78px; padding: 11px 13px; }
      .devis-client-box > div + div { border-left: none; }
      .devis-client-box-droite > div + div { border-left: 0; border-top: 0; }
      .devis-client-box span { font-size: 10px; font-weight: 800; text-decoration: underline; }
      .devis-client-box strong { font-size: 13px; }
      .devis-client-box small { font-size: 11px; }
      .devis-objet { margin: 14px 0 17px; font-size: 13px; }
      .devis-objet b { text-decoration: underline; }
      .devis-articles-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; border-radius: 0; overflow: hidden; }
      .devis-articles-table th, .devis-articles-table td { border: none; padding: 7px 6px; vertical-align: middle; }
      .devis-articles-table th { background: #1991eb; color: #fff; border-color: transparent; font-weight: 800; text-align: center; }
      .devis-articles-table .devis-categorie-header { background: #eff6ff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em; text-align: left; }
      .devis-articles-table .col-desig { text-align: left; }
      .devis-articles-table .col-type { width: 48px; text-align: center; }
      .devis-articles-table .col-diam { width: 70px; text-align: center; }
      .devis-articles-table .col-unite { width: 46px; text-align: center; }
      .devis-articles-table .col-qte { width: 48px; text-align: center; }
      .devis-articles-table .col-pu { width: 100px; text-align: right; }
      .devis-articles-table .col-total { width: 110px; text-align: right; }
      .devis-totaux { width: 55%; margin-left: auto; border-left: none; border-right: none; border-bottom: none; font-size: 12px; border-radius: 0; overflow: hidden; }
      .devis-totaux div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 9px; border-top: none; }
      .devis-totaux strong { text-align: right; }
      .devis-total-ttc { font-size: 14px; font-weight: 800; background: #e9e9e9; }
      .devis-total-ttc-lettres {
        margin: 10px 0 8px;
        padding: 0;
        font-size: 12px;
        color: #111827;
        font-style: italic;
        line-height: 1.5;
      }
      .devis-total-ttc-lettres strong {
        text-transform: lowercase;
        font-size: 1.05em;
        color: #111827;
      }
      .devis-validite { margin: 0 0 14px; font-size: 11px; }
      .devis-signature { text-align: right; font-weight: 800; font-size: 12px; }
      .devis-article-meta { display: block; color: var(--color-text-muted, #666); }
      :root[data-theme='dark'] .devis-document { background: var(--color-surface, #1A2235); color: var(--color-text, #E8EDF5); border-color: var(--color-border, #2A3550); }
      :root[data-theme='dark'] .devis-document-entete, :root[data-theme='dark'] .devis-document-title { border-color: var(--color-border, #2A3550); }
      :root[data-theme='dark'] .devis-client-box, :root[data-theme='dark'] .devis-client-box > div + div, :root[data-theme='dark'] .devis-articles-table th, :root[data-theme='dark'] .devis-articles-table td, :root[data-theme='dark'] .devis-totaux, :root[data-theme='dark'] .devis-totaux div { border-color: var(--color-border, #2A3550); }
      :root[data-theme='dark'] .devis-articles-table th, :root[data-theme='dark'] .devis-total-ttc { background: var(--color-surface-sunken, #141B2A); }
      :root[data-theme='dark'] .devis-articles-table td.devis-categorie-header { background: var(--color-surface-sunken, #141B2A) !important; color: var(--color-text, #E8EDF5) !important; }
      :root[data-theme='dark'] .devis-articles-table td.devis-categorie-header strong { color: var(--color-text, #E8EDF5) !important; }
      @media print {
        :root[data-theme='dark'] .devis-document,
        :root[data-theme='dark'] td.devis-categorie-header {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        :root[data-theme='dark'] td.devis-categorie-header {
          background: #202a40 !important;
          color: #e8edf5 !important;
          border-color: #e8edf5 !important;
        }
        :root[data-theme='dark'] td.devis-categorie-header strong {
          color: #e8edf5 !important;
        }
      }
      :root[data-theme='dark'] .devis-document small, :root[data-theme='dark'] .devis-article-meta { color: var(--color-text-muted, #8B99B3); }
      :root[data-theme='dark'] .devis-total-ttc-lettres,
      :root[data-theme='dark'] .devis-total-ttc-lettres strong {
        color: #f3f4f6 !important;
      }
      @media print {
        .sidebar,
        .app-topbar,
        .no-print,
        .cmd-palette-overlay {
          display: none !important;
        }
        .app-shell,
        .app-content,
        .app-content main,
        .page,
        .page-affichage-devis {
          display: block !important;
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .devis-document {
          width: 100% !important;
          max-width: none !important;
          margin: 0 !important;
        }
      }
      @media print {
        html,
        body,
        #root,
        .app-shell,
        .app-content,
        main,
        .page,
        .page-affichage-devis,
        .devis-document {
          background: #fff !important;
          color: #111 !important;
        }
        .devis-document,
        .devis-document-entete,
        .devis-document-title,
        .devis-client-box,
        .devis-client-box > div + div,
        .devis-articles-table th,
        .devis-articles-table td,
        .devis-totaux,
        .devis-totaux div {
          border-color: #111 !important;
        }
        .devis-articles-table th,
        .devis-total-ttc {
          background: #e9e9e9 !important;
          color: #111 !important;
        }
        .devis-articles-table td.devis-categorie-header,
        .devis-articles-table td.devis-categorie-header strong {
          background: #f3f4f6 !important;
          color: #111 !important;
        }
        .devis-document small,
        .devis-article-meta {
          color: #666 !important;
        }
        .devis-document,
        .devis-articles-table td.devis-categorie-header {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
      @media print {
        :root[data-theme='dark'] body,
        :root[data-theme='dark'] #root,
        :root[data-theme='dark'] .app-shell,
        :root[data-theme='dark'] .app-content,
        :root[data-theme='dark'] main,
        :root[data-theme='dark'] .page,
        :root[data-theme='dark'] .page-affichage-devis,
        :root[data-theme='dark'] .devis-document {
          background: #fff !important;
          color: #111 !important;
        }
        :root[data-theme='dark'] .devis-document,
        :root[data-theme='dark'] .devis-document-entete,
        :root[data-theme='dark'] .devis-document-title,
        :root[data-theme='dark'] .devis-client-box,
        :root[data-theme='dark'] .devis-client-box > div + div,
        :root[data-theme='dark'] .devis-articles-table th,
        :root[data-theme='dark'] .devis-articles-table td,
        :root[data-theme='dark'] .devis-totaux,
        :root[data-theme='dark'] .devis-totaux div {
          border-color: #111 !important;
        }
        :root[data-theme='dark'] .devis-articles-table th,
        :root[data-theme='dark'] .devis-total-ttc {
          background: #e9e9e9 !important;
          color: #111 !important;
        }
        :root[data-theme='dark'] .devis-articles-table td.devis-categorie-header,
        :root[data-theme='dark'] .devis-articles-table td.devis-categorie-header strong {
          background: #f3f4f6 !important;
          color: #111 !important;
        }
        :root[data-theme='dark'] .devis-document small,
        :root[data-theme='dark'] .devis-article-meta {
          color: #666 !important;
        }
        :root[data-theme='dark'] .devis-total-ttc-lettres,
        :root[data-theme='dark'] .devis-total-ttc-lettres strong {
          color: #111827 !important;
        }
      }
      @media print {
        .devis-document {
          border: none !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          padding: 24px 28px 30px !important;
        }
        .devis-document-entete {
          grid-template-columns: 1fr 82px 1fr;
          border-bottom: none !important;
          padding-bottom: 14px;
        }
        .devis-republique,
        .devis-institution b,
        .devis-document-title span,
        .devis-signature {
          color: #1065b8 !important;
        }
        .devis-document-title {
          border-bottom: 1px solid #bfdbfe !important;
          margin: 16px 0 14px;
        }
        .devis-document-title span { text-decoration: none; }
        .devis-client-box-droite {
          border-color: #bfdbfe !important;
          background: #eff6ff !important;
        }
        .devis-articles-table th {
          background: #1991eb !important;
          color: #fff !important;
          border-color: #147ad4 !important;
        }
        .devis-articles-table td {
          border-color: #cbd5e1 !important;
        }
        .devis-articles-table tbody tr:not(.devis-categorie-header):nth-child(even) td {
          background: #f8fafc !important;
        }
        .devis-articles-table td.devis-categorie-header,
        .devis-articles-table td.devis-categorie-header strong {
          background: #eff6ff !important;
          color: #1e3a8a !important;
          border-color: #bfdbfe !important;
        }
        .devis-total-ttc {
          background: #1991eb !important;
          color: #fff !important;
          border-color: #147ad4 !important;
        }
      }
      @media (max-width: 640px) { .devis-document { padding: 18px 12px; } .devis-document-entete { grid-template-columns: 1fr 88px; } .devis-logo { width: 83px; height: 83px; } .devis-agence { grid-column: 1 / -1; text-align: left; } .devis-client-box, .devis-client-box-droite { width: 100%; grid-template-columns: 1fr; } .devis-client-box > div + div { border-left: 0; border-top: 1px solid #111; } .devis-totaux { width: 100%; } .devis-articles-table { font-size: 10px; } }
      `}</style>
    </div>
  );
}
