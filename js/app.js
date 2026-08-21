const products = [
  {
    id: "LAN001",
    name: "X-Bacon Especial",
    category: "Hambúrgueres",
    price: 24.90,
    emoji: "🍔",
    description: "Pão brioche, hambúrguer artesanal, queijo cheddar, bacon crocante, molho especial e cebola caramelizada."
  },
  {
    id: "LAN002",
    name: "X-Salada",
    category: "Hambúrgueres",
    price: 19.90,
    emoji: "🍔",
    description: "Hambúrguer artesanal, queijo, alface, tomate, milho, batata palha e molho da casa."
  },
  {
    id: "LAN003",
    name: "Combo Clássico",
    category: "Combos",
    price: 31.90,
    emoji: "🍔",
    description: "X-Salada + batata frita média + refrigerante lata. O trio que não pede licença."
  },
  {
    id: "LAN004",
    name: "Combo Bacon",
    category: "Combos",
    price: 36.90,
    emoji: "🍟",
    description: "X-Bacon Especial + batata frita média + refrigerante lata."
  },
  {
    id: "LAN005",
    name: "Batata Frita",
    category: "Porções",
    price: 14.90,
    emoji: "🍟",
    description: "Porção de batata frita crocante, servida quentinha e com molho especial."
  },
  {
    id: "LAN006",
    name: "Nuggets",
    category: "Porções",
    price: 16.90,
    emoji: "🍗",
    description: "Porção com 10 unidades de nuggets crocantes."
  },
  {
    id: "LAN007",
    name: "Refrigerante Lata",
    category: "Bebidas",
    price: 6.00,
    emoji: "🥤",
    description: "Refrigerante em lata de 350 ml. Escolha o sabor no atendimento."
  },
  {
    id: "LAN008",
    name: "Suco Natural",
    category: "Bebidas",
    price: 8.90,
    emoji: "🧃",
    description: "Suco natural preparado na hora. 400 ml."
  },
  {
    id: "LAN009",
    name: "Milk-shake",
    category: "Sobremesas",
    price: 15.90,
    emoji: "🥤",
    description: "Milk-shake cremoso de 400 ml. Sabores disponíveis no atendimento."
  },
  {
    id: "LAN010",
    name: "Brownie com Sorvete",
    category: "Sobremesas",
    price: 18.90,
    emoji: "🍨",
    description: "Brownie de chocolate servido com uma bola de sorvete e calda."
  }
];

let cart = [];
let activeCategory = "Todos";
let selectedProduct = null;
let modalQuantity = 1;

const productGrid = document.getElementById("productGrid");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");
const productResult = document.getElementById("productResult");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const subtotalEl = document.getElementById("subtotal");
const discountEl = document.getElementById("discount");
const totalEl = document.getElementById("total");
const checkoutButton = document.getElementById("checkoutButton");
const toast = document.getElementById("toast");

const productModal = document.getElementById("productModal");
const checkoutModal = document.getElementById("checkoutModal");

const brl = value => value.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function renderProducts() {
  const search = searchInput.value.trim().toLowerCase();

  const filtered = products.filter(product => {
    const matchesCategory =
      activeCategory === "Todos" || product.category === activeCategory;

    const matchesSearch =
      product.name.toLowerCase().includes(search) ||
      product.description.toLowerCase().includes(search);

    return matchesCategory && matchesSearch;
  });

  productGrid.innerHTML = filtered.map(product => `
    <article class="product-card">
      <div class="product-image">${product.emoji}</div>
      <div class="product-body">
        <span class="product-category">${product.category.toUpperCase()}</span>
        <h4>${product.name}</h4>
        <p>${product.description}</p>
        <div class="product-footer">
          <span class="price">${brl(product.price)}</span>
          <div class="product-actions">
            <button class="detail-button" data-action="details" data-id="${product.id}">Ver</button>
            <button class="add-button" data-action="add" data-id="${product.id}">+ Adicionar</button>
          </div>
        </div>
      </div>
    </article>
  `).join("");

  productResult.textContent = `${filtered.length} produto${filtered.length === 1 ? "" : "s"}`;
  emptyState.classList.toggle("hidden", filtered.length !== 0);
  productGrid.classList.toggle("hidden", filtered.length === 0);
}

function addToCart(productId, quantity = 1) {
  const product = products.find(item => item.id === productId);
  if (!product) return;

  const existing = cart.find(item => item.id === productId);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ ...product, quantity });
  }

  renderCart();
  showToast(`${product.name} adicionado ao pedido.`);
}

function updateQuantity(productId, delta) {
  const item = cart.find(product => product.id === productId);
  if (!item) return;

  item.quantity += delta;

  if (item.quantity <= 0) {
    cart = cart.filter(product => product.id !== productId);
  }

  renderCart();
}

