const jwt = require('jsonwebtoken');

function verifierToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erreur: 'Token manquant. Veuillez vous connecter.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, agent) => {
    if (err) {
      return res.status(401).json({ erreur: 'Token invalide ou expiré.' });
    }
    req.agent = agent; // { id_agent, role, id_agence, nom, prenom }
    next();
  });
}

// Restreint l'accès à certains rôles (ex: autoriserRoles('admin', 'chef_agence'))
function autoriserRoles(...rolesAutorises) {
  return (req, res, next) => {
    if (!rolesAutorises.includes(req.agent.role)) {
      return res.status(403).json({ erreur: 'Accès refusé pour ce rôle.' });
    }
    next();
  };
}

module.exports = { verifierToken, autoriserRoles };
