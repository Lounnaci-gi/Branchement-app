import { LIBELLES_STATUT } from '../constants/statuts';

const STYLES = {
  DEPOSEE: { bg: 'var(--color-surface-sunken)', fg: 'var(--color-text-muted)', border: 'var(--color-border)' },
  ETUDE_EN_COURS: { bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)', border: 'var(--color-border-warning)' },
  ETUDE_TERMINEE: { bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)', border: 'var(--color-border-warning)' },
  DEVIS_EMIS: { bg: 'var(--color-accent-light)', fg: 'var(--color-accent)', border: 'var(--color-border-accent)' },
  DEVIS_PAYE: { bg: 'var(--color-success-bg)', fg: 'var(--color-success)', border: 'var(--color-border-success)' },
  TRAVAUX_EN_COURS: { bg: 'var(--color-primary-selection)', fg: 'var(--color-primary)', border: 'var(--color-border-primary)' },
  TRAVAUX_TERMINES: { bg: 'var(--color-success-bg)', fg: 'var(--color-success)', border: 'var(--color-border-success)' },
  REJETEE: { bg: 'var(--color-danger-bg)', fg: 'var(--color-danger)', border: 'var(--color-border-danger)' },
  ANNULEE: { bg: 'var(--color-surface-sunken)', fg: 'var(--color-text-muted)', border: 'var(--color-border)' }
};

export default function StatutBadge({ code }) {
  const style = STYLES[code] || STYLES.DEPOSEE;
  const libelle = LIBELLES_STATUT[code] || code;
  return (
    <span
      className="badge"
      style={{
        background: style.bg,
        color: style.fg,
        border: `1px solid ${style.border}`
      }}
      role="status"
      aria-label={`Statut : ${libelle}`}
    >
      <span className="badge-dot" style={{ background: style.fg }} aria-hidden="true" />
      {libelle}
    </span>
  );
}
