# CSS Architecture - Eco-Gestion

## 📁 Structure

```
css/
├── base/                    # Fondations
│   ├── variables.css        # Custom Properties (couleurs, espacements, etc.)
│   ├── reset.css            # Reset CSS et styles de base
│   └── typography.css       # Typographie et fonts
│
├── components/              # Composants réutilisables (15 fichiers)
│   ├── badges.css           # Système de badges et achievements
│   ├── buttons.css          # Tous les styles de boutons
│   ├── cards.css            # Cartes (cours, flashcards, etc.)
│   ├── carousel.css         # Carrousel de la page d'accueil
│   ├── cookie-banner.css    # Bandeau de consentement cookies
│   ├── favorite-btn.css     # Bouton favoris avec animation
│   ├── footer.css           # Pied de page
│   ├── forms.css            # Inputs, textareas, selects
│   ├── modals.css           # Fenêtres modales
│   ├── navigation.css       # Header et navigation
│   ├── pdf-export.css       # Bouton et styles d'export PDF
│   ├── reminders.css        # Rappels de révision
│   ├── switches.css         # Toggle switches
│   ├── tables.css           # Tableaux admin
│   └── viewers.css          # Affichage des visiteurs de cours
│
├── pages/                   # Styles spécifiques par page (7 fichiers)
│   ├── account.css          # Page profil utilisateur
│   ├── admin.css            # Panneau d'administration
│   ├── courses.css          # Liste et détail des cours
│   ├── flashcards.css       # Interface flashcards
│   ├── home.css             # Page d'accueil
│   ├── privacy.css          # Politique de confidentialité
│   └── quiz.css             # Interface quiz
│
├── utilities/               # Classes utilitaires
│   └── helpers.css          # Classes helper
│
└── main.css                 # Point d'entrée (imports)
```

## 🎯 Conventions

### Nommage
- **BEM-like** : `.component-name`, `.component-name__element`, `.component-name--modifier`
- **Préfixes** : `.btn-`, `.card-`, `.modal-`, etc.

### Unités
- **rem** pour le texte et layouts
- **px** uniquement pour les borders et shadows

### Responsive
- **Mobile-first** : `@media (min-width: ...)`
- Breakpoints : `768px`, `1024px`, `1200px`

### Variables CSS
Définies dans `base/variables.css` :
```css
--color-primary: #6366f1;
--color-secondary: #8b5cf6;
--spacing-sm: 0.5rem;
--spacing-md: 1rem;
--radius-md: 0.5rem;
```

## 📝 Ajouter un nouveau module

1. Créer le fichier dans le dossier approprié
2. Ajouter l'import dans `main.css`
3. Respecter l'ordre de cascade

```css
/* main.css */
@import './components/new-component.css';
```

## ✅ Status

| Catégorie   | Fichiers | Status |
|-------------|----------|--------|
| Base        | 3        | ✅ Complet |
| Components  | 15       | ✅ Complet |
| Pages       | 7        | ✅ Complet |
| Utilities   | 1        | ✅ Complet |

**Total : 26 fichiers CSS modulaires**
