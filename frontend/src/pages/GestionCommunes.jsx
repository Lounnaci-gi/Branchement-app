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
      <header className="obat-page-header">
        <div>
          <span className="obat-section-badge">ADE • RÉFÉRENTIEL TERRITORIAL</span>
          <h1 className="obat-page-title">Gestion des communes</h1>
          <p className="obat-page-subtitle">Référentiel des agences et communes rattachées pour le déploiement des branchements</p>
        </div>
      </header>

      <div className="obat-section-card" style={{ maxWidth: 860 }}>
        <div className="obat-section-card-header">
          <div className="obat-section-card-title">
            <span>➕</span> Ajouter une nouvelle commune
          </div>
        </div>
        <div className="obat-section-card-body">
          <form onSubmit={ajouter} noValidate>
            <div className="grid grid-cols-1 gap-4 items-end md:grid-cols-3">
              <div className="champ">
                <label htmlFor="nom-commune">Nom de la commune *</label>
                <input id="nom-commune" required value={form.nom_commune} onChange={(e) => modifier('nom_commune', e.target.value)} placeholder="Ex: Tizi Ouzou" />
              </div>
              <div className="champ">
                <label htmlFor="wilaya">Wilaya *</label>
                <input id="wilaya" required value={form.wilaya} onChange={(e) => modifier('wilaya', e.target.value)} placeholder="Ex: Tizi Ouzou" />
              </div>
              <div className="champ">
                <label htmlFor="agence">Agence de rattachement *</label>
                <select id="agence" required value={form.id_agence} onChange={(e) => modifier('id_agence', e.target.value)}>
                  <option value="">Sélectionner...</option>
                  {agences.map((agence) => (
                    <option key={agence.id_agence} value={agence.id_agence}>{agence.nom_agence}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" className="obat-btn obat-btn-pri" style={{ marginTop: 12 }} disabled={envoi}>
              {envoi ? 'Enregistrement...' : '✓ Ajouter la commune'}
            </button>
          </form>
        </div>
      </div>

      <div className="obat-section-card" style={{ maxWidth: 860 }}>
        <div className="obat-section-card-header">
          <div className="obat-section-card-title">
            <span>📍</span> Communes enregistrées ({communes.length})
          </div>
        </div>
        <div className="tableau-responsive">
          <table className="tableau">
            <thead>
              <tr>
                <th>Commune</th>
                <th>Wilaya</th>
                <th>Agence rattachée</th>
              </tr>
            </thead>
            <tbody>
              {communes.map((commune) => (
                <tr key={commune.id_commune}>
                  <td><strong>{commune.nom_commune}</strong></td>
                  <td>{commune.wilaya}</td>
                  <td style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{commune.nom_agence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
