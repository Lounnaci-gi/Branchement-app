import { useEffect, useState } from 'react';
import client from '../../api/client';
import { imprimerDevis } from '../../utils/impressionDevis';

export default function PanneauEtude({ idDemande, demande, etude, onEnregistre }) {
  const [ouvert, setOuvert] = useState(false);
  const [form, setForm] = useState({
    date_visite: etude?.date_visite?.slice(0, 10) || '',
    distance_reseau_m: etude?.distance_reseau_m || '',
    diametre_conduite: etude?.diametre_conduite || '',
    faisabilite: etude?.faisabilite || 'Faisable',
    observations: etude?.observations || ''
  });
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    setForm({
      date_visite: etude?.date_visite?.slice(0, 10) || '',
      distance_reseau_m: etude?.distance_reseau_m ?? '',
      diametre_conduite: etude?.diametre_conduite || '',
      faisabilite: etude?.faisabilite || 'Faisable',
      observations: etude?.observations || ''
    });
  }, [etude]);

  async function enregistrer(e) {
    e.preventDefault();
    setEnvoi(true);
    const fenetre = window.open('', '_blank', 'width=900,height=1000');
    let imprime = false;
    try {
      await client.put(`/demandes/${idDemande}/etude`, form);
      const dateEtude = form.date_visite || new Date();
      imprimerDevis({ ...demande, date_visite: form.date_visite, date_etude_terminee: dateEtude }, fenetre, dateEtude);
      imprime = true;
      setOuvert(false);
      onEnregistre();
    } finally {
      if (!imprime && fenetre && !fenetre.closed) fenetre.close();
      setEnvoi(false);
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Étude technique</h3>
        <button className="btn btn-secondary" onClick={() => setOuvert((o) => !o)}>
          {etude ? 'Modifier' : 'Renseigner'}
        </button>
      </div>

      {!ouvert && etude && (
        <div className="grille-info" style={{ marginTop: 16 }}>
          <div><span className="info-label">Date de visite</span><div>{etude.date_visite ? new Date(etude.date_visite).toLocaleDateString('fr-FR') : '—'}</div></div>
          <div><span className="info-label">Distance au réseau</span><div>{etude.distance_reseau_m ? `${etude.distance_reseau_m} m` : '—'}</div></div>
          <div><span className="info-label">Diamètre conduite</span><div>{etude.diametre_conduite || '—'}</div></div>
          <div><span className="info-label">Faisabilité</span><div>{etude.faisabilite || '—'}</div></div>
        </div>
      )}
      {!ouvert && !etude && <p style={{ color: 'var(--color-text-muted)', marginTop: 12 }}>Aucune étude renseignée.</p>}

      {ouvert && (
        <form onSubmit={enregistrer} style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="champ">
              <label>Date de visite</label>
              <input type="date" value={form.date_visite} onChange={(e) => setForm({ ...form, date_visite: e.target.value })} />
            </div>
            <div className="champ">
              <label>Faisabilité</label>
              <select value={form.faisabilite} onChange={(e) => setForm({ ...form, faisabilite: e.target.value })}>
                <option value="Faisable">Faisable</option>
                <option value="Faisable_sous_reserve">Faisable sous réserve</option>
                <option value="Non_faisable">Non faisable</option>
              </select>
            </div>
            <div className="champ">
              <label>Distance au réseau (m)</label>
              <input type="number" step="0.1" value={form.distance_reseau_m} onChange={(e) => setForm({ ...form, distance_reseau_m: e.target.value })} />
            </div>
            <div className="champ">
              <label>Diamètre conduite</label>
              <input value={form.diametre_conduite} onChange={(e) => setForm({ ...form, diametre_conduite: e.target.value })} placeholder="ex: 110mm" />
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
