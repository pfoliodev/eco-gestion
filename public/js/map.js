import { CATEGORIES_CONFIG } from './config/categories.js';
import { state } from './state.js';
import { renderCategories, selectCategory, viewCourse } from './course.js';

/* 
 * Map Module
 * Visualizes categories as a vertical saga map.
 */

export function initMap() {
    const listBtn = document.getElementById('btn-view-list');
    const mapBtn = document.getElementById('btn-view-map');

    if (listBtn && mapBtn) {
        listBtn.addEventListener('click', () => switchView('list'));
        mapBtn.addEventListener('click', () => switchView('map'));

        // Show toggle if we are in root view
        document.getElementById('view-toggle-controls').style.display = 'flex';
    }
}

export function renderMap() {
    const container = document.getElementById('map-nodes');
    if (!container) return;

    // Get categories with ordering (same as list view logic ideally, but simplified here)
    // We'll use the config order or priority list
    const priorityCategories = ['Eco/Gestion', 'English in Hospitality', 'Fondamentaux du marketing', "L'art de l'accueil"];
    // Add others present in state
    const allCats = [...new Set(state.courses.map(c => normalizeCategory(c.category)))];
    const orderedCats = [...priorityCategories];

    allCats.forEach(c => {
        if (!orderedCats.includes(c) && c !== 'Autre') orderedCats.push(c);
    });
    if (allCats.includes('Autre')) orderedCats.push('Autre');

    container.innerHTML = orderedCats.map((catName, index) => {
        const config = CATEGORIES_CONFIG[catName] || { label: catName, theme: '#64748b', image: '' };

        // Calculate progress (Mock or Real)
        // using existing helper if available or State
        let progressClass = '';
        let progress = 0;

        if (state.categoryQuizStats && state.categoryQuizStats[catName]) {
            const stats = state.categoryQuizStats[catName];
            if (stats.total > 0) {
                progress = Math.round((stats.completed / stats.total) * 100);
            }
        }

        if (progress === 100) progressClass = 'completed';
        else if (progress > 0) progressClass = 'unlocked';

        // Staggered layout (zigzag)
        const offset = index % 2 === 0 ? '-50px' : '50px';

        const profImageHtml = config.image ? `<div class="map-prof-avatar"><img src="${config.image}" alt="Professeur"></div>` : '';

        return `
        <div class="map-island ${progressClass}" style="border-color: ${config.theme}; transform: translateX(${offset})" onclick="toggleMapNode(this, '${catName.replace(/'/g, "\\'")}')">
            ${profImageHtml}
            <div class="map-island-icon">${getCategoryIcon(config.id)}</div>
            <div class="map-island-label">${config.label}</div>
        </div>
        <div class="map-subnodes" id="subnodes-${config.id || index}">
            <!-- Courses rendered on click -->
        </div>
        `;
    }).join('');

    // Draw path lines (Optional advanced feature)
    // drawMapPath(); 
}

function getCategoryIcon(id) {
    const icons = {
        'eco-gestion': '📈',
        'english-hospitality': '🇬🇧',
        'marketing': '📢',
        'reception': '🛎️',
        'excel': '📊',
        'oenologie': '🍷',
        'rh': '👥',
        'autre': '📚'
    };
    return icons[id] || '🏝️';
}

function normalizeCategory(cat) {
    // Re-use logic from categories.js or import it (it is exported)
    // For now assuming clean data or redundant plain logic
    if (!cat) return 'Autre';
    return cat; // helper is imported in course.js, better to import it here too if needed
}

export function switchView(mode) {
    const grid = document.getElementById('category-grid');
    const mapContainer = document.getElementById('map-container');
    const listBtn = document.getElementById('btn-view-list');
    const mapBtn = document.getElementById('btn-view-map');

    if (mode === 'map') {
        grid.style.display = 'none';
        mapContainer.style.display = 'block';
        listBtn.classList.remove('active');
        mapBtn.classList.add('active');
        renderMap();
    } else {
        grid.style.display = 'grid';
        mapContainer.style.display = 'none';
        listBtn.classList.add('active');
        mapBtn.classList.remove('active');
    }
}

window.toggleMapNode = function (element, catName) {
    // Find subnodes container
    const wrapper = element.nextElementSibling;

    // Toggle active
    if (wrapper.classList.contains('active')) {
        wrapper.classList.remove('active');
        return;
    }

    // Expand
    // Close others? No, let user explore.
    wrapper.classList.add('active');

    // Render courses if empty
    if (wrapper.innerHTML.trim() === '') {
        const courses = state.courses.filter(c => (c.category === catName || (catName === 'Autre' && !c.category))); // Simplified matching

        wrapper.innerHTML = courses.map(c => {
            const isDone = state.userProgress[c.id] && state.userProgress[c.id].validated;
            const statusClass = isDone ? 'completed' : '';

            return `
             <div class="map-course-node ${statusClass}" onclick="viewCourse('${c.id}')">
                ${isDone ? '⭐' : '📄'}
                <div class="map-course-popup">
                    <strong>${c.title}</strong><br>
                    <span style="font-size:0.8em">${isDone ? 'Terminé' : 'À faire'}</span>
                </div>
             </div>
             `;
        }).join('') + '<div style="height: 50px; width: 2px; background: var(--border-color);"></div>'; // Connector
    }
};
