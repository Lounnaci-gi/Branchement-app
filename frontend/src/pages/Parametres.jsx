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
  const [logoDevis, setLogoDevis] = useState(null);
  const [logoSelectionne, setLogoSelectionne] = useState(null);
  const [chargementLogo, setChargementLogo] = useState(true);
  const [enregistrementLogo, setEnregistrementLogo] = useState(false);

  async function chargerParametres() {
    return client.get('/parametres/tva')
      .then(({ data }) => {
        setTvaPrestation(String(data.tvaPrestation ?? 19));
        setTvaTravaux(String(data.tvaTravaux ?? 19));
        setHistorique(data.historique || []);
      });
  }

  async function chargerLogoDevis() {
    const { data } = await client.get('/parametres/logo-devis');
    setLogoDevis(data.logo || null);
  }

  useEffect(() => {
    chargerParametres()
      .catch((err) => notifierErreur(err.response?.data?.erreur || 'Impossible de charger les paramètres TVA.'))
      .finally(() => setChargement(false));
    chargerLogoDevis()
      .catch((err) => notifierErreur(err.response?.data?.erreur || 'Impossible de charger le logo du devis.'))
      .finally(() => setChargementLogo(false));
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

  function choisirLogo(e) {
    const fichier = e.target.files?.[0];
    e.target.value = '';
    if (!fichier) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(fichier.type)) {
      notifierErreur('Choisissez une image PNG, JPEG ou WebP.');
      return;
    }
    if (fichier.size > 512 * 1024) {
      notifierErreur('Le logo doit peser au maximum 512 Ko.');
      return;
    }

    const lecteur = new FileReader();
    lecteur.onload = () => setLogoSelectionne(String(lecteur.result || ''));
    lecteur.onerror = () => notifierErreur('Impossible de lire le fichier sélectionné.');
    lecteur.readAsDataURL(fichier);
  }

  async function enregistrerLogoDevis() {
    if (!logoSelectionne) return;
    setEnregistrementLogo(true);
    try {
      await client.put('/parametres/logo-devis', { image: logoSelectionne });
      setLogoDevis(logoSelectionne);
      setLogoSelectionne(null);
      notifierSucces('Le logo du devis a été enregistré.');
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || 'Impossible d’enregistrer le logo du devis.');
    } finally {
      setEnregistrementLogo(false);
    }
  }

  async function retablirLogoParDefaut() {
    setEnregistrementLogo(true);
    try {
      await client.delete('/parametres/logo-devis');
      setLogoDevis(null);
      setLogoSelectionne(null);
      notifierSucces('Le logo ADE par défaut est rétabli.');
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || 'Impossible de rétablir le logo par défaut.');
    } finally {
      setEnregistrementLogo(false);
    }
  }

  return (
    <section className="page">
      <Breadcrumbs items={[{ label: 'Tableau de bord', path: '/' }, { label: 'Paramètres' }]} />
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
          {enregistrement ? 'Enregistrement...' : 'Enregistrer les paramètres'}
        </button>
      </form>

      <section className="obat-section-card" style={{ maxWidth: 620, padding: 24, marginTop: 16 }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Logo du devis</h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '6px 0 0', fontSize: 13 }}>
            Ce logo apparaîtra sur les devis imprimés.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <img
            src={logoSelectionne || logoDevis || '/ade.png'}
            alt="Aperçu du logo de devis"
            style={{ width: 220, height: 90, objectFit: 'contain', border: '1px solid var(--color-border)', padding: 8, background: '#fff' }}
          />
          <div className="champ" style={{ flex: '1 1 260px' }}>
            <label htmlFor="logo-devis-fichier">Choisir une image</label>
            <input
              id="logo-devis-fichier"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={choisirLogo}
              disabled={chargementLogo || enregistrementLogo}
            />
            <small style={{ color: 'var(--color-text-muted)' }}>PNG, JPEG ou WebP, 512 Ko maximum.</small>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 20 }}>
          <button
            type="button"
            className="obat-btn obat-btn-pri"
            onClick={enregistrerLogoDevis}
            disabled={chargementLogo || enregistrementLogo || !logoSelectionne}
          >
            {enregistrementLogo ? 'Enregistrement...' : 'Enregistrer le logo'}
          </button>
          <button
            type="button"
            className="obat-btn obat-btn-sec"
            onClick={retablirLogoParDefaut}
            disabled={chargementLogo || enregistrementLogo || (!logoDevis && !logoSelectionne)}
          >
            Rétablir le logo ADE
          </button>
        </div>
      </section>

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