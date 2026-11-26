<div align="center">
  <img src="public/icon-192.png" width="88" alt="Logo BRAZ" />
  <h1>BRAZ</h1>
  <p><b>Vos finances personnelles, simplement.</b><br />
  Revenus, dépenses, budgets et épargne dans une application installable qui fonctionne hors ligne.</p>
</div>

<p align="center">
  <img src="docs/screenshots/accueil.png" width="24%" alt="Accueil : solde disponible, courbe du mois et dernières transactions" />
  <img src="docs/screenshots/transactions.png" width="24%" alt="Liste des transactions avec recherche et filtres" />
  <img src="docs/screenshots/budgets.png" width="24%" alt="Budgets mensuels par catégorie" />
  <img src="docs/screenshots/stats.png" width="24%" alt="Statistiques : revenus et dépenses sur six mois" />
</p>

## Fonctionnalités

| | |
|---|---|
| **Tableau de bord** | Solde disponible tous comptes confondus, revenus et dépenses du mois, courbe d'évolution, dernières transactions. |
| **Comptes** | Espèces, compte bancaire, mobile money ou tout autre compte, chacun avec son solde. Transferts d'un compte à l'autre. |
| **Transactions** | Ajout en quelques secondes avec description et compte, modification, suppression. Recherche sur toute la période, filtres par type, compte et catégorie. |
| **Récurrences** | Salaire, loyer, abonnements : cochez « Répéter chaque mois » et la transaction s'ajoute seule chaque mois. |
| **Catégories** | Quinze catégories prêtes à l'emploi, personnalisables (nom, icône, couleur). |
| **Budgets** | Une limite mensuelle par catégorie, avec le reste à dépenser. Alerte dans l'application quand un budget approche de sa limite ou la dépasse. |
| **Épargne** | Des objectifs alimentés depuis vos comptes, avec l'historique des versements et des retraits. |
| **Statistiques** | Vue par mois ou par année, comparaison avec la période précédente, répartition par catégorie, moyenne par jour. |
| **Sécurité** | Code à 4 chiffres à l'ouverture, déverrouillage par Face ID ou empreinte sur les appareils compatibles. |
| **Devises** | FCFA, XOF, euro, dollar. Changer de devise peut convertir tous les montants au taux de votre choix. |
| **Données** | Sauvegarde chiffrée par mot de passe (AES-256), restauration, export CSV des transactions, rappel de sauvegarde. |

Devise FCFA par défaut. Interface en français.

## Aperçu

<p align="center">
  <img src="docs/screenshots/nouvelle-transaction.png" width="24%" alt="Formulaire de nouvelle transaction" />
  <img src="docs/screenshots/epargne.png" width="24%" alt="Objectifs d'épargne" />
  <img src="docs/screenshots/code-acces.png" width="24%" alt="Écran de code d'accès" />
</p>

<p align="center">
  <img src="docs/screenshots/ordinateur-accueil.png" width="49%" alt="Accueil sur ordinateur" />
  <img src="docs/screenshots/ordinateur-statistiques.png" width="49%" alt="Statistiques sur ordinateur" />
</p>

Les montants des captures sont des données d'exemple.

## Vie privée

Il n'y a ni compte, ni serveur, ni suivi. Toutes les données restent sur l'appareil, dans IndexedDB.

- Les données ne se synchronisent pas entre appareils : utilisez l'export et la restauration pour les transférer.
- Le code d'accès verrouille l'écran, il ne chiffre pas les données : activez aussi le verrouillage du téléphone, qui chiffre tout l'appareil.
- Les sauvegardes sont chiffrées par défaut (AES-GCM 256 bits, clé dérivée du mot de passe par PBKDF2-SHA-256, 600 000 itérations). Le mot de passe n'est stocké nulle part : s'il est perdu, la sauvegarde est illisible.
- Le mode discret (icône œil sur l'accueil) masque les montants à l'écran.
- Effacer les données du navigateur efface aussi celles de BRAZ : exportez une sauvegarde régulièrement.

## Installer l'application

Ouvrez l'adresse de l'application sur votre téléphone, puis :

- **Android (Chrome)** : menu ⋮ → « Installer l'application ».
- **iPhone (Safari)** : Partager → « Sur l'écran d'accueil ».

Une fois installée, elle s'ouvre en plein écran et fonctionne sans connexion.

## Développement

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
npm run dev      # serveur de développement
npm run build    # vérification TypeScript + build de production dans dist/
npm run preview  # sert le build, service worker compris
```

`node scripts/icons.mjs` régénère les icônes de l'application à partir du logo.

### Organisation

```
src/
  App.tsx        navigation, mise en page, verrouillage
  store.tsx      état de l'application, synchronisé avec IndexedDB
  db.ts          accès IndexedDB
  lib.ts         dates, montants, calculs, sauvegarde
  ui.tsx         composants de base (boutons, feuilles, champs, animations)
  sheets.tsx     formulaires liés à l'argent (transaction, transfert, compte, épargne, devise)
  forms.tsx      autres formulaires (budget, objectif, catégorie, récurrences)
  lock.tsx       code d'accès et biométrie
  charts.tsx     graphiques SVG
  pages/         les six écrans
```

### Technique

React 19, TypeScript, Vite, Tailwind CSS 4, `vite-plugin-pwa` (service worker Workbox). Graphiques et accès IndexedDB écrits à la main, sans bibliothèque supplémentaire.

## Déploiement

Le dépôt est prêt pour Vercel : importez-le, la configuration est dans [`vercel.json`](vercel.json). Tout hébergement statique en HTTPS convient, en servant le dossier `dist/`.
