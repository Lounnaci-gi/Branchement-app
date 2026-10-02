export const MODE_NUMEROTATION_DEFAUT = 'ROMAIN';
export const EVENEMENT_NUMEROTATION_DEVIS = 'devis-numerotation-change';

const MODES_NUMEROTATION = new Set(['ROMAIN', 'ALPHABETIQUE']);

function cleStockageNumerotationDevis() {
  try {
    const agent = JSON.parse(sessionStorage.getItem('agent') || '{}');
    return `devis-numerotation:${agent.id_agent || 'local'}`;
  } catch {
    return 'devis-numerotation:local';
  }
}

export function estModeNumerotationValide(mode) {
  return MODES_NUMEROTATION.has(mode);
}

export function lireModeNumerotationDevis() {
  try {
    const mode = localStorage.getItem(cleStockageNumerotationDevis());
    return estModeNumerotationValide(mode) ? mode : MODE_NUMEROTATION_DEFAUT;
  } catch {
    return MODE_NUMEROTATION_DEFAUT;
  }
}

export function enregistrerModeNumerotationDevis(mode) {
  const modeValide = estModeNumerotationValide(mode) ? mode : MODE_NUMEROTATION_DEFAUT;
  localStorage.setItem(cleStockageNumerotationDevis(), modeValide);
  window.dispatchEvent(new CustomEvent(EVENEMENT_NUMEROTATION_DEVIS, { detail: { mode: modeValide } }));
  return modeValide;
}

function numeroRomain(valeur) {
  const nombres = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  let reste = valeur;
  return nombres.reduce((resultat, [nombre, symbole]) => {
    const repetitions = Math.floor(reste / nombre);
    reste %= nombre;
    return resultat + symbole.repeat(repetitions);
  }, '');
}

function numeroAlphabetique(index) {
  let reste = index + 1;
  let resultat = '';
  while (reste > 0) {
    reste -= 1;
    resultat = String.fromCharCode(97 + (reste % 26)) + resultat;
    reste = Math.floor(reste / 26);
  }
  return resultat;
}

export function formaterNumeroSection(index, mode = MODE_NUMEROTATION_DEFAUT) {
  const numero = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  return estModeNumerotationValide(mode) && mode === 'ALPHABETIQUE'
    ? numeroAlphabetique(numero)
    : numeroRomain(numero + 1);
}
