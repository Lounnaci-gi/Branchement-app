function echapperHtml(valeur) {
  return String(valeur ?? '').replace(/[&<>'"]/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[caractere]);
}

function valeurNumero(demande) {
  return String(demande.numero_demande || '').split('/')[0].replace(/\D/g, '').slice(-4).padStart(4, '0');
}

function valeurDate(valeur) {
  const date = new Date(valeur);
  if (Number.isNaN(date.getTime())) return '______';
  return [String(date.getDate()).padStart(2, '0'), String(date.getMonth() + 1).padStart(2, '0'), String(date.getFullYear()).slice(-2)].join('');
}

function casesAvecValeurs(valeur) {
  return Array.from(valeur, (chiffre) => `<span class="case">${echapperHtml(chiffre)}</span>`).join('');
}

export function genererHtmlDevis(demande, dateEmission = null) {
  const estMorale = Boolean(demande.est_personne_morale);
  const nom = estMorale ? (demande.raison_sociale || '') : (demande.demandeur_nom || '');
  const prenom = estMorale ? '' : (demande.demandeur_prenom || '');
  const adresseDemandeur = demande.demandeur_adresse || demande.adresse || '';
  const agenceBrute = demande.nom_agence || '';
  const agence = agenceBrute.replace(/^agence(?:\s+de)?\s*:?\s*/i, '').toUpperCase();
  const communeBranchement = demande.nom_commune || '';
  const communeResidence = demande.nom_commune_residence || '';
  const typeBranchement = demande.type_branchement || demande.libelle_type || '';
  const natureTravauxBrute = String(demande.type_autre || '').trim();
  const natureTravaux = (() => {
    if (!natureTravauxBrute) {
      return 'Branchement d\'eau potable';
    }
    if (natureTravauxBrute.startsWith('Branchement d\'eau potable')) return 'Branchement d\'eau potable';
    if (natureTravauxBrute.startsWith('Extension réseau AEP')) return 'Extension réseau AEP';
    if (natureTravauxBrute.startsWith('Rénovation de branchement')) return 'Rénovation de branchement';
    if (natureTravauxBrute.startsWith('Travaux de résiliation')) return 'Travaux de résiliation';
    if (natureTravauxBrute.startsWith('Autres')) return 'Autres';
    return natureTravauxBrute;
  })();
  const natureTravauxAffichee = [natureTravaux, typeBranchement].filter(Boolean).join(' - ');
  const numeroAffiche = valeurNumero(demande);

  const dateDocument = dateEmission
    || demande.date_emission
    || demande.date_maj
    || demande.date_depot
    || new Date();

  const dateAffichee = valeurDate(dateDocument);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Demande d'établissement de devis quantitatif et estimatif</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4 portrait; margin: 7mm; }
  html, body {
    width: 100%;
    min-height: 100%;
    background: #fff;
  }
  body {
    font-family: 'Poppins', Arial, sans-serif;
    font-size: 12px;
    color: #000;
    width: 100%;
    max-width: 100%;
    margin: 0;
    padding: 8mm 10mm;
    overflow: hidden;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
  .header-centre {
    width: 100%;
    text-align: center;
    margin: 0 0 8px 0;
    line-height: 1.4;
  }
  .republique-arabe {
    font-size: 18px;
    font-weight: bold;
    direction: rtl;
    unicode-bidi: plaintext;
  }
  .republique-francais {
    font-size: 12px;
    font-weight: bold;
  }
  .header-left { display: flex; align-items: center; padding-left: 0; }
  .adresse-ade { font-size: 12px; line-height: 1.4; display: flex; flex-direction: column; justify-content: center; text-align: center; }
  .header-left img { width: 68px; height: auto; display: block; align-self: center; margin-left: 12px; }
  .header-right { font-size: 12px; margin-top: 6px; white-space: normal; }
  .agence-line { display: inline-block; min-width: 150px; border-bottom: none; text-decoration: none; }
  .titre { font-weight: bold; font-size: 15px; text-transform: uppercase; margin: 12px 0 0 0; }
  .titre-bar { background: #000; height: 8px; width: 100%; margin: 4px 0 12px 0; }
  .enreg-date { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; font-size: 12px; flex-wrap: nowrap; letter-spacing: .2px; }
  .cases { display: inline-flex; vertical-align: middle; gap: 2px; margin-left: 4px; letter-spacing: 0; }
  .case { display: inline-flex; width: 14px; height: 16px; align-items: center; justify-content: center; border: 1px solid #000; font-size: 11px; line-height: 1; }
  .consigne { font-weight: bold; margin-bottom: 10px; }
  .field { margin-bottom: 6px; display: flex; align-items: flex-end; white-space: nowrap; }
  .field label { flex-shrink: 0; margin-right: 4px; font-size: 12px; }
  .field .line { flex-grow: 1; border-bottom: 1px solid #000; height: 1.3em; text-align: center; font-size: 12px; }
  .section-title { text-decoration: underline; margin: 10px 0 4px 0; font-size: 12px; }
  .full-line { border-bottom: 1px solid #000; height: 1.3em; margin-top: 2px; text-align: center; font-size: 12px; }
  .nature-block { margin-top: 12px; }
  .nature-lines .full-line { margin-bottom: 10px; }
  table.visas { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 18px; }
  table.visas caption { background: #5a5a5a; color: #fff; font-weight: bold; padding: 5px; caption-side: top; border: 1px solid #000; }
  table.visas th, table.visas td { border: 1px solid #000; text-align: center; padding: 6px; }
  table.visas th { font-weight: bold; }
  table.visas td { height: 58px; vertical-align: top; }
  @media print {
    html, body {
      width: 210mm;
      height: 297mm;
    }
    body {
      margin: 0;
      padding: 7mm;
      overflow: visible;
    }
    .field, .section-title, .nature-block, table.visas {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
</style>
</head>
<body>
  <div class="header-centre">
    <div class="republique-arabe">وزارة الموارد المائية</div>
    <div class="republique-arabe" style="font-size: 12px; margin-top: 2px;">وحدة المدية</div>
    <div class="republique-arabe" style="font-size: 18px; margin-top: 4px;">يبعشلا ةيطارقميدلا ةيرئازجلا ةيروهمجلا</div>
    <div class="republique-francais">République Algérienne Démocratique et Populaire</div>
  </div>

  <div class="header">
    <div class="header-left">
      <div class="adresse-ade">ALGERIENNE DES EAUX<br>Zone d'Alger<br>Unité de Médéa</div>
      <img src="/ade.png" alt="Logo ADE">
    </div>
    <div class="header-right">Agence de : <span class="agence-line">${echapperHtml(agence)}&nbsp;</span></div>
  </div>

  <div class="titre">Demande d'établissement de devis quantitatif et estimatif</div>
  <div class="titre-bar"></div>

  <div class="enreg-date">
    <div>N&deg; d'enregistrement de la demande&nbsp;: <span class="cases">${casesAvecValeurs(numeroAffiche)}</span></div>
    <div>Date&nbsp;&nbsp;&nbsp;<span class="cases">${casesAvecValeurs(dateAffichee)}</span></div>
  </div>

  <div class="consigne">Veuillez établir un devis quantitatif et estimatif pour :</div>

  <div class="field"><label>Nom&nbsp;(ou Raison sociale)</label><div class="line">${echapperHtml(nom)}</div></div>
  <div class="field"><label>Prénom</label><div class="line">${echapperHtml(prenom)}</div></div>

  <div class="section-title">Lieu des travaux :</div>
  <div class="field"><label>Nature</label><div class="line">${echapperHtml(natureTravauxAffichee)}</div></div>
  <div class="field"><label>Rue</label><div class="line">${echapperHtml(demande.adresse_branchement)}</div></div>
  <div class="field"><label>Commune</label><div class="line">${echapperHtml(communeBranchement)}</div></div>

  <div class="section-title">Adresse de correspondance:</div>
  <div class="field"><label>Rue</label><div class="line">${echapperHtml(adresseDemandeur)}</div></div>
  <div class="field"><label>Commune</label><div class="line">${echapperHtml(communeResidence)}</div></div>
  <div class="field"><label>Tél</label><div class="line">${echapperHtml(demande.telephone)}${demande.telephone_secondaire ? ` / ${echapperHtml(demande.telephone_secondaire)}` : ''}</div></div>

  <div class="nature-block">
    <div class="section-title">Nature des travaux demandés :</div>
    <div class="nature-lines">
      <div class="full-line">${echapperHtml(natureTravauxAffichee)}</div>
      <div class="full-line"></div>
    </div>
  </div>

  <table class="visas">
    <caption>VISAS</caption>
    <colgroup><col style="width:30%"><col style="width:40%"><col style="width:30%"></colgroup>
    <thead><tr><th>Chef de Section « Clientèle »</th><th>Juriste</th><th>Chef d'Agence Commerciale</th></tr></thead>
    <tbody><tr><td></td><td></td><td></td></tr></tbody>
  </table>

</body>
</html>`;
}

export function imprimerDevis(demande, fenetre = null, dateEmission = null) {
  const win = fenetre || window.open('', '_blank', 'width=900,height=1000');
  if (!win) return false;
  win.document.open();
  win.document.write(genererHtmlDevis(demande, dateEmission));
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 250);
  return true;
}
