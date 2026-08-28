import { useEffect, useState } from 'react';
import client from '../../api/client';
import { notifierErreur } from '../../utils/notifications';

export default function PanneauTravaux({ idDemande, travaux, devis, onEnregistre }) {
  const devisListe = Array.isArray(devis) ? devis : (devis ? [devis] : []);
  const devisPaye = devisListe.length > 0 && devisListe.every((item) => item.statut_paiement === 'PAYE');
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({
    date_debut: travaux?.date_debut?.slice(0, 10) || '',
    date_fin: travaux?.date_fin?.slice(0, 10) || '',
    equipe_execution: travaux?.equipe_execution || '',
    numero_compteur: travaux?.numero_compteur || '',
    observations: travaux?.observations || ''
  });
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    setForm({
      date_debut: travaux?.date_debut?.slice(0, 10) || '',
      date_fin: travaux?.date_fin?.slice(0, 10) || '',
      equipe_execution: travaux?.equipe_execution || '',
      numero_compteur: travaux?.numero_compteur || '',
      observations: travaux?.observations || ''
    });
  }, [travaux]);

  async function enregistrer(e) {
    e.preventDefault();
    if (!devisPaye) {
      await notifierErreur('Le devis doit être payé avant de renseigner l’exécution des travaux.');
      return;
    }
    setEnvoi(true);
    try {
      await client.put(`/demandes/${idDemande}/travaux`, form);
      setOuvert(false);
      onEnregistre();
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Exécution des travaux</h3>
        <button className="btn btn-secondary" disabled={!devisPaye} onClick={() => setOuvert((o) => !o)} title={!devisPaye ? 'Le devis doit être payé avant de renseigner les travaux.' : undefined}>
          {travaux ? 'Modifier' : 'Renseigner'}
        </button>
      </div>

      {!devisPaye && <p style={{ color: 'var(--color-text-muted)', marginTop: 12 }}>Le devis doit être payé avant de renseigner l’exécution des travaux.</p>}
      {!ouvert && travaux && (
        <div className="grille-info" style={{ marginTop: 16 }}>
          <div><span className="info-label">Ordre d'exécution</span><div className="mono">{travaux.numero_ordre_execution || '—'}</div></div>
          <div><span className="info-label">Début</span><div>{travaux.date_debut ? new Date(travaux.date_debut).toLocaleDateString('fr-FR') : '—'}</div></div>
          <div><span className="info-label">Fin</span><div>{travaux.date_fin ? new Date(travaux.date_fin).toLocaleDateString('fr-FR') : '—'}</div></div>
          <div><span className="info-label">Équipe</span><div>{travaux.equipe_execution || '—'}</div></div>
          <div><span className="info-label">N° compteur posé</span><div className="mono">{travaux.numero_compteur || '—'}</div></div>
        </div>
      )}
      {!ouvert && !travaux && <p style={{ color: 'var(--color-text-muted)', marginTop: 12 }}>Travaux non encore renseignés.</p>}

      {ouvert && (
        <form onSubmit={enregistrer} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="champ">
              <label>Date de début</label>
              <input type="date" value={form.date_debut} onChange={(e) => setForm({ ...form, date_debut: e.target.value })} />
            </div>
            <div className="champ">
              <label>Date de fin</label>
              <input type="date" value={form.date_fin} onChange={(e) => setForm({ ...form, date_fin: e.target.value })} />
            </div>
            <div className="champ">
              <label>Équipe d'exécution</label>
              <input value={form.equipe_execution} onChange={(e) => setForm({ ...form, equipe_execution: e.target.value })} />
            </div>
            <div className="champ">
              <label>N° compteur posé</label>
              <input value={form.numero_compteur} onChange={(e) => setForm({ ...form, numero_compteur: e.target.value })} />
            </div>
          </div>
          <div className="champ">
            <label>Observations</label>
            <textarea rows={2} value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
          </div>
          <button className="btn btn-primary" disabled={envoi}>{envoi ? 'Enregistrement...' : 'Enregistrer'}</button>
        </form>
      )}
    </div>
  );
}
