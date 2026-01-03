/**
 * Shop UI Module
 * ===============
 * Renders the shop interface and handles user interactions.
 */

import {
    getShopItems,
    getShopItem,
    purchaseItem,
    getUserInventory,
    userOwnsItem,
    isItemAvailable,
    equipItem,
    unequipItem
} from './shop.js';
import { getUserBalance, updateBalanceDisplay, formatCoins } from './coins.js';
import { ECONOMY } from './config/economy.js';
import { notyf } from './ui.js';
import { auth } from './firebase.js';

let currentCategory = 'all';
let currentItemToPurchase = null;

// ============================================
// INITIALIZATION
// ============================================

export async function initShopPage() {
    if (!auth.currentUser) {
        renderLoginRequired();
        return;
    }

    // Load and display balance
    const balance = await getUserBalance();
    updateShopBalance(balance);

    // Initialize filters
    initCategoryFilters();

    // Load shop items
    await renderShopItems();

    // Initialize purchase modal
    initPurchaseModal();
}

function renderLoginRequired() {
    const grid = document.getElementById('shop-items-grid');
    if (grid) {
        grid.innerHTML = `
            <div class="shop-login-required">
                <div class="icon">🔒</div>
                <h3>Connexion requise</h3>
                <p>Connectez-vous pour accéder à la boutique et dépenser vos Coins.</p>
                <a href="#login" class="btn-primary">Se connecter</a>
            </div>
        `;
    }
}

// ============================================
// CATEGORY FILTERS
// ============================================

function initCategoryFilters() {
    const filterBtns = document.querySelectorAll('.shop-filter-btn');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update category and reload
            currentCategory = btn.dataset.category;
            await renderShopItems();
        });
    });
}

// ============================================
// RENDERING
// ============================================

function updateShopBalance(balance) {
    const balanceEl = document.getElementById('shop-balance');
    if (balanceEl) {
        balanceEl.textContent = formatCoins(balance);
    }
}

export async function renderShopItems() {
    const grid = document.getElementById('shop-items-grid');
    const limitedGrid = document.getElementById('limited-items-grid');
    const limitedSection = document.getElementById('limited-section');
    const emptyState = document.getElementById('shop-empty');

    if (!grid) return;

    grid.innerHTML = '<div class="loading-spinner">Chargement...</div>';

    try {
        const [items, inventory] = await Promise.all([
            getShopItems(currentCategory),
            getUserInventory()
        ]);

        const ownedIds = new Set(inventory.map(i => i.id));
        const balance = await getUserBalance();

        // Separate limited and regular items
        const limitedItems = items.filter(item => item.isLimited);
        const regularItems = items.filter(item => !item.isLimited);

        // Render limited items
        if (limitedItems.length > 0 && (currentCategory === 'all' || currentCategory === limitedItems[0]?.category)) {
            limitedSection.style.display = 'block';
            limitedGrid.innerHTML = limitedItems.map(item =>
                renderItemCard(item, ownedIds.has(item.id), balance)
            ).join('');
        } else {
            limitedSection.style.display = 'none';
        }

        // Render regular items
        if (regularItems.length > 0) {
            grid.innerHTML = regularItems.map(item =>
                renderItemCard(item, ownedIds.has(item.id), balance)
            ).join('');
            emptyState.style.display = 'none';
        } else if (limitedItems.length === 0) {
            grid.innerHTML = '';
            emptyState.style.display = 'block';
        } else {
            grid.innerHTML = '';
        }

        // Attach event listeners
        attachItemListeners();

    } catch (error) {
        console.error('Error loading shop items:', error);
        grid.innerHTML = '<div class="error-msg">Erreur de chargement de la boutique.</div>';
    }
}

