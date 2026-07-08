// CONFIGURATION CONSTANTS
// ==========================================
// Deploy your Google Apps Script as a Web App and paste its URL here
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzWZnwVGsjwdzQvXd8mbekU1vHMdwCig1l3facIRGPh6oibnKVMROBEWn8nvKdSpvlh/exec";
const MTN_MERCHANT_CODE = "123456";
const AIRTEL_MERCHANT_CODE = "789101";
const BOUTIQUE_WHATSAPP = "256757754559"; // Boutique owners' business WhatsApp line (no '+' prefix)

let allProducts = [];
let selectedItem = "";
let selectedPrice = 0;

// ==========================================
// 1. INITIALIZATION & LIFECYCLE HOOKS
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    // Fetch products if on the products page
    if (document.getElementById("product-list")) {
        fetchLiveProducts();
    }

    // Initialize the Promotional Bottom Sheet on the Homepage
    const offerDismissed = localStorage.getItem('boutique_offer_dismissed');
    const offerBottomSheet = document.getElementById('offerBottomSheet');

    if (offerBottomSheet) {
        if (!offerDismissed) {
            setTimeout(() => {
                offerBottomSheet.classList.add('active');
            }, 2500);
        } else {
            const reopenBadge = document.getElementById('reopenOfferBadge');
            if (reopenBadge) reopenBadge.style.display = 'block';
        }
    }
});

// ==========================================
// 2. FETCH & RENDER PRODUCTS FROM GOOGLE SHEETS
// ==========================================
async function fetchLiveProducts() {
    const container = document.getElementById("product-list");
    const loadingEl = document.getElementById("loading");

    if (!container) return;

    try {
        // Fetch from Web App URL. If URL is the default placeholder, use mock data for demonstration.
        let data = [];
        if (WEB_APP_URL === "https://script.google.com/macros/s/" || !WEB_APP_URL) {
            console.warn("Using demonstration mock products. Please update WEB_APP_URL with your actual Google Apps Script URL.");
            data = getMockProducts();
        } else {
            const response = await fetch(WEB_APP_URL);
            data = await response.json();
        }

        allProducts = data;

        if (loadingEl) loadingEl.style.display = "none";
        renderProducts(allProducts);
    } catch (error) {
        console.error("Error loading shop database:", error);
        if (loadingEl) {
            loadingEl.innerHTML = `
                <div class="error-state">
                    <p style="color: var(--danger); font-weight: bold; margin-bottom: 8px;">Failed to load items.</p>
                    <p style="font-size: 0.9rem;">Please refresh or try again later.</p>
                    <button class="btn-primary" onclick="fetchLiveProducts()" style="margin-top: 16px; padding: 8px 20px; font-size: 0.85rem;">Retry</button>
                </div>
            `;
        }
    }
}

