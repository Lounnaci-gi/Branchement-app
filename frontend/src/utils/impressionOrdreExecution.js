function echapperHtml(valeur) {
  return String(valeur ?? '').replace(/[&<>'"]/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[caractere]);
}

function dateFrancaise(valeur) {
  if (!valeur) return '';
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR');
}

/**
 * Décompose une date en format JJ / MM / AA sous forme de cases de saisie
 */
function genererCasesDate(dateVal) {
  let j1 = '', j2 = '', m1 = '', m2 = '', a1 = '', a2 = '';
  if (dateVal) {
    const d = new Date(dateVal);
    if (!Number.isNaN(d.getTime())) {
      const jour = String(d.getDate()).padStart(2, '0');
      const mois = String(d.getMonth() + 1).padStart(2, '0');
      const annee = String(d.getFullYear()).slice(-2);
      j1 = jour[0]; j2 = jour[1];
      m1 = mois[0]; m2 = mois[1];
      a1 = annee[0]; a2 = annee[1];
    }
  }

  return `<div class="date-groupe">
    <span class="case-chiffre">${echapperHtml(j1)}</span>
    <span class="case-chiffre">${echapperHtml(j2)}</span>
    <span class="sep-date">!</span>
    <span class="case-chiffre">${echapperHtml(m1)}</span>
    <span class="case-chiffre">${echapperHtml(m2)}</span>
    <span class="sep-date">!</span>
    <span class="case-chiffre">${echapperHtml(a1)}</span>
    <span class="case-chiffre">${echapperHtml(a2)}</span>
  </div>`;
}

/**
 * Génère des cases de saisie pour un numéro / index (par défaut 8 cases: 4 ! 4)
 */
function genererCasesChiffres(valeur = '', nbTotal = 8, separation = 4) {
  const str = String(valeur || '').replace(/\D/g, '').slice(0, nbTotal).padStart(valeur ? nbTotal : 0, ' ');
  const chars = Array.from({ length: nbTotal }, (_, i) => str[i] || '');

  const groupe1 = chars.slice(0, separation);
  const groupe2 = chars.slice(separation);

  return `<div class="date-groupe">
    ${groupe1.map((c) => `<span class="case-chiffre">${echapperHtml(c.trim())}</span>`).join('')}
    <span class="sep-date">!</span>
    ${groupe2.map((c) => `<span class="case-chiffre">${echapperHtml(c.trim())}</span>`).join('')}
  </div>`;
}

export function genererHtmlOrdreExecution(donnees) {
  const demande = donnees || {};
  const etude = donnees.etude || {};
  const devisListe = Array.isArray(donnees.devis) ? donnees.devis : (donnees.devis ? [donnees.devis] : []);
  const devisPaye = devisListe.find((d) => d.statut_paiement === 'PAYE') || devisListe[0] || {};
  const travaux = donnees.travaux || {};
  const miseEnService = donnees.miseEnService || {};

  const estMorale = Boolean(demande.est_personne_morale);
  const nom = estMorale ? (demande.raison_sociale || '') : (demande.demandeur_nom || demande.nom || '');
  const prenom = estMorale ? '' : (demande.demandeur_prenom || demande.prenom || '');

  const agenceBrute = demande.nom_agence || '';
  const agence = agenceBrute.replace(/^agence(?:\s+de)?\s*:?\s*/i, '');

  const communeBranchement = demande.nom_commune_branchement || demande.nom_commune || '';
  const adresseBranchementBrute = (demande.adresse_branchement || '').trim();
  let adresseBranchement = adresseBranchementBrute;
  if (communeBranchement && !adresseBranchementBrute.toLowerCase().includes(communeBranchement.toLowerCase())) {
    adresseBranchement = `${adresseBranchementBrute} - ${communeBranchement}`;
  }

  const communeResidence = demande.nom_commune_residence || demande.nom_commune || '';
  const adresseDemandeurBrute = (demande.demandeur_adresse || demande.adresse || '').trim();
  let adresseResidence = adresseDemandeurBrute;
  if (communeResidence && !adresseDemandeurBrute.toLowerCase().includes(communeResidence.toLowerCase())) {
    adresseResidence = `${adresseDemandeurBrute} - ${communeResidence}`;
  }

  const typeBranchement = (demande.type_branchement || demande.libelle_type || '').trim();
  const typeAutre = (demande.type_autre || '').trim();

  const natureTravaux = (() => {
    const source = typeAutre || typeBranchement || 'Branchement d\'eau potable';
    const texte = String(source).trim();
    if (!texte) return 'Branchement d\'eau potable';
    if (texte.startsWith('Branchement d\'eau potable')) return 'Branchement d\'eau potable';
    if (texte.startsWith('Extension réseau AEP') || /extension/i.test(texte)) return 'Extension réseau AEP';
    if (texte.startsWith('Rénovation de branchement') || /rénovation/i.test(texte)) return 'Rénovation de branchement';
    if (texte.startsWith('Travaux de résiliation') || /résiliation/i.test(texte)) return 'Travaux de résiliation';
    if (texte.startsWith('Autres') || /autres/i.test(texte)) return 'Autres';
    return texte;
  })();

  // Devis multiples : numéros et dates
  const numerosDevisTexte = devisListe.map((d) => d.numero_devis || '—').filter(Boolean).join(' / ') || devisPaye.numero_devis || '';
  const datesDevisTexte = devisListe.map((d) => dateFrancaise(d.date_emission)).filter(Boolean).join(' / ') || dateFrancaise(devisPaye.date_emission) || '';

  // Paiements multiples : références de règlement
  const devisPayes = devisListe.filter((d) => d.statut_paiement === 'PAYE' || d.date_paiement || d.mode_paiement);
  const listeReglements = (devisPayes.length > 0 ? devisPayes : devisListe).map((d) => {
    const parts = [];
    if (devisListe.length > 1 && d.numero_devis) {
      parts.push(`[Devis ${d.numero_devis}]`);
    }
    if (d.mode_paiement === 'Especes') {
      parts.push('Espèces' + (d.numero_recu ? ` (Reçu N° ${d.numero_recu})` : ''));
    } else if (d.mode_paiement === 'Cheque') {
      parts.push('Chèque' + (d.numero_cheque ? ` N° ${d.numero_cheque}` : ''));
    } else if (d.mode_paiement === 'Versement_bancaire') {
      parts.push('Versement bancaire' + (d.numero_versement ? ` N° ${d.numero_versement}` : ''));
    } else if (d.mode_paiement === 'Virement') {
      parts.push('Virement' + (d.numero_versement ? ` N° ${d.numero_versement}` : ''));
    } else if (d.mode_paiement) {
      parts.push(d.mode_paiement);
    }
    if (d.banque) parts.push(`(${d.banque})`);
    if (d.date_paiement) parts.push(`du ${dateFrancaise(d.date_paiement)}`);
    if (d.montant) parts.push(`[${Number(d.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} DA]`);
    return parts.join(' ');
  }).filter(Boolean);

  const refReglement = listeReglements.join(' ; ');

  const telephone = [demande.telephone, demande.telephone_secondaire].filter(Boolean).join(' / ');
  const dateDocument = travaux.date_debut || devisPaye.date_paiement || new Date();

  const diametre = travaux.diametre_compteur || etude.diametre_conduite || demande.diametre_defaut || '';
  const observations = travaux.observations || demande.observations || '';
  const numeroOrdre = travaux.numero_ordre_execution || demande.numero_demande || '';

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Ordre d'exécution - ${echapperHtml(numeroOrdre)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 12mm 8mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Poppins', Arial, sans-serif;
      font-size: 11.5px;
      color: #000;
      background: #fff;
      line-height: 1.25;
    }
    .page-a4 {
      width: 100%;
      max-width: 190mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 275mm;
    }

    /* En-tête */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .header-left {
      text-align: center;
      font-size: 11px;
      line-height: 1.35;
      width: 38%;
    }
    .header-left .titre-org {
      font-weight: bold;
      font-size: 12px;
    }
    .header-center {
      width: 24%;
      text-align: center;
    }
    .header-center img {
      width: 70px;
      height: auto;
      object-fit: contain;
    }
    .header-right {
      width: 38%;
      text-align: right;
      font-size: 12px;
      font-weight: 500;
    }
    .header-right .agence-valeur {
      font-weight: bold;
      border-bottom: 1px solid #000;
      padding: 0 4px;
      display: inline-block;
      min-width: 120px;
      text-align: center;
    }

    /* Titre & Barre */
    .titre-section {
      position: relative;
      text-align: center;
      margin: 6px 0 2px 0;
      min-height: 24px;
    }
    .titre-principal {
      font-size: 17px;
      font-weight: bold;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      display: inline-block;
    }
    .code-ordre {
      position: absolute;
      right: 0;
      bottom: 2px;
      font-size: 8.5pt;
      font-weight: bold;
      color: #000;
      letter-spacing: 0;
    }
    .barre-noire {
      background: #000;
      height: 9px;
      width: 100%;
      margin-top: 4px;
      margin-bottom: 10px;
    }

    /* Date haut droite */
    .date-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
      font-size: 12px;
      font-weight: 500;
    }
    .date-groupe {
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .case-chiffre {
      display: inline-flex;
      width: 15px;
      height: 17px;
      align-items: center;
      justify-content: center;
      border: 1px solid #000;
      font-size: 11px;
      font-weight: bold;
      background: #fff;
    }
    .sep-date {
      margin: 0 2px;
      font-weight: bold;
      font-size: 11px;
    }

    /* Travaux à effectuer */
    .ligne-travaux-titre {
      font-weight: bold;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .ligne-pleine {
      border-bottom: 1px solid #000;
      min-height: 20px;
      padding: 0 4px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      text-align: center;
      font-size: 11.5px;
      font-weight: 500;
      margin-bottom: 8px;
    }

    .ligne-devis-reglement {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      margin-bottom: 6px;
      font-size: 11.5px;
    }
    .champ-ligne {
      display: flex;
      align-items: flex-end;
      margin-bottom: 6px;
      font-size: 11.5px;
    }
    .champ-ligne label {
      white-space: nowrap;
      margin-right: 6px;
    }
    .champ-ligne .valeur-soulignee {
      flex-grow: 1;
      border-bottom: 1px solid #000;
      min-height: 17px;
      padding: 0 6px;
      font-weight: 500;
      text-align: center;
    }

    .section-titre-souligne {
      text-decoration: underline;
      font-weight: bold;
      font-size: 12px;
      margin: 10px 0 6px 0;
    }

    /* Tableaux Visas */
    table.tableau-visas {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 12px 0;
    }
    table.tableau-visas th, table.tableau-visas td {
      border: 1.5px solid #000;
      text-align: center;
      padding: 5px;
    }
    table.tableau-visas th {
      font-weight: bold;
      font-size: 11.5px;
      background: #f2f2f2;
    }
    table.tableau-visas td {
      height: 52px;
      vertical-align: top;
      text-align: left;
      font-size: 11px;
    }

    /* Section Deux Colonnes : Travaux / Compteur */
    .grille-deux-colonnes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 24px;
      margin: 10px 0;
      align-items: start;
    }
    .col-gauche, .col-droite {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ligne-inline-date {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11.5px;
    }

    /* Observations */
    .section-observations {
      margin-top: 8px;
    }
    .obs-lignes {
      margin-top: 4px;
    }
    .obs-ligne {
      border-bottom: 1px solid #000;
      min-height: 18px;
      padding: 0 4px;
      font-size: 11px;
    }

    /* Tableau bas */
    table.tableau-bas {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      margin: 12px 0 8px 0;
    }
    table.tableau-bas th, table.tableau-bas td {
      border: 1.5px solid #000;
      padding: 6px 8px;
    }
    table.tableau-bas th {
      font-weight: bold;
      text-align: center;
      font-size: 11.5px;
      background: #f2f2f2;
    }
    table.tableau-bas td {
      height: 62px;
      vertical-align: top;
      font-size: 11px;
      line-height: 1.5;
    }

    /* Bandeau noir bas */
    .bandeau-bas {
      background: #000;
      color: #fff;
      text-align: center;
      font-weight: bold;
      font-size: 11.5px;
      padding: 5px 0;
      margin-top: 4px;
      letter-spacing: 0.3px;
    }

    @media screen {
      body {
        background: #eef2f5;
        padding: 20px;
      }
      .page-a4 {
        background: #fff;
        padding: 20px 30px;
        box-shadow: 0 4px 14px rgba(0,0,0,0.15);
      }
    }
  </style>
</head>
<body>
  <main class="page-a4">
    <div>
      <!-- En-tête -->
      <div class="header">
        <div class="header-left">
          <div class="titre-org">ALGERIENNE DES EAUX</div>
          <div>Zone d'Alger</div>
          <div>Unité de Médéa</div>
        </div>
        <div class="header-center">
          <img src="/ade.png" alt="Logo ADE" />
        </div>
        <div class="header-right">
          Agence de <span class="agence-valeur">${echapperHtml(agence)}</span>
        </div>
      </div>

      <!-- Titre et bandeau -->
      <div class="titre-section">
        <span class="titre-principal">ORDRE D’EXECUTION</span>
        ${numeroOrdre ? `<span class="code-ordre">${echapperHtml(numeroOrdre)}</span>` : ''}
      </div>
      <div class="barre-noire"></div>

      <!-- Date en haut à droite -->
      <div class="date-row">
        <span>Date</span>
        ${genererCasesDate(dateDocument)}
      </div>

      <!-- Travaux à effectuer -->
      <div class="ligne-travaux-titre">Travaux à effectuer :</div>
      <div class="ligne-pleine">${echapperHtml(natureTravaux)}</div>

      <div class="ligne-devis-reglement">
        <span>Selon devis n°</span>
        <span style="border-bottom: 1px solid #000; flex: 1; padding: 0 4px; font-weight: 500;">${echapperHtml(numerosDevisTexte)}</span>
        <span style="margin-left: 12px;">Du</span>
        <span style="border-bottom: 1px solid #000; min-width: 110px; text-align: center; font-weight: 500;">${echapperHtml(datesDevisTexte)}</span>
        <span style="margin-left: 6px; font-size: 10.5px;">(Ci-joint)</span>
      </div>

      <div class="champ-ligne" style="margin-top: 4px;">
        <label>Référence de règlement :</label>
        <div class="valeur-soulignee">${echapperHtml(refReglement)}</div>
      </div>

      <!-- Section Bénéficiaire -->
      <div class="section-titre-souligne">Bénéficiaire :</div>

      <div class="champ-ligne">
        <label>Nom <span style="font-size: 10px;">(ou Raison sociale)</span></label>
        <div class="valeur-soulignee">${echapperHtml(nom)}</div>
      </div>

      <div class="champ-ligne">
        <label>Prénom</label>
        <div class="valeur-soulignee">${echapperHtml(prenom)}</div>
      </div>

      <div class="champ-ligne">
        <label style="text-decoration: underline;">Adresse de branchement :</label>
        <div class="valeur-soulignee">${echapperHtml(adresseBranchement)}</div>
      </div>
      <div class="ligne-pleine" style="margin-bottom: 4px;"></div>

      <div class="champ-ligne">
        <label style="text-decoration: underline;">Adresse de correspondance :</label>
        <div class="valeur-soulignee">${echapperHtml(adresseResidence)}</div>
      </div>
      <div class="ligne-pleine" style="margin-bottom: 4px;"></div>

      <div class="champ-ligne">
        <label>Tél.</label>
        <div class="valeur-soulignee">${echapperHtml(telephone)}</div>
      </div>

      <!-- Visas intermédiaires -->
      <table class="tableau-visas">
        <thead>
          <tr>
            <th style="width: 50%;">Chef de Section « Clientèle »</th>
            <th style="width: 50%;">Chef d’Agence Commerciale</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td></td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <!-- Section Deux Colonnes (Travaux & Compteur) -->
      <div class="grille-deux-colonnes">
        <!-- Colonne Gauche -->
        <div class="col-gauche">
          <div class="ligne-inline-date">
            <span>Travaux entamés le</span>
            ${genererCasesDate(travaux.date_debut)}
          </div>
          <div class="ligne-inline-date" style="margin-top: 4px;">
            <span>Travaux achevés le</span>
            ${genererCasesDate(travaux.date_fin)}
          </div>
          <div class="champ-ligne" style="margin-top: 6px;">
            <label>Par :</label>
            <div class="valeur-soulignee">${echapperHtml(travaux.equipe_execution || '')}</div>
          </div>
        </div>

        <!-- Colonne Droite (Compteur) -->
        <div class="col-droite">
          <div style="font-weight: bold; text-decoration: underline; font-size: 12px; margin-bottom: 2px;">Compteur</div>
          <div class="ligne-inline-date">
            <span>Posé le</span>
            ${genererCasesDate(travaux.date_fin || travaux.date_debut)}
          </div>
          <div class="champ-ligne">
            <label>Marque :</label>
            <div class="valeur-soulignee">${echapperHtml(travaux.marque_compteur || '')}</div>
          </div>
          <div class="champ-ligne">
            <label>Type :</label>
            <div class="valeur-soulignee" style="max-width: 100px;">${echapperHtml(travaux.type_compteur || typeBranchement)}</div>
            <label style="margin-left: 10px;">Diamètre :</label>
            <div class="valeur-soulignee">${echapperHtml(diametre)}</div>
          </div>
          <div class="ligne-inline-date">
            <span>N° de Série</span>
            ${genererCasesChiffres(travaux.numero_compteur || '', 8, 4)}
          </div>
          <div class="ligne-inline-date" style="margin-top: 3px;">
            <span>Index de pose</span>
            ${genererCasesChiffres(miseEnService.index_initial !== undefined && miseEnService.index_initial !== null ? String(miseEnService.index_initial) : '', 8, 4)}
          </div>
        </div>
      </div>

      <!-- Observations -->
      <div class="section-observations">
        <div class="champ-ligne">
          <label>Observations :</label>
          <div class="valeur-soulignee">${echapperHtml(observations)}</div>
        </div>
        <div class="obs-lignes">
          <div class="obs-ligne"></div>
          <div class="obs-ligne"></div>
        </div>
      </div>

      <!-- Tableau Signatures Finales -->
      <table class="tableau-bas">
        <thead>
          <tr>
            <th style="width: 50%;">Réalisateur</th>
            <th style="width: 50%;">Contrôleur « ADE »</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div>Nom : ${echapperHtml(travaux.equipe_execution || '')}</div>
              <div style="margin-top: 14px;">Visa :</div>
            </td>
            <td>
              <div>Nom :</div>
              <div>Fonction :</div>
              <div>Visa :</div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Bandeau noir de bas de page -->
    <div class="bandeau-bas">
      Ordre d’exécution à retourner à la section « clientèle »
    </div>
  </main>
</body>
</html>`;
}

export function imprimerOrdreExecution(donnees, fenetre = null) {
  const win = fenetre || window.open('', '_blank', 'width=900,height=1000');
  if (!win) return false;

  win.document.open();
  win.document.write(genererHtmlOrdreExecution(donnees));
  win.document.close();

  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);

  return true;
}