function renderItemCard(item, isOwned, userBalance) {
    const available = isItemAvailable(item);
    const canAfford = userBalance >= item.price;
    const isOutOfStock = item.stock !== undefined && item.stock !== null && item.stock <= 0;

    // Consumables are never "fully owned" in a way that blocks purchase
    const showAsOwned = isOwned && item.category !== 'consumable';

    let badgeHtml = '';
    if (showAsOwned) {
        badgeHtml = '<span class="item-badge owned">Possédé</span>';
    } else if (isOutOfStock) {
        badgeHtml = '<span class="item-badge out-of-stock">Rupture</span>';
    } else if (item.isLimited) {
        badgeHtml = '<span class="item-badge limited">Limité</span>';
    } else if (item.isNew) {
        badgeHtml = '<span class="item-badge new">Nouveau</span>';
    }

    // Stock display
    let stockHtml = '';
    if (item.stock !== undefined && item.stock !== null && !showAsOwned) {
        const stockClass = item.stock <= 10 ? 'low' : '';
        stockHtml = `<span class="item-stock ${stockClass}">${item.stock} restant${item.stock > 1 ? 's' : ''}</span>`;
    }

    // Button state
    let buttonHtml = '';
    if (showAsOwned) {
        buttonHtml = `<button class="btn-buy owned" disabled>✓ Possédé</button>`;
    } else if (!available) {
        buttonHtml = `<button class="btn-buy" disabled>Non disponible</button>`;
    } else if (!canAfford) {
        buttonHtml = `<button class="btn-buy" disabled>Solde insuffisant</button>`;
    } else {
        buttonHtml = `<button class="btn-buy" data-item-id="${item.id}">Acheter</button>`;
    }

    // Theme preview background
    const previewStyle = item.preview?.['--bg-main']
        ? `style="--item-preview-bg: ${item.preview['--bg-main']}"`
        : '';

    return `
        <div class="shop-item-card ${isOwned ? 'owned' : ''} ${!available ? 'out-of-stock' : ''}" data-item-id="${item.id}">
            ${badgeHtml}
            <div class="item-preview ${item.category === 'theme' ? 'theme-preview' : ''} ${item.category === 'consumable' ? 'consumable-preview' : ''}" ${previewStyle}>
                ${item.image ? `<img src="${item.image}" alt="${item.name}">` : (item.icon || '🎁')}
            </div>
            <div class="item-info">
                <h4 class="item-name">${item.name}</h4>
                <p class="item-description">${item.description || ''}</p>
                <div class="item-meta">
                    <div class="item-price">
                        <span class="coin-icon">🪙</span>
                        <span>${item.price}</span>
                    </div>
                    ${stockHtml}
                </div>
            </div>
            ${buttonHtml}
        </div>
    `;
}

function attachItemListeners() {
    document.querySelectorAll('.btn-buy[data-item-id]').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.itemId;
            await openPurchaseModal(itemId);
        });
    });
}

// ============================================
// PURCHASE MODAL
// ============================================

function initPurchaseModal() {
    const modal = document.getElementById('purchase-modal');
    const closeBtn = document.getElementById('purchase-modal-close');
    const cancelBtn = document.getElementById('purchase-cancel');
    const confirmBtn = document.getElementById('purchase-confirm');

    if (closeBtn) {
        closeBtn.addEventListener('click', closePurchaseModal);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closePurchaseModal);
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', handlePurchaseConfirm);
    }

    // Close on overlay click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closePurchaseModal();
            }
        });
    }
}

