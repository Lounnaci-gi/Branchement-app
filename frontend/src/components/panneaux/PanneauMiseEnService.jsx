import { useEffect, useState } from 'react';
import client from '../../api/client';
import { notifierErreur, notifierSucces } from '../../utils/notifications';
import InputDate from '../InputDate';

export default function PanneauMiseEnService({ idDemande, miseEnService, travaux, onEnregistre }) {
  const travauxRenseignes = Boolean(travaux && (travaux.id_travaux || travaux.numero_ordre_execution));
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({
    date_mise_service: miseEnService?.date_mise_service?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    numero_abonne: miseEnService?.numero_abonne || '',
    index_initial: miseEnService?.index_initial ?? 0
  });
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    setForm({
      date_mise_service: miseEnService?.date_mise_service?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      numero_abonne: miseEnService?.numero_abonne || '',
      index_initial: miseEnService?.index_initial ?? 0
    });
  }, [miseEnService]);

  async function enregistrer(e) {
    e.preventDefault();
    if (!travauxRenseignes) {
      await notifierErreur('L’exécution des travaux doit être renseignée avant de renseigner la mise en service.');
      return;
    }
    setEnvoi(true);
    try {
      await client.put(`/demandes/${idDemande}/mise-en-service`, form);
      setOuvert(false);
      onEnregistre();
      await notifierSucces('Mise en service enregistrée avec succès.');
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || 'Erreur lors de l’enregistrement de la mise en service.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Mise en service</h3>
        <button
          className="btn btn-secondary"
          disabled={!travauxRenseignes}
          onClick={() => setOuvert((o) => !o)}
          title={!travauxRenseignes ? 'L’exécution des travaux doit être renseignée avant de renseigner la mise en service.' : undefined}
        >
          {ouvert ? 'Fermer' : miseEnService ? 'Modifier' : 'Renseigner'}
        </button>
      </div>

      {!travauxRenseignes && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: 12 }}>
          L’exécution des travaux doit être renseignée avant de pouvoir enregistrer la mise en service.
        </p>
      )}

      {!ouvert && travauxRenseignes && miseEnService && (
        <div className="grille-info" style={{ marginTop: 16 }}>
          <div><span className="info-label">Date de mise en service</span><div>{miseEnService.date_mise_service ? new Date(miseEnService.date_mise_service).toLocaleDateString('fr-FR') : '—'}</div></div>
          <div><span className="info-label">N° abonné (facturation)</span><div className="mono">{miseEnService.numero_abonne || '—'}</div></div>
          <div><span className="info-label">Index initial</span><div>{miseEnService.index_initial ?? '—'} m³</div></div>
        </div>
      )}
      {travauxRenseignes && !miseEnService && !ouvert && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: 12 }}>Branchement pas encore mis en service.</p>
      )}

      {ouvert && travauxRenseignes && (
        <form onSubmit={enregistrer} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="champ">
              <label>Date de mise en service</label>
              <InputDate
                required
                value={form.date_mise_service}
                onChange={(val) => setForm({ ...form, date_mise_service: val })}
              />
            </div>
            <div className="champ">
              <label>N° abonné (système facturation)</label>
              <input value={form.numero_abonne} onChange={(e) => setForm({ ...form, numero_abonne: e.target.value })} />
            </div>
            <div className="champ">
              <label>Index initial du compteur (m³)</label>
              <input type="number" step="0.001" value={form.index_initial} onChange={(e) => setForm({ ...form, index_initial: e.target.value })} />
            </div>
          </div>
          <button className="btn btn-primary" disabled={envoi}>{envoi ? 'Enregistrement...' : 'Confirmer la mise en service'}</button>
        </form>
      )}
    </div>
  );
}

