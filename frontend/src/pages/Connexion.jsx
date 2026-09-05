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
      setErreur(message);
      motDePasseInputRef.current?.focus();
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="login-container">
      {/* Cercles d'ambiance aquatique en arrière-plan */}
      <div className="login-bg-shape login-bg-shape-1" />
      <div className="login-bg-shape login-bg-shape-2" />
      <div className="login-bg-shape login-bg-shape-3" />

      {/* Sélecteur de thème clair/sombre interactif */}
      <div className="login-theme-wrapper">
        <ThemeToggle variant="pill" showLabel={true} />
      </div>

      {/* Formulaire de connexion */}
      <form onSubmit={soumettre} className="login-card" noValidate>
        {/* En-tête avec Logo ADE */}
        <div className="login-header">
          <div className="login-logo-wrapper">
            <img src="/ade.png" alt="ADE Logo" className="login-logo" />
          </div>
          <div className="login-title-group">
            <h1>Suivi des Branchements</h1>
            <div>Espace Agent ADE</div>
          </div>
        </div>

        {/* Alerte d'erreur interactive */}
        {erreur && (
          <div className="login-alert" role="alert">
            <span className="login-alert-icon" aria-hidden="true">⚠️</span>
            <div style={{ flex: 1 }}>{erreur}</div>
            <button
              type="button"
              onClick={() => setErreur('')}
              style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 16 }}
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Champ Identifiant */}
        <div className="login-field">
          <div className="login-label-row">
            <label htmlFor="login-identifiant" className="login-label">
              <span>👤</span> Identifiant
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
              <span>🔒</span> Mot de passe
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
              <span aria-hidden="true">{afficherMotDePasse ? '🙈' : '👁️'}</span>
            </button>
          </div>

          {/* Indicateur de verrouillage des majuscules */}
          {capsLockActif && (
            <div className="login-caps-warning">
              <span aria-hidden="true">⚠️</span> Touche Majuscule (Caps Lock) activée
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
              <span aria-hidden="true">→</span>
            </>
          )}
        </button>

        {/* Pied de formulaire */}
        <div className="login-footer">
          <span>Algérienne Des Eaux · Direction de Zone</span>
        </div>
      </form>
    </div>
  );
}
