# Eco-Gestion - Plateforme de Gestion de Cours d'Économie

Une application web moderne pour gérer, organiser et partager des cours et exercices d'économie avec un système d'administration complet.

## ✨ Fonctionnalités Principales

### 📚 Gestion des Cours et Exercices
- **Création et édition** de cours avec éditeur de texte riche (TinyMCE)
- **Types de contenu** : Cours théoriques et exercices pratiques
- **Catégorisation** par sujet et catégorie
- **Liaison cours-exercices** : Associez des exercices à vos cours
- **Système d'archivage** : Les cours supprimés sont archivés et peuvent être restaurés
- **Recherche et filtrage** avancés par titre, sujet, type et description

### 👥 Système d'Authentification
- **Inscription** avec email/mot de passe (prénom et nom optionnels)
- **Connexion** par email/mot de passe ou Google Sign-In
- **Gestion de profil** : Modification du prénom, nom et photo de profil
- **Système de rôles** : Administrateur et Étudiant

### 🔐 Panneau d'Administration
- **Gestion des utilisateurs** :
  - Liste complète avec prénom, nom, email, rôle et date de création
  - Promotion/rétrogradation des rôles
  - Archivage des utilisateurs (restauration possible)
  - Onglet dédié aux utilisateurs archivés
  
- **Gestion des cours** :
  - Association cours-exercices
  - Visualisation des cours archivés
  - Restauration des cours archivés
  
- **Gestion des signalements** :
  - Système de reporting de bugs par les utilisateurs
  - Marquage résolu/nouveau
  - Vue détaillée des signalements

### 🎨 Interface Utilisateur
- **Design moderne** avec mode sombre
- **Responsive** : Optimisé pour mobile, tablette et desktop
- **Menu mobile** avec fermeture automatique lors de la navigation
- **Navigation fluide** avec système de pages SPA
- **Notifications toast** pour les actions utilisateur
- **Statistiques** : Nombre de cours et exercices

### 🔄 Système d'Archivage
- **Cours archivés** : Restauration depuis le panneau admin
- **Utilisateurs archivés** : Évite les conflits avec Firebase Authentication
- **Traçabilité** : Date d'archivage enregistrée

## 🛠️ Technologies Utilisées

### Frontend
- **HTML5, CSS3** - Structure et style moderne
- **JavaScript (ES6 Modules)** - Logique applicative modulaire
- **Architecture SPA** - Navigation sans rechargement de page

### Backend & Services
- **Firebase Authentication** - Gestion sécurisée des utilisateurs
- **Firebase Firestore** - Base de données NoSQL en temps réel
- **Firebase Hosting** - Hébergement rapide et sécurisé

### Bibliothèques
- [TinyMCE](https://www.tiny.cloud/) - Éditeur de texte riche WYSIWYG
- [Notyf](https://carlosroso.com/notyf/) - Notifications toast élégantes

## 📦 Installation et Lancement

### Prérequis
- Node.js et npm installés
- Compte Firebase

### 1. Cloner le dépôt
```bash
git clone https://github.com/pfoliodev/eco-gestion.git
cd eco-gestion
```

### 2. Configuration Firebase

1. Créez un projet sur [Firebase Console](https://console.firebase.google.com/)
2. Activez les services suivants :
   - **Authentication** : Email/Password et Google Sign-In
   - **Firestore Database**
   - **Hosting**
3. Créez une application web et copiez la configuration
4. Collez votre configuration dans `public/js/firebase-config.js`

### 3. Règles Firestore

Déployez les règles de sécurité :
```bash
firebase deploy --only firestore:rules
```

Les règles incluent :
- Lecture/écriture sécurisée pour les utilisateurs
- Permissions admin pour la gestion
- Protection contre la suppression de son propre compte

### 4. Lancement Local

```bash
firebase serve
```

L'application sera accessible sur `http://localhost:5000`

### 5. Déploiement en Production

```bash
firebase deploy
```

## 📁 Structure du Projet

```
eco-gestion/
├── public/
│   ├── js/
│   │   ├── main.js              # Point d'entrée principal
│   │   ├── auth.js              # Authentification
│   │   ├── course.js            # Gestion des cours
│   │   ├── admin.js             # Panneau d'administration
│   │   ├── account.js           # Gestion du profil
│   │   ├── bug.js               # Système de signalement
│   │   ├── firebase.js          # Configuration Firebase
│   │   ├── state.js             # Gestion d'état global
│   │   └── ui.js                # Utilitaires UI
│   ├── templates/
│   │   ├── components/          # Composants réutilisables
│   │   └── pages/               # Pages de l'application
│   ├── styles.css               # Styles globaux
│   └── index.html               # Page principale
├── firestore.rules              # Règles de sécurité Firestore
└── firebase.json                # Configuration Firebase
```

## 🔒 Sécurité

- **Authentification Firebase** : Mots de passe cryptés
- **Règles Firestore** : Contrôle d'accès granulaire
- **Validation côté serveur** : Protection contre les injections
- **Archivage** : Pas de suppression définitive des données

## 🚀 Fonctionnalités à Venir

- [ ] Système de notifications en temps réel
- [ ] Export de cours en PDF
- [ ] Partage de cours entre utilisateurs
- [ ] Système de favoris
- [ ] Statistiques avancées pour les admins

## 📝 Licence

Ce projet est sous licence MIT.

## 👨‍💻 Auteur

Développé par [pfoliodev](https://github.com/pfoliodev)

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.
