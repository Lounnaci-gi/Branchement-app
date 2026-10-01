import { MODELES_DEVIS } from '../../utils/devisModeles';
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function ApercuModele({ id }) {
  return (
    <div className={`devis-modele-apercu devis-modele-apercu--${id}`} aria-hidden="true">
      <div className="devis-modele-apercu-entete" />
      <div className="devis-modele-apercu-titre" />
      <div className="devis-modele-apercu-client" />
      <div className="devis-modele-apercu-table">
        <span /><span /><span />
      </div>
    </div>
  );
}

export default function SelecteurModeleDevis({
  valeur,
  onChange,
  variant = 'standard',
  disabled = false
}) {
  const [ouvert, setOuvert] = useState(false);
  const [indexActif, setIndexActif] = useState(() => Math.max(0, MODELES_DEVIS.findIndex((modele) => modele.id === valeur)));
  const conteneurRef = useRef(null);
  const boutonRef = useRef(null);
  const optionRefs = useRef([]);
  const indexSelectionne = Math.max(0, MODELES_DEVIS.findIndex((modele) => modele.id === valeur));
  const modeleSelectionne = MODELES_DEVIS[indexSelectionne];
  const idListe = `devis-modele-options-${variant}`;

  useEffect(() => {
    if (ouvert) optionRefs.current[indexActif]?.focus();
  }, [ouvert, indexActif]);

  useEffect(() => {
    function fermerAuClicExterieur(event) {
      if (!conteneurRef.current?.contains(event.target)) setOuvert(false);
    }
    document.addEventListener('pointerdown', fermerAuClicExterieur);
    return () => document.removeEventListener('pointerdown', fermerAuClicExterieur);
  }, []);

  function ouvrir(index = indexSelectionne) {
    setIndexActif(index);
    setOuvert(true);
  }

  function gererClavierOption(event, index) {
    let prochainIndex = index;
    if (event.key === 'ArrowDown') prochainIndex = Math.min(index + 1, MODELES_DEVIS.length - 1);
    else if (event.key === 'ArrowUp') prochainIndex = Math.max(index - 1, 0);
    else if (event.key === 'Home') prochainIndex = 0;
    else if (event.key === 'End') prochainIndex = MODELES_DEVIS.length - 1;
    else if (event.key === 'Escape') {
      event.preventDefault();
      setOuvert(false);
      boutonRef.current?.focus();
      return;
    } else {
      return;
    }
    event.preventDefault();
    setIndexActif(prochainIndex);
    optionRefs.current[prochainIndex]?.focus();
  }

  function choisirModele(id) {
    onChange(id);
    setOuvert(false);
    boutonRef.current?.focus();
  }

  return (
    <div
      ref={conteneurRef}
      className={`devis-modele-selecteur no-print ${variant === 'dense' ? 'devis-modele-selecteur--dense' : ''}`}
    >
      <button
        ref={boutonRef}
        type="button"
        className="devis-modele-champ"
        aria-label={`Modèle de devis : ${modeleSelectionne.label}`}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={idListe}
        disabled={disabled}
        onClick={() => ouvert ? setOuvert(false) : ouvrir()}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            ouvrir();
          }
        }}
      >
        <ApercuModele id={modeleSelectionne.id} />
        <span className="devis-modele-details">
          <strong>{modeleSelectionne.label}</strong>
          <span>{modeleSelectionne.description}</span>
        </span>
        <ChevronDown size={18} aria-hidden="true" className={`devis-modele-chevron ${ouvert ? 'devis-modele-chevron--ouvert' : ''}`} />
      </button>
      {ouvert ? (
        <div id={idListe} className="devis-modele-options" role="listbox" aria-label="Modèles de devis">
          {MODELES_DEVIS.map((modele, index) => {
            const actif = modele.id === valeur;
            return (
              <button
                key={modele.id}
                ref={(element) => { optionRefs.current[index] = element; }}
                type="button"
                role="option"
                aria-selected={actif}
                tabIndex={index === indexActif ? 0 : -1}
                className={`devis-modele-option ${actif ? 'devis-modele-option--selectionne' : ''}`}
                onClick={() => choisirModele(modele.id)}
                onKeyDown={(event) => gererClavierOption(event, index)}
              >
            <ApercuModele id={modele.id} />
            <span className="devis-modele-details">
              <strong>{modele.label}</strong>
              <span>{modele.description}</span>
            </span>
                {actif ? <Check size={18} aria-label="Sélectionné" className="devis-modele-option-check" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
