import QRCode from 'qrcode';

/**
 * Utilitaire d'impression de l'accusé de réception
 * Conforme aux spécifications :
 * - Dimensions de chaque coupon : 95mm × 85mm
 * - Exactement 2 coupons par page d'impression
 * - QR Code en haut à droite contenant : Code demande, Nom & prénom, Type de branchement, Date de la demande
 * - En-tête officiel ADE + Champs obligatoires
 */

function echapperHtml(valeur) {
  return String(valeur ?? '').replace(/[&<>'"]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[c]);
}

export async function genererHtmlAccuse(demande) {
  const estMorale = Boolean(demande.est_personne_morale);
  const nom = estMorale ? (demande.raison_sociale || '') : (demande.demandeur_nom || demande.nom || '');
  const prenom = estMorale ? '' : (demande.demandeur_prenom || demande.prenom || '');
  const nomComplet = estMorale ? nom : `${nom} ${prenom}`.trim();
  const adresse = demande.demandeur_adresse || demande.adresse || demande.adresse_branchement || '';
  
  const typeLibelle = demande.type_branchement || demande.libelle_type || '';
  const typeAutre = demande.type_autre ? ` : ${demande.type_autre}` : '';
  const libelleComplet = `${typeLibelle}${typeAutre}`.trim() || 'Branchement standard';
  
  let natureDoleance = "Branchement d'eau Potable";
  if (libelleComplet.toLowerCase().includes('extension')) {
    natureDoleance = 'Extension de réseau AEP';
  } else if (libelleComplet) {
    natureDoleance = `Branchement d'eau Potable ${libelleComplet}`;
  }

  const dateDepot = demande.date_depot
    ? new Date(demande.date_depot).toLocaleDateString('fr-FR')
    : new Date().toLocaleDateString('fr-FR');

  const rawAgence = demande.nom_agence || '';
  const agenceTexte = rawAgence.toLowerCase().startsWith('agence')
    ? rawAgence
    : rawAgence ? `Agence de ${rawAgence}` : 'Agence de _______________________';

  const numeroDemande = demande.numero_demande || '___________';

  // Contenu du QR Code
  const texteQrCode = [
    `N° Demande: ${numeroDemande}`,
    `Demandeur: ${nomComplet}`,
    `Type: ${libelleComplet}`,
    `Date: ${dateDepot}`
  ].join('\n');

  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(texteQrCode, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch (err) {
    console.error('Erreur génération QR Code:', err);
  }

  // Structure d'un coupon (95mm × 85mm)
  const couponHtml = () => `
    <div class="coupon">
      <div class="coupon-entete">
        <div class="entete-gauche">
          <div class="entete-logo-titre">
            <img src="/ade.png" alt="ADE" class="logo-ade" />
            <div>
              <div class="titre-principal">ALGERIENNE DES EAUX</div>
              <div class="sous-titre">Zone d’Alger · Unité de Médéa</div>
            </div>
          </div>
          <div class="agence-ligne">${echapperHtml(agenceTexte)}</div>
        </div>
        <div class="entete-droite">
          ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" alt="QR Code" class="qrcode-img" />` : ''}
        </div>
      </div>

      <div class="titre-accuse">
        Accusé de réception N° <span class="valeur-numero">${echapperHtml(numeroDemande)}</span>
      </div>

      <div class="corps-coupon">
        <div class="champ-ligne">
          <span class="champ-libelle">Nom&nbsp;:</span>
          <span class="champ-valeur">${echapperHtml(nom)}</span>
        </div>

        <div class="champ-ligne">
          <span class="champ-libelle">Prénom&nbsp;:</span>
          <span class="champ-valeur">${echapperHtml(prenom)}</span>
        </div>

        <div class="champ-ligne">
          <span class="champ-libelle">Adresse&nbsp;:</span>
          <span class="champ-valeur">${echapperHtml(adresse)}</span>
        </div>

        <div class="champ-ligne">
          <span class="champ-libelle">Nature&nbsp;:</span>
          <span class="champ-valeur">${echapperHtml(natureDoleance)}</span>
        </div>

        <div class="champ-ligne">
          <span class="champ-libelle">Date de réception&nbsp;:</span>
          <span class="champ-valeur date-valeur">${echapperHtml(dateDepot)}</span>
        </div>

        <div class="signature-section">
          <div class="signature-libelle">Le responsable commercial&nbsp;:</div>
          <div class="signature-espace"></div>
        </div>
      </div>
    </div>
  `;

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Accusé de réception - ${echapperHtml(numeroDemande)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
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
      color: #000;
      background: #fff;
    }
    .page-impression {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 12mm;
      padding-top: 6mm;
    }
    .coupon {
      width: 95mm;
      height: 85mm;
      min-width: 95mm;
      max-width: 95mm;
      min-height: 85mm;
      max-height: 85mm;
      border: 1px dashed #555;
      padding: 3.5mm 4.5mm 2.5mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background: #fff;
      overflow: hidden;
    }
    .coupon-entete {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 3mm;
      height: 22mm;
      max-height: 22mm;
    }
    .entete-gauche {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
    }
    .entete-logo-titre {
      display: flex;
      align-items: center;
      gap: 2mm;
    }
    .logo-ade {
      width: 65px;
      height: 65px;
      object-fit: contain;
      flex-shrink: 0;
    }
    .titre-principal {
      font-weight: bold;
      font-size: 8pt;
      line-height: 1.1;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    .sous-titre {
      font-size: 6.5pt;
      line-height: 1.1;
      color: #222;
    }
    .agence-ligne {
      font-size: 7pt;
      font-weight: bold;
      margin-top: 1px;
    }
    .entete-droite {
      width: 20mm;
      height: 20mm;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qrcode-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .titre-accuse {
      text-align: center;
      font-size: 8.5pt;
      font-weight: bold;
      margin: 1.5mm 0 1mm;
      line-height: 1.2;
    }
    .valeur-numero {
      display: inline-block;
      min-width: 80px;
      border-bottom: 1px solid #000;
      padding: 0 3px;
      font-family: 'Poppins', Arial, sans-serif;
      font-weight: bold;
    }
    .corps-coupon {
      font-size: 7.5pt;
      line-height: 1.35;
      display: flex;
      flex-direction: column;
      gap: 1.2mm;
    }
    .champ-ligne {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      min-height: 14px;
    }
    .champ-libelle {
      font-weight: bold;
      white-space: nowrap;
      font-size: 7.5pt;
    }
    .champ-valeur {
      flex: 1;
      border-bottom: 1px dotted #333;
      padding: 0 2px;
      min-height: 13px;
      font-size: 7.5pt;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .date-valeur {
      max-width: 110px;
    }
    .signature-section {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      margin-top: 1mm;
    }
    .signature-libelle {
      font-weight: bold;
      font-size: 7pt;
    }
    .signature-espace {
      min-width: 75px;
      height: 14px;
    }
    .separateur-decoupe {
      width: 95mm;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #888;
      font-size: 8pt;
      user-select: none;
    }
    .separateur-ligne {
      flex: 1;
      border-top: 1px dashed #aaa;
    }
    @media screen {
      body {
        background: #eef2f5;
        padding: 20px;
      }
      .page-impression {
        background: #fff;
        max-width: 160mm;
        margin: 0 auto;
        padding: 20px 0;
        box-shadow: 0 4px 14px rgba(0,0,0,0.15);
      }
    }
  </style>
</head>
<body>
  <main class="page-impression">
    ${couponHtml()}
    <div class="separateur-decoupe">
      <div class="separateur-ligne"></div>
      <span>✂ Ligne de découpe</span>
      <div class="separateur-ligne"></div>
    </div>
    ${couponHtml()}
  </main>
</body>
</html>`;
}

export async function imprimerAccuse(demande, fenetre = null) {
  const win = fenetre || window.open('', '_blank', 'width=800,height=800');
  if (!win) return;

  const html = await genererHtmlAccuse(demande);
  win.document.open();
  win.document.write(html);
  win.document.close();

  setTimeout(() => {
    win.focus();
    win.print();
  }, 250);
}
