// Client State
let user = null;
let cart = [];
let products = [];
let activeCategory = '';
let searchQuery = '';

function saveCart() {
  const key = user ? `cart_${user.username}` : 'cart_guest';
  localStorage.setItem(key, JSON.stringify(cart));
}

// DOM Elements
const logoBtn = document.getElementById('logo-btn');
const shopNavBtn = document.getElementById('shop-nav-btn');
const ordersNavBtn = document.getElementById('orders-nav-btn');
const authNavBtn = document.getElementById('auth-nav-btn');
const authBtnText = document.getElementById('auth-btn-text');
const cartNavBtn = document.getElementById('cart-nav-btn');
const cartCount = document.getElementById('cart-count');

const shopView = document.getElementById('shop-view');
const authView = document.getElementById('auth-view');
const ordersView = document.getElementById('orders-view');

const productsContainer = document.getElementById('products-container');
const categoryFilters = document.getElementById('category-filters');
const searchInput = document.getElementById('search-input');

const productModal = document.getElementById('product-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalProductDetail = document.getElementById('modal-product-detail');

const cartDrawer = document.getElementById('cart-drawer');
const cartDrawerBackdrop = document.getElementById('cart-drawer-backdrop');
const closeCartBtn = document.getElementById('close-cart-btn');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartSubtotal = document.getElementById('cart-subtotal');
const checkoutBtn = document.getElementById('checkout-btn');
const cartCheckoutActions = document.getElementById('cart-checkout-actions');
const checkoutFormContainer = document.getElementById('checkout-form-container');
const checkoutForm = document.getElementById('checkout-form');
const cancelCheckoutBtn = document.getElementById('cancel-checkout-btn');

const tabLoginBtn = document.getElementById('tab-login-btn');
const tabRegisterBtn = document.getElementById('tab-register-btn');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const toastEl = document.getElementById('toast');
const ordersContainer = document.getElementById('orders-container');

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
  checkUserSession();
  fetchProducts();
  updateCartUI();
  
  // Lucide Icons Initialization
  lucide.createIcons();
});

// Navigation Handling
function showView(viewId) {
  [shopView, authView, ordersView].forEach(view => {
    view.style.display = view.id === viewId ? 'block' : 'none';
  });

  // Hide cart button on Auth view
  cartNavBtn.style.display = viewId === 'auth-view' ? 'none' : 'flex';

  // Update Nav Links Active Class
  shopNavBtn.classList.toggle('active', viewId === 'shop-view');
  ordersNavBtn.classList.toggle('active', viewId === 'orders-view');
  authNavBtn.classList.toggle('active', viewId === 'auth-view');
}

logoBtn.addEventListener('click', (e) => { e.preventDefault(); showView('shop-view'); });
shopNavBtn.addEventListener('click', () => showView('shop-view'));
ordersNavBtn.addEventListener('click', () => {
  showView('orders-view');
  fetchOrdersHistory();
});

authNavBtn.addEventListener('click', () => {
  if (user) {
    // Logout Action
    logoutUser();
  } else {
    showView('auth-view');
  }
});

// Toast Notifications
function showToast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.style.borderLeft = `4px solid ${isError ? 'var(--error)' : 'var(--success)'}`;
  toastEl.classList.add('show');
  setTimeout(() => {
    toastEl.classList.remove('show');
  }, 3500);
}

// User Authentications Actions
async function checkUserSession() {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data.loggedIn) {
      setUserSession(data.username);
    } else {
      clearUserSession();
    }
  } catch (err) {
    console.error('Session verification failed', err);
  }
}

function setUserSession(username) {
  user = { username };
  authBtnText.textContent = `Sign Out (${username})`;
  ordersNavBtn.style.display = 'block';
  cart = JSON.parse(localStorage.getItem(`cart_${username}`) || '[]');
  updateCartUI();
}

function clearUserSession() {
  user = null;
  authBtnText.textContent = 'Sign In';
  ordersNavBtn.style.display = 'none';
  cart = JSON.parse(localStorage.getItem('cart_guest') || '[]');
  updateCartUI();
}

async function logoutUser() {
  try {
    const res = await fetch('/api/auth/logout', { method: 'POST' });
    const data = await res.json();
    clearUserSession();
    showToast(data.message);
    showView('shop-view');
  } catch (err) {
    showToast('Failed to sign out.', true);
  }
}

// Auth Tabs Switch
tabLoginBtn.addEventListener('click', () => {
  tabLoginBtn.classList.add('active');
  tabRegisterBtn.classList.remove('active');
  loginForm.style.display = 'block';
  registerForm.style.display = 'none';
});

tabRegisterBtn.addEventListener('click', () => {
  tabRegisterBtn.classList.add('active');
  tabLoginBtn.classList.remove('active');
  registerForm.style.display = 'block';
  loginForm.style.display = 'none';
});

// Forms Submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (res.ok) {
      showToast(data.message);
      setUserSession(data.username);
      loginForm.reset();
      showView('shop-view');
    } else {
      showToast(data.error, true);
    }
  } catch (err) {
    showToast('Login connection failed.', true);
  }
});

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('reg-username').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();

    if (res.ok) {
      showToast(data.message);
      setUserSession(data.username);
      registerForm.reset();
      showView('shop-view');
    } else {
      showToast(data.error, true);
    }
  } catch (err) {
    showToast('Registration connection failed.', true);
  }
});


