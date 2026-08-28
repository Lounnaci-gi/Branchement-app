import { useEffect, useState } from 'react';
import client from '../api/client';
import Breadcrumbs from '../components/Breadcrumbs';
import { notifierSucces, notifierErreur } from '../utils/notifications';

const FORMULAIRE_VIDE = { nom_commune: '', wilaya: '', id_agence: '' };

export default function GestionCommunes() {
  const [communes, setCommunes] = useState([]);
  const [agences, setAgences] = useState([]);
  const [form, setForm] = useState(FORMULAIRE_VIDE);
  const [envoi, setEnvoi] = useState(false);

  async function chargerDonnees() {
    const [communesResponse, agencesResponse] = await Promise.all([
      client.get('/referentiels/communes'),
      client.get('/referentiels/agences')
    ]);
    setCommunes(communesResponse.data);
    setAgences(agencesResponse.data);
  }

  useEffect(() => {
    chargerDonnees().catch((err) => {
      notifierErreur(err.response?.data?.erreur || 'Impossible de charger les référentiels.');
    });
  }, []);

  function modifier(champ, valeur) {
    setForm((ancienne) => ({ ...ancienne, [champ]: valeur }));
  }

  async function ajouter(e) {
    e.preventDefault();
    setEnvoi(true);
    try {
      await client.post('/referentiels/communes', form);
      setForm(FORMULAIRE_VIDE);
      await chargerDonnees();
      await notifierSucces('La commune est maintenant disponible dans les demandes.');
    } catch (err) {
      await notifierErreur(err.response?.data?.erreur || "Erreur lors de l'ajout de la commune.");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="page">
      <Breadcrumbs items={[{ label: 'Tableau de bord', path: '/', icon: '📊' }, { label: 'Gestion des communes' }]} />
      <header className="page-header">
        <div>
          <h1>Gestion des communes</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>Référentiel des agences et communes rattachées</p>
        </div>
      </header>

      <form onSubmit={ajouter} className="card" style={{ padding: 24, marginBottom: 20, maxWidth: 760 }}>
        <h3 style={{ marginBottom: 16 }}>Ajouter une commune</h3>
        <div className="grid grid-cols-1 gap-4 items-end md:grid-cols-3">
          <div className="champ">
            <label htmlFor="nom-commune">Nom de la commune *</label>
            <input id="nom-commune" required value={form.nom_commune} onChange={(e) => modifier('nom_commune', e.target.value)} />
          </div>
          <div className="champ">
            <label htmlFor="wilaya">Wilaya *</label>
            <input id="wilaya" required value={form.wilaya} onChange={(e) => modifier('wilaya', e.target.value)} />
          </div>
          <div className="champ">
            <label htmlFor="agence">Agence *</label>
            <select id="agence" required value={form.id_agence} onChange={(e) => modifier('id_agence', e.target.value)}>
              <option value="">Sélectionner...</option>
              {agences.map((agence) => (
                <option key={agence.id_agence} value={agence.id_agence}>{agence.nom_agence}</option>
              ))}
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-primary mt-2" disabled={envoi}>
          {envoi ? 'Ajout...' : 'Ajouter la commune'}
        </button>
      </form>

      <section className="card" style={{ padding: 24 }}>
        <h3 style={{ marginBottom: 16 }}>Communes enregistrées ({communes.length})</h3>
        <div style={{ display: 'grid', gap: 8 }}>
          {communes.map((commune) => (
            <div key={commune.id_commune} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
              <strong>{commune.nom_commune}</strong>
              <span>{commune.wilaya}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>{commune.nom_agence}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
