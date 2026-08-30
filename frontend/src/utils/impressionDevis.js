function echapperHtml(valeur) {
  return String(valeur ?? '').replace(/[&<>'"]/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[caractere]);
}

function dateFrancaise(valeur) {
  return valeur ? new Date(valeur).toLocaleDateString('fr-FR') : '';
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

  // Date de l'étude technique terminée
  const dateEtude = dateEmission
    || demande.date_etude_terminee
    || demande.date_visite
    || demande.etude?.date_visite
    || (Array.isArray(demande.historique) ? demande.historique.find((h) => h.code_statut === 'ETUDE_TERMINEE')?.date_changement : null)
    || (demande.statut_actuel === 'ETUDE_TERMINEE' ? demande.date_maj : null)
    || demande.date_depot
    || new Date();

  const dateAffichee = valeurDate(dateEtude);

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Demande d'établissement de devis quantitatif et estimatif</title>
<style>
  * { box-sizing: border-box; }
  @page { size: A4 portrait; margin: 10mm 12mm; }
  body {
    font-family: 'Poppins', Arial, sans-serif;
    font-size: 13px;
    color: #000;
    max-width: 900px;
    margin: 30px auto;
    padding: 20px 30px;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
  .header-left { display: flex; align-items: center; padding-left: 40px; }
  .adresse-ade { font-size: 14px; line-height: 1.6; display: flex; flex-direction: column; justify-content: center; text-align: center; }
  .header-left img { width: 78px; height: auto; display: block; align-self: center; margin-left: 90px; }
  .header-right { font-size: 13px; margin-top: 6px; white-space: nowrap; }
  .agence-line { display: inline-block; min-width: 160px; border-bottom: none; text-decoration: none; }
  .titre { font-weight: bold; font-size: 17px; text-transform: uppercase; margin: 18px 0 0 40px; }
  .titre-bar { background: #000; height: 10px; width: 100%; margin: 6px 0 18px 0; }
  .enreg-date { display: flex; align-items: center; justify-content: space-between; gap: 30px; margin-bottom: 22px; font-size: 14px; flex-wrap: nowrap; letter-spacing: .5px; }
  .cases { display: inline-flex; vertical-align: middle; gap: 2px; margin-left: 4px; letter-spacing: 0; }
  .case { display: inline-flex; width: 16px; height: 18px; align-items: center; justify-content: center; border: 1px solid #000; font-size: 12px; line-height: 1; }
  .consigne { font-weight: bold; margin-bottom: 14px; }
  .field { margin-bottom: 8px; display: flex; align-items: flex-end; white-space: nowrap; }
  .field label { flex-shrink: 0; margin-right: 4px; font-size: 14px; }
  .field .line { flex-grow: 1; border-bottom: 1px solid #000; height: 1.4em; text-align: center; font-size: 14px; }
  .section-title { text-decoration: underline; margin: 16px 0 4px 0; font-size: 14px; }
  .full-line { border-bottom: 1px solid #000; height: 1.6em; margin-top: 4px; text-align: center; font-size: 14px; }
  .nature-block { margin-top: 16px; }
  .nature-lines .full-line { margin-bottom: 14px; }
  table.visas { width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 40px; }
  table.visas caption { background: #5a5a5a; color: #fff; font-weight: bold; padding: 5px; caption-side: top; border: 1px solid #000; }
  table.visas th, table.visas td { border: 1px solid #000; text-align: center; padding: 6px; }
  table.visas th { font-weight: bold; }
  table.visas td { height: 90px; vertical-align: top; }
  @media print { body { margin: 0 auto; padding: 0; max-width: none; } }
</style>
</head>
<body>
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

  <div class="section-title">Adresse de branchement :</div>
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

const STATUTS_AVEC_ETUDE = new Set([
  'ETUDE_TERMINEE',
  'DEVIS_EMIS',
  'DEVIS_PAYE',
  'TRAVAUX_EN_COURS',
  'TRAVAUX_TERMINES',
  'MISE_EN_SERVICE'
]);

export function imprimerDevis(demande, fenetre = null, dateEmission = null) {
  const estEtudeTerminee = STATUTS_AVEC_ETUDE.has(demande?.statut_actuel)
    || Boolean(dateEmission || demande?.date_etude_terminee || demande?.date_visite || demande?.etude?.date_visite)
    || Boolean(Array.isArray(demande?.historique) && demande.historique.some((h) => h.code_statut === 'ETUDE_TERMINEE'));

  if (!estEtudeTerminee) {
    if (fenetre && !fenetre.closed) fenetre.close();
    return false;
  }

  const win = fenetre || window.open('', '_blank', 'width=900,height=1000');
  if (!win) return false;
  win.document.open();
  win.document.write(genererHtmlDevis(demande, dateEmission));
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 250);
  return true;
}
