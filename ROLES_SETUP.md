# Configuration du Système de Rôles

## Étapes à suivre

### 1. Déployer les règles Firestore

Les règles de sécurité ont été créées dans `firestore.rules`. Pour les déployer :

```bash
firebase deploy --only firestore:rules
```

### 2. Créer un utilisateur admin

Par défaut, tous les nouveaux utilisateurs sont créés avec le rôle `student`. Pour créer un admin :

1. **Option A : Via la console Firebase**
   - Va sur [Firebase Console](https://console.firebase.google.com)
   - Sélectionne ton projet `eco-gestion-d764e`
   - Va dans **Firestore Database**
   - Crée une collection `users` si elle n'existe pas
   - Ajoute un document avec l'ID = **UID de l'utilisateur** (tu peux le trouver dans Authentication)
   - Contenu du document :
     ```json
     {
       "role": "admin",
       "email": "ton-email@example.com",
       "createdAt": "2024-01-01T00:00:00.000Z"
     }
     ```

2. **Option B : Via le code (temporaire)**
   - Connecte-toi avec ton compte
   - Ouvre la console du navigateur (F12)
   - Exécute :
     ```javascript
     const db = firebase.firestore();
     const userId = firebase.auth().currentUser.uid;
     db.collection('users').doc(userId).set({
       role: 'admin',
       email: firebase.auth().currentUser.email,
       createdAt: new Date()
     });
     ```

### 3. Fonctionnement du système

- **Étudiants (role: 'student')** :
  - Peuvent se connecter
  - Peuvent voir tous les cours
  - **NE PEUVENT PAS** créer, modifier ou supprimer des cours
  - Les boutons "Ajouter", "Modifier" et "Supprimer" sont cachés

- **Administrateurs (role: 'admin')** :
  - Peuvent se connecter
  - Peuvent voir tous les cours
  - **PEUVENT** créer, modifier et supprimer des cours
  - Ont accès à tous les boutons d'administration

### 4. Sécurité

Les règles Firestore protègent la base de données même si quelqu'un essaie de contourner l'interface :
- Seuls les admins peuvent modifier la collection `courses`
- Tout le monde peut lire les cours
- Les utilisateurs peuvent seulement lire/écrire leurs propres données dans `users`

### 5. Tester

1. Connecte-toi avec un compte admin → Tu dois voir les boutons d'édition
2. Connecte-toi avec un compte étudiant → Les boutons doivent être cachés
3. Essaie de créer un cours en tant qu'étudiant → Erreur de permission
