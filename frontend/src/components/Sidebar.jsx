import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ThemeToggle from './ThemeToggle';
import './Sidebar.css';

export default function Sidebar({ agent, onOpenSearch }) {
  const navigate = useNavigate();
  const [agentCourant, setAgentCourant] = useState(agent);

  useEffect(() => {
    function actualiserAgent() {
      setAgentCourant(JSON.parse(localStorage.getItem('agent') || '{}'));
    }
    window.addEventListener('agent-updated', actualiserAgent);
    return () => window.removeEventListener('agent-updated', actualiserAgent);
  }, []);

  function deconnexion() {
    localStorage.removeItem('token');
    localStorage.removeItem('agent');
    navigate('/connexion');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-marque">
        <div className="sidebar-logo-wrapper">
          <img className="sidebar-logo" src="/ade.png" alt="ADE" />
        </div>
        <div>
          <div className="sidebar-titre">Branchements</div>
          <div className="sidebar-sous-titre">Algérienne Des Eaux</div>
        </div>
      </div>

      {/* Bouton Recherche Rapide (Ctrl + K) */}
      <button
        type="button"
        className="sidebar-search-btn"
        onClick={onOpenSearch}
        title="Recherche rapide (Ctrl + K)"
      >
        <span className="sidebar-search-icon" aria-hidden="true">🔍</span>
        <span className="sidebar-search-text">Recherche...</span>
        <kbd className="sidebar-search-kbd">Ctrl K</kbd>
      </button>

      <nav className="sidebar-nav">
        <NavLink to="/" end className={({ isActive }) => `sidebar-lien ${isActive ? 'actif' : ''}`}>
          <span className="sidebar-lien-icone" aria-hidden="true">⌂</span>
          <span>Tableau de bord</span>
        </NavLink>
        <NavLink to="/demandes" className={({ isActive }) => `sidebar-lien ${isActive ? 'actif' : ''}`}>
          <span className="sidebar-lien-icone" aria-hidden="true">≡</span>
          <span>Demandes</span>
        </NavLink>
        <NavLink to="/demandes/nouvelle" className={({ isActive }) => `sidebar-lien ${isActive ? 'actif' : ''}`}>
          <span className="sidebar-lien-icone" aria-hidden="true">＋</span>
          <span>Nouvelle demande</span>
        </NavLink>
        {agentCourant?.role === 'admin' && (
          <NavLink to="/referentiels/communes" className={({ isActive }) => `sidebar-lien ${isActive ? 'actif' : ''}`}>
            <span className="sidebar-lien-icone" aria-hidden="true">⌖</span>
            <span>Communes</span>
          </NavLink>
        )}
      </nav>

      {/* Modern Interactive Theme Switcher */}
      <ThemeToggle variant="sidebar" showLabel={true} />

      <div className="sidebar-agent">
        <div className="sidebar-agent-avatar">
          {agentCourant?.prenom?.[0] || 'A'}{agentCourant?.nom?.[0] || 'D'}
        </div>
        <div className="sidebar-agent-info">
          <div className="sidebar-agent-nom">
            {agentCourant?.prenom || 'Agent'} {agentCourant?.nom || ''}
          </div>
          <div className="sidebar-agent-role">
            {agentCourant?.role?.replace('_', ' ') || 'Utilisateur'}
          </div>
        </div>
        <button
          className="sidebar-action-btn sidebar-profil"
          onClick={() => navigate('/profil')}
          title="Modifier le profil"
          aria-label="Modifier le profil"
        >
          ⚙
        </button>
        <button
          className="sidebar-action-btn sidebar-deconnexion"
          onClick={deconnexion}
          title="Se déconnecter"
          aria-label="Se déconnecter"
        >
          ⏻
        </button>
      </div>
    </aside>
  );
}
