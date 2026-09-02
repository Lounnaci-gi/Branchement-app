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
                  SELECT f.code_famille AS code, f.libelle AS libelle_famille,
                    a.code_article AS code_article, a.libelle, a.unite,
                    COALESCE(t.mode_prix, a.mode_prix) AS mode_prix,
                    COALESCE(t.prix_unitaire, a.prix_unitaire) AS prix,
                    COALESCE(t.prix_fourniture, a.prix_fourniture) AS prix_fourniture,
                    COALESCE(t.prix_pose, a.prix_pose) AS prix_pose,
                    COALESCE(t.type_tva, a.type_tva) AS type_tva,
                    COALESCE(t.taux_tva, a.taux_tva) AS taux_tva,
                    ISNULL(a.avec_diametre, 0) AS avec_diametre
      FROM FamillesArticles f
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
        famille = { code: article.code, libelle: article.libelle_famille, articles: [] };
        acc.push(famille);
      }
      famille.articles.push({
        code: article.code_article,
        libelle: article.libelle,
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
        .input('prix_unitaire', sql.Decimal(12, 2), Number.isFinite(prix) ? prix : 0)
        .input('prix_fourniture', sql.Decimal(12, 2), fourniture)
        .input('prix_pose', sql.Decimal(12, 2), pose)
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