function renderProducts(productsList) {
    const container = document.getElementById("product-list");
    if (!container) return;

    if (productsList.length === 0) {
        container.innerHTML = `<div class="empty-state">No matching items found.</div>`;
        container.style.display = "block";
        return;
    }

    container.innerHTML = productsList.map(product => {
        const isOutOfStock = product.Stock_Status && product.Stock_Status.toLowerCase() === 'out of stock';
        const isLowStock = product.Stock_Status && product.Stock_Status.toLowerCase() === 'low stock';

        let badgeHTML = '';
        if (isOutOfStock) {
            badgeHTML = `<span class="badge badge-sold-out">Sold Out</span>`;
        } else if (isLowStock) {
            badgeHTML = `<span class="badge badge-low-stock">Low Stock</span>`;
        } else {
            badgeHTML = `<span class="badge badge-in-stock">In Stock</span>`;
        }

        const cleanPrice = Number(product.Price) || 0;
        const category = product.Category || 'Collection';
        const imageUrl = product.Image_URL || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=500&q=80';

        return `
            <div class="product-card">
                <div class="product-img-container">
                    <img src="${imageUrl}" alt="${product.Name}" onerror="this.src='https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=500&q=80'">
                    ${badgeHTML}
                </div>
                <div class="product-info">
                    <span class="product-category">${category}</span>
                    <h3 class="product-title">${product.Name}</h3>
                    <p class="product-price">UGX ${cleanPrice.toLocaleString()}</p>
                    ${isOutOfStock
                ? `<button class="order-btn out-of-stock" disabled>Sold Out</button>`
                : `<button class="order-btn" onclick="openOrderModal('${product.Name.replace(/'/g, "\\'")}', ${cleanPrice})">Order for Pickup</button>`
            }
                </div>
            </div>
        `;
    }).join('');

    container.style.display = "grid";
}

// Search filter implementation
function searchProducts(query) {
    const filtered = allProducts.filter(p =>
        (p.Name && p.Name.toLowerCase().includes(query.toLowerCase())) ||
        (p.Category && p.Category.toLowerCase().includes(query.toLowerCase()))
    );
    renderProducts(filtered);
}

// ==========================================
// 3. CHECKOUT MODAL & INTERACTIVE PAYMENT CONTROLS
// ==========================================
function openOrderModal(name, price) {
    selectedItem = name;
    selectedPrice = Number(price) || 0;

    const detailsContainer = document.getElementById("modalProductDetails");
    if (detailsContainer) {
        detailsContainer.innerHTML = `
            <p>Selected Item: <strong>${name}</strong></p>
            <p>Total Amount: <strong>UGX ${selectedPrice.toLocaleString()}</strong></p>
        `;
    }

    const modal = document.getElementById("orderModal");
    if (modal) {
        modal.style.display = "flex";
    }

    // Set default payment method and trigger instructions setup
    const payMethod = document.getElementById("paymentMethod");
    if (payMethod) {
        payMethod.value = "Cash on Pickup";
        togglePaymentInstructions();
    }
}

function closeModal() {
    const modal = document.getElementById("orderModal");
    if (modal) {
        modal.style.display = "none";
    }
    const form = document.getElementById("pickupForm");
    if (form) {
        form.reset();
    }
}

function togglePaymentInstructions() {
    const method = document.getElementById("paymentMethod").value;
    const instructionBox = document.getElementById("momoInstructions");
    const instructionText = document.getElementById("instructionText");
    const txnIdInput = document.getElementById("txnId");

    if (!instructionBox || !instructionText || !txnIdInput) return;

    if (method === "Cash on Pickup") {
        instructionBox.style.display = "none";
        txnIdInput.removeAttribute("required");
    } else {
        instructionBox.style.display = "block";
        txnIdInput.setAttribute("required", "true");

        if (method === "MTN MoMo Pay") {
            instructionText.innerHTML = `
                <strong>MTN MoMo Pay Steps:</strong><br>
                1. Dial *165*3#<br>
                2. Enter Merchant Code: <strong>${MTN_MERCHANT_CODE}</strong> <span id="copyCodeBtn" class="copy-item" onclick="copyToClipboard('${MTN_MERCHANT_CODE}', 'copyCodeBtn')">Copy Code</span><br>
                3. Amount: <strong>UGX ${selectedPrice.toLocaleString()}</strong> <span id="copyAmtBtn" class="copy-item" onclick="copyToClipboard('${selectedPrice}', 'copyAmtBtn')">Copy Amount</span>
            `;
        } else if (method === "Airtel Merchant") {
            instructionText.innerHTML = `
                <strong>Airtel Merchant Steps:</strong><br>
                1. Dial *185*4#<br>
                2. Enter Merchant Code: <strong>${AIRTEL_MERCHANT_CODE}</strong> <span id="copyCodeBtn" class="copy-item" onclick="copyToClipboard('${AIRTEL_MERCHANT_CODE}', 'copyCodeBtn')">Copy Code</span><br>
                3. Amount: <strong>UGX ${selectedPrice.toLocaleString()}</strong> <span id="copyAmtBtn" class="copy-item" onclick="copyToClipboard('${selectedPrice}', 'copyAmtBtn')">Copy Amount</span>
            `;
        }
    }
}

// Utility to copy values directly to clipboard
function copyToClipboard(text, elementId) {
    navigator.clipboard.writeText(text).then(() => {
        const el = document.getElementById(elementId);
        if (!el) return;
        const originalText = el.innerText;
        el.innerText = "Copied!";
        el.style.backgroundColor = "var(--success)";
        el.style.color = "white";
        setTimeout(() => {
            el.innerText = originalText;
            el.style.backgroundColor = "";
            el.style.color = "";
        }, 1500);
    }).catch(err => {
        console.error("Failed to copy text: ", err);
    });
}

// ==========================================
// 4. DATA PACKAGING & FORM SUBMISSION TO GOOGLE SHEETS
// ==========================================
async function submitOrder(event) {
    event.preventDefault();

    const btn = document.getElementById("submitBtn");
    if (!btn) return;

    const originalBtnText = btn.innerText;
    btn.innerText = "Processing Reservation...";
    btn.disabled = true;

    const paymentMethod = document.getElementById("paymentMethod").value;
    const txnId = document.getElementById("txnId").value || "N/A";
    const custName = document.getElementById("custName").value;
    const custPhone = document.getElementById("custPhone").value;

    const orderData = {
        name: custName,
        phone: custPhone,
        item: selectedItem,
        price: selectedPrice.toString(),
        payment_method: paymentMethod,
        txn_id: txnId,
        payment_status: paymentMethod === "Cash on Pickup" ? "Unpaid (Cash)" : "Verifying (MoMo)"
    };

    try {
        // If App Script URL is a placeholder, simulate sheet insertion success
        let result = { status: "success" };

        if (WEB_APP_URL !== "https://script.google.com/macros/s/" && WEB_APP_URL) {
            const response = await fetch(WEB_APP_URL, {
                method: "POST",
                body: JSON.stringify(orderData)
            });
            result = await response.json();
        } else {
            // Simulate delay for mock demonstration
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        if (result.status === "success") {
            showToast("Success!", "Your order is saved.", "Pick your items after 2 days");

            // Generate receipt text for WhatsApp redirection
            const message = `Hello! I just placed a boutique order via the website.\n\n` +
                `👤 Name: ${orderData.name}\n` +
                `📞 Phone: ${orderData.phone}\n` +
                `👗 Item: ${orderData.item}\n` +
                `💰 Price: UGX ${Number(orderData.price).toLocaleString()}\n` +
                `💳 Payment: ${orderData.payment_method}\n` +
                `📝 Ref/Txn ID: ${orderData.txn_id}\n\n`;
            // Redirect current tab to WhatsApp (bypasses browser popup blocker)
            window.location.href = `https://wa.me/${BOUTIQUE_WHATSAPP}?text=${encodeURIComponent(message)}`;

            // Clean up
            closeModal();
            const instructionBox = document.getElementById("momoInstructions");
            if (instructionBox) instructionBox.style.display = "none";
        } else {
            showToast("Error", result.message || "Failed to process order on backend.", "error");
        }
    } catch (error) {
        showToast("Connection Error", "Please ensure your device is connected to the internet and try again.", "error");
        console.error(error);
    } finally {
        btn.innerText = originalBtnText;
        btn.disabled = false;
    }
}

