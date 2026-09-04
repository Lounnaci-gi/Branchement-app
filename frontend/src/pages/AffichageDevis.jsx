import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import Breadcrumbs from '../components/Breadcrumbs';
import { notifierErreur } from '../utils/notifications';

function nomAbonne(demande) {
  if (demande.est_personne_morale) return demande.raison_sociale || '—';
  return `${demande.demandeur_nom || ''} ${demande.demandeur_prenom || ''}`.trim() || '—';
}

export default function AffichageDevis() {
  const { id, idDevis } = useParams();
  const [fiche, setFiche] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    client.get(`/demandes/${id}`)
      .then((res) => setFiche(res.data))
      .catch((err) => notifierErreur(err.response?.data?.erreur || 'Impossible de charger le devis.'))
      .finally(() => setChargement(false));
  }, [id]);

  if (chargement) return <div className="page" aria-busy="true"><div className="squelette squelette-titre" /></div>;
  if (!fiche) return <div className="page etat-erreur"><h1>Dossier introuvable</h1><Link to="/demandes" className="btn btn-primary">Retour aux demandes</Link></div>;

  const devis = fiche.devis?.find((item) => String(item.id_devis) === String(idDevis));
  if (!devis) return <div className="page etat-erreur"><h1>Devis introuvable</h1><Link to={`/demandes/${id}`} className="btn btn-primary">Retour au dossier</Link></div>;

  const demande = fiche.demande;
  const nature = demande.type_autre || demande.type_branchement || 'Branchement d’eau potable';
  const aDesArticles = Array.isArray(devis.articles) && devis.articles.length > 0;
  const aUnDiametre = aDesArticles && devis.articles.some((a) => a.diametre);
  const totalHtArticles = aDesArticles
    ? devis.articles.reduce((sum, a) => sum + Number(a.montantLigne || (a.quantite * a.prix) || 0), 0)
    : Number(devis.montant);
  const totalTvaArticles = aDesArticles
    ? devis.articles.reduce((sum, a) => sum + (Number(a.quantite || 0) * Number(a.prix || 0) * (Number(a.tauxTva ?? 19) / 100)), 0)
    : 0;

  return (
    <div className="page page-affichage-devis">
      <div className="no-print">
        <Breadcrumbs items={[
          { label: 'Demandes', path: '/demandes' },
          { label: demande.numero_demande, path: `/demandes/${id}` },
          { label: devis.numero_devis, icon: '📄' }
        ]} />
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div>
            <h1>Devis {devis.numero_devis}</h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>Consultation du devis</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to={`/demandes/${id}`} className="btn btn-secondary">← Retour au dossier</Link>
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>🖨 Imprimer</button>
          </div>
        </div>
      </div>

      <article className="card devis-document">
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
          <div><span>DEVIS QUANTITATIF ET ESTIMATIF</span><small>N° : {devis.numero_devis}</small></div>
          <span>{new Date(devis.date_emission).toLocaleDateString('fr-FR')}</span>
        </div>

        <section className="devis-client-box">
          <div><span>ABONNÉ</span><strong>{nomAbonne(demande)}</strong><small>{demande.telephone || demande.telephone_secondaire || 'Téléphone non renseigné'}</small></div>
          <div><span>ADRESSE DES TRAVAUX</span><strong>{demande.adresse_branchement || '—'}</strong><small>{demande.nom_commune || 'Commune non renseignée'}</small></div>
        </section>

        <div className="devis-objet"><b>Objet :</b> {nature}</div>

        <table className="devis-articles-table">
          <thead>
            <tr>
              <th>Désignation des travaux / fournitures</th>
              {aUnDiametre && <th>Diamètre</th>}
              <th>Unité</th>
              <th>Qtité</th>
              <th>P.U.</th>
              <th>Montant HT</th>
            </tr>
          </thead>
          <tbody>
            {aDesArticles ? (
              devis.articles.map((art) => (
                <tr key={art.id_ligne || art.code}>
                  <td style={{ textAlign: 'left' }}>
                    <strong>{art.libelle}</strong>
                    {art.code ? <small style={{ display: 'block', color: 'var(--color-text-muted, #666)' }}>{art.code}</small> : null}
                    {(art.matiere || art.couleur) ? <small style={{ display: 'block', color: 'var(--color-text-muted, #666)' }}>{[art.matiere, art.couleur].filter(Boolean).join(' · ')}</small> : null}
                  </td>
                  {aUnDiametre && <td style={{ textAlign: 'center' }}>{art.diametre || '—'}</td>}
                  <td style={{ textAlign: 'center' }}>{art.unite || 'U'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{art.quantite}</td>
                  <td style={{ textAlign: 'right' }}>{Number(art.prix).toLocaleString('fr-DZ')} DA</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{Number(art.montantLigne || (art.quantite * art.prix)).toLocaleString('fr-DZ')} DA</td>
                </tr>
              ))
            ) : (
              <tr>
                <td style={{ textAlign: 'left' }}>Prestations et fournitures relatives aux travaux</td>
                {aUnDiametre && <td style={{ textAlign: 'center' }}>—</td>}
                <td style={{ textAlign: 'center' }}>U</td>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>1</td>
                <td style={{ textAlign: 'right' }}>{Number(devis.montant).toLocaleString('fr-DZ')} DA</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{Number(devis.montant).toLocaleString('fr-DZ')} DA</td>
              </tr>
            )}
          </tbody>
        </table>

        <section className="devis-totaux">
          <div><span>Total HT</span><strong>{Number(totalHtArticles).toLocaleString('fr-DZ')} DA</strong></div>
          {totalTvaArticles > 0 ? (
            <div><span>TVA (calculée)</span><strong>{Number(Math.round(totalTvaArticles * 100) / 100).toLocaleString('fr-DZ')} DA</strong></div>
          ) : (
            <div><span>TVA applicable</span><strong>Selon la catégorie de prestation</strong></div>
          )}
          <div className="devis-total-ttc"><span>Total du devis (TTC)</span><strong>{Number(devis.montant).toLocaleString('fr-DZ')} DA</strong></div>
        </section>
        <p className="devis-validite">Le présent devis est valable pour une durée de 01 mois.</p>
        <footer className="devis-signature">LE CHEF D’AGENCE COMMERCIALE</footer>
      </article>

      <style>{`@media print {
        .no-print { display: none !important; }
        .page-affichage-devis { padding: 0; background: #fff; }
        .devis-document { box-shadow: none; border: 1px solid #000; margin: 0; max-width: none; }
      }
      .devis-document { max-width: 920px; margin: 0 auto; padding: 24px 28px 30px; color: #111; background: #fff; border: 1px solid #a9a9a9; }
      .devis-document-entete { display: grid; grid-template-columns: 1fr 82px 1fr; align-items: center; gap: 16px; padding-bottom: 15px; border-bottom: 1px solid #111; }
      .devis-institution, .devis-agence { display: flex; flex-direction: column; gap: 4px; font-size: 11px; }
      .devis-institution strong { font-size: 12px; }
      .devis-institution b { font-size: 13px; margin-top: 5px; }
      .devis-republique { font-weight: 700; font-size: 12px; }
      .devis-logo { width: 70px; height: 70px; object-fit: contain; justify-self: center; }
      .devis-agence { text-align: right; font-size: 12px; }
      .devis-agence b { margin-top: 8px; border-top: 1px solid #111; padding-top: 7px; }
      .devis-document-title { display: flex; justify-content: space-between; align-items: end; margin: 18px 0 14px; border-bottom: 2px solid #111; padding-bottom: 7px; }
      .devis-document-title div { display: flex; flex-direction: column; gap: 5px; }
      .devis-document-title span { font-size: 17px; font-weight: 800; text-decoration: underline; }
      .devis-document-title small { font-size: 12px; font-weight: 700; }
      .devis-client-box { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #111; margin-bottom: 15px; }
      .devis-client-box > div { display: flex; flex-direction: column; gap: 5px; min-height: 78px; padding: 11px 13px; }
      .devis-client-box > div + div { border-left: 1px solid #111; }
      .devis-client-box span { font-size: 10px; font-weight: 800; text-decoration: underline; }
      .devis-client-box strong { font-size: 13px; }
      .devis-client-box small { font-size: 11px; }
      .devis-objet { margin: 14px 0 17px; font-size: 13px; }
      .devis-objet b { text-decoration: underline; }
      .devis-articles-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; }
      .devis-articles-table th, .devis-articles-table td { border: 1px solid #111; padding: 7px 6px; }
      .devis-articles-table th { background: #e9e9e9; font-weight: 800; text-align: center; }
      .devis-articles-table th:first-child, .devis-articles-table td:first-child { width: 46%; text-align: left; }
      .devis-articles-table th:nth-child(2) { width: 11%; }
      .devis-articles-table th:nth-child(3) { width: 9%; }
      .devis-articles-table th:nth-child(4), .devis-articles-table th:nth-child(5) { width: 17%; }
      .devis-articles-table td:not(:first-child) { text-align: right; }
      .devis-totaux { width: 55%; margin-left: auto; border-left: 1px solid #111; border-right: 1px solid #111; border-bottom: 1px solid #111; font-size: 12px; }
      .devis-totaux div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 9px; border-top: 1px solid #111; }
      .devis-totaux strong { text-align: right; }
      .devis-total-ttc { font-size: 14px; font-weight: 800; background: #e9e9e9; }
      .devis-validite { margin: 18px 0 45px; font-size: 11px; }
      .devis-signature { text-align: right; font-weight: 800; font-size: 12px; }
      @media (max-width: 640px) { .devis-document { padding: 18px 12px; } .devis-document-entete { grid-template-columns: 1fr 58px; } .devis-logo { width: 55px; height: 55px; } .devis-agence { grid-column: 1 / -1; text-align: left; } .devis-client-box { grid-template-columns: 1fr; } .devis-client-box > div + div { border-left: 0; border-top: 1px solid #111; } .devis-totaux { width: 100%; } .devis-articles-table { font-size: 10px; } }
      `}</style>
    </div>
  );
}
