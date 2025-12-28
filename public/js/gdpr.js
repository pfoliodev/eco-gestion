// GDPR and Cookie Consent Management
import { notyf } from './ui.js';

const COOKIE_CONSENT_KEY = 'cookie-consent';
const COOKIE_PREFERENCES_KEY = 'cookie-preferences';

export function initGDPR() {
    // Check if user has already given consent
    const consent = getCookieConsent();

    if (!consent) {
        // Show cookie banner after a short delay
        setTimeout(() => {
            showCookieBanner();
        }, 1000);
    }

    // Initialize event listeners
    initCookieBannerListeners();
    initPreferencesModalListeners();
}

function showCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
        banner.style.display = 'block';
        // Add animation
        setTimeout(() => {
            banner.classList.add('show');
        }, 100);
    }
}

function hideCookieBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
        banner.classList.remove('show');
        setTimeout(() => {
            banner.style.display = 'none';
        }, 300);
    }
}

function initCookieBannerListeners() {
    const acceptBtn = document.getElementById('accept-cookies');
    const rejectBtn = document.getElementById('reject-cookies');
    const customizeBtn = document.getElementById('customize-cookies');

    if (acceptBtn) {
        acceptBtn.addEventListener('click', acceptAllCookies);
    }

    if (rejectBtn) {
        rejectBtn.addEventListener('click', rejectAllCookies);
    }

    if (customizeBtn) {
        customizeBtn.addEventListener('click', showPreferencesModal);
    }
}

function initPreferencesModalListeners() {
    const saveBtn = document.getElementById('save-preferences');
    const closeBtn = document.getElementById('close-preferences');

    if (saveBtn) {
        saveBtn.addEventListener('click', savePreferences);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closePreferencesModal);
    }
}

export function acceptAllCookies() {
    const consent = {
        essential: true,
        analytics: true,
        timestamp: new Date().toISOString()
    };

    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(consent));

    hideCookieBanner();
    notyf.success('Préférences enregistrées');
}

export function rejectAllCookies() {
    const consent = {
        essential: true, // Always true - required for site functionality
        analytics: false,
        timestamp: new Date().toISOString()
    };

    localStorage.setItem(COOKIE_CONSENT_KEY, 'rejected');
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(consent));

    hideCookieBanner();
    notyf.success('Préférences enregistrées');
}

function showPreferencesModal() {
    const modal = document.getElementById('cookie-preferences-modal');
    if (modal) {
        modal.style.display = 'flex';

        // Load current preferences
        const preferences = getCookiePreferences();
        if (preferences) {
            const analyticsCheckbox = document.getElementById('analytics-cookies');
            if (analyticsCheckbox) {
                analyticsCheckbox.checked = preferences.analytics || false;
            }
        }
    }
}

function closePreferencesModal() {
    const modal = document.getElementById('cookie-preferences-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function savePreferences() {
    const analyticsCheckbox = document.getElementById('analytics-cookies');

    const consent = {
        essential: true,
        analytics: analyticsCheckbox ? analyticsCheckbox.checked : false,
        timestamp: new Date().toISOString()
    };

    localStorage.setItem(COOKIE_CONSENT_KEY, 'customized');
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(consent));

    closePreferencesModal();
    hideCookieBanner();
    notyf.success('Préférences enregistrées');
}

export function getCookieConsent() {
    return localStorage.getItem(COOKIE_CONSENT_KEY);
}

export function getCookiePreferences() {
    const prefs = localStorage.getItem(COOKIE_PREFERENCES_KEY);
    return prefs ? JSON.parse(prefs) : null;
}

export function resetCookieConsent() {
    localStorage.removeItem(COOKIE_CONSENT_KEY);
    localStorage.removeItem(COOKIE_PREFERENCES_KEY);
    showCookieBanner();
}

// Export for global access
window.resetCookieConsent = resetCookieConsent;
