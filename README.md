# Suivi des Demandes de Branchement AEP

Application de gestion et de suivi des demandes de branchement en eau potable (ADE).
Workflow couvert : **Dépôt → Étude technique → Devis → Paiement → Travaux → Mise en service**.

## Architecture

```
branchement-app/
├── database/
│   ├── schema.sql              → structure complète SQL Server (tables, vue, procédure, trigger)
│   └── seed-referentiel.sql    → données de référence de départ (centre/agence/communes) — à adapter
├── backend/                    → API Node.js / Express / mssql
│   ├── config/db.js
│   ├── middleware/auth.js      → JWT
│   ├── routes/                 → auth, demandes, référentiels, dashboard
│   ├── scripts/creerAgent.js   → crée un compte agent (admin, guichet, technique...)
│   └── server.js
└── frontend/                   → React (Vite)
    └── src/
        ├── pages/               → Connexion, TableauDeBord, ListeDemandes, NouvelleDemande, DetailDemande
        ├── components/          → Sidebar, Pipeline (visualisation workflow), StatutBadge
        └── components/panneaux/ → Étude, Devis, Travaux, Mise en service
```

## 1. Base de données

Dans SQL Server Management Studio (ou `sqlcmd`) :

```sql
-- Exécuter dans l'ordre :
-- 1. database/schema.sql
-- 2. database/seed-referentiel.sql (adapte les communes/agences à ta réalité)
```

## 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# → renseigner DB_USER, DB_PASSWORD, DB_SERVER, DB_NAME dans .env

# Créer le premier compte (ex: admin)
node scripts/creerAgent.js "admin@ade.dz" "MotDePasse123" "Benali" "Ahmed" admin 1

npm run dev   # démarre sur http://localhost:5000
```

## 3. Frontend

```bash
cd frontend
npm install
npm run dev   # démarre sur http://localhost:5173 (proxy /api → :5000)
```

Se connecter avec le compte créé à l'étape 2.

## Notes importantes

- **Protection SQL** : toutes les valeurs provenant des requêtes ou du corps HTTP doivent être transmises avec `.input()`/`.execute()` de `mssql`, jamais concaténées dans une requête. Les paramètres d'identifiant et de pagination sont validés côté route avant leur liaison SQL. Toute nouvelle condition dynamique doit être construite uniquement à partir d'une liste blanche de fragments constants.
- **Rôles** : `agent_guichet`, `agent_technique`, `chef_agence`, `admin`. Actuellement tous les rôles connectés ont accès aux mêmes actions côté API (le contrôle par rôle est prévu via `autoriserRoles()` dans `middleware/auth.js` — à affiner selon ton organisation réelle : par exemple, restreindre la saisie de l'étude technique aux `agent_technique`).
- **Isolation par agence** : les agents non-admin ne voient que les demandes de leur propre agence (`req.agent.id_agence`).
- **Transitions de statut** : le graphe de transitions autorisées est défini dans `backend/routes/demandes.js` (`TRANSITIONS`). C'est le seul endroit à modifier si le workflow métier évolue.
- **Numérotation** : les demandes sont numérotées `{compteur}/{année}` (ex: `0001/2026`), avec un compteur annuel généré côté serveur.
- **Paiement** : suivi simple (montant + statut payé/impayé + date + mode), pas d'échéancier ni de relances — conforme à ce que tu as demandé.
- **Rattachement à la facturation** : le champ `numero_abonne` dans `MisesEnService` est prévu comme point de jonction avec ton système de facturation existant (DBF/Clipper), mais aucune intégration automatique n'est faite — à connecter si besoin.

## Prochaines étapes possibles

- Authentification par rôle plus fine (ex: seul un `chef_agence` peut rejeter une demande)
- Upload réel des pièces jointes (CIN, plan de situation) — la table `PiecesJointes` existe déjà, il manque l'endpoint d'upload (multer) et l'UI
- Export PDF du récapitulatif de demande / du devis
- Notifications SMS/email au demandeur à chaque changement de statut
- Intégration avec le système de facturation existant pour la mise en service automatique
