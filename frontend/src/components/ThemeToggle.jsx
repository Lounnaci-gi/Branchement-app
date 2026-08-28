import { useTheme } from '../context/ThemeContext';
import './ThemeToggle.css';

export default function ThemeToggle({ variant = 'sidebar', showLabel = true, className = '' }) {
  const { isDark, toggleTheme } = useTheme();

  const handleToggle = (e) => {
    toggleTheme(e);
  };

  return (
    <button
      type="button"
      className={`theme-toggle-btn theme-toggle-${variant} ${isDark ? 'is-dark' : 'is-light'} ${className}`}
      onClick={handleToggle}
      title={isDark ? 'Passer au mode clair' : 'Passer au mode sombre'}
      aria-label={isDark ? 'Passer au mode clair' : 'Passer au mode sombre'}
    >
      <div className="theme-toggle-track" aria-hidden="true">
        {/* Animated Sun / Moon SVG */}
        <div className="theme-toggle-thumb">
          <svg
            className="theme-icon"
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Stars for night */}
            <g className="theme-stars">
              <circle cx="17" cy="6" r="1" fill="currentColor" stroke="none" />
              <circle cx="19" cy="11" r="0.8" fill="currentColor" stroke="none" />
              <circle cx="14" cy="4" r="0.7" fill="currentColor" stroke="none" />
            </g>

            {/* Sun rays */}
            <g className="theme-sun-rays">
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </g>

            {/* Center Moon / Sun Body */}
            <mask id="moon-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <circle className="moon-mask-cutout" cx="17" cy="8" r="6" fill="black" />
            </mask>
            <circle
              className="theme-main-circle"
              cx="12"
              cy="12"
              r="5"
              fill="currentColor"
              mask="url(#moon-mask)"
            />
          </svg>
        </div>
      </div>

      {showLabel && (
        <span className="theme-toggle-label">
          {isDark ? 'Mode sombre' : 'Mode clair'}
        </span>
      )}
    </button>
  );
}
