/**
 * Command Palette - Modern Command Interface
 * Provides quick access to navigation, courses, and actions
 */

export class CommandPalette {
    constructor() {
        this.overlay = null;
        this.input = null;
        this.resultsContainer = null;
        this.selectedIndex = 0;
        this.filteredCommands = [];
        this.allCommands = [];
        this.isOpen = false;

        this.init();
    }

    init() {
        this.createDOM();
        this.attachEventListeners();
        this.buildCommandList();
    }

    createDOM() {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'command-palette-overlay';
        this.overlay.innerHTML = `
            <div class="command-palette">
                <div class="command-palette-search">
                    <span class="command-palette-search-icon">🔍</span>
                    <input 
                        type="text" 
                        class="command-palette-input" 
                        placeholder="Rechercher des cours, actions..."
                        autocomplete="off"
                        spellcheck="false"
                    />
                    <span class="command-palette-hint">ESC</span>
                </div>
                <div class="command-palette-results"></div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        this.input = this.overlay.querySelector('.command-palette-input');
        this.resultsContainer = this.overlay.querySelector('.command-palette-results');
    }

    attachEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+K or Cmd+K to open
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }

            // ESC to close
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }

            // Arrow navigation when open
            if (this.isOpen) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.selectNext();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.selectPrevious();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    this.executeSelected();
                }
            }
        });

        // FAB button
        const fabBtn = document.getElementById('command-palette-fab');
        if (fabBtn) {
            fabBtn.addEventListener('click', () => this.toggle());
        }

        // Click outside to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // Search input
        this.input.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
    }

    buildCommandList() {
        this.allCommands = [
            // Navigation
            {
                id: 'nav-home',
                title: 'Accueil',
                subtitle: 'Revenir à la page d\'accueil',
                icon: '🏠',
                category: 'Navigation',
                action: () => window.navigateTo('accueil')
            },
            {
                id: 'nav-events',
                title: 'Événements',
                subtitle: 'Voir tous les cours',
                icon: '📚',
                category: 'Navigation',
                action: () => window.navigateTo('evenements')
            },
            {
                id: 'nav-pantheon',
                title: 'Panthéon',
                subtitle: 'Consulter le classement',
                icon: '👑',
                category: 'Navigation',
                action: () => window.navigateTo('pantheon')
            },
            {
                id: 'nav-account',
                title: 'Mon Compte',
                subtitle: 'Gérer mon profil',
                icon: '👤',
                category: 'Navigation',
                action: () => window.navigateTo('mon-compte')
            },
            {
                id: 'nav-shop',
                title: 'Boutique',
                subtitle: 'Acheter des items',
                icon: '🛍️',
                category: 'Navigation',
                action: () => window.navigateTo('shop')
            },
            // Actions
            {
                id: 'action-theme',
                title: 'Basculer le thème',
                subtitle: 'Clair / Sombre',
                icon: '🌓',
                category: 'Actions',
                shortcut: 'Ctrl+D',
                action: () => {
                    const currentTheme = document.documentElement.getAttribute('data-theme');
                    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                    document.documentElement.setAttribute('data-theme', newTheme);
                    localStorage.setItem('theme', newTheme);
                }
            },
            {
                id: 'action-favorites',
                title: 'Mes Favoris',
                subtitle: 'Voir mes cours favoris',
                icon: '⭐',
                category: 'Actions',
                action: () => {
                    window.navigateTo('mon-compte');
                    setTimeout(() => {
                        const favSection = document.querySelector('.favorites-section');
                        if (favSection) {
                            favSection.scrollIntoView({ behavior: 'smooth' });
                        }
                    }, 300);
                }
            },
            {
                id: 'action-quests',
                title: 'Mes Quêtes',
                subtitle: 'Voir mes quêtes actives',
                icon: '📜',
                category: 'Actions',
                action: () => {
                    document.getElementById('quest-fab')?.click();
                }
            }
        ];

        // Add admin actions if user is admin
        if (window.currentUser?.role === 'admin') {
            this.allCommands.push(
                {
                    id: 'admin-panel',
                    title: 'Panneau Admin',
                    subtitle: 'Accéder au panneau d\'administration',
                    icon: '⚙️',
                    category: 'Admin',
                    action: () => window.navigateTo('admin')
                },
                {
                    id: 'admin-add-course',
                    title: 'Ajouter un Cours',
                    subtitle: 'Créer un nouveau cours',
                    icon: '➕',
                    category: 'Admin',
                    action: () => window.navigateTo('ajouter')
                }
            );
        }
    }

    async loadCoursesCommands() {
        // Dynamically load courses from Firestore
        if (!window.db) return;

        try {
            const coursesSnapshot = await window.db.collection('courses').get();
            const courseCommands = coursesSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: `course-${doc.id}`,
                    title: data.title,
                    subtitle: data.subject || 'Cours',
                    icon: this.getCourseIcon(data.type),
                    category: 'Cours',
                    action: () => window.navigateTo('course-detail', { courseId: doc.id })
                };
            });

            // Add courses to commands
            this.allCommands = [
                ...this.allCommands.filter(cmd => cmd.category !== 'Cours'),
                ...courseCommands
            ];
        } catch (error) {
            console.error('Error loading courses:', error);
        }
    }

    getCourseIcon(type) {
        const icons = {
            'cours': '📖',
            'exercice': '✏️',
            'video': '🎥',
            'tp': '💻'
        };
        return icons[type] || '📄';
    }

    handleSearch(query) {
        if (!query.trim()) {
            this.filteredCommands = this.allCommands;
        } else {
            this.filteredCommands = this.fuzzySearch(query, this.allCommands);
        }

        this.selectedIndex = 0;
        this.render();
    }

    fuzzySearch(query, commands) {
        const lowerQuery = query.toLowerCase();

        return commands.filter(cmd => {
            const titleMatch = cmd.title.toLowerCase().includes(lowerQuery);
            const subtitleMatch = cmd.subtitle?.toLowerCase().includes(lowerQuery);
            const categoryMatch = cmd.category.toLowerCase().includes(lowerQuery);

            return titleMatch || subtitleMatch || categoryMatch;
        }).sort((a, b) => {
            // Prioritize title matches
            const aTitle = a.title.toLowerCase().indexOf(lowerQuery);
            const bTitle = b.title.toLowerCase().indexOf(lowerQuery);

            if (aTitle !== -1 && bTitle === -1) return -1;
            if (aTitle === -1 && bTitle !== -1) return 1;

            return aTitle - bTitle;
        });
    }

    highlightMatch(text, query) {
        if (!query.trim()) return text;

        const lowerText = text.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerText.indexOf(lowerQuery);

        if (index === -1) return text;

        return text.substring(0, index) +
            `<span class="command-match">${text.substring(index, index + query.length)}</span>` +
            text.substring(index + query.length);
    }

    render() {
        const query = this.input.value;

        if (this.filteredCommands.length === 0) {
            this.resultsContainer.innerHTML = `
                <div class="command-palette-empty">
                    <div class="command-palette-empty-icon">🔍</div>
                    <div class="command-palette-empty-text">Aucun résultat trouvé</div>
                </div>
            `;
            return;
        }

        // Group by category
        const grouped = this.filteredCommands.reduce((acc, cmd) => {
            if (!acc[cmd.category]) acc[cmd.category] = [];
            acc[cmd.category].push(cmd);
            return acc;
        }, {});

        let html = '';
        Object.entries(grouped).forEach(([category, commands]) => {
            html += `
                <div class="command-palette-section">
                    <div class="command-palette-section-title">${category}</div>
                    ${commands.map((cmd, index) => {
                const globalIndex = this.filteredCommands.indexOf(cmd);
                return `
                            <div class="command-item ${globalIndex === this.selectedIndex ? 'selected' : ''}" data-index="${globalIndex}">
                                <span class="command-item-icon">${cmd.icon}</span>
                                <div class="command-item-content">
                                    <div class="command-item-title">${this.highlightMatch(cmd.title, query)}</div>
                                    ${cmd.subtitle ? `<div class="command-item-subtitle">${cmd.subtitle}</div>` : ''}
                                </div>
                                ${cmd.shortcut ? `<span class="command-item-shortcut">${cmd.shortcut}</span>` : ''}
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        });

        this.resultsContainer.innerHTML = html;

        // Add click handlers
        this.resultsContainer.querySelectorAll('.command-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                this.selectedIndex = index;
                this.executeSelected();
            });
        });
    }

    selectNext() {
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredCommands.length;
        this.render();
        this.scrollToSelected();
    }

    selectPrevious() {
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredCommands.length) % this.filteredCommands.length;
        this.render();
        this.scrollToSelected();
    }

    scrollToSelected() {
        const selected = this.resultsContainer.querySelector('.command-item.selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    executeSelected() {
        const command = this.filteredCommands[this.selectedIndex];
        if (command && command.action) {
            command.action();
            this.close();
        }
    }

    open() {
        this.isOpen = true;
        this.overlay.classList.add('active');
        this.input.value = '';
        this.filteredCommands = this.allCommands;
        this.selectedIndex = 0;

        // Load courses dynamically when opening
        this.loadCoursesCommands().then(() => {
            this.render();
        });

        // Focus input
        setTimeout(() => {
            this.input.focus();
        }, 100);
    }

    close() {
        this.isOpen = false;
        this.overlay.classList.remove('active');
        this.input.value = '';
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
}

// Initialize command palette when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.commandPalette = new CommandPalette();
    });
} else {
    window.commandPalette = new CommandPalette();
}
