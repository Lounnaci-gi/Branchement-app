import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import './CommandPalette.css';

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const quickLinks = [
    { title: 'Tableau de bord', path: '/', icon: '📊', description: 'Indicateurs clés et pipeline' },
    { title: 'Nouvelle demande', path: '/demandes/nouvelle', icon: '➕', description: 'Enregistrer une demande de branchement' },
    { title: 'Liste des demandes', path: '/demandes', icon: '📋', description: 'Explorer et filtrer toutes les demandes' },
    { title: 'Gestion des communes', path: '/referentiels/communes', icon: '⌖', description: 'Référentiel des agences et communes' },
    { title: 'Articles de devis', path: '/referentiels/articles', icon: '▤', description: 'Créer et consulter les articles de chiffrage' },
    { title: 'Mon profil', path: '/profil', icon: '⚙', description: 'Modifier mot de passe et informations' }
  ];

  // Focus on input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Live search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const { data } = await client.get('/demandes', {
          params: { recherche: query.trim(), taille: 8 }
        });
        setResults(data.demandes || []);
        setSelectedIndex(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [query]);

  const items = query.trim()
    ? results.map((d) => ({
        type: 'demande',
        id: d.id_demande,
        title: d.numero_demande,
        subtitle: `${d.demandeur || [d.demandeur_nom, d.demandeur_prenom].filter(Boolean).join(' ') || 'Demandeur'} · ${d.nom_commune || ''}`,
        statut: d.statut_actuel,
        path: `/demandes/${d.id_demande}`
      }))
    : quickLinks.map((l) => ({
        type: 'link',
        title: l.title,
        subtitle: l.description,
        icon: l.icon,
        path: l.path
      }));

  const handleSelect = useCallback(
    (item) => {
      onClose();
      navigate(item.path);
    },
    [navigate, onClose]
  );

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, items.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        handleSelect(items[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="cmd-palette-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="cmd-palette-modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="cmd-palette-search-bar">
          <span className="cmd-palette-search-icon" aria-hidden="true">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="cmd-palette-input"
            placeholder="Rechercher une demande, un nom, ou taper une action..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && <div className="cmd-palette-spinner" aria-hidden="true" />}
          <kbd>Échap</kbd>
        </div>

        <div className="cmd-palette-results">
          {items.length === 0 ? (
            <div className="cmd-palette-empty">
              <span>Aucun résultat trouvé pour "{query}"</span>
            </div>
          ) : (
            <>
              <div className="cmd-palette-section-title">
                {query.trim() ? 'Demandes correspondantes' : 'Raccourcis & Navigation'}
              </div>
              <ul className="cmd-palette-list">
                {items.map((item, idx) => (
                  <li
                    key={item.id || item.title}
                    className={`cmd-palette-item ${selectedIndex === idx ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    {item.type === 'demande' ? (
                      <div className="cmd-palette-item-content">
                        <div className="cmd-palette-item-main">
                          <span className="cmd-palette-item-number mono">{item.title}</span>
                          <span className="cmd-palette-item-sub">{item.subtitle}</span>
                        </div>
                        <span>{item.statut}</span>
                      </div>
                    ) : (
                      <div className="cmd-palette-item-content">
                        <div className="cmd-palette-item-main">
                          <span className="cmd-palette-item-icon">{item.icon}</span>
                          <div>
                            <span className="cmd-palette-item-title">{item.title}</span>
                            <span className="cmd-palette-item-desc">{item.subtitle}</span>
                          </div>
                        </div>
                        <span className="cmd-palette-item-arrow" aria-hidden="true">→</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="cmd-palette-footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> pour naviguer</span>
          <span><kbd>↵ Entrée</kbd> pour ouvrir</span>
          <span><kbd>Échap</kbd> pour fermer</span>
        </div>
      </div>
    </div>
  );
}
