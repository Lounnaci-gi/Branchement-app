import { LIBELLES_STATUT } from '../constants/statuts';

const STYLES = {
  DEPOSEE: { bg: 'var(--color-surface-sunken)', fg: 'var(--color-text-muted)', border: 'var(--color-border)' },
  ETUDE_EN_COURS: { bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)', border: 'rgba(217, 119, 6, 0.25)' },
  ETUDE_TERMINEE: { bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)', border: 'rgba(217, 119, 6, 0.25)' },
  DEVIS_EMIS: { bg: 'var(--color-accent-light)', fg: 'var(--color-accent)', border: 'rgba(240, 120, 87, 0.25)' },
  DEVIS_PAYE: { bg: 'var(--color-success-bg)', fg: 'var(--color-success)', border: 'rgba(22, 163, 74, 0.25)' },
  TRAVAUX_EN_COURS: { bg: 'var(--color-primary-selection)', fg: 'var(--color-primary)', border: 'rgba(37, 153, 251, 0.25)' },
  TRAVAUX_TERMINES: { bg: 'var(--color-primary-selection)', fg: 'var(--color-primary)', border: 'rgba(37, 153, 251, 0.25)' },
  MISE_EN_SERVICE: { bg: 'var(--color-success-bg)', fg: 'var(--color-success)', border: 'rgba(22, 163, 74, 0.25)' },
  REJETEE: { bg: 'var(--color-danger-bg)', fg: 'var(--color-danger)', border: 'rgba(220, 38, 38, 0.25)' },
  ANNULEE: { bg: 'var(--color-surface-sunken)', fg: 'var(--color-text-muted)', border: 'var(--color-border)' }
};

export default function StatutBadge({ code }) {
  const style = STYLES[code] || STYLES.DEPOSEE;
  return (
    <span
      className="badge"
      style={{
        background: style.bg,
        color: style.fg,
        border: `1px solid ${style.border}`
      }}
    >
      <span className="badge-dot" style={{ background: style.fg }} />
      {LIBELLES_STATUT[code] || code}
    </span>
  );
}
