// Template Loader Module
// Handles dynamic loading and caching of HTML templates

// Cache pour stocker les templates chargés
const templateCache = new Map();

/**
 * Charge un template HTML depuis un fichier
 * @param {string} path - Chemin vers le template
 * @returns {Promise<string>} - Contenu HTML du template
 */
export async function loadTemplate(path) {
    if (templateCache.has(path)) {
        return templateCache.get(path);
    }

    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`Failed to load template: ${path} (${response.status})`);
        }
        const html = await response.text();
        templateCache.set(path, html);
        return html;
    } catch (error) {
        console.error('Template loading error:', error);
        return '';
    }
}

/**
 * Charge et insère un template dans un conteneur
 * @param {string} containerId - ID du conteneur
 * @param {string} templatePath - Chemin vers le template
 * @returns {Promise<boolean>} - True si succès, false sinon
 */
export async function renderTemplate(containerId, templatePath) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container not found: ${containerId}`);
        return false;
    }

    const html = await loadTemplate(templatePath);
    if (html) {
        container.innerHTML = html;
        return true;
    }
    return false;
}

/**
 * Charge plusieurs templates en parallèle
 * @param {Object[]} templates - Array d'objets {containerId, path}
 * @returns {Promise<void>}
 */
export async function loadMultipleTemplates(templates) {
    const promises = templates.map(({ containerId, path }) =>
        renderTemplate(containerId, path)
    );
    await Promise.all(promises);
}

/**
 * Précharge des templates sans les afficher
 * @param {string[]} paths - Array de chemins de templates
 * @returns {Promise<void>}
 */
export async function preloadTemplates(paths) {
    const promises = paths.map(path => loadTemplate(path));
    await Promise.all(promises);
}

/**
 * Vide le cache des templates
 */
export function clearTemplateCache() {
    templateCache.clear();
}
