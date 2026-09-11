function normaliserTypeArticleTarif(payload = {}) {
  const typeArticle = String(payload.type_article || '').trim().toUpperCase();
  let modePrix = String(payload.mode_prix || 'FOURNITURE_POSE').trim().toUpperCase();
  const prixUnitaire = Number(payload.prix_unitaire);
  let fourniture = payload.prix_fourniture === null || payload.prix_fourniture === '' || payload.prix_fourniture === undefined
    ? null
    : Number(payload.prix_fourniture);
  let pose = payload.prix_pose === null || payload.prix_pose === '' || payload.prix_pose === undefined
    ? null
    : Number(payload.prix_pose);

  if (typeArticle === 'PR') {
    modePrix = 'PRESTATION';
    fourniture = null;
    pose = null;
    return {
      mode_prix: modePrix,
      prix_unitaire: Number.isFinite(prixUnitaire) ? prixUnitaire : 0,
      prix_fourniture: null,
      prix_pose: null,
      type_article: typeArticle
    };
  }

  if (typeArticle === 'F') {
    modePrix = 'FOURNITURE_POSE';
    fourniture = Number.isFinite(fourniture) ? fourniture : 0;
    pose = 0;
  } else if (typeArticle === 'P') {
    modePrix = 'FOURNITURE_POSE';
    fourniture = 0;
    pose = Number.isFinite(pose) ? pose : 0;
  } else if (typeArticle === 'FP') {
    modePrix = 'FOURNITURE_POSE';
    fourniture = Number.isFinite(fourniture) ? fourniture : 0;
    pose = Number.isFinite(pose) ? pose : 0;
  }

  return {
    mode_prix: modePrix,
    prix_unitaire: modePrix === 'PRESTATION'
      ? (Number.isFinite(prixUnitaire) ? prixUnitaire : 0)
      : (Number.isFinite(fourniture) && Number.isFinite(pose) ? fourniture + pose : Number(prixUnitaire || 0)),
    prix_fourniture: modePrix === 'PRESTATION' ? null : fourniture,
    prix_pose: modePrix === 'PRESTATION' ? null : pose,
    type_article: typeArticle
  };
}

module.exports = { normaliserTypeArticleTarif };