async function openPurchaseModal(itemId) {
    const modal = document.getElementById('purchase-modal');
    const preview = document.getElementById('purchase-preview');
    const priceEl = document.getElementById('purchase-price');
    const afterBalanceEl = document.getElementById('purchase-after-balance');

    if (!modal) return;

    const item = await getShopItem(itemId);
    if (!item) return;

    const balance = await getUserBalance();

    currentItemToPurchase = item;

    // Update preview
    preview.innerHTML = `
        <div class="item-preview ${item.category === 'theme' ? 'theme-preview' : ''} ${item.category === 'consumable' ? 'consumable-preview' : ''}" style="width:100px; height:100px; margin:0 auto 1rem;">
             ${item.image ? `<img src="${item.image}" alt="${item.name}">` : (item.icon || '🎁')}
        </div>
        <div class="item-name" style="font-size:1.2rem;">${item.name}</div>
    `;

    // Quantity Input Logic
    const existingQtyRow = document.getElementById('purchase-qty-row');
    if (existingQtyRow) existingQtyRow.remove();

    let quantity = 1;

    // Helper to update totals
    const updateTotals = () => {
        const total = item.price * quantity;
        priceEl.textContent = total;

        const after = balance - total;
        afterBalanceEl.textContent = `${formatCoins(after)} Coins`;

        const confirmBtn = document.getElementById('purchase-confirm');
        if (after < 0) {
            afterBalanceEl.style.color = 'red';
            confirmBtn.disabled = true;
        } else {
            afterBalanceEl.style.color = '';
            confirmBtn.disabled = false;
        }
    };

    if (item.category === 'consumable') {
        const qtyRow = document.createElement('div');
        qtyRow.id = 'purchase-qty-row';
        qtyRow.className = 'detail-row';
        qtyRow.style.display = 'flex';
        qtyRow.style.justifyContent = 'space-between';
        qtyRow.style.alignItems = 'center';
        qtyRow.style.marginBottom = '1rem';
        qtyRow.innerHTML = `
            <span style="font-weight:600;">Quantité</span>
            <input type="number" id="purchase-qty-input" value="1" min="1" max="99" style="width: 60px; padding: 5px; border-radius: 8px; border: 1px solid var(--border-color); text-align: center; font-weight: bold;">
        `;

        // Insert before the price details row (which usually contains #purchase-price)
        const priceContainer = priceEl.parentElement; // .detail-row
        if (priceContainer && priceContainer.parentElement) {
            priceContainer.parentElement.insertBefore(qtyRow, priceContainer);
        }

        const qtyInput = document.getElementById('purchase-qty-input');
        if (qtyInput) {
            qtyInput.addEventListener('input', (e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val) || val < 1) val = 1;
                if (val > 99) val = 99;
                quantity = val;
                updateTotals();
            });
        }
    }

    updateTotals(); // Initial calc

    // Show modal
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.classList.add('visible');
    });
}

function closePurchaseModal() {
    const modal = document.getElementById('purchase-modal');
    if (modal) {
        modal.classList.remove('visible');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    }
    currentItemToPurchase = null;
    const qtyRow = document.getElementById('purchase-qty-row');
    if (qtyRow) qtyRow.remove();
}

async function handlePurchaseConfirm() {
    if (!currentItemToPurchase) return;

    const confirmBtn = document.getElementById('purchase-confirm');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Achat en cours...';

    // Get quantity
    const qtyInput = document.getElementById('purchase-qty-input');
    const quantity = qtyInput ? parseInt(qtyInput.value) : 1;

    try {
        const result = await purchaseItem(currentItemToPurchase.id, quantity);

        if (result.success) {
            closePurchaseModal();
            // showPurchaseSuccess(result.item); 
            // Reuse simple notification for cleaner logic with quantity

            // Refresh shop display
            await renderShopItems();
            updateShopBalance(result.newBalance);

            notyf.success(`🎉 ${quantity}x ${result.item.name} ajouté(s) !`);
        } else {
            notyf.error(result.error || 'Erreur lors de l\'achat');
        }
    } catch (error) {
        console.error('Purchase error:', error);
        notyf.error('Erreur lors de l\'achat');
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<span class="coin-icon">🪙</span> Acheter';
    }
}

function showPurchaseSuccess(item) {
    const overlay = document.createElement('div');
    overlay.className = 'purchase-success-overlay';
    overlay.innerHTML = `
        <div class="purchase-success-content">
            <div class="success-icon">${item.icon || '🎁'}</div>
            <h3>Achat réussi !</h3>
            <p>${item.name} a été ajouté à votre inventaire</p>
            <button class="btn-primary" onclick="this.closest('.purchase-success-overlay').remove()">Super !</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Auto-close after 3 seconds
    setTimeout(() => {
        if (overlay.parentNode) {
            overlay.remove();
        }
    }, 3000);
}

// ============================================
// PAGE NAVIGATION HOOK
// ============================================

document.addEventListener('pageChange', async (e) => {
    if (e.detail.pageId === 'shop' || e.detail.pageId === 'page-shop') {
        await initShopPage();
    }
});

// Export for manual initialization
export { initShopPage as loadShop };
