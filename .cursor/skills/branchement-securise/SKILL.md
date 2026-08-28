---
name: frontend-interactif-moderne
description: >
  Construire des interfaces web React/TypeScript modernes, interactives et performantes pour le suivi de dossiers de demande de branchement AEP et de devis (workflow multi-étapes, pipeline de statuts, upload de documents, export PDF). À utiliser systématiquement dès qu'il s'agit de créer ou refondre un composant, une page, un formulaire ou une liste liée aux dossiers de branchement ou aux devis, même si l'utilisateur ne dit pas explicitement "performant" ou "moderne". Couvre visualisation de pipeline/workflow, formulaires de dossier, upload et prévisualisation de documents, génération/export PDF de devis, états de chargement/erreur/vide, accessibilité clavier, et anti-patterns UI génériques à éviter.
---

# Frontend interactif & performant (suivi branchement AEP & devis)

Contexte cible : l'application de suivi des demandes de branchement AEP (React + Node.js + SQL Server, workflow à six étapes avec pipeline visuel) et ses devis associés — pas des créances/factures, pas de DBF, pas de site vitrine. La priorité n'est pas l'esthétique de marque mais la **clarté du statut d'un dossier en un coup d'œil** et la fiabilité pour l'agent qui saisit/consulte des dossiers toute la journée.

Stack par défaut (sauf indication contraire dans le projet) : React + TypeScript, Vite, Tailwind CSS, Node.js/SQL Server côté back. Si le projet a déjà des choix différents, les respecter plutôt que les imposer.

## 1. Avant de coder : cadrer l'écran

Pour toute nouvelle page/composant, déterminer en une phrase :
- Est-ce une vue **liste de dossiers** (tous les dossiers/devis d'un centre), une vue **détail d'un dossier** (pipeline + infos + documents), ou un **formulaire** (création/édition de dossier ou de devis) ?
- Quelle est l'action principale de l'utilisateur ici : suivre l'avancement, saisir un nouveau dossier, faire signer/valider une étape, générer un devis ?
- Ce qui doit rester visible/stable pendant que le reste charge (typiquement : le statut du dossier et son numéro/référence).

Ne pas sur-architecturer un écran simple. Le volume de dossiers de branchement reste modeste (dizaines à quelques centaines par centre) — pas besoin de virtualisation lourde ici, la priorité va à la clarté du statut et à la fluidité de la saisie.

## 2. Le pipeline de workflow (six étapes)

C'est le composant signature de l'app — il doit être lisible d'un coup d'œil et cohérent partout où le statut d'un dossier apparaît (liste, détail, éventuel export).

- Représenter les six étapes comme une timeline horizontale (ou verticale sur petit écran) avec un état clair par étape : complétée / en cours / à venir / bloquée. Ne pas se contenter de texte ("Étape 3/6") sans repère visuel.
- Une étape bloquée ou en attente doit dire pourquoi ("En attente de la signature du demandeur", pas juste une pastille grise).
- Réutiliser exactement le même composant de pipeline dans la liste (version compacte) et dans le détail (version complète) — ne pas dupliquer la logique de statut à deux endroits qui peuvent diverger.
- Coder les couleurs de statut une fois (ex. vert = validé, orange = en attente, rouge = bloqué/rejeté, gris = à venir) et les réutiliser partout, jamais de couleur ad hoc par écran.

## 3. Formulaires de dossier et de devis

- Si la création d'un dossier a plusieurs sections logiques (identité du demandeur, adresse/parcelle, caractéristiques techniques, pièces jointes), découper en étapes ou sections repliables plutôt qu'un formulaire unique très long — plus facile à valider et moins intimidant.
- Validation inline au blur, messages d'erreur au ras du champ, formulés en langage utilisateur ("Le numéro de parcelle est requis", pas "Champ invalide").
- Pour le devis : afficher le calcul du montant en direct pendant la saisie (quantités, tarifs) plutôt qu'après soumission — l'agent doit voir immédiatement l'effet d'une modification.
- Désactiver le bouton de soumission pendant l'envoi, jamais cliquable en double (évite les dossiers dupliqués).
- Sauvegarde de brouillon si la saisie d'un dossier est longue — éviter de perdre la saisie sur une navigation accidentelle ou une session qui expire.

## 4. Documents et export PDF

- Upload de documents (pièce d'identité, plan, justificatif) avec prévisualisation immédiate (miniature pour image/PDF) et barre de progression réelle, pas un spinner indéterminé sur un gros fichier.
- Lister les documents déjà attachés avec leur nature clairement identifiée (le type de pièce, pas juste le nom de fichier brut) et un état si une pièce obligatoire manque encore.
- Génération de devis en PDF : donner un aperçu avant téléchargement quand c'est raisonnable, et un nom de fichier explicite (référence du dossier, pas "devis.pdf").

## 5. Interactivité et fiabilité au quotidien

- **États explicites** : chaque liste/détail asynchrone gère 4 états — chargement (squelette, pas un spinner plein écran), vide ("Aucun dossier pour ce centre" avec bouton de création directement accessible), erreur (message clair + action de réessai), contenu.
- **Feedback immédiat** : changement de statut ou action de validation → retour visuel en < 100ms (état "en cours" sur le bouton/l'étape), même si la requête réelle prend plus longtemps.
- **Recherche/filtre de dossiers** (par référence, demandeur, statut, centre) : debounce 250–400ms, ne jamais bloquer la frappe.
- **Clavier** : tout élément cliquable atteignable au clavier (tab, entrée, échap pour fermer une modale) — utile pour un agent qui enchaîne beaucoup de dossiers.

## 6. Anti-patterns à éviter

- Dupliquer la logique du pipeline de statut dans plusieurs composants avec des couleurs/libellés qui finissent par diverger.
- Formulaire de création de dossier en un seul bloc géant sans découpage, qui décourage la relecture avant soumission.
- Upload de document sans preview ni indication du type de pièce attendu.
- Palette de couleurs par défaut (bleu/indigo générique) sans lien avec le sens du statut du dossier.

## 7. Checklist rapide avant de livrer un écran

- [ ] Le statut du dossier est lisible en un coup d'œil (liste et détail cohérents)
- [ ] Formulaire : validation inline, pas de double-soumission possible
- [ ] Upload de document : preview + progression + type de pièce visible
- [ ] États vide/erreur pensés, pas juste le cas "ça marche"
- [ ] Accessible au clavier, focus visible

Appliquer cette checklist mentalement, sans forcément l'énumérer à l'utilisateur — elle sert à calibrer le code produit, pas à faire un rapport formel à chaque fois.