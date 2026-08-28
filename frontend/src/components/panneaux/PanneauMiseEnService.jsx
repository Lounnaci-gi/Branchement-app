import { useEffect, useState } from 'react';
import client from '../../api/client';

export default function PanneauMiseEnService({ idDemande, miseEnService, onEnregistre }) {
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
    setEnvoi(true);
    try {
      await client.put(`/demandes/${idDemande}/mise-en-service`, form);
      setOuvert(false);
      onEnregistre();
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Mise en service</h3>
        <button className="btn btn-secondary" onClick={() => setOuvert((o) => !o)}>
          {ouvert ? 'Fermer' : miseEnService ? 'Modifier' : 'Renseigner'}
        </button>
      </div>

      {!ouvert && miseEnService && (
        <div className="grille-info" style={{ marginTop: 16 }}>
          <div><span className="info-label">Date de mise en service</span><div>{miseEnService.date_mise_service ? new Date(miseEnService.date_mise_service).toLocaleDateString('fr-FR') : '—'}</div></div>
          <div><span className="info-label">N° abonné (facturation)</span><div className="mono">{miseEnService.numero_abonne || '—'}</div></div>
          <div><span className="info-label">Index initial</span><div>{miseEnService.index_initial ?? '—'} m³</div></div>
        </div>
      )}
      {!miseEnService && !ouvert && <p style={{ color: 'var(--color-text-muted)', marginTop: 12 }}>Branchement pas encore mis en service.</p>}

      {ouvert && (
        <form onSubmit={enregistrer} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="champ">
              <label>Date de mise en service</label>
              <input type="date" required value={form.date_mise_service} onChange={(e) => setForm({ ...form, date_mise_service: e.target.value })} />
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
