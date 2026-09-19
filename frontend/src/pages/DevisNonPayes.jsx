import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import Breadcrumbs from '../components/Breadcrumbs';
import { notifierErreur } from '../utils/notifications';

export default function DevisNonPayes() {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState('');

  useEffect(() => {
    client.get('/dashboard')
      .then((res) => setDonnees(res.data.devisNonPayes || { total: 0, montant_total: 0, details: [] }))
      .catch(() => notifierErreur('Impossible de charger les devis non payés.'))
      .finally(() => setChargement(false));
  }, []);

  const details = donnees?.details || [];
  const termeFiltre = filtre.trim().toLowerCase();
  const detailsFiltres = useMemo(() => {
    if (!termeFiltre) return details;
    return details.filter((devis) => [
      devis.demandeur,
      devis.numero_demande,
      devis.numero_devis
    ].some((valeur) => String(valeur || '').toLowerCase().includes(termeFiltre)));
  }, [details, termeFiltre]);

  const montantTotalFiltre = detailsFiltres.reduce((total, devis) => total + Number(devis.montant || 0), 0);

  if (chargement) {
    return <div className="page" aria-busy="true"><div className="squelette squelette-titre" /></div>;
  }

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Tableau de bord', path: '/' }, { label: 'Devis non payés' }]} />

      <header className="obat-page-header">
        <div>
          <span>ADE • SUIVI DES PAIEMENTS</span>
          <h1 className="obat-page-title">Devis non payés</h1>
          <p className="obat-page-subtitle">Suivi des devis en attente de règlement.</p>
        </div>
      </header>

      <section className="obat-section-card">
        <div className="obat-section-card-header" style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', alignItems: 'center', gap: 12, width: '100%' }}>
          <div className="obat-section-card-title">Tableau des devis non payés</div>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            {Number(donnees?.total || 0)} devis · {Number(donnees?.montant_total || 0).toLocaleString('fr-DZ')} DA
          </span>
          <div />
          <label style={{ width: 'min(100%, 360px)', margin: 0 }}>
            <span className="sr-only">Filtrer les devis non payés</span>
            <input
              type="search"
              value={filtre}
              onChange={(event) => setFiltre(event.target.value)}
              placeholder="Filtrer par demande, client, devis..."
              aria-label="Filtrer les devis non payés"
              style={{ width: '100%' }}
            />
          </label>
        </div>
        <div className="obat-section-card-body">
          {detailsFiltres.length > 0 ? (
            <div className="obat-payment-table-wrap">
              <table className="obat-payment-table">
                <thead>
                  <tr>
                    <th>Demande</th>
                    <th>Client</th>
                    <th>Devis</th>
                    <th>Date d’émission</th>
                    <th>Montant</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {detailsFiltres.map((devis) => (
                    <tr key={devis.id_devis}>
                      <td>{devis.numero_demande || '—'}</td>
                      <td>{devis.demandeur || '—'}</td>
                      <td>{devis.numero_devis || '—'}</td>
                      <td>{devis.date_emission ? new Date(devis.date_emission).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="obat-payment-amount">{Number(devis.montant || 0).toLocaleString('fr-DZ')} DA</td>
                      <td>
                        <Link className="obat-btn obat-btn-sec" to={`/demandes/${devis.id_demande}/devis/${devis.id_devis}`}>
                          Voir le devis
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan="4">Total affiché</th>
                    <th className="obat-payment-amount">{montantTotalFiltre.toLocaleString('fr-DZ')} DA</th>
                    <th>{detailsFiltres.length} devis</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : termeFiltre ? (
            <p>Aucun devis non payé ne correspond au filtre.</p>
          ) : (
            <p>Aucun devis non payé enregistré.</p>
          )}
        </div>
      </section>
    </div>
  );
}
