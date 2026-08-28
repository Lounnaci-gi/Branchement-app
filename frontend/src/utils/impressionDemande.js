function echapperHtml(valeur) {
  return String(valeur ?? '').replace(/[&<>'"]/g, (caractere) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[caractere]);
}

function dateFrancaise(valeur) {
  if (!valeur) return '';
  return new Date(valeur).toLocaleDateString('fr-FR');
}

function caseCochee(condition) {
  return condition ? '&#9745;' : '&#9744;';
}

function categorieBesoin(type) {
  const typeNormalise = type
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (typeNormalise.includes('domest')) return 'domestique';
  if (typeNormalise.includes('commercial') || typeNormalise.includes('artisan')) return 'commercial';
  if (typeNormalise.includes('industri') || typeNormalise.includes('touris')) return 'industriel';
  if (typeNormalise.includes('chantier')) return 'chantier';
  if (typeNormalise.includes('incend')) return 'incendie';
  return 'autre';
}

export function genererHtmlDemande(demande) {
  const estMorale = Boolean(demande.est_personne_morale);
  const nom = estMorale ? (demande.raison_sociale || '') : (demande.demandeur_nom || demande.nom || '');
  const prenom = estMorale ? '' : (demande.demandeur_prenom || demande.prenom || '');
  const communeResidence = demande.nom_commune_residence || demande.nom_commune || '';
  const type = demande.type_branchement || demande.libelle_type || '';
  const categorie = categorieBesoin(type);
  const adresse = demande.demandeur_adresse || demande.adresse || '';
  const numero = demande.numero_demande || '';
  const dateDepot = dateFrancaise(demande.date_depot);
  const agenceBrute = demande.nom_agence || '';
  const agence = /^agence\b/i.test(agenceBrute) ? agenceBrute : agenceBrute ? `Agence de ${agenceBrute}` : 'Agence de _______________________';

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Demande de branchement - ${echapperHtml(numero)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #000; background: #fff; font-family: 'Poppins', Arial, sans-serif; font-size: 9pt; line-height: 1.15; }
    .document { position: relative; width: 186mm; height: 277mm; margin: 0 auto; }
    .entete { position: absolute; top: 1mm; left: 0; width: 100%; height: 28mm; }
    .identite-ade { position: absolute; top: 2mm; left: 9mm; display: flex; align-items: center; gap: 3mm; }
    .logo { position: absolute; top: 0; left: 50%; width: 23mm; height: 23mm; transform: translateX(-50%); object-fit: contain; }
    .ade-nom { font-size: 10pt; }
    .ade-zone { text-align: center; font-size: 8pt; }
    .identite-ade > div { width: 34mm; }
    .agence { position: absolute; top: 5mm; right: 9mm; font-size: 9pt; font-weight: bold; }
    h1 { position: absolute; top: 33mm; left: 0; width: 100%; margin: 0; text-align: center; font-size: 16pt; font-weight: normal; line-height: 1.1; }
    .titre-texte { text-decoration: underline; }
    .numero-titre { position: absolute; right: 0; bottom: 0; font-size: 8pt; text-decoration: none; }
    .instruction { position: absolute; top: 40mm; left: 0; width: 100%; margin: 0; padding: 0.5mm 1mm; background: #000; color: #fff; text-align: center; font-weight: bold; font-size: 8pt; line-height: 1.1; }
    .intro { position: absolute; top: 49mm; left: 0; width: 100%; margin: 0; }
    .section { position: absolute; top: 56mm; left: 0; width: 100%; margin: 0; }
    .ligne { display: flex; align-items: baseline; gap: 1.5mm; margin: 0; min-height: 6mm; }
    .label { white-space: nowrap; }
    .valeur { flex: 1; min-height: 4mm; border-bottom: 1px solid #000; padding: 0 1mm; text-align: center; }
    .grille { display: grid; grid-template-columns: 1fr 1fr; column-gap: 7mm; }
    .texte { text-align: justify; margin: 0; }
    .section + .texte { position: absolute; top: 103mm; left: 0; width: 100%; }
    .besoins { position: absolute; top: 119mm; left: 10mm; width: 165mm; text-align: left; }
    .choix { position: absolute; top: 124mm; left: 10mm; width: 165mm; display: block; margin: 0; }
    .choix span { display: block; min-height: 5mm; }
    .choix .sous-ligne { margin-left: 10mm; }
    .choix > span:last-child { display: flex; align-items: baseline; }
    .autre-ligne { flex: 1; min-height: 4mm; margin-left: 2mm; border-bottom: 1px solid #000; text-align: center; }
    .branchement { position: absolute; top: 165mm; left: 0; width: 100%; margin: 0; }
    .branchement .ligne { min-height: 7mm; }
    .branchement + .texte { position: absolute; top: 181mm; left: 0; width: 100%; }
    .infos-techniques { position: absolute; top: 181mm; left: 0; width: 100%; font-size: 8.5pt; }
    .infos-techniques p { margin: 0 0 1mm; font-weight: bold; }
    .infos-techniques .ligne { min-height: 5mm; }
    .infos-techniques .valeur { flex: 0 0 28mm; text-align: left; }
    .engagement { position: absolute; top: 201mm; left: 0; width: 100%; }
    .signature { position: absolute; top: 219mm; left: 0; width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin: 0; min-height: 24mm; }
    .fait { width: 60%; }
    .signature-zone { width: 32%; text-align: center; }
    .signature-ligne { display: none; }
    .reserve { position: absolute; top: 254mm; left: 0; width: 100%; margin: 0; padding-top: 1.5mm; font-size: 8.5pt; }
    .reserve .ligne { margin: 1mm 0; }
    @media screen { body { background: #eef2f5; padding: 15px; } .document { background: #fff; padding: 12mm 16mm; box-shadow: 0 2px 12px #bbb; } }
  </style>
</head>
<body>
  <main class="document">
    <header class="entete">
      <div class="identite-ade"><div><div class="ade-nom">ALGERIENNE DES EAUX</div><div class="ade-zone">Zone d’Alger<br />Unité de Médéa</div></div></div>
      <img src="/ade.png" alt="ADE" class="logo" />
      <div class="agence">${echapperHtml(agence)}</div>
    </header>

    <h1><span class="titre-texte">DEMANDE DE BRANCHEMENT D’EAU POTABLE</span><span class="numero-titre">${echapperHtml(numero)}</span></h1>
    <p class="instruction">DOCUMENT A RETOURNER AU SERVICE DES EAUX DUMENT REMPLI ET SIGNE</p>
    <p class="intro">Je soussigné(e) Madame, Mademoiselle, Monsieur (rayer les mentions inutiles)&nbsp;:</p>

    <section class="section">
      <div class="ligne"><span class="label">Nom (ou raison sociale)&nbsp;:</span><span class="valeur">${echapperHtml(nom)}</span></div>
      <div class="ligne"><span class="label">Prénom&nbsp;:</span><span class="valeur">${echapperHtml(prenom)}</span></div>
      <div class="ligne"><span class="label">Adresse de correspondance&nbsp;:</span></div>
      <div class="ligne"><span class="label">Rue&nbsp;:</span><span class="valeur">${echapperHtml(adresse)}</span></div>
      <div class="ligne"><span class="label">Commune&nbsp;:</span><span class="valeur">${echapperHtml(communeResidence)}</span></div>
      <div class="ligne"><span class="label">Tél&nbsp;:</span><span class="valeur">${echapperHtml(demande.telephone)}${demande.telephone_secondaire ? ` / ${echapperHtml(demande.telephone_secondaire)}` : ''}</span></div>
      <div class="ligne"><span class="label">Agissant en qualité de&nbsp;:</span><span class="valeur">${echapperHtml(demande.qualite_demandeur)}</span></div>
    </section>

    <p class="texte">Et après avoir pris connaissance du règlement général du service public d’alimentation en eau potable en vigueur, demande à l’Algérienne des Eaux qu’il me soit consenti un raccordement au réseau d’alimentation en eau potable de type&nbsp;: Ordinaire, Temporaire, Spécial (rayer les mentions inutiles)</p>
    <div class="texte besoins">Pour des besoins&nbsp;: (cocher la case correspondante)</div>
    <div class="choix"><span>${caseCochee(categorie === 'domestique')} Domestiques: Maison individuelle</span><span class="sous-ligne">Immeuble collectif nombre de logements / locaux commerciaux : __________________</span><span>${caseCochee(categorie === 'commercial')} Commerciaux (Artisans, commerçants)</span><span>${caseCochee(categorie === 'industriel')} Industrie ou tourisme</span><span>${caseCochee(categorie === 'chantier')} Les besoins de chantier</span><span>${caseCochee(categorie === 'incendie')} Borne d’incendie</span><span>${caseCochee(categorie === 'autre')} Autres (à préciser)&nbsp;:<span class="autre-ligne">${echapperHtml(demande.type_autre || '')}</span></span></div>

    <section class="branchement">
      <div class="ligne"><span class="label">Adresse de branchement&nbsp;:</span><span class="valeur">${echapperHtml(demande.adresse_branchement)}</span></div>
    </section>

    <section class="infos-techniques">
      <p>Dans le cadre d’un branchement lié à un besoin pour la construction d’un immeuble, à des besoins industriels ou de chantier, veuillez préciser les informations suivantes&nbsp;:</p>
      <div class="ligne"><span class="label">Diamètre du branchement&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span><span class="valeur">&nbsp;</span><span>mm</span></div>
      <div class="ligne"><span class="label">Débit moyen horaire&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</span><span class="valeur">&nbsp;</span><span>m3/h</span></div>
    </section>

    <p class="texte engagement">Je m’engage à me conformer aux prescriptions du Règlement Général du Service des Eaux dont un exemplaire m’a été remis sur demande ou consulté au niveau du service « accueil clientèle » de l’Algérienne des Eaux.</p>

    <section class="signature">
      <div class="fait">Fait à ${echapperHtml(agence)}, le ${echapperHtml(dateDepot)}</div>
      <div class="signature-zone">Signature<br /><strong>Lu et approuvé</strong></div>
    </section>

    <section class="reserve"><strong>Partie réservée à l’Algérienne des Eaux – A.D.E</strong><div class="ligne"><span>Date de réception&nbsp;:</span></div></section>
  </main>
</body>
</html>`;
}

export function imprimerDemande(demande, fenetre = null) {
  const win = fenetre || window.open('', '_blank', 'width=900,height=1000');
  if (!win) return;
  win.document.open();
  win.document.write(genererHtmlDemande(demande));
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 250);
}
