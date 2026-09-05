const express = require('express');
const router = express.Router();
const { sql, getPool } = require('../config/db');
const { verifierToken, autoriserRoles } = require('../middleware/auth');

function texteValide(valeur, { maxLength = 200, obligatoire = false } = {}) {
  const text = typeof valeur === 'string' ? valeur.trim() : '';
  if (!text && !obligatoire) return true;
  if (!text && obligatoire) return false;
  if (text.length > maxLength) return false;
  return !/[<>]|javascript:|on\w+\s*=|[\u0000-\u001F\u007F]/i.test(text);
}

router.use(verifierToken);

router.get('/articles', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
                  SELECT f.id_famille, f.code_famille AS code, f.libelle AS libelle_famille,
                    f.id_categorie,
                    cat.libelle AS libelle_categorie,
                    a.id_article, a.code_article AS code_article, a.libelle, a.matiere, a.couleur, a.unite,
                    COALESCE(t.mode_prix, a.mode_prix) AS mode_prix,
                    COALESCE(t.prix_unitaire, a.prix_unitaire) AS prix,
                    COALESCE(t.prix_fourniture, a.prix_fourniture) AS prix_fourniture,
                    COALESCE(t.prix_pose, a.prix_pose) AS prix_pose,
                    COALESCE(t.type_tva, a.type_tva) AS type_tva,
                    COALESCE(t.taux_tva, a.taux_tva) AS taux_tva,
                    ISNULL(a.avec_diametre, 0) AS avec_diametre
      FROM FamillesArticles f
      LEFT JOIN CategoriesArticles cat ON cat.id_categorie = f.id_categorie
      INNER JOIN ArticlesDevis a ON a.id_famille = f.id_famille
                  OUTER APPLY (
               SELECT TOP 1 tarif.mode_prix, tarif.prix_unitaire, tarif.prix_fourniture,
                 tarif.prix_pose, tarif.type_tva, tarif.taux_tva
               FROM TarifsArticlesDevis tarif
               WHERE tarif.id_article = a.id_article
                 AND tarif.date_debut <= CONVERT(date, GETDATE())
                 AND (tarif.date_fin IS NULL OR tarif.date_fin >= CONVERT(date, GETDATE()))
               ORDER BY tarif.date_debut DESC, tarif.id_tarif DESC
                  ) t
      WHERE f.actif = 1 AND a.actif = 1
      ORDER BY f.libelle, a.libelle
    `);
    const familles = result.recordset.reduce((acc, article) => {
      let famille = acc.find((item) => item.code === article.code);
      if (!famille) {
        famille = {
          id_famille: article.id_famille,
          code: article.code,
          libelle: article.libelle_famille,
          id_categorie: article.id_categorie,
          libelle_categorie: article.libelle_categorie,
          articles: []
        };
        acc.push(famille);
      }
      famille.articles.push({
        id_article: article.id_article,
        code: article.code_article,
        libelle: article.libelle,
        matiere: article.matiere,
        couleur: article.couleur,
        unite: article.unite,
        modePrix: article.mode_prix,
        prix: Number(article.prix),
        prixFourniture: article.prix_fourniture === null ? null : Number(article.prix_fourniture),
        prixPose: article.prix_pose === null ? null : Number(article.prix_pose),
        typeTva: article.type_tva,
        tauxTva: Number(article.taux_tva),
        avecDiametre: Boolean(article.avec_diametre)
      });
      return acc;
    }, []);
    res.json(familles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement du référentiel des articles.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES D'ARTICLES
// ─────────────────────────────────────────────────────────────────────────────

router.get('/articles/categories', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT id_categorie, code_categorie, libelle
      FROM CategoriesArticles
      WHERE actif = 1
      ORDER BY libelle
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement des catégories d\'articles.' });
  }
});

router.post('/articles/categories', autoriserRoles('admin'), async (req, res) => {
  const libelle = typeof req.body.libelle === 'string' ? req.body.libelle.trim() : '';

  if (!texteValide(libelle, { maxLength: 100, obligatoire: true })) {
    return res.status(400).json({ erreur: 'Le libellé de la catégorie est invalide (100 caractères max).' });
  }

  try {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const creation = await new sql.Request(transaction)
        .input('libelle', sql.NVarChar(100), libelle)
        .query(`INSERT INTO CategoriesArticles (code_categorie, libelle)
                OUTPUT INSERTED.id_categorie
                VALUES (CONCAT(N'__CAT_TEMP_', CONVERT(NVARCHAR(36), NEWID())), @libelle)`);
      const categorieId = creation.recordset[0].id_categorie;
      const result = await new sql.Request(transaction)
        .input('id_categorie', sql.Int, categorieId)
        .query(`UPDATE CategoriesArticles
                SET code_categorie = CONCAT(N'CAT-', id_categorie)
                OUTPUT INSERTED.id_categorie, INSERTED.code_categorie, INSERTED.libelle
                WHERE id_categorie = @id_categorie`);
      await transaction.commit();
      res.status(201).json(result.recordset[0]);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    if (err.number === 2601 || err.number === 2627) {
      return res.status(409).json({ erreur: 'Le code automatique de cette catégorie existe déjà.' });
    }
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de la création de la catégorie.' });
  }
});

router.put('/articles/categories/:id_categorie', autoriserRoles('admin'), async (req, res) => {
  const categorieId = Number(req.params.id_categorie);
  const libelle = typeof req.body.libelle === 'string' ? req.body.libelle.trim() : '';

  if (!Number.isInteger(categorieId) || categorieId <= 0 || !texteValide(libelle, { maxLength: 100, obligatoire: true })) {
    return res.status(400).json({ erreur: 'Le libellé de la catégorie est invalide.' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id_categorie', sql.Int, categorieId)
      .input('libelle', sql.NVarChar(100), libelle)
      .query(`UPDATE CategoriesArticles
              SET libelle = @libelle
              OUTPUT INSERTED.id_categorie, INSERTED.code_categorie, INSERTED.libelle
              WHERE id_categorie = @id_categorie AND actif = 1`);
    if (!result.recordset[0]) return res.status(404).json({ erreur: 'Catégorie introuvable.' });
    res.json(result.recordset[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de la modification de la catégorie.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// FAMILLES D'ARTICLES
// ─────────────────────────────────────────────────────────────────────────────

router.get('/articles/familles', autoriserRoles('admin', 'chef_agence', 'agent_technique'), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT f.id_famille, f.code_famille, f.libelle,
             f.id_categorie, cat.libelle AS libelle_categorie
      FROM FamillesArticles f
      LEFT JOIN CategoriesArticles cat ON cat.id_categorie = f.id_categorie
      WHERE f.actif = 1
      ORDER BY cat.libelle, f.libelle
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement des familles d\'articles.' });
  }
});

router.post('/articles/familles', autoriserRoles('admin'), async (req, res) => {
  const libelle = typeof req.body.libelle === 'string' ? req.body.libelle.trim() : '';
  const idCategorie = req.body.id_categorie ? Number(req.body.id_categorie) : null;

  if (!texteValide(libelle, { maxLength: 100, obligatoire: true })) {
    return res.status(400).json({ erreur: 'Le libellé de la famille est invalide.' });
  }
  if (idCategorie !== null && (!Number.isInteger(idCategorie) || idCategorie <= 0)) {
    return res.status(400).json({ erreur: 'La catégorie sélectionnée est invalide.' });
  }

  try {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const creation = await new sql.Request(transaction)
        .input('libelle', sql.NVarChar(100), libelle)
        .input('id_categorie', sql.Int, idCategorie)
        .query(`INSERT INTO FamillesArticles (code_famille, libelle, id_categorie)
                OUTPUT INSERTED.id_famille
                VALUES (CONCAT(N'__FAM_TEMP_', CONVERT(NVARCHAR(36), NEWID())), @libelle, @id_categorie)`);
      const familleId = creation.recordset[0].id_famille;
      const result = await new sql.Request(transaction)
        .input('id_famille', sql.Int, familleId)
        .query(`UPDATE FamillesArticles
                SET code_famille = CONCAT(N'FAM-', id_famille)
                OUTPUT INSERTED.id_famille, INSERTED.code_famille, INSERTED.libelle, INSERTED.id_categorie
                WHERE id_famille = @id_famille`);
      await transaction.commit();
      const fam = result.recordset[0];
      let libelle_categorie = null;
      if (fam.id_categorie) {
        const cat = await pool.request()
          .input('id_categorie', sql.Int, fam.id_categorie)
          .query('SELECT libelle FROM CategoriesArticles WHERE id_categorie = @id_categorie');
        libelle_categorie = cat.recordset[0]?.libelle || null;
      }
      res.status(201).json({ ...fam, libelle_categorie });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    if (err.number === 2601 || err.number === 2627) {
      return res.status(409).json({ erreur: 'Le code automatique de cette famille existe déjà.' });
    }
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de la création de la famille d\'articles.' });
  }
});

router.put('/articles/familles/:id_famille', autoriserRoles('admin'), async (req, res) => {
  const familleId = Number(req.params.id_famille);
  const libelle = typeof req.body.libelle === 'string' ? req.body.libelle.trim() : '';
  const idCategorie = req.body.id_categorie !== undefined
    ? (req.body.id_categorie === null || req.body.id_categorie === '' ? null : Number(req.body.id_categorie))
    : undefined;

  if (!Number.isInteger(familleId) || familleId <= 0 || !texteValide(libelle, { maxLength: 100, obligatoire: true })) {
    return res.status(400).json({ erreur: 'Le libellé de la famille est invalide.' });
  }
  if (idCategorie !== undefined && idCategorie !== null && (!Number.isInteger(idCategorie) || idCategorie <= 0)) {
    return res.status(400).json({ erreur: 'La catégorie sélectionnée est invalide.' });
  }

  try {
    const pool = await getPool();
    let query;
    let request = pool.request()
      .input('id_famille', sql.Int, familleId)
      .input('libelle', sql.NVarChar(100), libelle);

    if (idCategorie !== undefined) {
      request = request.input('id_categorie', sql.Int, idCategorie);
      query = `UPDATE FamillesArticles
               SET libelle = @libelle, id_categorie = @id_categorie
               OUTPUT INSERTED.id_famille, INSERTED.code_famille, INSERTED.libelle, INSERTED.id_categorie
               WHERE id_famille = @id_famille AND actif = 1`;
    } else {
      query = `UPDATE FamillesArticles
               SET libelle = @libelle
               OUTPUT INSERTED.id_famille, INSERTED.code_famille, INSERTED.libelle, INSERTED.id_categorie
               WHERE id_famille = @id_famille AND actif = 1`;
    }

    const result = await request.query(query);
    if (!result.recordset[0]) return res.status(404).json({ erreur: 'Famille d\'articles introuvable.' });

    const fam = result.recordset[0];
    let libelle_categorie = null;
    if (fam.id_categorie) {
      const cat = await pool.request()
        .input('id_categorie', sql.Int, fam.id_categorie)
        .query('SELECT libelle FROM CategoriesArticles WHERE id_categorie = @id_categorie');
      libelle_categorie = cat.recordset[0]?.libelle || null;
    }
    res.json({ ...fam, libelle_categorie });
  } catch (err) {
    if (err.number === 2601 || err.number === 2627) {
      return res.status(409).json({ erreur: 'Ce code de famille existe déjà.' });
    }
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de la modification de la famille d\'articles.' });
  }
});

router.post('/articles', autoriserRoles('admin', 'chef_agence', 'agent_technique'), async (req, res) => {
  const {
    id_famille,
    libelle,
    matiere,
    couleur,
    unite,
    mode_prix,
    prix_unitaire,
    prix_fourniture,
    prix_pose,
    type_tva,
    taux_tva,
    avec_diametre
  } = req.body;

  const familleId = Number(id_famille);
  const matiereArticle = typeof matiere === 'string' ? matiere.trim() : '';
  const couleurArticle = typeof couleur === 'string' ? couleur.trim() : '';
  const prix = Number(prix_unitaire);
  const fourniture = prix_fourniture === null || prix_fourniture === '' ? null : Number(prix_fourniture);
  const pose = prix_pose === null || prix_pose === '' ? null : Number(prix_pose);
  const taux = Number(taux_tva);
  const avecDiametre = avec_diametre === true || avec_diametre === 1 || avec_diametre === 'true';

  if (
    !Number.isInteger(familleId) || familleId <= 0 ||
    !texteValide(libelle, { maxLength: 150, obligatoire: true }) ||
    !texteValide(matiereArticle, { maxLength: 50 }) ||
    !texteValide(couleurArticle, { maxLength: 50 }) ||
    !['U', 'ML', 'M²', 'M3', 'KG', 'H', 'FF', 'ENS'].includes(unite) ||
    !['PRESTATION', 'FOURNITURE_POSE'].includes(mode_prix) ||
    !['PRESTATION', 'TRAVAUX'].includes(type_tva) ||
    taux_tva === null || taux_tva === undefined || String(taux_tva).trim() === '' ||
    !Number.isFinite(taux) || taux < 0 || taux > 100
  ) {
    return res.status(400).json({ erreur: 'Les informations de l’article sont invalides.' });
  }

  if (mode_prix === 'PRESTATION' && (!Number.isFinite(prix) || prix < 0)) {
    return res.status(400).json({ erreur: 'Le prix unitaire doit être un montant positif ou nul.' });
  }
  if (mode_prix === 'FOURNITURE_POSE' && (!Number.isFinite(fourniture) || fourniture < 0 || !Number.isFinite(pose) || pose < 0)) {
    return res.status(400).json({ erreur: 'Les prix de fourniture et de pose sont obligatoires.' });
  }

  const prixFinal = mode_prix === 'FOURNITURE_POSE' ? fourniture + pose : prix;
  const fournitureFinale = mode_prix === 'FOURNITURE_POSE' ? fourniture : null;
  const poseFinale = mode_prix === 'FOURNITURE_POSE' ? pose : null;

  try {
    const pool = await getPool();
    const famille = await pool.request()
      .input('id_famille', sql.Int, familleId)
      .query('SELECT id_famille, code_famille, libelle FROM FamillesArticles WHERE id_famille = @id_famille AND actif = 1');
    if (!famille.recordset[0]) return res.status(404).json({ erreur: 'Famille d’article introuvable.' });

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const creation = await new sql.Request(transaction)
        .input('id_famille', sql.Int, familleId)
        .input('libelle', sql.NVarChar(150), libelle.trim())
        .input('matiere', sql.NVarChar(50), matiereArticle || null)
        .input('couleur', sql.NVarChar(50), couleurArticle || null)
        .input('unite', sql.NVarChar(20), unite)
        .input('mode_prix', sql.NVarChar(20), mode_prix)
        .input('prix_unitaire', sql.Decimal(12, 2), prixFinal)
        .input('prix_fourniture', sql.Decimal(12, 2), fournitureFinale)
        .input('prix_pose', sql.Decimal(12, 2), poseFinale)
        .input('type_tva', sql.NVarChar(20), type_tva)
        .input('taux_tva', sql.Decimal(5, 2), taux)
        .input('avec_diametre', sql.Bit, avecDiametre)
        .query(`INSERT INTO ArticlesDevis
          (id_famille, code_article, libelle, matiere, couleur, unite, mode_prix, prix_unitaire, prix_fourniture, prix_pose, type_tva, taux_tva, avec_diametre)
          OUTPUT INSERTED.id_article
          VALUES (@id_famille, CONCAT(N'__ART_TEMP_', CONVERT(NVARCHAR(36), NEWID())), @libelle, @matiere, @couleur, @unite, @mode_prix, @prix_unitaire, @prix_fourniture, @prix_pose, @type_tva, @taux_tva, @avec_diametre)`);

      const article = await new sql.Request(transaction)
        .input('id_article', sql.Int, creation.recordset[0].id_article)
        .query(`UPDATE ArticlesDevis
                SET code_article = CONCAT(N'ART-', RIGHT(REPLICATE(N'0', 8) + CONVERT(NVARCHAR(10), id_article), 8))
                OUTPUT INSERTED.*
                WHERE id_article = @id_article`);

      await new sql.Request(transaction)
        .input('id_article', sql.Int, creation.recordset[0].id_article)
        .input('mode_prix', sql.NVarChar(20), mode_prix)
        .input('prix_unitaire', sql.Decimal(12, 2), prixFinal)
        .input('prix_fourniture', sql.Decimal(12, 2), fournitureFinale)
        .input('prix_pose', sql.Decimal(12, 2), poseFinale)
        .input('type_tva', sql.NVarChar(20), type_tva)
        .input('taux_tva', sql.Decimal(5, 2), taux)
        .query(`INSERT INTO TarifsArticlesDevis
          (id_article, mode_prix, prix_unitaire, prix_fourniture, prix_pose, type_tva, taux_tva, date_debut)
          VALUES (@id_article, @mode_prix, @prix_unitaire, @prix_fourniture, @prix_pose, @type_tva, @taux_tva, CONVERT(date, GETDATE()))`);
      await transaction.commit();

      const artCree = article.recordset[0];
      const famInfo = famille.recordset[0];
      res.status(201).json({
        id_article: artCree.id_article,
        code_article: artCree.code_article,
        code: artCree.code_article,
        libelle: artCree.libelle,
        matiere: artCree.matiere,
        couleur: artCree.couleur,
        unite: artCree.unite,
        mode_prix: artCree.mode_prix,
        modePrix: artCree.mode_prix,
        prix: Number(artCree.prix_unitaire),
        prix_unitaire: Number(artCree.prix_unitaire),
        prixFourniture: artCree.prix_fourniture !== null ? Number(artCree.prix_fourniture) : null,
        prix_fourniture: artCree.prix_fourniture !== null ? Number(artCree.prix_fourniture) : null,
        prixPose: artCree.prix_pose !== null ? Number(artCree.prix_pose) : null,
        prix_pose: artCree.prix_pose !== null ? Number(artCree.prix_pose) : null,
        type_tva: artCree.type_tva,
        typeTva: artCree.type_tva,
        taux_tva: Number(artCree.taux_tva),
        tauxTva: Number(artCree.taux_tva),
        avec_diametre: Boolean(artCree.avec_diametre),
        avecDiametre: Boolean(artCree.avec_diametre),
        id_famille: familleId,
        famille: famInfo.libelle || famInfo.code_famille
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    if (err.number === 2601 || err.number === 2627) {
      return res.status(409).json({ erreur: 'Le code automatique de cet article existe déjà.' });
    }
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de la création de l’article.' });
  }
});

router.put('/articles/:code', autoriserRoles('admin'), async (req, res) => {
  const codeArticle = String(req.params.code || '').trim();
  const {
    libelle,
    unite,
    matiere,
    couleur,
    avec_diametre,
    mode_prix,
    prix_unitaire,
    prix_fourniture,
    prix_pose,
    type_tva,
    taux_tva,
    date_debut
  } = req.body;

  if (!codeArticle) {
    return res.status(400).json({ erreur: 'Code article manquant.' });
  }

  const libelleValide = typeof libelle === 'string' ? libelle.trim() : '';
  if (!texteValide(libelleValide, { maxLength: 150, obligatoire: true })) {
    return res.status(400).json({ erreur: 'La désignation de l’article est requise (150 caractères max).' });
  }

  const unitesValides = ['U', 'ML', 'M²', 'M3', 'KG', 'H', 'FF', 'ENS'];
  const uniteValide = String(unite || '').trim().toUpperCase();
  if (!unitesValides.includes(uniteValide)) {
    return res.status(400).json({ erreur: `L’unité « ${unite} » n’est pas valide.` });
  }

  const matiereArticle = typeof matiere === 'string' ? matiere.trim() : '';
  const couleurArticle = typeof couleur === 'string' ? couleur.trim() : '';
  const avecDiametre = avec_diametre === true || avec_diametre === 1 || avec_diametre === 'true';

  try {
    const pool = await getPool();
    const existant = await pool.request()
      .input('code_article', sql.NVarChar(50), codeArticle)
      .query('SELECT id_article, mode_prix, type_tva, taux_tva FROM ArticlesDevis WHERE code_article = @code_article AND actif = 1');

    if (!existant.recordset[0]) {
      return res.status(404).json({ erreur: 'Article introuvable.' });
    }

    const idArticle = existant.recordset[0].id_article;
    const modeEffectif = mode_prix || existant.recordset[0].mode_prix || 'FOURNITURE_POSE';
    const typeTvaEffectif = type_tva || existant.recordset[0].type_tva || 'PRESTATION';
    const tauxTvaEffectif = Number.isFinite(Number(taux_tva)) ? Number(taux_tva) : Number(existant.recordset[0].taux_tva || 19);

    const prix = Number(prix_unitaire);
    const fourniture = prix_fourniture === null || prix_fourniture === '' ? null : Number(prix_fourniture);
    const pose = prix_pose === null || prix_pose === '' ? null : Number(prix_pose);

    const prixFinal = modeEffectif === 'FOURNITURE_POSE'
      ? (Number.isFinite(fourniture) && Number.isFinite(pose) ? fourniture + pose : Number(prix || 0))
      : Number.isFinite(prix) ? prix : 0;
    const fournitureFinale = modeEffectif === 'FOURNITURE_POSE' ? fourniture : null;
    const poseFinale = modeEffectif === 'FOURNITURE_POSE' ? pose : null;

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Mettre à jour la définition de l'article dans ArticlesDevis
      await new sql.Request(transaction)
        .input('id_article', sql.Int, idArticle)
        .input('libelle', sql.NVarChar(150), libelleValide)
        .input('matiere', sql.NVarChar(50), matiereArticle || null)
        .input('couleur', sql.NVarChar(50), couleurArticle || null)
        .input('unite', sql.NVarChar(20), uniteValide)
        .input('avec_diametre', sql.Bit, avecDiametre)
        .input('mode_prix', sql.NVarChar(20), modeEffectif)
        .input('prix_unitaire', sql.Decimal(12, 2), prixFinal)
        .input('prix_fourniture', sql.Decimal(12, 2), fournitureFinale)
        .input('prix_pose', sql.Decimal(12, 2), poseFinale)
        .input('type_tva', sql.NVarChar(20), typeTvaEffectif)
        .input('taux_tva', sql.Decimal(5, 2), tauxTvaEffectif)
        .query(`
          UPDATE ArticlesDevis
          SET libelle = @libelle,
              matiere = @matiere,
              couleur = @couleur,
              unite = @unite,
              avec_diametre = @avec_diametre,
              mode_prix = @mode_prix,
              prix_unitaire = @prix_unitaire,
              prix_fourniture = @prix_fourniture,
              prix_pose = @prix_pose,
              type_tva = @type_tva,
              taux_tva = @taux_tva
          WHERE id_article = @id_article
        `);

      // 2. Mettre à jour l'historique des tarifs dans TarifsArticlesDevis
      const dateDebutStr = String(date_debut || '').trim() || new Date().toISOString().slice(0, 10);
      const debut = new Date(`${dateDebutStr}T00:00:00`);

      await new sql.Request(transaction)
        .input('id_article', sql.Int, idArticle)
        .input('date_debut', sql.Date, debut)
        .query(`
          UPDATE TarifsArticlesDevis SET date_fin = DATEADD(day, -1, @date_debut)
          WHERE id_article = @id_article AND date_fin IS NULL AND date_debut < @date_debut
        `);

      await new sql.Request(transaction)
        .input('id_article', sql.Int, idArticle)
        .input('mode_prix', sql.NVarChar(20), modeEffectif)
        .input('prix_unitaire', sql.Decimal(12, 2), prixFinal)
        .input('prix_fourniture', sql.Decimal(12, 2), fournitureFinale)
        .input('prix_pose', sql.Decimal(12, 2), poseFinale)
        .input('type_tva', sql.NVarChar(20), typeTvaEffectif)
        .input('taux_tva', sql.Decimal(5, 2), tauxTvaEffectif)
        .input('date_debut', sql.Date, debut)
        .query(`
          INSERT INTO TarifsArticlesDevis
            (id_article, mode_prix, prix_unitaire, prix_fourniture, prix_pose, type_tva, taux_tva, date_debut)
          VALUES
            (@id_article, @mode_prix, @prix_unitaire, @prix_fourniture, @prix_pose, @type_tva, @taux_tva, @date_debut)
        `);

      await transaction.commit();

      res.json({
        message: 'Article et tarif mis à jour avec succès.',
        article: {
          id_article: idArticle,
          code: codeArticle,
          libelle: libelleValide,
          matiere: matiereArticle || null,
          couleur: couleurArticle || null,
          unite: uniteValide,
          avec_diametre: avecDiametre,
          mode_prix: modeEffectif,
          prix: prixFinal,
          prix_fourniture: fournitureFinale,
          prix_pose: poseFinale
        }
      });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('Erreur mise à jour article:', err);
    res.status(500).json({ erreur: 'Erreur lors de la mise à jour de l’article.' });
  }
});

router.post('/articles/tarifs', autoriserRoles('admin'), async (req, res) => {
  const { code_article, mode_prix, prix_unitaire, prix_fourniture, prix_pose, type_tva, taux_tva, date_debut } = req.body;
  const debut = new Date(`${date_debut}T00:00:00`);
  const prix = Number(prix_unitaire);
  const fourniture = prix_fourniture === null || prix_fourniture === '' ? null : Number(prix_fourniture);
  const pose = prix_pose === null || prix_pose === '' ? null : Number(prix_pose);
  const taux = Number(taux_tva);
  if (!texteValide(code_article, { maxLength: 50, obligatoire: true }) || !['PRESTATION', 'FOURNITURE_POSE'].includes(mode_prix) || !['PRESTATION', 'TRAVAUX'].includes(type_tva) || !Number.isFinite(taux) || taux < 0 || taux > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(String(date_debut)) || Number.isNaN(debut.getTime())) {
    return res.status(400).json({ erreur: 'Les informations du nouveau tarif sont invalides.' });
  }
  if (mode_prix === 'PRESTATION' && (!Number.isFinite(prix) || prix < 0)) {
    return res.status(400).json({ erreur: 'Le prix de prestation est obligatoire.' });
  }
  if (mode_prix === 'FOURNITURE_POSE' && (!Number.isFinite(fourniture) || fourniture < 0 || !Number.isFinite(pose) || pose < 0)) {
    return res.status(400).json({ erreur: 'Les prix Fourniture et Pose sont obligatoires.' });
  }

  const prixFinal = mode_prix === 'FOURNITURE_POSE' ? fourniture + pose : prix;
  const fournitureFinale = mode_prix === 'FOURNITURE_POSE' ? fourniture : null;
  const poseFinale = mode_prix === 'FOURNITURE_POSE' ? pose : null;

  try {
    const pool = await getPool();
    const article = await pool.request()
      .input('code_article', sql.NVarChar(50), code_article.trim())
      .query('SELECT id_article FROM ArticlesDevis WHERE code_article = @code_article AND actif = 1');
    if (!article.recordset[0]) return res.status(404).json({ erreur: 'Article introuvable.' });
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input('id_article', sql.Int, article.recordset[0].id_article)
        .input('date_debut', sql.Date, debut)
        .query(`UPDATE TarifsArticlesDevis SET date_fin = DATEADD(day, -1, @date_debut)
                WHERE id_article = @id_article AND date_fin IS NULL AND date_debut < @date_debut`);
      await new sql.Request(transaction)
        .input('id_article', sql.Int, article.recordset[0].id_article)
        .input('mode_prix', sql.NVarChar(20), mode_prix)
        .input('prix_unitaire', sql.Decimal(12, 2), prixFinal)
        .input('prix_fourniture', sql.Decimal(12, 2), fournitureFinale)
        .input('prix_pose', sql.Decimal(12, 2), poseFinale)
        .input('type_tva', sql.NVarChar(20), type_tva)
        .input('taux_tva', sql.Decimal(5, 2), taux)
        .input('date_debut', sql.Date, debut)
        .query(`INSERT INTO TarifsArticlesDevis (id_article, mode_prix, prix_unitaire, prix_fourniture, prix_pose, type_tva, taux_tva, date_debut)
                VALUES (@id_article, @mode_prix, @prix_unitaire, @prix_fourniture, @prix_pose, @type_tva, @taux_tva, @date_debut)`);
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
    res.status(201).json({ message: 'Nouveau tarif enregistré.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de l’enregistrement du tarif.' });
  }
});

router.get('/communes', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT c.id_commune, c.nom_commune, c.wilaya, c.id_agence, a.nom_agence
      FROM Communes c
      INNER JOIN Agences a ON a.id_agence = c.id_agence
      ORDER BY c.nom_commune
    `);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement des communes.' });
  }
});