// ==========================================
// 5. PROMOTIONAL BOTTOM SHEET CONTROLS
// ==========================================
function toggleBottomSheet() {
    const sheet = document.getElementById('offerBottomSheet');
    const badge = document.getElementById('reopenOfferBadge');

    if (sheet && badge) {
        sheet.classList.toggle('active');
        badge.style.display = sheet.classList.contains('active') ? 'none' : 'block';
    }
}

function closeBottomSheetPermanently() {
    const sheet = document.getElementById('offerBottomSheet');
    const badge = document.getElementById('reopenOfferBadge');

    if (sheet) sheet.classList.remove('active');
    localStorage.setItem('boutique_offer_dismissed', 'true');
    if (badge) badge.style.display = 'block';
}

// ==========================================
// 6. PREMIUM TOAST ALERTS SYSTEM
// ==========================================
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    toast.innerHTML = `
        <div class="toast-content">
            <strong>${title}</strong>
            <p>${message}</p>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================
// 7. DEMONSTRATION INVENTORY MOCK DATA
// ==========================================
function getMockProducts() {
    return [
        {
            "Name": "Floral Summer Dress",
            "Price": "85000",
            "Stock_Status": "In Stock",
            "Category": "Dresses",
            "Image_URL": "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=500&q=80"
        },
        {
            "Name": "Classic Denim Jacket",
            "Price": "120000",
            "Stock_Status": "In Stock",
            "Category": "Tops & Outerwear",
            "Image_URL": "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=500&q=80"
        },
        {
            "Name": "High-Waist Pleated Skirt",
            "Price": "55000",
            "Stock_Status": "Low Stock",
            "Category": "Skirts",
            "Image_URL": "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=500&q=80"
        },
        {
            "Name": "Luxury Leather Handbag",
            "Price": "180000",
            "Stock_Status": "In Stock",
            "Category": "Bags & Accessories",
            "Image_URL": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=500&q=80"
        },
        {
            "Name": "Elegant Casual Jumpsuit",
            "Price": "95000",
            "Stock_Status": "Out of Stock",
            "Category": "Jumpsuits",
            "Image_URL": "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=500&q=80"
        },
        {
            "Name": "Suede Ankle Boots",
            "Price": "150000",
            "Stock_Status": "In Stock",
            "Category": "Shoes",
            "Image_URL": "https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?auto=format&fit=crop&w=500&q=80"
        }
    ];
}
