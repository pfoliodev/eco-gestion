import { db, settingsCollection } from './firebase.js';
import { getDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/9.21.0/firebase-firestore.js";
import { state, setFeatures } from './state.js';

/**
 * Loads feature flags from Firestore and updates the global state.
 */
export async function initFeatures() {
    try {
        const docRef = doc(db, 'settings', 'features');
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            setFeatures(snap.data());
        } else {
            // Initialize with default values if doc doesn't exist
            await setDoc(docRef, state.features);
        }

        applyFeatureFlags();
    } catch (error) {
        console.error("Error loading features:", error);
        // Fallback to defaults already in state
        applyFeatureFlags();
    }
}

/**
 * Updates the UI based on the current feature flags.
 */
export function applyFeatureFlags() {
    const { features } = state;

    console.log('🔧 Applying feature flags:', features); // Debug log

    // 1. Navigation links in Header
    toggleElementBySelector('a[href="#flashcards"]', features.flashcards);

    // 2. Home Page Elements
    toggleElementById('card-flashcards', features.flashcards);
    toggleElementById('feature-card-quiz', features.quiz);
    toggleElementBySelector('.reminders-section', features.reminders);

    // 3. Course detail sections
    toggleElementById('flashcards-sidebar-section', features.flashcards);

    // 4. Account & Gamification
    toggleElementById('account-section-badges', features.badges);
    toggleElementBySelector('a[href="#pantheon"]', features.badges);

    // 5. Sidebar/Buttons
    toggleElementById('manage-course-flashcards', features.flashcards);
}

// Better selector helper
function toggleElementBySelector(selector, isVisible) {
    document.querySelectorAll(selector).forEach(el => {
        el.style.display = isVisible ? '' : 'none';

        // Handle list items containing the link (for header)
        if (el.tagName === 'A') {
            const li = el.closest('li');
            if (li) li.style.display = isVisible ? '' : 'none';
        }
    });
}

/**
 * Updates a feature flag in Firestore and applies changes.
 */
export async function updateFeatureFlag(featureName, isEnabled) {
    try {
        const docRef = doc(db, 'settings', 'features');
        await setDoc(docRef, { [featureName]: isEnabled }, { merge: true });

        setFeatures({ [featureName]: isEnabled });
        applyFeatureFlags();

        return true;
    } catch (error) {
        console.error(`Error updating feature ${featureName}:`, error);
        throw error;
    }
}

/**
 * Reinitializes the home page carousel after feature flags change
 */
function reinitializeCarousel() {
    const carousel = document.getElementById('home-features-carousel');
    if (!carousel) return;

    const allSlides = carousel.querySelectorAll('.carousel-slide');
    const visibleSlides = Array.from(allSlides)
        .filter(slide => slide.style.display !== 'none');

    console.log('🎠 Carousel reinit:', visibleSlides.length, 'visible slides');

    // If no slides are visible, hide the entire carousel
    if (visibleSlides.length === 0) {
        carousel.style.display = 'none';
        return;
    }

    // Show carousel if hidden
    carousel.style.display = '';

    // Remove active class from ALL slides first
    allSlides.forEach(slide => {
        slide.classList.remove('active');
    });

    // Add active class ONLY to the first VISIBLE slide
    if (visibleSlides.length > 0) {
        visibleSlides[0].classList.add('active');
        console.log('✅ Active slide:', visibleSlides[0].id);
    }

    // Update carousel indicators
    const indicators = carousel.querySelector('.carousel-indicators');
    if (indicators && visibleSlides.length > 1) {
        indicators.innerHTML = visibleSlides.map((_, index) =>
            `<span class="indicator ${index === 0 ? 'active' : ''}" data-slide="${index}"></span>`
        ).join('');
    } else if (indicators) {
        // Hide indicators if only one slide
        indicators.innerHTML = '';
    }
}

// Helpers

function toggleElementById(id, isVisible) {
    const el = document.getElementById(id);
    console.log(`🔍 Toggle ${id}:`, el ? 'found' : 'NOT FOUND', '| visible:', isVisible);
    if (el) el.style.display = isVisible ? '' : 'none';
}
