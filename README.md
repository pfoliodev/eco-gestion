# Plateforme de Cours 
Une application web moderne pour gérer, réviser et partager des cours d'économie avec un système complet de gamification et d'outils pédagogiques.

## ✨ Fonctionnalités Principales

### 📚 Gestion des Cours et Exercices
- **Création et édition** avec éditeur de texte riche (TinyMCE)
- **Types de contenu** : Cours théoriques et exercices pratiques
- **Catégorisation** par sujet et catégorie
- **Liaison cours-exercices** : Associez des exercices à vos cours
- **Système d'archivage** : Les cours supprimés sont archivés (restaurables)
- **Recherche et filtrage** avancés par titre, sujet, type
- **📄 Export PDF** : Téléchargez n'importe quel cours en PDF formaté

### 🃏 Flashcards
- **Création de decks** par sujet ou par cours
- **Mode révision** avec retournement de carte
- **Suivi de progression** : Cartes maîtrisées vs à revoir
- **Interface intuitive** : Glissez ou cliquez pour naviguer

### 📝 QCM de Révision
- **Quiz interactifs** liés aux cours
- **Correction instantanée** avec explications
- **Historique des scores** par utilisateur
- **Temps de complétion** suivi et affiché
- **Administration simple** pour créer/modifier les quiz

### 🏆 Système de Badges (Gamification)
- **Badges automatiques** débloqués selon l'activité :
  - 🌟 Premier Pas - Premier quiz complété
  - 🎯 Expert - Score parfait sur un quiz
  - 📚 Érudit - 5 cours lus entièrement
  - 🔥 Assidu - 7 jours consécutifs connecté
  - Et bien d'autres...
- **Affichage sur le profil** avec progression

### ❤️ Favoris et Suivi
- **Ajout aux favoris** : Marquez vos cours préférés
- **Historique de visites** : Voir qui a consulté chaque cours
- **Cours récents** : Accès rapide aux derniers cours consultés

### 🔔 Rappels de Révision
- **Rappels personnalisés** : Planifiez vos sessions de révision
- **Notifications** : Ne manquez jamais une session
- **Gestion admin** : Créez des rappels globaux

### 👥 Système d'Authentification
- **Inscription** avec email/mot de passe
- **Connexion Google** (OAuth 2.0)
- **Profil utilisateur** : Photo, prénom, nom
- **Rôles** : Administrateur et Étudiant

### 🔐 Panneau d'Administration
- **Gestion des utilisateurs** : Liste, rôles, archivage
- **Gestion des cours** : Création, édition, liaison exercices
- **Signalements de bugs** : Suivi et résolution
- **Statistiques** : Temps moyen de quiz, utilisateurs actifs
- **Feature Flags** : Activation/désactivation de fonctionnalités

### 🍪 RGPD & Confidentialité
- **Bandeau cookies** : Consentement explicite
- **Politique de confidentialité** détaillée
- **Mentions légales** complètes

### 🪙 Système IFH Coins (Économie Virtuelle)
- **Monnaie virtuelle** : Gagnez des IFH Coins en participant
- **Sources de gains** :
  - Quiz complétés (basé sur le score et la rapidité)
  - Badges débloqués (+50 IFH par badge)
  - Bonus de première connexion
- **Boutique** avec catégories :
  - 🎨 **Thèmes** : Personnalisez l'interface
  - 🖼️ **Cadres** : Décorez votre photo de profil
  - 🏅 **Badges** : Éditions limitées et exclusifs
  - ⚡ **Boosts** : Avantages temporaires
- **Inventaire utilisateur** : Équipez vos articles achetés
- **Historique des transactions** : Suivi complet de vos gains/dépenses
- **Admin** : 
  - Gestion CRUD des articles boutique
  - Don de coins aux utilisateurs
  - Statistiques de l'économie

## 🛠️ Technologies Utilisées

### Frontend
- **HTML5, CSS3** - Structure et styles modernes (modularisés)
- **JavaScript (ES6 Modules)** - Architecture modulaire
- **Architecture SPA** - Navigation sans rechargement

### Backend & Services
- **Firebase Authentication** - Gestion sécurisée des utilisateurs
- **Firebase Firestore** - Base de données NoSQL temps réel
- **Firebase Hosting** - Hébergement rapide et sécurisé

### Bibliothèques
- [TinyMCE](https://www.tiny.cloud/) - Éditeur WYSIWYG
- [Notyf](https://carlosroso.com/notyf/) - Notifications toast
- [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/) - Export PDF
- [Inter Font](https://fonts.google.com/specimen/Inter) - Typographie

## 📦 Installation

### Prérequis
- Node.js et npm
- Compte Firebase

### 1. Cloner le dépôt
```bash
git clone https://github.com/pfoliodev/eco-gestion.git
cd eco-gestion
```

### 2. Configuration Firebase
1. Créez un projet sur [Firebase Console](https://console.firebase.google.com/)
2. Activez **Authentication** (Email/Password + Google)
3. Activez **Firestore Database**
4. Copiez la configuration dans `public/js/firebase-config.js`

### 3. Déployer les règles Firestore
```bash
firebase deploy --only firestore:rules
```

### 4. Lancement local
```bash
npx serve public -l 3000
# ou
firebase serve
```

### 5. Déploiement
```bash
firebase deploy
```

## 📁 Structure du Projet

```
eco-gestion/
├── public/
│   ├── css/
│   │   ├── base/           # Variables, reset, typographie
│   │   ├── components/     # Boutons, cartes, modals, coins...
│   │   ├── pages/          # Styles par page (shop, account...)
│   │   └── main.css        # Point d'entrée CSS
│   ├── js/
│   │   ├── config/
│   │   │   └── economy.js  # Configuration économie IFH
│   │   ├── main.js         # Point d'entrée JS
│   │   ├── auth.js         # Authentification
│   │   ├── course.js       # Gestion des cours
│   │   ├── quiz.js         # Logique quiz
│   │   ├── quiz-ui.js      # Interface quiz
│   │   ├── flashcard.js    # Logique flashcards
│   │   ├── flashcard-ui.js # Interface flashcards
│   │   ├── badges.js       # Système de badges
│   │   ├── favorites.js    # Gestion des favoris
│   │   ├── coins.js        # Gestion IFH Coins
│   │   ├── shop.js         # Boutique (logique)
│   │   ├── shop-ui.js      # Boutique (interface)
│   │   ├── trades.js       # Échanges entre utilisateurs
│   │   ├── pdf-export.js   # Export PDF
│   │   ├── admin.js        # Panneau admin
│   │   ├── account.js      # Profil utilisateur
│   │   ├── reminders.js    # Rappels de révision
│   │   ├── stats.js        # Statistiques
│   │   └── ...
│   ├── templates/
│   │   ├── components/     # Header, footer, modals
│   │   └── pages/          # Templates des pages
│   └── index.html          # Page principale
├── firestore.rules         # Règles de sécurité
├── firebase.json           # Configuration Firebase
└── README.md
```

## 🔒 Sécurité

- **Authentification Firebase** : Tokens JWT sécurisés
- **Règles Firestore** : Contrôle d'accès granulaire
- **Sanitization** : Protection XSS sur les entrées utilisateur
- **Archivage** : Pas de suppression définitive

## 📝 Licence

Ce projet est sous licence MIT.

## 👨‍💻 Auteur

Développé par [pfoliodev](https://github.com/pfoliodev)

## 🤝 Contribution

Les contributions sont les bienvenues ! Ouvrez une issue ou une pull request.

