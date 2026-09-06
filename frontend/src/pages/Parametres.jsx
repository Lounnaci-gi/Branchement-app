import { useEffect, useState } from 'react';
import client from '../api/client';
import Breadcrumbs from '../components/Breadcrumbs';
import { notifierErreur, notifierSucces } from '../utils/notifications';

export default function Parametres() {
  const [tvaPrestation, setTvaPrestation] = useState('19');
  const [tvaTravaux, setTvaTravaux] = useState('19');
  const [dateEffet, setDateEffet] = useState(new Date().toISOString().slice(0, 10));
  const [historique, setHistorique] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);

  async function chargerParametres() {
    return client.get('/parametres/tva')
      .then(({ data }) => {
        setTvaPrestation(String(data.tvaPrestation ?? 19));
        setTvaTravaux(String(data.tvaTravaux ?? 19));
        setHistorique(data.historique || []);
      });
  }

  useEffect(() => {
    chargerParametres()
      .catch((err) => notifierErreur(err.response?.data?.erreur || 'Impossible de charger les paramètres TVA.'))
      .finally(() => setChargement(false));
  }, []);

  async function enregistrer(e) {
    e.preventDefault();
    const prestation = Number(tvaPrestation);
    const travaux = Number(tvaTravaux);
    if (![prestation, travaux].every((taux) => Number.isFinite(taux) && taux >= 0 && taux <= 100)) {
      notifierErreur('Les taux doivent être compris entre 0 et 100 %.');
      return;
    }

    setEnregistrement(true);
    try {
      const { data } = await client.put('/parametres/tva', {
        tvaPrestation: prestation,
        tvaTravaux: travaux,
        dateEffet
      });
      await chargerParametres();
      notifierSucces('Les paramètres TVA ont été enregistrés.');
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || 'Impossible d’enregistrer les paramètres TVA.');
    } finally {
      setEnregistrement(false);
    }
  }

  return (
    <section className="page">
      <Breadcrumbs items={[{ label: 'Tableau de bord', path: '/', icon: '📊' }, { label: 'Paramètres' }]} />
      <header className="obat-page-header">
        <div>
          <span>ADE • ADMINISTRATION</span>
          <h1 className="obat-page-title">Paramètres</h1>
          <p className="obat-page-subtitle">Configurez les taux de TVA appliqués aux nouveaux tarifs.</p>
        </div>
      </header>

      <form onSubmit={enregistrer} className="obat-section-card" style={{ maxWidth: 620, padding: 24 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Taux de TVA</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '6px 0 0', fontSize: 13 }}>
            Programmez les taux applicables aux nouveaux articles et tarifs à partir d’une date donnée.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="champ">
            <label htmlFor="tva-prestation">TVA Prestation (%)</label>
            <input
              id="tva-prestation"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={tvaPrestation}
              onChange={(e) => setTvaPrestation(e.target.value)}
              disabled={chargement || enregistrement}
              required
            />
          </div>
          <div className="champ">
            <label htmlFor="tva-travaux">TVA Travaux (%)</label>
            <input
              id="tva-travaux"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={tvaTravaux}
              onChange={(e) => setTvaTravaux(e.target.value)}
              disabled={chargement || enregistrement}
              required
            />
          </div>
          <div className="champ">
            <label htmlFor="date-effet-tva">Date d’effet</label>
            <input
              id="date-effet-tva"
              type="date"
              value={dateEffet}
              onChange={(e) => setDateEffet(e.target.value)}
              disabled={chargement || enregistrement}
              required
            />
          </div>
        </div>

        <button type="submit" className="obat-btn obat-btn-pri" disabled={chargement || enregistrement} style={{ marginTop: 24 }}>
          {enregistrement ? 'Enregistrement...' : '✓ Enregistrer les paramètres'}
        </button>
      </form>

      <section className="obat-section-card" style={{ maxWidth: 620, padding: 24, marginTop: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Historique des taux</h2>
        <div style={{ overflowX: 'auto', marginTop: 14 }}>
          <table className="obat-articles-table">
            <thead>
              <tr><th>Date d’effet</th><th>TVA Prestation</th><th>TVA Travaux</th></tr>
            </thead>
            <tbody>
              {Array.from(new Set(historique.map((ligne) => ligne.dateEffet))).map((date) => (
                <tr key={date}>
                  <td>{new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR')}</td>
                  <td>{historique.find((ligne) => ligne.dateEffet === date && ligne.type === 'PRESTATION')?.taux ?? '—'}%</td>
                  <td>{historique.find((ligne) => ligne.dateEffet === date && ligne.type === 'TRAVAUX')?.taux ?? '—'}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}