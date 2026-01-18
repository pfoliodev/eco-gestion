# Palette de Commandes 🎨⌘

## Vue d'ensemble

La **Palette de Commandes** est une interface moderne qui permet une navigation rapide et une recherche efficace dans l'application Eco-Gestion.

## Fonctionnalités

### 🔍 **Recherche Intelligente**
- Recherche fuzzy de cours, actions et pages
- Highlighting des termes correspondants
- Tri intelligent par pertinence

### ⌨️ **Raccourcis Clavier**
- **Ouvrir** : `Ctrl+K` (Windows/Linux) ou `Cmd+K` (Mac)
- **Fermer** : `Echap` ou clic en dehors
- **Navigation** : Flèches `↑` / `↓`
- **Exécuter** : `Entrée`

### 🚀 **Actions Disponibles**

#### Navigation
- 🏠 **Accueil** - Revenir à la page d'accueil
- 📚 **Événements** - Voir tous les cours
- 👑 **Panthéon** - Consulter le classement
- 👤 **Mon Compte** - Gérer mon profil
- 🛍️ **Boutique** - Acheter des items

#### Actions Rapides
- 🌓 **Basculer le thème** - Passer en mode clair/sombre (`Ctrl+D`)
- ⭐ **Mes Favoris** - Accéder à mes cours favoris
- 📜 **Mes Quêtes** - Voir mes quêtes actives

#### Admin (utilisateurs admin uniquement)
- ⚙️ **Panneau Admin** - Accéder à l'administration
- ➕ **Ajouter un Cours** - Créer un nouveau cours

#### Cours Dynamiques
- Tous les cours disponibles sont searchables
- Accès direct en cliquant ou via `Entrée`

## Utilisation

### Méthode 1 : Bouton FAB
Cliquez sur le bouton **⌘** en bas à droite de l'écran (à côté des boutons quêtes et bug).

### Méthode 2 : Raccourci Clavier
Appuyez sur `Ctrl+K` (ou `Cmd+K` sur Mac) n'importe où dans l'application.

### Recherche
1. Tapez votre recherche dans le champ
2. Utilisez les flèches pour naviguer
3. Appuyez sur `Entrée` pour exécuter l'action

## Architecture Technique

### Fichiers
- **CSS** : `public/css/components/command-palette.css`
- **JavaScript** : `public/js/command-palette.js`
- **Intégration** : Importé dans `main.js`

### Classe Principale : `CommandPalette`

#### Méthodes Clés
- `open()` - Ouvre la palette
- `close()` - Ferme la palette
- `toggle()` - Bascule l'état
- `handleSearch(query)` - Gère la recherche
- `fuzzySearch(query, commands)` - Recherche fuzzy
- `buildCommandList()` - Construit la liste des commandes
- `loadCoursesCommands()` - Charge dynamiquement les cours depuis Firestore

### Données Exposées Globalement
```javascript
window.commandPalette  // Instance de la palette
window.navigateTo      // Fonction de navigation
window.db              // Firestore database
window.auth            // Firebase auth
```

## Design

### Glassmorphism
- Backdrop blur pour un effet moderne
- Transitions fluides
- Support du mode sombre

### Responsive
- Adapté mobile (95% de largeur sur petits écrans)
- Raccourcis clavier cachés sur mobile
- Layout optimisé pour touch

## Extension

### Ajouter une Nouvelle Action

```javascript
// Dans command-palette.js, méthode buildCommandList()
{
    id: 'mon-action',
    title: 'Mon Action',
    subtitle: 'Description de l\'action',
    icon: '🎯',
    category: 'Actions',
    shortcut: 'Ctrl+M', // Optionnel
    action: () => {
        // Code à exécuter
    }
}
```

### Ajouter une Nouvelle Catégorie
Les catégories sont créées automatiquement en fonction du champ `category` des commandes.

## Performance

- **Lazy Loading** : Les cours sont chargés uniquement à l'ouverture
- **Recherche Optimisée** : Algorithme de recherche fuzzy efficace
- **Rendu Conditionnel** : Seuls les résultats filtrés sont affichés

## Compatibilité

- ✅ Chrome/Edge (dernières versions)
- ✅ Firefox (dernières versions)
- ✅ Safari (dernières versions)
- ✅ Mobile responsive

## Améliorations Futures

- [ ] Recherche par raccourcis personnalisés
- [ ] Historique des commandes récentes
- [ ] Actions contextuelles basées sur la page actuelle
- [ ] Support vocal (recherche par voix)
- [ ] Thèmes personnalisables
