import { Link } from 'react-router-dom';
import './Breadcrumbs.css';

export default function Breadcrumbs({ items = [] }) {
  if (!items || items.length === 0) return null;

  return (
    <nav className="breadcrumbs" aria-label="Fil d'Ariane">
      <ol className="breadcrumbs-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className={`breadcrumbs-item ${isLast ? 'is-active' : ''}`}>
              {item.path && !isLast ? (
                <Link to={item.path} className="breadcrumbs-link">
                  {item.icon && <span className="breadcrumbs-icon">{item.icon}</span>}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span className="breadcrumbs-current" aria-current={isLast ? 'page' : undefined}>
                  {item.icon && <span className="breadcrumbs-icon">{item.icon}</span>}
                  <span>{item.label}</span>
                </span>
              )}
              {!isLast && <span className="breadcrumbs-separator" aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