// --- PRODUCTS LOGIC ---

function renderSkeletons() {
  productsContainer.innerHTML = Array(6).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-text title"></div>
      <div class="skeleton-text desc"></div>
      <div class="skeleton-text desc" style="width: 70%;"></div>
      <div class="skeleton-text price"></div>
    </div>
  `).join('');
}

async function fetchProducts() {
  try {
    renderSkeletons();
    let url = `/api/products?`;
    if (activeCategory) url += `category=${encodeURIComponent(activeCategory)}&`;
    if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}`;
    
    const res = await fetch(url);
    products = await res.json();
    
    // Smooth 300ms delay to make the skeleton transition feel buttery
    setTimeout(() => {
      renderProducts();
    }, 300);
  } catch (err) {
    showToast('Failed to load products.', true);
  }
}

function renderProducts() {
  if (products.length === 0) {
    productsContainer.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">
        No premium products match your search.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products.map(p => `
    <div class="product-card" onclick="openDetails(${p.id})">
      <div class="product-img-wrapper">
        <img src="${p.image_url}" alt="${p.name}" loading="lazy">
        <div class="product-card-overlay">
          <span class="btn-overlay"><i data-lucide="expand"></i> Quick View</span>
        </div>
      </div>
      <div class="product-info">
        <span class="product-cat">${p.category}</span>
        <h3 class="product-title">${p.name}</h3>
        <p class="product-desc">${p.description}</p>
        <div class="product-footer">
          <span class="product-price">$${p.price.toFixed(2)}</span>
        </div>
      </div>
    </div>
  `).join('');
  
  lucide.createIcons();
}

// Category filter trigger
categoryFilters.addEventListener('click', (e) => {
  if (e.target.classList.contains('cat-btn')) {
    document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    activeCategory = e.target.getAttribute('data-category');
    fetchProducts();
  }
});

// Search input trigger
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery = e.target.value;
    fetchProducts();
  }, 300);
});

// Product Details Modal
async function openDetails(productId) {
  try {
    const res = await fetch(`/api/products/${productId}`);
    const product = await res.json();
    
    const cartItem = cart.find(item => item.product_id === product.id);
    const cartQty = cartItem ? cartItem.quantity : 0;
    const remainingStock = Math.max(0, product.stock - cartQty);
    
    modalProductDetail.innerHTML = `
      <img src="${product.image_url}" class="modal-img" alt="${product.name}">
      <div class="modal-details">
        <span class="product-cat">${product.category}</span>
        <h2>${product.name}</h2>
        <p class="modal-desc">${product.description}</p>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <span class="product-price" style="font-size: 1.8rem;">$${product.price.toFixed(2)}</span>
          <span style="font-size: 0.9rem; color: ${remainingStock > 0 ? 'var(--success)' : 'var(--error)'}; font-weight:600;">
            ${remainingStock > 0 ? `${remainingStock} units remaining` : 'Out of Stock'}
          </span>
        </div>

        <button class="btn btn-primary w-full" onclick="addToCart(${product.id})" ${remainingStock === 0 ? 'disabled' : ''}>
          <i data-lucide="shopping-cart"></i>
          Add to Workspace Cart
        </button>
      </div>
    `;

    lucide.createIcons();
    productModal.classList.add('open');
  } catch (err) {
    showToast('Could not fetch details.', true);
  }
}

closeModalBtn.addEventListener('click', () => {
  productModal.classList.remove('open');
});

productModal.addEventListener('click', (e) => {
  if (e.target === productModal) productModal.classList.remove('open');
});


// --- CART & CHECKOUT ---

cartNavBtn.addEventListener('click', () => {
  cartDrawer.classList.add('open');
  cartDrawerBackdrop.classList.add('open');
});

function closeCart() {
  cartDrawer.classList.remove('open');
  cartDrawerBackdrop.classList.remove('open');
  checkoutFormContainer.style.display = 'none';
  cartCheckoutActions.style.display = 'block';
}

closeCartBtn.addEventListener('click', closeCart);
cartDrawerBackdrop.addEventListener('click', closeCart);

window.addToCart = function(productId) {
  const existing = cart.find(item => item.product_id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ product_id: productId, quantity: 1 });
  }

  saveCart();
  updateCartUI();
  productModal.classList.remove('open');
  showToast('Product added to your cart.');
  
  // Auto open cart drawer
  cartDrawer.classList.add('open');
  cartDrawerBackdrop.classList.add('open');
};

function updateCartCount() {
  const count = cart.reduce((acc, val) => acc + val.quantity, 0);
  cartCount.textContent = count;
  cartCount.style.animation = 'none';
  cartCount.offsetHeight; /* trigger reflow */
  cartCount.style.animation = '';
}

