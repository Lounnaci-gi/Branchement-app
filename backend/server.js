require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const demandesRoutes = require('./routes/demandes');
const referentielsRoutes = require('./routes/referentiels');
const dashboardRoutes = require('./routes/dashboard');

const app = express();

function sanitiserChaine(valeur) {
  if (typeof valeur !== 'string') return valeur;

  return valeur
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function sanitiserValeur(valeur) {
  if (Array.isArray(valeur)) {
    return valeur.map((item) => sanitiserValeur(item));
  }

  if (valeur && typeof valeur === 'object') {
    return Object.fromEntries(
      Object.entries(valeur).map(([cle, item]) => [cle, sanitiserValeur(item)])
    );
  }

  if (typeof valeur === 'string') {
    return sanitiserChaine(valeur);
  }

  return valeur;
}

function estChampMotDePasse(cle) {
  return ['mot_de_passe', 'ancien_mot_de_passe', 'nouveau_mot_de_passe'].includes(cle);
}

function sanitiserCorps(corps) {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) return sanitiserValeur(corps);
  return Object.fromEntries(
    Object.entries(corps).map(([cle, valeur]) => [cle, estChampMotDePasse(cle) ? valeur : sanitiserValeur(valeur)])
  );
}

// Vérification au démarrage que les secrets sont configurés
const JWT_SECRET_DEFAUT = 'changez_cette_cle_secrete_en_production';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === JWT_SECRET_DEFAUT) {
  console.error('[SECURITE] ERREUR CRITIQUE : JWT_SECRET n\'est pas défini ou utilise la valeur par défaut. Changez-le dans .env avant de déployer en production.');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

app.disable('x-powered-by');

// CORS — restreint à l'origine déclarée dans .env (jamais de wildcard *)
const originesAutorisees = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origin (ex: Postman en dev, appels serveur-à-serveur)
    if (!origin) return callback(null, true);
    if (originesAutorisees.includes(origin)) return callback(null, true);
    return callback(new Error(`Origine CORS non autorisée : ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  req.body = sanitiserCorps(req.body);
  req.query = sanitiserValeur(req.query);
  req.params = sanitiserValeur(req.params);

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Rate-limiting sur les routes d'authentification (anti brute-force)
let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch {
  rateLimit = null;
}

if (rateLimit) {
  const limiteAuth = rateLimit({
    windowMs: 15 * 60 * 1000, // fenêtre de 15 minutes
    max: 20,                   // max 20 tentatives par fenêtre par IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { erreur: 'Trop de tentatives de connexion. Veuillez réessayer dans 15 minutes.' }
  });
  app.use('/api/auth/login', limiteAuth);
} else {
  console.warn('[SECURITE] express-rate-limit non installé — brute-force non protégé sur /api/auth/login');
}

app.use('/api/auth', authRoutes);
app.use('/api/demandes', demandesRoutes);
app.use('/api/referentiels', referentielsRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/api/sante', (req, res) => res.json({ statut: 'OK' }));

// Gestion des erreurs non interceptées
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ erreur: 'Erreur interne du serveur.' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API Suivi Branchement AEP démarrée sur le port ${PORT}`);
});
