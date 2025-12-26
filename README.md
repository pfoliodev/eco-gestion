# Eco-Gestion - Gestion de Cours d'Économie

Une application web simple pour gérer et organiser des synthèses de cours en économie.

## Fonctionnalités

-   **Ajouter, Modifier, Supprimer des Cours:** Interface complète pour la gestion de vos cours.
-   **Éditeur de Texte Riche:** Un éditeur de texte moderne (Quill.js) pour formater le contenu de vos cours.
-   **Recherche et Filtrage:** Retrouvez facilement vos cours par titre, sujet ou description.
-   **Mode Sombre:** Thème sombre pour une meilleure expérience visuelle.
-   **Persistance des Données:** Les données sont stockées dans Firebase Firestore pour un accès depuis n'importe où.

## Technologies Utilisées

-   **Frontend:** HTML5, CSS3, JavaScript (ES6 Modules)
-   **Base de Données:** Firebase Firestore
-   **Hébergement:** Firebase Hosting
-   **Bibliothèques:**
    -   [Quill.js](https://quilljs.com/) - Éditeur de texte riche
    -   [Notyf](https://carlosroso.com/notyf/) - Notifications Toast

## Installation et Lancement

1.  **Clonez le dépôt:**
    ```bash
    git clone <URL_DU_REPO>
    cd <NOM_DU_DOSSIER>
    ```

2.  **Configurez Firebase:**
    -   Créez un projet sur la [console Firebase](https://console.firebase.google.com/).
    -   Activez **Firestore** et **Firebase Hosting**.
    -   Créez une application web et copiez votre configuration Firebase.
    -   Collez votre configuration dans le fichier `public/firebase-config.js`.

3.  **Lancez l'application:**
    -   Vous pouvez lancer l'application en utilisant un serveur local. Par exemple, avec l'extension "Live Server" de VS Code.
    -   Ou en la déployant sur Firebase Hosting:
        ```bash
        firebase deploy
        ```
