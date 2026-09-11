import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import ThemeToggle from '../components/ThemeToggle';
import './Connexion.css';

const IDENTIFIANT_REGEX = /^[^<>\u0000-\u001F\u007F]{1,150}$/u;

export default function Connexion() {
  const [email, setEmail] = useState(() => localStorage.getItem('login_remember_identifiant') || '');
  const [motDePasse, setMotDePasse] = useState('');
  const [seSouvenir, setSeSouvenir] = useState(() => Boolean(localStorage.getItem('login_remember_identifiant')));
  const [afficherMotDePasse, setAfficherMotDePasse] = useState(false);
  const [capsLockActif, setCapsLockActif] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');

  const identifiantInputRef = useRef(null);
  const motDePasseInputRef = useRef(null);
  const navigate = useNavigate();

  // Focus automatique au montage
  useEffect(() => {
    if (email) {
      motDePasseInputRef.current?.focus();
    } else {
      identifiantInputRef.current?.focus();
    }
  }, []);

  // Détection de la touche Verr Maj (Caps Lock)
  function verifierCapsLock(e) {
    if (e.getModifierState) {
      setCapsLockActif(e.getModifierState('CapsLock'));
    }
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur('');

    const emailValide = email.trim();
    const motDePasseValide = motDePasse;

    if (!emailValide || !IDENTIFIANT_REGEX.test(emailValide)) {
      setErreur('Veuillez saisir un identifiant valide.');
      identifiantInputRef.current?.focus();
      return;
    }

    if (!motDePasseValide || motDePasseValide.length < 8) {
      setErreur('Le mot de passe doit contenir au moins 8 caractères.');
      motDePasseInputRef.current?.focus();
      return;
    }

    setChargement(true);
    try {
      const { data } = await client.post('/auth/login', {
        email: emailValide,
        mot_de_passe: motDePasseValide
      });

      // Gestion du "Se souvenir de moi"
      if (seSouvenir) {
        localStorage.setItem('login_remember_identifiant', emailValide);
      } else {
        localStorage.removeItem('login_remember_identifiant');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('agent', JSON.stringify(data.agent));
      navigate('/');
    } catch (err) {
      const message = err.response?.data?.erreur || 'Erreur de connexion au serveur.';
      const tentativesRestantes = err.response?.data?.tentativesRestantes;
      setErreur(
        typeof tentativesRestantes === 'number'
          ? `${message} Tentatives restantes : ${tentativesRestantes}.`
          : message
      );
      motDePasseInputRef.current?.focus();
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-background-grid" aria-hidden="true" />
      <div className="login-background-orb login-background-orb-one" aria-hidden="true" />
      <div className="login-background-orb login-background-orb-two" aria-hidden="true" />

      {/* Sélecteur de thème clair/sombre interactif */}
      <div className="login-theme-wrapper">
        <ThemeToggle variant="pill" showLabel={true} />
      </div>

      <div className="login-card">
        <aside className="login-brand-panel">
          <div className="login-brand-mark">
            <img src="/ade.png" alt="Algérienne des Eaux" className="login-logo" />
          </div>
          <div className="login-brand-copy">
            <span className="login-kicker">Portail professionnel</span>
            <h1>Suivi des<br />branchements</h1>
            <p>Une vision simple et fiable de chaque demande, du dépôt à la réalisation.</p>
          </div>
          <div className="login-brand-footer">
            <span className="login-status-dot" aria-hidden="true" />
            <span>Plateforme sécurisée ADE</span>
          </div>
        </aside>

        <form onSubmit={soumettre} className="login-form" noValidate>
          <div className="login-header">
            <div className="login-title-group">
              <span className="login-kicker">Espace agent</span>
              <h2>Bon retour parmi nous</h2>
              <p>Connectez-vous pour accéder à votre espace de travail.</p>
            </div>
          </div>

        {/* Alerte d'erreur interactive */}
        {erreur && (
          <div className="login-alert" role="alert">
            <div style={{ flex: 1 }}>{erreur}</div>
            <button
              type="button"
              onClick={() => setErreur('')}
              className="login-alert-close"
              aria-label="Fermer le message d'erreur"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}

        {/* Champ Identifiant */}
        <div className="login-field">
          <div className="login-label-row">
            <label htmlFor="login-identifiant" className="login-label">
              Identifiant
            </label>
          </div>
          <div className="login-input-wrapper">
            <input
              ref={identifiantInputRef}
              id="login-identifiant"
              type="text"
              className="login-input"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (erreur) setErreur('');
              }}
              required
              placeholder="ex: v.nom ou email"
              autoComplete="username"
              disabled={chargement}
            />
          </div>
        </div>

        {/* Champ Mot de passe */}
        <div className="login-field">
          <div className="login-label-row">
            <label htmlFor="login-mot-de-passe" className="login-label">
              Mot de passe
            </label>
          </div>
          <div className="login-input-wrapper">
            <input
              ref={motDePasseInputRef}
              id="login-mot-de-passe"
              type={afficherMotDePasse ? 'text' : 'password'}
              className="login-input"
              value={motDePasse}
              onChange={(e) => {
                setMotDePasse(e.target.value);
                if (erreur) setErreur('');
              }}
              onKeyUp={verifierCapsLock}
              onKeyDown={verifierCapsLock}
              required
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={chargement}
            />
            <button
              type="button"
              className="login-password-toggle"
              onClick={() => setAfficherMotDePasse(!afficherMotDePasse)}
              aria-label={afficherMotDePasse ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              title={afficherMotDePasse ? 'Masquer' : 'Afficher'}
              tabIndex={-1}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
                <circle cx="12" cy="12" r="2.5" />
              </svg>
            </button>
          </div>

          {/* Indicateur de verrouillage des majuscules */}
          {capsLockActif && (
            <div className="login-caps-warning">
              Touche Majuscule (Caps Lock) activée
            </div>
          )}
        </div>

        {/* Options : Se souvenir de moi */}
        <div className="login-options-row">
          <label className="login-remember-me">
            <input
              type="checkbox"
              checked={seSouvenir}
              onChange={(e) => setSeSouvenir(e.target.checked)}
              disabled={chargement}
            />
            <span>Se souvenir de mon identifiant</span>
          </label>
        </div>

        {/* Bouton de soumission */}
        <button
          type="submit"
          className="login-btn-submit"
          disabled={chargement}
        >
          {chargement ? (
            <>
              <div className="login-spinner" aria-hidden="true" />
              <span>Authentification en cours...</span>
            </>
          ) : (
            <>
              <span>Se connecter</span>
            </>
          )}
        </button>

          <div className="login-footer">
            <span>Algérienne Des Eaux</span>
            <span aria-hidden="true">•</span>
            <span>Direction de Zone</span>
          </div>
        </form>
      </div>
    </div>
  );
}
