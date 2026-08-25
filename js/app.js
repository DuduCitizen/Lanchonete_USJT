import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


// ======================================================
// PRODUTOS
// ======================================================

let products = [];


// ======================================================
// ESTADO DA APLICAÇÃO
// ======================================================

let cart = [];
let activeCategory = "Todos";
let selectedProduct = null;
let modalQuantity = 1;


// ======================================================
// ELEMENTOS DO HTML
// ======================================================

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


// ======================================================
// FORMATAÇÃO DE PREÇO
// ======================================================

const brl = value => {
  const price = Number(value) || 0;

  return price.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
};


// ======================================================
// CARREGAR PRODUTOS DO FIRESTORE
// ======================================================

async function loadProducts() {

  try {

    console.log("Carregando produtos do Firebase...");

    const productsCollection = collection(
      window.db,
      "produtos"
    );

    const snapshot = await getDocs(
      productsCollection
    );


    products = snapshot.docs.map(doc => {

      const data = doc.data();

      return {

        // ID do documento no Firebase
        id: doc.id,

        // Informações do produto
        name: String(data.name || "Produto sem nome"),

        category: String(data.category || "Outros"),

        price: Number(data.price) || 0,

        description: String(
          data.description || "Sem descrição disponível."
        ),

        emoji: String(
          data.emoji || "🍔"
        ),

        // Controle de disponibilidade
        available: data.available !== false,

        // Controle de estoque
        stock: Number(data.stock) || 0

      };

    });


    console.log(
      "Produtos vindos do Firebase:",
      products
    );


    renderProducts();

  } catch (error) {

    console.error(
      "Erro ao carregar produtos:",
      error
    );

    showToast(
      "Erro ao carregar os produtos."
    );

  }
}


// ======================================================
// RENDERIZAR PRODUTOS
// ======================================================

function renderProducts() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();


  const filtered = products.filter(product => {

    // --------------------------------------------------
    // PRODUTO INDISPONÍVEL
    // --------------------------------------------------

    if (product.available === false) {
      return false;
    }


    // --------------------------------------------------
    // PRODUTO SEM ESTOQUE
    // --------------------------------------------------

    if (product.stock <= 0) {
      return false;
    }


    // --------------------------------------------------
    // CATEGORIA
    // --------------------------------------------------

    const category =
      String(product.category || "");


    const matchesCategory =
      activeCategory === "Todos" ||
      category === activeCategory;


    // --------------------------------------------------
    // PESQUISA
    // --------------------------------------------------

    const name =
      String(product.name || "");


    const description =
      String(product.description || "");


    const matchesSearch =
      name.toLowerCase().includes(search) ||
      description.toLowerCase().includes(search);


    return matchesCategory && matchesSearch;

  });


  // ----------------------------------------------------
  // HTML DOS PRODUTOS
  // ----------------------------------------------------

  productGrid.innerHTML = filtered.map(product => `

    <article class="product-card">

      <div class="product-image">
        ${product.emoji}
      </div>

      <div class="product-body">

        <span class="product-category">
          ${String(product.category).toUpperCase()}
        </span>

        <h4>${product.name}</h4>

        <p>${product.description}</p>

        <div class="product-footer">

          <span class="price">
            ${brl(product.price)}
          </span>

          <div class="product-actions">

            <button
              class="detail-button"
              data-action="details"
              data-id="${product.id}">
              Ver
            </button>

            <button
              class="add-button"
              data-action="add"
              data-id="${product.id}">
              + Adicionar
            </button>

          </div>

        </div>

      </div>

    </article>

  `).join("");


  // ----------------------------------------------------
  // CONTADOR
  // ----------------------------------------------------

  productResult.textContent =
    `${filtered.length} produto${filtered.length === 1 ? "" : "s"}`;


  // ----------------------------------------------------
  // ESTADO VAZIO
  // ----------------------------------------------------

  emptyState.classList.toggle(
    "hidden",
    filtered.length !== 0
  );


  productGrid.classList.toggle(
    "hidden",
    filtered.length === 0
  );

}


