import React, { useEffect, useState, useRef } from 'react';

/**
 * Composant de saisie de date en format jj/mm/aaaa (dd/mm/yyyy).
 * Stocke et retourne la valeur au format ISO standard YYYY-MM-DD.
 * Intègre un sélecteur natif (bouton calendrier) et une saisie guidée jj/mm/aaaa.
 */
export default function InputDate({ value = '', onChange, min, max, className = '', style = {}, disabled = false, required = false, id, name }) {
  // Convertit YYYY-MM-DD -> DD/MM/YYYY
  const isoToFr = (iso) => {
    if (!iso) return '';
    const clean = iso.slice(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return iso;
  };

  // Convertit DD/MM/YYYY -> YYYY-MM-DD
  const frToIso = (fr) => {
    if (!fr) return '';
    const parts = fr.trim().split('/');
    if (parts.length === 3) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      if (y.length === 4 && Number(d) >= 1 && Number(d) <= 31 && Number(m) >= 1 && Number(m) <= 12) {
        return `${y}-${m}-${d}`;
      }
    }
    return '';
  };

  const [texte, setTexte] = useState(isoToFr(value));
  const hiddenDateRef = useRef(null);

  useEffect(() => {
    setTexte(isoToFr(value));
  }, [value]);

  function handleTexteChange(e) {
    let val = e.target.value.replace(/[^\d/]/g, '');

    // Gestion de la saisie automatique des /
    const digitsOnly = val.replace(/\//g, '');
    if (digitsOnly.length <= 2) {
      val = digitsOnly;
    } else if (digitsOnly.length <= 4) {
      val = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
    } else {
      val = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4, 8)}`;
    }

    setTexte(val);

    if (val.length === 10) {
      const iso = frToIso(val);
      if (iso && onChange) {
        onChange(iso);
      }
    } else if (val.length === 0 && onChange) {
      onChange('');
    }
  }

  function handleBlur() {
    if (!texte) {
      if (onChange) onChange('');
      return;
    }
    const iso = frToIso(texte);
    if (iso) {
      setTexte(isoToFr(iso));
      if (onChange) onChange(iso);
    } else {
      // Si la date est incomplète ou invalide, on remet la valeur précédente ou vide
      setTexte(isoToFr(value));
    }
  }

  function handleNativePickerChange(e) {
    const valIso = e.target.value;
    if (onChange) onChange(valIso);
    setTexte(isoToFr(valIso));
  }

  function openPicker() {
    if (disabled) return;
    if (hiddenDateRef.current) {
      if (typeof hiddenDateRef.current.showPicker === 'function') {
        hiddenDateRef.current.showPicker();
      } else {
        hiddenDateRef.current.focus();
      }
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%' }}>
      <input
        type="text"
        id={id}
        name={name}
        inputMode="numeric"
        placeholder="JJ/MM/AAAA"
        value={texte}
        disabled={disabled}
        required={required}
        className={className}
        style={{
          width: '100%',
          paddingRight: '36px',
          ...style
        }}
        onChange={handleTexteChange}
        onBlur={handleBlur}
      />
      {/* Bouton calendrier interactif */}
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        title="Ouvrir le calendrier"
        style={{
          position: 'absolute',
          right: '6px',
          background: 'none',
          border: 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '4px 6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted, #64748b)',
          fontSize: '15px'
        }}
      >
        📅
      </button>
      {/* Input date natif masqué mais fonctionnel pour le datepicker popup */}
      <input
        ref={hiddenDateRef}
        type="date"
        tabIndex={-1}
        value={value ? value.slice(0, 10) : ''}
        min={min ? min.slice(0, 10) : undefined}
        max={max ? max.slice(0, 10) : undefined}
        disabled={disabled}
        onChange={handleNativePickerChange}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none'
        }}
      />
    </div>
  );
}
