export const CATEGORIES_CONFIG = {
    'Eco/Gestion': {
        id: 'eco-gestion',
        label: 'Eco/Gestion',
        className: 'eco-gestion',
        image: '/images/prof/prof_ecogestion.png',
        theme: '#0d9488'
    },
    'English in Hospitality': {
        id: 'english-hospitality',
        label: 'English in Hospitality',
        className: 'english-hospitality',
        image: '/images/prof/prof_english.png',
        theme: '#be185d'
    },
    'Fondamentaux du marketing': {
        id: 'marketing',
        label: 'Fondamentaux du marketing',
        className: 'marketing',
        image: '/images/prof/prof_marketing.png',
        theme: '#3b82f6'
    },
    "L'art de l'accueil": {
        id: 'reception',
        label: "L'art de l'accueil",
        className: 'reception',
        image: '/images/prof/prof_accueil.png',
        theme: '#8b5cf6'
    },
    'Modélisation Excel': {
        id: 'excel',
        label: 'Modélisation Excel',
        className: 'excel',
        image: '/images/prof/prof_excel.png',
        theme: '#10b981'
    },
    'Sommelerie & Oenologie': {
        id: 'oenologie',
        label: 'Sommelerie & Oenologie',
        className: 'oenologie',
        image: '/images/prof/prof_oenologie.png',
        theme: '#713f12'
    },
    'Fondamentaux des ressources humaines': {
        id: 'rh',
        label: 'Ressources Humaines',
        className: 'rh',
        image: '/images/prof/prof_rh.png',
        theme: '#f59e0b'
    },
    'Autre': {
        id: 'autre',
        label: 'Autre',
        className: 'default',
        image: '/images/prof/prof_default.png',
        theme: '#64748b'
    }
};

export const normalizeCategory = (cat) => {
    if (!cat) return 'Autre';
    const lower = cat.toLowerCase();
    if (lower.includes('english') || lower.includes('anglais')) return 'English in Hospitality';
    if (lower.includes('eco') || lower.includes('gestion')) return 'Eco/Gestion';
    if (lower.includes('marketing')) return 'Fondamentaux du marketing';
    if (lower.includes('accueil') || lower.includes('réception') || lower.includes('reception')) return "L'art de l'accueil";
    if (lower.includes('excel') || lower.includes('tableur')) return 'Modélisation Excel';
    if (lower.includes('vin') || lower.includes('sommelerie') || lower.includes('oenologie')) return 'Sommelerie & Oenologie';
    if (lower.includes('ressources humaines') || lower.includes('rh') || lower.includes('management')) return 'Fondamentaux des ressources humaines';
    return cat;
};