// ======================================================
// VERIFICAR SE PRODUTO PODE SER ADICIONADO
// ======================================================

function canAddProduct(product, quantity = 1) {

  if (!product) {
    return false;
  }


  if (product.available === false) {

    showToast(
      `${product.name} está indisponível.`
    );

    return false;
  }


  if (product.stock <= 0) {

    showToast(
      `${product.name} está sem estoque.`
    );

    return false;
  }


  const existing = cart.find(
    item => item.id === product.id
  );


  const currentQuantity =
    existing ? existing.quantity : 0;


  if (
    currentQuantity + quantity >
    product.stock
  ) {

    showToast(
      `Estoque insuficiente. Disponível: ${product.stock}.`
    );

    return false;
  }


  return true;

}


// ======================================================
// ADICIONAR AO CARRINHO
// ======================================================

function addToCart(productId, quantity = 1) {

  const product = products.find(
    item => item.id === productId
  );


  if (!product) {
    return;
  }


  // Verifica disponibilidade e estoque
  if (!canAddProduct(product, quantity)) {
    return;
  }


  const existing = cart.find(
    item => item.id === productId
  );


  if (existing) {

    existing.quantity += quantity;

  } else {

    cart.push({

      ...product,

      quantity

    });

  }


  renderCart();


  showToast(
    `${product.name} adicionado ao pedido.`
  );

}


// ======================================================
// ALTERAR QUANTIDADE
// ======================================================

function updateQuantity(productId, delta) {

  const item = cart.find(
    product => product.id === productId
  );


  if (!item) {
    return;
  }


  // Aumentar quantidade
  if (delta > 0) {

    if (!canAddProduct(item, delta)) {
      return;
    }

  }


  item.quantity += delta;


  // Remover quando chegar a zero
  if (item.quantity <= 0) {

    cart = cart.filter(
      product => product.id !== productId
    );

  }


  renderCart();

}


// ======================================================
// RENDERIZAR CARRINHO
// ======================================================

function renderCart() {

  if (cart.length === 0) {

    cartItems.innerHTML = `

      <div class="cart-empty">

        <div>🛒</div>

        <strong>
          Seu carrinho está vazio
        </strong>

        <span>
          Adicione produtos do cardápio.
        </span>

      </div>

    `;

  } else {

    cartItems.innerHTML = cart.map(item => `

      <div class="cart-item">

        <div class="cart-item-image">
          ${item.emoji}
        </div>

        <div class="cart-item-info">

          <strong>
            ${item.name}
          </strong>

          <small>
            ${brl(item.price)} cada
          </small>

          <div class="qty-controls">

            <button
              data-cart-action="decrease"
              data-id="${item.id}">
              −
            </button>

            <span>
              ${item.quantity}
            </span>

            <button
              data-cart-action="increase"
              data-id="${item.id}">
              +
            </button>

          </div>

        </div>

        <div class="cart-item-price">
          ${brl(item.price * item.quantity)}
        </div>

      </div>

    `).join("");

  }


  // ----------------------------------------------------
  // VALORES
  // ----------------------------------------------------

  const subtotal = cart.reduce(
    (sum, item) =>
      sum +
      (Number(item.price) || 0) *
      item.quantity,
    0
  );


  const discount = 0;


  const total =
    subtotal - discount;


  const quantity =
    cart.reduce(
      (sum, item) =>
        sum + item.quantity,
      0
    );


  // ----------------------------------------------------
  // ATUALIZAR HTML
  // ----------------------------------------------------

  subtotalEl.textContent =
    brl(subtotal);


  discountEl.textContent =
    brl(discount);


  totalEl.textContent =
    brl(total);


  cartCount.textContent =
    quantity;


  checkoutButton.disabled =
    cart.length === 0;

}


// ======================================================
// MODAL DO PRODUTO
// ======================================================

