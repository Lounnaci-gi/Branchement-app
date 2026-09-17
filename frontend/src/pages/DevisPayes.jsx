import { useEffect, useState } from 'react';
import client from '../api/client';
import Breadcrumbs from '../components/Breadcrumbs';
import { notifierErreur } from '../utils/notifications';

function afficherReference(devis) {
  if (devis.numero_recu) return `Reçu : ${devis.numero_recu}`;
  if (devis.numero_cheque) return `Chèque : ${devis.numero_cheque}`;
  if (devis.numero_versement) return `Versement : ${devis.numero_versement}`;
  return '—';
}

export default function DevisPayes() {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    client.get('/dashboard')
      .then((res) => setDonnees(res.data.devisPayes || { total: 0, montant_total: 0, details: [] }))
      .catch(() => notifierErreur('Impossible de charger les devis payés.'))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) {
    return <div className="page" aria-busy="true"><div className="squelette squelette-titre" /></div>;
  }

  const details = donnees?.details || [];

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Tableau de bord', path: '/' }, { label: 'Devis payés' }]} />

      <header className="obat-page-header">
        <div>
          <span>ADE • DOSSIER TECHNIQUE</span>
          <h1 className="obat-page-title">Devis payés</h1>
          <p className="obat-page-subtitle">Consultation des paiements enregistrés et de leurs références.</p>
        </div>
      </header>

      <section className="obat-section-card">
        <div className="obat-section-card-header">
          <div className="obat-section-card-title">Informations des paiements</div>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            {Number(donnees?.total || 0)} devis · {Number(donnees?.montant_total || 0).toLocaleString('fr-DZ')} DA
          </span>
        </div>
        <div className="obat-section-card-body">
          {details.length > 0 ? (
            <div className="obat-payment-table-wrap">
              <table className="obat-payment-table">
                <thead>
                  <tr>
                    <th>Demande</th>
                    <th>Devis</th>
                    <th>Montant</th>
                    <th>Mode</th>
                    <th>Date de paiement</th>
                    <th>Référence</th>
                    <th>Banque</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((devis) => (
                    <tr key={devis.id_devis}>
                      <td>{devis.numero_demande || '—'}</td>
                      <td>{devis.numero_devis || '—'}</td>
                      <td className="obat-payment-amount">{Number(devis.montant || 0).toLocaleString('fr-DZ')} DA</td>
                      <td>{devis.mode_paiement || '—'}</td>
                      <td>{devis.date_paiement ? new Date(devis.date_paiement).toLocaleDateString('fr-FR') : '—'}</td>
                      <td>{afficherReference(devis)}</td>
                      <td>{devis.banque || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Aucun devis payé enregistré.</p>
          )}
        </div>
      </section>
    </div>
  );
}