function renderCart() {
  if (cart.length === 0) {
    cartItems.innerHTML = `
      <div class="cart-empty">
        <div>🛒</div>
        <strong>Seu carrinho está vazio</strong>
        <span>Adicione produtos do cardápio.</span>
      </div>
    `;
  } else {
    cartItems.innerHTML = cart.map(item => `
      <div class="cart-item">
        <div class="cart-item-image">${item.emoji}</div>
        <div class="cart-item-info">
          <strong>${item.name}</strong>
          <small>${brl(item.price)} cada</small>
          <div class="qty-controls">
            <button data-cart-action="decrease" data-id="${item.id}">−</button>
            <span>${item.quantity}</span>
            <button data-cart-action="increase" data-id="${item.id}">+</button>
          </div>
        </div>
        <div class="cart-item-price">${brl(item.price * item.quantity)}</div>
      </div>
    `).join("");
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = 0;
  const total = subtotal - discount;
  const quantity = cart.reduce((sum, item) => sum + item.quantity, 0);

  subtotalEl.textContent = brl(subtotal);
  discountEl.textContent = brl(discount);
  totalEl.textContent = brl(total);
  cartCount.textContent = quantity;
  checkoutButton.disabled = cart.length === 0;
}

function openProductModal(productId) {
  selectedProduct = products.find(item => item.id === productId);
  if (!selectedProduct) return;

  modalQuantity = 1;
  document.getElementById("modalProductImage").textContent = selectedProduct.emoji;
  document.getElementById("modalProductCategory").textContent = selectedProduct.category.toUpperCase();
  document.getElementById("modalProductName").textContent = selectedProduct.name;
  document.getElementById("modalProductDescription").textContent = selectedProduct.description;
  document.getElementById("modalProductPrice").textContent = brl(selectedProduct.price);
  document.getElementById("modalProductCode").textContent = `Código: ${selectedProduct.id}`;
  document.getElementById("modalQuantity").textContent = modalQuantity;

  productModal.classList.remove("hidden");
}

function closeModal(modal) {
  modal.classList.add("hidden");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2400);
}

document.getElementById("categoryButtons").addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;

  activeCategory = button.dataset.category;

  document.querySelectorAll(".category").forEach(item => {
    item.classList.toggle("active", item === button);
  });

  renderProducts();
});

searchInput.addEventListener("input", renderProducts);

productGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const id = button.dataset.id;

  if (button.dataset.action === "details") {
    openProductModal(id);
  }

  if (button.dataset.action === "add") {
    addToCart(id);
  }
});

cartItems.addEventListener("click", event => {
  const button = event.target.closest("[data-cart-action]");
  if (!button) return;

  const delta = button.dataset.cartAction === "increase" ? 1 : -1;
  updateQuantity(button.dataset.id, delta);
});

document.getElementById("clearCartButton").addEventListener("click", () => {
  if (!cart.length) return;
  cart = [];
  renderCart();
  showToast("Carrinho limpo.");
});

document.getElementById("openCartButton").addEventListener("click", () => {
  document.getElementById("cartPanel").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

document.getElementById("closeProductModal").addEventListener("click", () => {
  closeModal(productModal);
});

document.getElementById("modalDecrease").addEventListener("click", () => {
  modalQuantity = Math.max(1, modalQuantity - 1);
  document.getElementById("modalQuantity").textContent = modalQuantity;
});

document.getElementById("modalIncrease").addEventListener("click", () => {
  modalQuantity++;
  document.getElementById("modalQuantity").textContent = modalQuantity;
});

document.getElementById("modalAddButton").addEventListener("click", () => {
  if (!selectedProduct) return;
  addToCart(selectedProduct.id, modalQuantity);
  closeModal(productModal);
});

checkoutButton.addEventListener("click", () => {
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  document.getElementById("checkoutTotal").textContent = brl(total);
  checkoutModal.classList.remove("hidden");
});

document.getElementById("closeCheckoutModal").addEventListener("click", () => {
  closeModal(checkoutModal);
});

document.getElementById("confirmSaleButton").addEventListener("click", () => {
  const customerName =
    document.getElementById("customerName").value.trim() || "Cliente não identificado";

  const payment =
    document.querySelector('input[name="payment"]:checked').value;

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Nesta etapa, a venda ainda é simulada.
  // Na Etapa 3, este ponto será conectado ao Firestore:
  // 1. Registrar venda
  // 2. Baixar estoque
  // 3. Registrar log/timestamp
  // 4. Atualizar CRM

  console.log("Venda simulada:", {
    cliente: customerName,
    pagamento: payment,
    total,
    itens: cart
  });

  cart = [];
  renderCart();
  closeModal(checkoutModal);
  document.getElementById("customerName").value = "";

  showToast(`Venda finalizada via ${payment}. Total: ${brl(total)}`);
});

[productModal, checkoutModal].forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal(modal);
  });
});

document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  closeModal(productModal);
  closeModal(checkoutModal);
});

renderProducts();
renderCart();