router.post('/communes', autoriserRoles('admin'), async (req, res) => {
  const { nom_commune, wilaya, id_agence } = req.body;
  if (!texteValide(nom_commune, { maxLength: 100, obligatoire: true }) || !texteValide(wilaya, { maxLength: 100, obligatoire: true }) || !Number.isInteger(Number(id_agence))) {
    return res.status(400).json({ erreur: 'Nom, wilaya et agence sont requis et valides.' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('nom_commune', sql.NVarChar(100), nom_commune.trim())
      .input('wilaya', sql.NVarChar(100), wilaya.trim())
      .input('id_agence', sql.Int, Number(id_agence))
      .query(`
        INSERT INTO Communes (nom_commune, wilaya, id_agence)
        OUTPUT INSERTED.id_commune, INSERTED.nom_commune, INSERTED.wilaya, INSERTED.id_agence
        VALUES (@nom_commune, @wilaya, @id_agence)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    if (err.number === 547) {
      return res.status(400).json({ erreur: 'Cette agence n\u2019existe pas.' });
    }
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors de l\u2019ajout de la commune.' });
  }
});

router.get('/types-branchement', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT id_type, libelle, diametre_defaut FROM TypesBranchement ORDER BY libelle`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement des types de branchement.' });
  }
});

router.get('/banques', async (req, res) => {
  try {
    const pool = await getPool();
    const agenceFilter = req.agent.role === 'admin' ? '' : ' AND d.id_agence = @id_agence';
    const request = pool.request();
    if (req.agent.role !== 'admin') request.input('id_agence', sql.Int, req.agent.id_agence);
    const result = await request.query(`
      SELECT DISTINCT d.banque
      FROM Devis d
      INNER JOIN Demandes dem ON dem.id_demande = d.id_demande
      WHERE NULLIF(LTRIM(RTRIM(d.banque)), '') IS NOT NULL${agenceFilter}
      ORDER BY d.banque
    `);
    res.json(result.recordset.map((banque) => banque.banque));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement des banques.' });
  }
});

router.get('/marques-compteur', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT libelle
      FROM MarquesCompteur
      ORDER BY libelle
    `);
    res.json(result.recordset.map((marque) => marque.libelle));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement des marques de compteur.' });
  }
});

router.get('/statuts', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT code_statut, libelle, ordre, est_final FROM Statuts ORDER BY ordre`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement des statuts.' });
  }
});

router.get('/agences', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT id_agence, nom_agence, code_agence, id_centre FROM Agences ORDER BY nom_agence`);
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erreur: 'Erreur lors du chargement des agences.' });
  }
});

module.exports = router;
