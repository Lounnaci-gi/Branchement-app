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

export default function DevisPayes({ mode = 'tous' }) {
  const [donnees, setDonnees] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [filtre, setFiltre] = useState('');
  const [triColonne, setTriColonne] = useState('datePaiement');
  const [triOrdre, setTriOrdre] = useState('desc');

  useEffect(() => {
    client.get('/dashboard')
      .then((res) => setDonnees(res.data || {}))
      .catch(() => notifierErreur('Impossible de charger les devis.'))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) {
    return <div className="page" aria-busy="true"><div className="squelette squelette-titre" /></div>;
  }

  const devisPayes = Array.isArray(donnees?.devisPayes?.details) ? donnees.devisPayes.details : [];
  const devisNonPayes = Array.isArray(donnees?.devisNonPayes?.details) ? donnees.devisNonPayes.details : [];

  const detailsParMode = {
    tous: [
      ...devisPayes.map((devis) => ({ ...devis, statut: 'PAYE', date_reference: devis.date_paiement || devis.date_emission || null })),
      ...devisNonPayes.map((devis) => ({ ...devis, statut: 'IMPAYE', date_reference: devis.date_emission || null }))
    ],
    payes: devisPayes.map((devis) => ({ ...devis, statut: 'PAYE', date_reference: devis.date_paiement || devis.date_emission || null })),
    nonpayes: devisNonPayes.map((devis) => ({ ...devis, statut: 'IMPAYE', date_reference: devis.date_emission || null }))
  };

  const details = (detailsParMode[mode] || detailsParMode.tous).map((devis, index) => ({ ...devis, _ordre: index + 1 }));

  const termeFiltre = filtre.trim().toLowerCase();

  const detailsFiltres = details.filter((devis) => {
    if (!termeFiltre) return true;
    return [
      devis.demandeur,
      devis.numero_demande,
      devis.numero_devis,
      devis.mode_paiement,
      devis.statut,
      devis.numero_recu,
      devis.numero_cheque,
      devis.numero_versement,
      devis.banque
    ].some((valeur) => String(valeur || '').toLowerCase().includes(termeFiltre));
  });

  const changerTri = (colonne) => {
    if (triColonne === colonne) {
      setTriOrdre((precedent) => (precedent === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setTriColonne(colonne);
    setTriOrdre('asc');
  };

  const detailsTries = [...detailsFiltres].sort((a, b) => {
    let aVal = '';
    let bVal = '';

    switch (triColonne) {
      case 'ordre':
        aVal = a._ordre;
        bVal = b._ordre;
        break;
      case 'demande':
        aVal = a.numero_demande || '';
        bVal = b.numero_demande || '';
        break;
      case 'demandeur':
        aVal = a.demandeur || '';
        bVal = b.demandeur || '';
        break;
      case 'devis':
        aVal = a.numero_devis || '';
        bVal = b.numero_devis || '';
        break;
      case 'montant':
        aVal = Number(a.montant || 0);
        bVal = Number(b.montant || 0);
        break;
      case 'mode':
        aVal = a.mode_paiement || '';
        bVal = b.mode_paiement || '';
        break;
      case 'statut':
        aVal = a.statut || '';
        bVal = b.statut || '';
        break;
      case 'datePaiement':
        aVal = a.date_reference ? new Date(a.date_reference).getTime() : 0;
        bVal = b.date_reference ? new Date(b.date_reference).getTime() : 0;
        break;
      case 'reference':
        aVal = afficherReference(a);
        bVal = afficherReference(b);
        break;
      case 'banque':
        aVal = a.banque || '';
        bVal = b.banque || '';
        break;
      default:
        aVal = a.date_reference ? new Date(a.date_reference).getTime() : 0;
        bVal = b.date_reference ? new Date(b.date_reference).getTime() : 0;
    }

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return triOrdre === 'asc' ? -1 : 1;
    if (aVal > bVal) return triOrdre === 'asc' ? 1 : -1;
    return 0;
  });

  const montantTotalFiltre = detailsTries.reduce((total, devis) => total + Number(devis.montant || 0), 0);

  const libelleMode = {
    tous: { titre: 'Devis', sousTitre: 'Consultation des devis payés et non payés.' },
    payes: { titre: 'Devis payés', sousTitre: 'Consultation des devis réglés.' },
    nonpayes: { titre: 'Devis non payés', sousTitre: 'Suivi des devis en attente de règlement.' }
  };

  const page = libelleMode[mode] || libelleMode.tous;

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Tableau de bord', path: '/' }, { label: page.titre }]} />

      <header className="obat-page-header">
        <div>
          <span>ADE • DOSSIER TECHNIQUE</span>
          <h1 className="obat-page-title">{page.titre}</h1>
          <p className="obat-page-subtitle">{page.sousTitre}</p>
        </div>
      </header>

      <section className="obat-section-card">
        <div className="obat-section-card-header" style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', alignItems: 'center', gap: 12, width: '100%' }}>
          <div className="obat-section-card-title">Informations des devis</div>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}>
            {details.length} devis · {details.reduce((total, devis) => total + Number(devis.montant || 0), 0).toLocaleString('fr-DZ')} DA
          </span>
          <div />
          <label style={{ width: 'min(100%, 360px)', margin: 0, justifySelf: 'end' }}>
            <span className="sr-only">Filtrer les devis</span>
            <input
              type="search"
              value={filtre}
              onChange={(event) => setFiltre(event.target.value)}
              placeholder="Filtrer par demande, devis, statut..."
              aria-label="Filtrer les devis"
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
                    <th className="col-triable" onClick={() => changerTri('ordre')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Ordre</span>
                        {triColonne === 'ordre' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th className="col-triable" onClick={() => changerTri('demande')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Demande</span>
                        {triColonne === 'demande' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th className="col-triable" onClick={() => changerTri('demandeur')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Nom &amp; prénom / Raison sociale</span>
                        {triColonne === 'demandeur' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th className="col-triable" onClick={() => changerTri('devis')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Devis</span>
                        {triColonne === 'devis' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th className="col-triable" onClick={() => changerTri('statut')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Statut</span>
                        {triColonne === 'statut' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th className="col-triable" onClick={() => changerTri('montant')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Montant</span>
                        {triColonne === 'montant' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th className="col-triable" onClick={() => changerTri('mode')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Mode</span>
                        {triColonne === 'mode' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th className="col-triable" onClick={() => changerTri('datePaiement')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Date de paiement</span>
                        {triColonne === 'datePaiement' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th className="col-triable" onClick={() => changerTri('reference')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Référence</span>
                        {triColonne === 'reference' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                    <th className="col-triable" onClick={() => changerTri('banque')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Banque</span>
                        {triColonne === 'banque' && <span>{triOrdre === 'asc' ? '↑' : '↓'}</span>}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {detailsTries.map((devis) => (
                    <tr key={devis.id_devis}>
                      <td className="mono" style={{ fontWeight: 700 }}>{String(devis._ordre).padStart(3, '0')}</td>
                      <td>{devis.numero_demande || '—'}</td>
                      <td>{devis.demandeur || '—'}</td>
                      <td>{devis.numero_devis || '—'}</td>
                      <td className="obat-payment-amount">{Number(devis.montant || 0).toLocaleString('fr-DZ')} DA</td>
                      <td>{devis.mode_paiement || '—'}</td>
                      <td>{devis.date_paiement ? new Date(devis.date_paiement).toLocaleDateString('fr-FR') : '—'}</td>
                      <td>{afficherReference(devis)}</td>
                      <td>{devis.banque || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan="4">Total affiché</th>
                    <th className="obat-payment-amount">{montantTotalFiltre.toLocaleString('fr-DZ')} DA</th>
                    <th colSpan="5">{detailsFiltres.length} devis</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : termeFiltre ? (
            <p>Aucun devis payé ne correspond au filtre.</p>
          ) : (
            <p>Aucun devis payé enregistré.</p>
          )}
        </div>
      </section>
    </div>
  );
}
