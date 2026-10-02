import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EVENEMENT_NUMEROTATION_DEVIS,
  MODE_NUMEROTATION_DEFAUT,
  enregistrerModeNumerotationDevis,
  estModeNumerotationValide,
  formaterNumeroSection,
  lireModeNumerotationDevis
} from './devisNumerotation.js';

test('formate les sections en chiffres romains par défaut', () => {
  assert.equal(MODE_NUMEROTATION_DEFAUT, 'ROMAIN');
  assert.equal(formaterNumeroSection(0), 'I');
  assert.equal(formaterNumeroSection(3, 'ROMAIN'), 'IV');
});

test('formate les sections avec des lettres minuscules', () => {
  assert.equal(formaterNumeroSection(0, 'ALPHABETIQUE'), 'a');
  assert.equal(formaterNumeroSection(2, 'ALPHABETIQUE'), 'c');
  assert.equal(formaterNumeroSection(26, 'ALPHABETIQUE'), 'aa');
});

test('traite les indices invalides comme la première section', () => {
  assert.equal(formaterNumeroSection(-1), 'I');
  assert.equal(formaterNumeroSection(Number.NaN, 'ALPHABETIQUE'), 'a');
});

test('lit et enregistre la préférence de numérotation par agent', () => {
  const valeurs = new Map();
  const evenements = [];
  const anciens = {
    localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
    sessionStorage: Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage'),
    window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
    CustomEvent: Object.getOwnPropertyDescriptor(globalThis, 'CustomEvent')
  };

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (cle) => valeurs.get(cle) ?? null,
      setItem: (cle, valeur) => valeurs.set(cle, valeur)
    }
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: { getItem: () => JSON.stringify({ id_agent: 42 }) }
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { dispatchEvent: (evenement) => evenements.push(evenement) }
  });
  Object.defineProperty(globalThis, 'CustomEvent', {
    configurable: true,
    value: class CustomEvent {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    }
  });

  try {
    assert.equal(lireModeNumerotationDevis(), 'ROMAIN');
    assert.equal(enregistrerModeNumerotationDevis('ALPHABETIQUE'), 'ALPHABETIQUE');
    assert.equal(valeurs.get('devis-numerotation:42'), 'ALPHABETIQUE');
    assert.equal(lireModeNumerotationDevis(), 'ALPHABETIQUE');
    assert.equal(evenements[0].type, EVENEMENT_NUMEROTATION_DEVIS);
    assert.equal(evenements[0].detail.mode, 'ALPHABETIQUE');
    assert.equal(estModeNumerotationValide('invalide'), false);
  } finally {
    for (const [cle, descripteur] of Object.entries(anciens)) {
      if (descripteur) Object.defineProperty(globalThis, cle, descripteur);
      else delete globalThis[cle];
    }
  }
});
