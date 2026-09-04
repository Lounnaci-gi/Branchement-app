import { useEffect, useState } from 'react';
import { Link, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Connexion from './pages/Connexion';
import TableauDeBord from './pages/TableauDeBord';
import ListeDemandes from './pages/ListeDemandes';
import NouvelleDemande from './pages/NouvelleDemande';
import DetailDemande from './pages/DetailDemande';
import CreationDevis from './pages/CreationDevis';
import AffichageDevis from './pages/AffichageDevis';
import GestionCommunes from './pages/GestionCommunes';
import GestionArticles from './pages/GestionArticles';
import Profil from './pages/Profil';

import CommandPalette from './components/CommandPalette';

function EspaceProtege({ children }) {
  const [, setRafraichirAgent] = useState(0);
  const [paletteOuverte, setPaletteOuverte] = useState(false);

  useEffect(() => {
    function onAgentMisAJour() {
      setRafraichirAgent((value) => value + 1);
    }
    window.addEventListener('agent-updated', onAgentMisAJour);
    return () => window.removeEventListener('agent-updated', onAgentMisAJour);
  }, []);

  // Raccourci global Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOuverte((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/connexion" replace />;
  const agent = JSON.parse(localStorage.getItem('agent') || '{}');

  return (
    <div className="app-shell">
      <Sidebar agent={agent} onOpenSearch={() => setPaletteOuverte(true)} />
      <div className="app-content">
        <header className="app-topbar">
          <div className="app-topbar-context">
            <strong>Suivi des branchements</strong>
            <span>Algérienne Des Eaux</span>
          </div>
          <div className="app-topbar-actions">
            <button type="button" className="app-topbar-search" onClick={() => setPaletteOuverte(true)}>
              Rechercher une demande… <kbd>Ctrl K</kbd>
            </button>
            <Link to="/demandes/nouvelle" className="btn btn-primary">Nouvelle demande</Link>
          </div>
        </header>
        <main>{children}</main>
      </div>
      <CommandPalette isOpen={paletteOuverte} onClose={() => setPaletteOuverte(false)} />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/connexion" element={<Connexion />} />
      <Route path="/" element={<EspaceProtege><TableauDeBord /></EspaceProtege>} />
      <Route path="/demandes" element={<EspaceProtege><ListeDemandes /></EspaceProtege>} />
      <Route path="/demandes/nouvelle" element={<EspaceProtege><NouvelleDemande /></EspaceProtege>} />
      <Route path="/demandes/:id/modifier" element={<EspaceProtege><NouvelleDemande /></EspaceProtege>} />
      <Route path="/demandes/:id/devis/nouveau" element={<EspaceProtege><CreationDevis /></EspaceProtege>} />
      <Route path="/demandes/:id/devis/:idDevis" element={<EspaceProtege><AffichageDevis /></EspaceProtege>} />
      <Route path="/demandes/:id" element={<EspaceProtege><DetailDemande /></EspaceProtege>} />
      <Route path="/referentiels/communes" element={<EspaceProtege><GestionCommunes /></EspaceProtege>} />
      <Route path="/referentiels/articles" element={<EspaceProtege><GestionArticles /></EspaceProtege>} />
      <Route path="/profil" element={<EspaceProtege><Profil /></EspaceProtege>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