function openProductModal(productId) {

  selectedProduct = products.find(
    item => item.id === productId
  );


  if (!selectedProduct) {
    return;
  }


  // Segurança extra
  if (
    selectedProduct.available === false ||
    selectedProduct.stock <= 0
  ) {

    showToast(
      `${selectedProduct.name} está indisponível.`
    );

    return;
  }


  modalQuantity = 1;


  document.getElementById(
    "modalProductImage"
  ).textContent =
    selectedProduct.emoji;


  document.getElementById(
    "modalProductCategory"
  ).textContent =
    String(
      selectedProduct.category || "Outros"
    ).toUpperCase();


  document.getElementById(
    "modalProductName"
  ).textContent =
    selectedProduct.name;


  document.getElementById(
    "modalProductDescription"
  ).textContent =
    selectedProduct.description;


  document.getElementById(
    "modalProductPrice"
  ).textContent =
    brl(selectedProduct.price);


  document.getElementById(
    "modalProductCode"
  ).textContent =
    `Código: ${selectedProduct.id}`;


  document.getElementById(
    "modalQuantity"
  ).textContent =
    modalQuantity;


  productModal.classList.remove(
    "hidden"
  );

}


// ======================================================
// FECHAR MODAL
// ======================================================

function closeModal(modal) {

  modal.classList.add(
    "hidden"
  );

}


// ======================================================
// TOAST
// ======================================================

function showToast(message) {

  toast.textContent =
    message;


  toast.classList.remove(
    "hidden"
  );


  clearTimeout(
    showToast.timer
  );


  showToast.timer =
    setTimeout(
      () =>
        toast.classList.add("hidden"),
      2400
    );

}


// ======================================================
// CATEGORIAS
// ======================================================

document
  .getElementById("categoryButtons")
  .addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          "[data-category]"
        );


      if (!button) {
        return;
      }


      activeCategory =
        button.dataset.category;


      document
        .querySelectorAll(".category")
        .forEach(item => {

          item.classList.toggle(
            "active",
            item === button
          );

        });


      renderProducts();

    }
  );


// ======================================================
// PESQUISA
// ======================================================

searchInput.addEventListener(
  "input",
  renderProducts
);


// ======================================================
// CLIQUES NOS PRODUTOS
// ======================================================

productGrid.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-action]"
      );


    if (!button) {
      return;
    }


    const id =
      button.dataset.id;


    if (
      button.dataset.action ===
      "details"
    ) {

      openProductModal(id);

    }


    if (
      button.dataset.action ===
      "add"
    ) {

      addToCart(id);

    }

  }
);


// ======================================================
// CLIQUES NO CARRINHO
// ======================================================

cartItems.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-cart-action]"
      );


    if (!button) {
      return;
    }


    const delta =
      button.dataset.cartAction ===
      "increase"
        ? 1
        : -1;


    updateQuantity(
      button.dataset.id,
      delta
    );

  }
);


// ======================================================
// LIMPAR CARRINHO
// ======================================================

document
  .getElementById("clearCartButton")
  .addEventListener(
    "click",
    () => {

      if (!cart.length) {
        return;
      }


      cart = [];


      renderCart();


      showToast(
        "Carrinho limpo."
      );

    }
  );


// ======================================================
// ABRIR CARRINHO
// ======================================================

document
  .getElementById("openCartButton")
  .addEventListener(
    "click",
    () => {

      document
        .getElementById("cartPanel")
        .scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

    }
  );


// ======================================================
// FECHAR MODAL DO PRODUTO
// ======================================================

document
  .getElementById("closeProductModal")
  .addEventListener(
    "click",
    () => {

      closeModal(
        productModal
      );

    }
  );


// ======================================================
// DIMINUIR QUANTIDADE NO MODAL
// ======================================================

document
  .getElementById("modalDecrease")
  .addEventListener(
    "click",
    () => {

      modalQuantity =
        Math.max(
          1,
          modalQuantity - 1
        );


      document.getElementById(
        "modalQuantity"
      ).textContent =
        modalQuantity;

    }
  );