function updateCartUI() {
  updateCartCount();

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); margin-top: 40px;">
        Your workspace cart is empty.
      </div>
    `;
    cartSubtotal.textContent = '$0.00';
    checkoutBtn.disabled = true;
    return;
  }

  checkoutBtn.disabled = false;

  // We need metadata for cart items
  Promise.all(cart.map(async (item) => {
    const res = await fetch(`/api/products/${item.product_id}`);
    const product = await res.json();
    return { ...product, quantity: item.quantity };
  })).then(items => {
    let subtotal = 0;
    cartItemsContainer.innerHTML = items.map(item => {
      subtotal += item.price * item.quantity;
      return `
        <div class="cart-item">
          <img src="${item.image_url}" class="cart-item-img" alt="${item.name}">
          <div class="cart-item-details">
            <div class="cart-item-name">${item.name}</div>
            <div class="cart-item-price">$${item.price.toFixed(2)}</div>
          </div>
          <div class="cart-item-actions">
            <button class="qty-btn" onclick="updateQty(${item.id}, -1)">-</button>
            <span>${item.quantity}</span>
            <button class="qty-btn" onclick="updateQty(${item.id}, 1)">+</button>
          </div>
        </div>
      `;
    }).join('');

    cartSubtotal.textContent = `$${subtotal.toFixed(2)}`;
  }).catch(() => {
    showToast('Failed to synchronize cart.', true);
  });
}

window.updateQty = function(productId, change) {
  const item = cart.find(item => item.product_id === productId);
  if (!item) return;

  item.quantity += change;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.product_id !== productId);
  }

  saveCart();
  updateCartUI();
};

// Checkout Toggle
checkoutBtn.addEventListener('click', () => {
  if (!user) {
    showToast('Authentication required for checkout.', true);
    showView('auth-view');
    closeCart();
    return;
  }
  cartCheckoutActions.style.display = 'none';
  checkoutFormContainer.style.display = 'block';
});

cancelCheckoutBtn.addEventListener('click', () => {
  checkoutFormContainer.style.display = 'none';
  cartCheckoutActions.style.display = 'block';
});

// Card input formatter (Adds spaces every 4 digits)
const cardInput = document.getElementById('card-num');
cardInput.addEventListener('input', (e) => {
  let val = e.target.value.replace(/\D/g, '');
  if (val.length > 16) val = val.substring(0, 16);
  const matches = val.match(/\d{1,4}/g);
  e.target.value = matches ? matches.join(' ') : '';
});

// Checkout processing
const confirmOrderBtn = document.getElementById('confirm-order-btn');
if (confirmOrderBtn) {
  confirmOrderBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    console.log('Confirm order button clicked');
    const addressEl = document.getElementById('shipping-address');
    const address = addressEl ? addressEl.value.trim() : '';
    const cardNum = cardInput ? cardInput.value.replace(/\s/g, '') : '';

    if (!address) {
      showToast('Shipping address is required.', true);
      if (addressEl) addressEl.focus();
      return;
    }

    if (!cardNum || !/^\d{16}$/.test(cardNum)) {
      showToast('Invalid card details. Please enter exactly 16 digits.', true);
      if (cardInput) cardInput.focus();
      return;
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cart: cart,
          shipping_address: address
        })
      });
      const data = await res.json();

      if (res.ok) {
        // Confetti celebration (null-safe check)
        if (typeof confetti === 'function') {
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 }
          });
        }
        showToast('Order secured successfully!');
        cart = [];
        saveCart();
        updateCartUI();
        if (checkoutForm) checkoutForm.reset();
        closeCart();
        showView('orders-view');
        fetchOrdersHistory();
      } else {
        showToast(data.error, true);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      showToast('Failed to secure order. Checkout pipeline down.', true);
    }
  });
}


// --- ORDER REGISTRY ---

async function fetchOrdersHistory() {
  if (!user) return;
  try {
    const res = await fetch('/api/orders/history');
    const orders = await res.json();
    renderOrders(orders);
  } catch (err) {
    showToast('Failed to pull order registry.', true);
  }
}

function renderOrders(orders) {
  if (orders.length === 0) {
    ordersContainer.innerHTML = `
      <div style="text-align: center; color: var(--text-secondary); padding: 40px;">
        You have not placed any orders yet.
      </div>
    `;
    return;
  }

  ordersContainer.innerHTML = orders.map(o => `
    <div class="order-card">
      <div class="order-card-header">
        <div>
          <span class="order-id">Order ID: #${o.id}</span>
          <span class="order-date">// Placed on: ${new Date(o.created_at).toLocaleString()}</span>
        </div>
        <span class="order-status">${o.status}</span>
      </div>
      <div class="order-details">
        <div class="order-items">
          <strong>Items Ordered</strong>
          ${o.items.split(',').map(item => `<div class="order-item-row"><i data-lucide="package" style="width: 14px; height: 14px; margin-right: 8px; vertical-align: middle; color: var(--accent);"></i>${item.trim()}</div>`).join('')}
        </div>
        <div class="order-total-block">
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px; font-weight: 500;">Shipping to: ${o.shipping_address}</div>
          <div class="order-total-label">Total Paid</div>
          <span class="order-total">$${o.total_amount.toFixed(2)}</span>
        </div>
      </div>
    </div>
  `).join('');
  
  lucide.createIcons();
}
