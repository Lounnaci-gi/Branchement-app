import { useEffect, useState } from 'react';
import client from '../api/client';
import Breadcrumbs from '../components/Breadcrumbs';
import { demanderConfirmation, notifierErreur, notifierSucces } from '../utils/notifications';

const IDENTIFIANT_REGEX = /^[^<>\u0000-\u001F\u007F]{1,150}$/u;

function normaliserIdentifiant(identifiant) {
  return String(identifiant || '').trim();
}

function identifiantsIdentiques(identifiantA, identifiantB) {
  return normaliserIdentifiant(identifiantA).toLocaleLowerCase() === normaliserIdentifiant(identifiantB).toLocaleLowerCase();
}

export default function Profil() {
  const [emailInitial, setEmailInitial] = useState('');
  const [email, setEmail] = useState('');
  const [nomInitial, setNomInitial] = useState('');
  const [prenomInitial, setPrenomInitial] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [ancienMotDePasse, setAncienMotDePasse] = useState('');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState('');
  const [chargement, setChargement] = useState(false);
  const [afficherAncien, setAfficherAncien] = useState(false);
  const [afficherNouveau, setAfficherNouveau] = useState(false);
  const [afficherConfirmation, setAfficherConfirmation] = useState(false);

  useEffect(() => {
    client.get('/auth/profil')
      .then(({ data }) => {
        setEmailInitial(data.email || '');
        setEmail(data.email || '');
        setNomInitial(data.nom || '');
        setPrenomInitial(data.prenom || '');
        setNom(data.nom || '');
        setPrenom(data.prenom || '');
        localStorage.setItem('agent', JSON.stringify(data));
      })
      .catch((err) => notifierErreur(err.response?.data?.erreur || 'Impossible de charger le profil.'));
  }, []);

  async function soumettre(e) {
    e.preventDefault();
    const emailTrim = normaliserIdentifiant(email);
    const emailChange = !identifiantsIdentiques(emailTrim, emailInitial);
    const nomChange = nom.trim() !== nomInitial;
    const prenomChange = prenom.trim() !== prenomInitial;
    const motDePasseChange = nouveauMotDePasse.length > 0;

    if (!ancienMotDePasse) {
      notifierErreur('Saisissez votre mot de passe actuel pour confirmer les modifications.');
      return;
    }
    if (!emailChange && !nomChange && !prenomChange && !motDePasseChange) {
      notifierErreur('Modifiez votre identifiant ou votre mot de passe avant d’enregistrer.');
      return;
    }
    if (emailChange && !IDENTIFIANT_REGEX.test(emailTrim)) {
      notifierErreur('Saisissez un identifiant valide.');
      return;
    }
    if (motDePasseChange && nouveauMotDePasse.length < 8) {
      notifierErreur('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (motDePasseChange && nouveauMotDePasse !== confirmationMotDePasse) {
      notifierErreur('La confirmation du nouveau mot de passe ne correspond pas.');
      return;
    }

    const confirmation = await demanderConfirmation('Confirmer la modification de votre identifiant et/ou de votre mot de passe ?');
    if (!confirmation) {
      return;
    }

    setChargement(true);
    try {
      const payload = {
        ancien_mot_de_passe: ancienMotDePasse
      };
      if (emailChange) {
        payload.email = emailTrim;
      }
      if (motDePasseChange) {
        payload.nouveau_mot_de_passe = nouveauMotDePasse;
      }
      if (nomChange) payload.nom = nom.trim();
      if (prenomChange) payload.prenom = prenom.trim();

      const { data } = await client.patch('/auth/profil', payload);
      localStorage.setItem('token', data.token);
      localStorage.setItem('agent', JSON.stringify(data.agent));
      setEmailInitial(data.agent.email);
      setEmail(data.agent.email);
      setNomInitial(data.agent.nom || '');
      setPrenomInitial(data.agent.prenom || '');
      setNom(data.agent.nom || '');
      setPrenom(data.agent.prenom || '');
      setAncienMotDePasse('');
      setNouveauMotDePasse('');
      setConfirmationMotDePasse('');
      window.dispatchEvent(new Event('agent-updated'));
      notifierSucces('Modification réussie.');
    } catch (err) {
      notifierErreur(err.response?.data?.erreur || 'Erreur lors de la mise à jour du profil.');
    } finally {
      setChargement(false);
    }
  }

  return (
    <section className="page">
      <Breadcrumbs items={[{ label: 'Tableau de bord', path: '/', icon: '📊' }, { label: 'Mon profil' }]} />
      <header className="page-header">
        <div>
          <h1>Mon profil</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: 4 }}>Paramètres du compte et identifiants de connexion</p>
        </div>
      </header>
      <form onSubmit={soumettre} className="card" style={{ maxWidth: 520, padding: 24 }}>
        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
          <legend style={{ fontWeight: 600, marginBottom: 12 }}>Nom affiché</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="champ">
              <label htmlFor="profil-prenom">Prénom</label>
              <input id="profil-prenom" type="text" maxLength="80" value={prenom} onChange={(e) => setPrenom(e.target.value)} autoComplete="given-name" />
            </div>
            <div className="champ">
              <label htmlFor="profil-nom">Nom</label>
              <input id="profil-nom" type="text" maxLength="80" value={nom} onChange={(e) => setNom(e.target.value)} autoComplete="family-name" />
            </div>
          </div>
        </fieldset>

        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
          <legend style={{ fontWeight: 600, marginBottom: 12 }}>Identifiant de connexion</legend>
          <div className="champ">
            <label htmlFor="profil-email">Identifiant</label>
            <input
              id="profil-email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
        </fieldset>

        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
          <legend style={{ fontWeight: 600, marginBottom: 12 }}>Mot de passe</legend>
          <div className="champ">
            <label htmlFor="ancien-mot-de-passe">Mot de passe actuel</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="ancien-mot-de-passe"
                type={afficherAncien ? 'text' : 'password'}
                value={ancienMotDePasse}
                onChange={(e) => setAncienMotDePasse(e.target.value)}
                required
                autoComplete="current-password"
                style={{ flex: 1 }}
              />
              <button type="button" className="btn profil-toggle-password" onClick={() => setAfficherAncien((value) => !value)} aria-label={afficherAncien ? 'Masquer le mot de passe actuel' : 'Afficher le mot de passe actuel'} title={afficherAncien ? 'Masquer' : 'Afficher'}>
                <span aria-hidden="true">{afficherAncien ? '🙈' : '👁'}</span>
              </button>
            </div>
          </div>
          <div className="champ">
            <label htmlFor="nouveau-mot-de-passe">Nouveau mot de passe</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="nouveau-mot-de-passe"
                type={afficherNouveau ? 'text' : 'password'}
                minLength="8"
                value={nouveauMotDePasse}
                onChange={(e) => setNouveauMotDePasse(e.target.value)}
                autoComplete="new-password"
                placeholder="Laisser vide pour ne pas changer"
                style={{ flex: 1 }}
              />
              <button type="button" className="btn profil-toggle-password" onClick={() => setAfficherNouveau((value) => !value)} aria-label={afficherNouveau ? 'Masquer le nouveau mot de passe' : 'Afficher le nouveau mot de passe'} title={afficherNouveau ? 'Masquer' : 'Afficher'}>
                <span aria-hidden="true">{afficherNouveau ? '🙈' : '👁'}</span>
              </button>
            </div>
          </div>
          <div className="champ">
            <label htmlFor="confirmation-mot-de-passe">Confirmer le nouveau mot de passe</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="confirmation-mot-de-passe"
                type={afficherConfirmation ? 'text' : 'password'}
                minLength="8"
                value={confirmationMotDePasse}
                onChange={(e) => setConfirmationMotDePasse(e.target.value)}
                autoComplete="new-password"
                placeholder="Répétez le nouveau mot de passe"
                style={{ flex: 1 }}
              />
              <button type="button" className="btn profil-toggle-password" onClick={() => setAfficherConfirmation((value) => !value)} aria-label={afficherConfirmation ? 'Masquer la confirmation du mot de passe' : 'Afficher la confirmation du mot de passe'} title={afficherConfirmation ? 'Masquer' : 'Afficher'}>
                <span aria-hidden="true">{afficherConfirmation ? '🙈' : '👁'}</span>
              </button>
            </div>
          </div>
        </fieldset>

        <button type="submit" className="btn btn-primary" disabled={chargement}>
          {chargement ? 'Enregistrement...' : 'Enregistrer les modifications'}
        </button>
      </form>
    </section>
  );
}