// ======================================================
// AUMENTAR QUANTIDADE NO MODAL
// ======================================================

document
  .getElementById("modalIncrease")
  .addEventListener(
    "click",
    () => {

      if (!selectedProduct) {
        return;
      }


      // Não permite ultrapassar o estoque
      const existing = cart.find(
        item =>
          item.id ===
          selectedProduct.id
      );


      const alreadyInCart =
        existing
          ? existing.quantity
          : 0;


      if (
        alreadyInCart +
        modalQuantity >=
        selectedProduct.stock
      ) {

        showToast(
          `Estoque máximo: ${selectedProduct.stock}.`
        );

        return;
      }


      modalQuantity++;


      document.getElementById(
        "modalQuantity"
      ).textContent =
        modalQuantity;

    }
  );


// ======================================================
// ADICIONAR PELO MODAL
// ======================================================

document
  .getElementById("modalAddButton")
  .addEventListener(
    "click",
    () => {

      if (!selectedProduct) {
        return;
      }


      addToCart(
        selectedProduct.id,
        modalQuantity
      );


      closeModal(
        productModal
      );

    }
  );


// ======================================================
// ABRIR CHECKOUT
// ======================================================

checkoutButton.addEventListener(
  "click",
  () => {

    if (!cart.length) {
      return;
    }


    const total =
      cart.reduce(
        (sum, item) =>
          sum +
          (Number(item.price) || 0) *
          item.quantity,
        0
      );


    document.getElementById(
      "checkoutTotal"
    ).textContent =
      brl(total);


    checkoutModal.classList.remove(
      "hidden"
    );

  }
);


// ======================================================
// FECHAR CHECKOUT
// ======================================================

document
  .getElementById(
    "closeCheckoutModal"
  )
  .addEventListener(
    "click",
    () => {

      closeModal(
        checkoutModal
      );

    }
  );


// ======================================================
// CONFIRMAR VENDA
// ======================================================

document
  .getElementById(
    "confirmSaleButton"
  )
  .addEventListener(
    "click",
    () => {

      if (!cart.length) {
        return;
      }


      const customerName =
        document
          .getElementById(
            "customerName"
          )
          .value
          .trim()
        ||
        "Cliente não identificado";


      const payment =
        document
          .querySelector(
            'input[name="payment"]:checked'
          )
          .value;


      const total =
        cart.reduce(
          (sum, item) =>
            sum +
            (Number(item.price) || 0) *
            item.quantity,
          0
        );


      console.log(
        "Venda simulada:",
        {
          cliente:
            customerName,

          pagamento:
            payment,

          total:
            total,

          itens:
            cart
        }
      );


      // ----------------------------------------------
      // IMPORTANTE:
      // A venda ainda NÃO é salva no Firebase.
      //
      // Isso será implementado no próximo passo.
      // ----------------------------------------------


      cart = [];


      renderCart();


      closeModal(
        checkoutModal
      );


      document.getElementById(
        "customerName"
      ).value = "";


      showToast(
        `Venda finalizada via ${payment}. Total: ${brl(total)}`
      );

    }
  );


// ======================================================
// FECHAR MODAIS CLICANDO FORA
// ======================================================

[
  productModal,
  checkoutModal
].forEach(
  modal => {

    modal.addEventListener(
      "click",
      event => {

        if (
          event.target ===
          modal
        ) {

          closeModal(
            modal
          );

        }

      }
    );

  }
);


// ======================================================
// FECHAR MODAIS COM ESC
// ======================================================

document.addEventListener(
  "keydown",
  event => {

    if (
      event.key !==
      "Escape"
    ) {
      return;
    }


    closeModal(
      productModal
    );


    closeModal(
      checkoutModal
    );

  }
);


// ======================================================
// INICIALIZAÇÃO
// ======================================================

loadProducts();

renderCart();
