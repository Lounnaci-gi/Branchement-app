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
        <div className="theme-toggle-thumb" />
      </div>

      {showLabel && (
        <span className="theme-toggle-label">
          {isDark ? 'Mode sombre' : 'Mode clair'}
        </span>
      )}
    </button>
  );
}
