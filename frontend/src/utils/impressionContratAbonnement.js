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

function caseCochee(condition) {
  return condition ? '&#9745;' : '&#9744;';
}

function libelleAgence(nomAgence) {
  const agenceBrute = String(nomAgence || '').trim();
  if (!agenceBrute) return '_______________________';
  return /^agence\b/i.test(agenceBrute) ? agenceBrute : `Agence de ${agenceBrute}`;
}

function categorieTypeBranchement(demande) {
  const type = String(demande.type_branchement || demande.libelle_type || '').toLowerCase();
  if (type.includes('domest')) return { categorie: 'Domestique', type: 'Ordinaire' };
  if (type.includes('commercial') || type.includes('artisan')) return { categorie: 'Commercial', type: 'Ordinaire' };
  if (type.includes('industri') || type.includes('touris')) return { categorie: 'Industriel', type: 'Spécial' };
  if (type.includes('chantier')) return { categorie: 'Chantier', type: 'Temporaire' };
  if (type.includes('incend')) return { categorie: 'Incendie', type: 'Spécial' };
  return { categorie: demande.type_autre || 'Autre', type: 'Ordinaire' };
}

export function genererHtmlContratAbonnement(donnees) {
  const demande = donnees || {};
  const travaux = donnees.travaux || {};
  const etude = donnees.etude || {};

  const estMorale = Boolean(demande.est_personne_morale);
  const nomComplet = estMorale
    ? (demande.raison_sociale || '')
    : [demande.demandeur_nom || demande.nom || '', demande.demandeur_prenom || demande.prenom || ''].filter(Boolean).join(' ');

  const qualite = String(demande.qualite_demandeur || '').toUpperCase();
  const estProprietaire = qualite === 'PROPRIETAIRE';
  const estLocataire = qualite === 'LOCATAIRE';
  const estAutre = !estProprietaire && !estLocataire;

  const communeBranchement = demande.nom_commune_branchement || demande.nom_commune || '';
  const communeResidence = demande.nom_commune_residence || demande.nom_commune || '';
  const adresseResidence = demande.demandeur_adresse || demande.adresse || '';
  const adresseComplete = [adresseResidence, communeResidence].filter(Boolean).join(' - ');

  const { categorie, type } = categorieTypeBranchement(demande);
  const diametreBranchement = etude.diametre_conduite || '';
  const diametreCompteur = travaux.diametre_compteur || '';
  const dateInstallation = travaux.date_fin || travaux.date_debut || '';
  const numeroContrat = demande.numero_demande || '';
  const agence = libelleAgence(demande.nom_agence);
  const lieuSignature = communeBranchement || communeResidence || agence.replace(/^Agence de\s*/i, '');
  const dateSignature = dateFrancaise(travaux.date_fin || new Date());

  const typePiece = demande.type_piece_identite === 'PC' ? 'PC' : 'CNI';
  const neLe = demande.ne_le ? dateFrancaise(demande.ne_le) : '';

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Contrat d'abonnement - ${echapperHtml(numeroContrat)}</title>
  <style>
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      margin: 0;
      color: #000;
      background: #fff;
      font-family: 'Poppins', Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.2;
    }
    .document {
      width: 190mm;
      min-height: 277mm;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
    }
    .entete {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4mm;
    }
    .entete-gauche {
      width: 34%;
      font-size: 9.5pt;
      line-height: 1.35;
      padding-top: 2mm;
    }
    .entete-centre {
      width: 24%;
      text-align: center;
    }
    .entete-centre img {
      width: 24mm;
      height: auto;
      object-fit: contain;
    }
    .entete-droite {
      width: 34%;
      text-align: right;
      font-size: 10pt;
      font-weight: 600;
      padding-top: 4mm;
    }
    .titre {
      text-align: center;
      font-size: 18pt;
      font-weight: 700;
      color: #6d6e71;
      letter-spacing: 0.5px;
      margin: 0 0 2mm;
    }
    .sous-titre {
      background: #b7b8bb;
      color: #fff;
      text-align: center;
      font-size: 8.5pt;
      font-weight: 600;
      padding: 1.2mm 2mm;
      margin-bottom: 4mm;
    }
    .corps {
      display: flex;
      gap: 5mm;
      flex: 1;
      align-items: stretch;
    }
    .cadre-service {
      width: 42%;
      border-right: 1.5px solid #000;
      padding-right: 4mm;
      font-size: 9pt;
    }
    .cadre-service h2 {
      margin: 0 0 3mm;
      font-size: 9.5pt;
      font-weight: 700;
      text-align: center;
    }
    .champ-service {
      margin-bottom: 2.5mm;
    }
    .champ-service label {
      display: block;
      font-size: 8.5pt;
      margin-bottom: 0.8mm;
    }
    .boite {
      min-height: 7mm;
      border: 1px solid #000;
      padding: 1mm 2mm;
      font-size: 10pt;
      font-weight: 600;
      text-align: center;
    }
    .boite-paire {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2mm;
    }
    .partie-abonne {
      width: 58%;
      font-size: 9.5pt;
      position: relative;
      padding-top: 1mm;
    }
    .numero-contrat {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 2mm;
      margin-bottom: 3mm;
      font-weight: 600;
    }
    .numero-contrat .boite {
      min-width: 42mm;
      min-height: 8mm;
    }
    .ligne {
      display: flex;
      align-items: baseline;
      gap: 1.5mm;
      margin: 0 0 2.2mm;
      min-height: 5.5mm;
    }
    .ligne .label { white-space: nowrap; }
    .ligne .valeur {
      flex: 1;
      border-bottom: 1px solid #000;
      min-height: 4.5mm;
      padding: 0 1mm;
      text-align: center;
      font-weight: 600;
      font-size: 10pt;
    }
    .qualites {
      margin: 3mm 0;
      line-height: 1.8;
    }
    .texte-legal {
      text-align: justify;
      font-size: 9pt;
      line-height: 1.35;
      margin: 3mm 0;
    }
    .signatures-haut {
      display: flex;
      justify-content: space-between;
      margin-top: 8mm;
      font-weight: 600;
      font-size: 9.5pt;
    }
    .garantie {
      margin-top: 6mm;
      border-top: 1px solid #000;
      padding-top: 3mm;
      font-size: 9pt;
    }
    .garantie h3 {
      margin: 0 0 2mm;
      font-size: 9.5pt;
      text-decoration: underline;
      text-align: center;
    }
    .garantie .note {
      text-align: center;
      font-style: italic;
      margin-bottom: 3mm;
      font-size: 8.5pt;
    }
    .bandeau {
      margin-top: auto;
      background: #000;
      color: #fff;
      text-align: center;
      font-weight: 700;
      font-size: 9pt;
      padding: 1.5mm 2mm;
      letter-spacing: 0.3px;
    }
    .pied {
      margin-top: 2mm;
      text-align: center;
      font-size: 7.5pt;
      line-height: 1.3;
    }
    @media screen {
      body { background: #eef2f5; padding: 12px; }
      .document { background: #fff; box-shadow: 0 2px 12px #bbb; padding: 10mm; }
    }
  </style>
</head>
<body>
  <main class="document">
    <header class="entete">
      <div class="entete-gauche">
        <div>ALGERIENNE DES EAUX</div>
        <div>Zone d’Alger</div>
        <div>Unité de Médéa</div>
      </div>
      <div class="entete-centre">
        <img src="/ade.png" alt="ADE" />
      </div>
      <div class="entete-droite">${echapperHtml(agence)}</div>
    </header>

    <h1 class="titre">CONTRAT D’ABONNEMENT</h1>
    <div class="sous-titre">Conformément à l’article 5 du règlement général du service des eaux</div>

    <section class="corps">
      <aside class="cadre-service">
        <h2>Cadre réservé au service</h2>
        <div class="champ-service boite-paire">
          <div>
            <label>Catégorie</label>
            <div class="boite">${echapperHtml(categorie)}</div>
          </div>
          <div>
            <label>Type</label>
            <div class="boite">${echapperHtml(type)}</div>
          </div>
        </div>
        <div class="champ-service">
          <label>N° d’Abonné</label>
          <div class="boite">&nbsp;</div>
        </div>
        <div class="champ-service">
          <label>Diamètre de branchement</label>
          <div class="boite">${echapperHtml(diametreBranchement)}</div>
        </div>
        <div class="champ-service">
          <label>Date d’installation</label>
          <div class="boite">${echapperHtml(dateFrancaise(dateInstallation))}</div>
        </div>
        <div class="champ-service">
          <label>N° de Compteur</label>
          <div class="boite">${echapperHtml(travaux.numero_compteur || '')}</div>
        </div>
        <div class="champ-service">
          <label>Marque du compteur</label>
          <div class="boite">${echapperHtml(travaux.marque_compteur || '')}</div>
        </div>
        <div class="champ-service">
          <label>Diamètre du compteur</label>
          <div class="boite">${echapperHtml(diametreCompteur)}</div>
        </div>
        <div class="champ-service">
          <label>Index de départ</label>
          <div class="boite">&nbsp;</div>
        </div>
      </aside>

      <section class="partie-abonne">
        <div class="numero-contrat">
          <span>N°</span>
          <div class="boite">${echapperHtml(numeroContrat)}</div>
        </div>

        <div class="ligne"><span class="label">Je soussigné :</span><span class="valeur">${echapperHtml(nomComplet)}</span></div>
        ${estMorale ? '' : `<div class="ligne"><span class="label">Fils(le) de :</span><span class="valeur">${echapperHtml(demande.fils_de || '')}</span></div>`}
        ${estMorale ? '' : `<div class="ligne"><span class="label">Né(e) le :</span><span class="valeur">${echapperHtml(neLe)}</span></div>`}
        <div class="ligne"><span class="label">Pièce d’identité (${typePiece}) N° :</span><span class="valeur">${echapperHtml(demande.cin || '')}</span></div>
        <div class="ligne">
          <span class="label">Délivrée le</span>
          <span class="valeur" style="flex:0.45">${echapperHtml(dateFrancaise(demande.cin_delivre_le))}</span>
          <span class="label">par</span>
          <span class="valeur" style="flex:0.45">${echapperHtml(demande.cin_delivre_par || '')}</span>
        </div>

        <div class="qualites">
          <div>${caseCochee(estProprietaire)} Propriétaire</div>
          <div>${caseCochee(estLocataire)} Locataire</div>
          <div>${caseCochee(estAutre)} Autres : (à préciser) ${estAutre ? `<strong>${echapperHtml(qualite === 'MANDATAIRE' ? 'Mandataire' : qualite)}</strong>` : ''}</div>
        </div>

        <p class="texte-legal">
          Déclare avoir pris connaissance du règlement général du service des eaux et de la note tarifaire en vigueur,
          demande à l’Algérienne des Eaux de me consentir un abonnement au service des eaux, pour une durée d’un an,
          renouvelable par tacite reconduction, et m’engage à me conformer aux dispositions du règlement général du service des eaux.
        </p>

        <div class="ligne">
          <span class="label">Fait à</span>
          <span class="valeur" style="flex:0.55">${echapperHtml(lieuSignature)}</span>
          <span class="label">le</span>
          <span class="valeur" style="flex:0.35">${echapperHtml(dateSignature)}</span>
        </div>

        <div class="signatures-haut">
          <span>P/L’ADE</span>
          <span>L’ABONNÉ</span>
        </div>
      </section>
    </section>

    <section class="garantie">
      <div style="text-align:center;margin-bottom:2mm;">Pour un abonnement souscrit par un locataire</div>
      <h3>ENGAGEMENT DE GARANTIE DU PROPRIETAIRE</h3>
      <div class="note">(Signature du propriétaire précédée de la mention « lu et approuvé »)</div>
      <div class="ligne"><span class="label">Nom et prénom :</span><span class="valeur">&nbsp;</span></div>
      <div class="ligne"><span class="label">Adresse :</span><span class="valeur">${echapperHtml(estLocataire ? adresseComplete : '')}</span></div>
      <div class="ligne" style="margin-top:4mm"><span class="label">&nbsp;</span><span class="valeur">&nbsp;</span></div>
    </section>

    <div class="bandeau">ORIGINAL A REMETTRE AU CLIENT</div>
    <div class="pied">
      EP. ADE Siège Social Unité de Médéa – Quartier KOTITANE BP 254 Médéa 26000
      Tél. 025 58 25 72 &nbsp; Fax 025 59 63 15
    </div>
  </main>
</body>
</html>`;
}

export function imprimerContratAbonnement(donnees, fenetre = null) {
  const win = fenetre || window.open('', '_blank', 'width=900,height=1000');
  if (!win) return false;

  win.document.open();
  win.document.write(genererHtmlContratAbonnement(donnees));
  win.document.close();

  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);

  return true;
}
