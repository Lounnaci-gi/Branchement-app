export function nomAbonne(demande) {
  if (demande.est_personne_morale) return demande.raison_sociale || '—';
  return `${demande.demandeur_nom || ''} ${demande.demandeur_prenom || ''}`.trim() || '—';
}

export function numeroRomain(valeur) {
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

export function formaterMontant(valeur) {
  const montant = Number(valeur);
  return (Number.isFinite(montant) ? montant : 0).toLocaleString('fr-DZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function nombreEnLettresSousMille(nombre) {
  const nombres = [
    'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
    'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'
  ];

  if (nombre < 17) return nombres[nombre] ?? 'zéro';
  if (nombre < 20) return `dix-${nombres[nombre - 10]}`;
  if (nombre < 100) {
    const dizaine = Math.floor(nombre / 10);
    const unite = nombre % 10;
    const dizaines = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];

    if (dizaine === 7) return nombre === 71 ? 'soixante et onze' : `soixante-${nombreEnLettresSousMille(nombre - 60)}`;
    if (dizaine === 8) return nombre === 80 ? 'quatre-vingts' : `quatre-vingt-${nombreEnLettresSousMille(unite)}`;
    if (dizaine === 9) return `quatre-vingt-${nombreEnLettresSousMille(nombre - 80)}`;
    if (unite === 0) return dizaines[dizaine];
    return unite === 1 ? `${dizaines[dizaine]} et un` : `${dizaines[dizaine]}-${nombres[unite]}`;
  }

  const centaines = Math.floor(nombre / 100);
  const reste = nombre % 100;
  const prefixe = centaines === 1 ? 'cent' : `${nombres[centaines]} cent`;
  if (reste === 0) return centaines === 1 ? prefixe : `${prefixe}s`;
  return `${prefixe} ${nombreEnLettresSousMille(reste)}`;
}

export function montantEnLettres(valeur) {
  const montant = Math.max(0, Math.round((Number(valeur) || 0) * 100) / 100);
  const entier = Math.floor(montant);
  const centimes = Math.round((montant - entier) * 100);
  const millions = Math.floor(entier / 1000000);
  const resteMillions = entier % 1000000;
  const parties = [];

  if (millions > 0) {
    parties.push(`${nombreEnLettresSousMille(millions)} million${millions > 1 ? 's' : ''}`);
  }

  if (resteMillions > 0) {
    const milliers = Math.floor(resteMillions / 1000);
    const reste = resteMillions % 1000;
    if (milliers > 0) {
      parties.push(milliers === 1 ? 'mille' : `${nombreEnLettresSousMille(milliers)} mille`);
    }
    if (reste > 0) {
      parties.push(nombreEnLettresSousMille(reste));
    }
  }

  if (parties.length === 0) {
    parties.push('zéro');
  }

  const texte = `${parties.join(' ')} dinar${entier > 1 ? 's' : ''}`;
  if (centimes > 0) {
    return `${texte} et ${nombreEnLettresSousMille(centimes)} centime${centimes > 1 ? 's' : ''}`;
  }
  return texte;
}

export function libelleArticleSansCategorie(libelle) {
  return String(libelle || '—').replace(/^\s*\[[^\]]+\]\s*/, '').trim() || '—';
}

export function obtenirCategorieArticle(art, mapCategories = new Map()) {
  const libelles = [
    art?.categorie,
    art?.libelleCategorie,
    art?.libelle_categorie,
    art?.categorie_article,
    art?.libelleCategorieArticle,
    art?.categorieArticle,
    art?.categorie_libelle
  ].filter(Boolean);

  if (libelles.length > 0) return libelles[0];

  const codeArticle = String(art?.code || art?.code_article || '').trim().toUpperCase();
  if (codeArticle && mapCategories.has(codeArticle)) return mapCategories.get(codeArticle);

  return 'Sans catégorie';
}
