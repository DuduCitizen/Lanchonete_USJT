import {
  collection,
  getDocs,
  doc,
  serverTimestamp,
  runTransaction,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


// ======================================================
// PRODUTOS
// ======================================================

let products = [];


// ======================================================
// VENDAS
// ======================================================

let sales = [];


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

const productGrid =
  document.getElementById("productGrid");

const emptyState =
  document.getElementById("emptyState");

const searchInput =
  document.getElementById("searchInput");

const productResult =
  document.getElementById("productResult");

const cartItems =
  document.getElementById("cartItems");

const cartCount =
  document.getElementById("cartCount");

const subtotalEl =
  document.getElementById("subtotal");

const discountEl =
  document.getElementById("discount");

const totalEl =
  document.getElementById("total");

const checkoutButton =
  document.getElementById("checkoutButton");

const toast =
  document.getElementById("toast");

const productModal =
  document.getElementById("productModal");

const checkoutModal =
  document.getElementById("checkoutModal");

const saleDetailsModal =
  document.getElementById("saleDetailsModal");


// ======================================================
// FORMATAÇÃO
// ======================================================

const brl = value => {

  const price =
    Number(value) || 0;

  return price.toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  );

};


function formatDate(timestamp) {

  if (!timestamp) {
    return "Data não disponível";
  }


  let date;


  if (
    timestamp &&
    typeof timestamp.toDate === "function"
  ) {

    date =
      timestamp.toDate();

  } else if (
    timestamp instanceof Date
  ) {

    date =
      timestamp;

  } else {

    date =
      new Date(timestamp);

  }


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "Data inválida";

  }


  return date.toLocaleString(
    "pt-BR",
    {
      dateStyle: "short",
      timeStyle: "short"
    }
  );

}


// ======================================================
// CARREGAR PRODUTOS
// ======================================================

async function loadProducts() {

  try {

    console.log(
      "Carregando produtos do Firebase..."
    );


    const productsCollection =
      collection(
        window.db,
        "produtos"
      );


    const snapshot =
      await getDocs(
        productsCollection
      );


    products =
      snapshot.docs.map(
        documentSnapshot => {

          const data =
            documentSnapshot.data();


          return {

            id:
              documentSnapshot.id,

            name:
              String(
                data.name ||
                "Produto sem nome"
              ),

            category:
              String(
                data.category ||
                "Outros"
              ),

            price:
              Number(
                data.price
              ) || 0,

            description:
              String(
                data.description ||
                "Sem descrição disponível."
              ),

            emoji:
              String(
                data.image ||
                data.emoji ||
                "🍔"
              ),

            available:
              data.available === true,

            stock:
              Number(
                data.stock
              ) || 0

          };

        }
      );


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
// CARREGAR HISTÓRICO DE VENDAS
// ======================================================

async function loadSales() {

  try {

    console.log(
      "Carregando histórico de vendas..."
    );


    const salesCollection =
      collection(
        window.db,
        "vendas"
      );


    let snapshot;


    try {

      const salesQuery =
        query(
          salesCollection,
          orderBy(
            "createdAt",
            "desc"
          )
        );


      snapshot =
        await getDocs(
          salesQuery
        );

    } catch (orderError) {

      console.warn(
        "Não foi possível ordenar pelo createdAt. Carregando sem ordenação.",
        orderError
      );


      snapshot =
        await getDocs(
          salesCollection
        );

    }


    sales =
      snapshot.docs.map(
        documentSnapshot => {

          const data =
            documentSnapshot.data();


          return {

            id:
              documentSnapshot.id,

            customerName:
              String(
                data.customerName ||
                "Cliente não identificado"
              ),

            payment:
              String(
                data.payment ||
                "Não informado"
              ),

            subtotal:
              Number(
                data.subtotal
              ) || 0,

            discount:
              Number(
                data.discount
              ) || 0,

            total:
              Number(
                data.total
              ) || 0,

            items:
              Array.isArray(
                data.items
              )
                ? data.items
                : [],

            createdAt:
              data.createdAt || null,

            status:
              String(
                data.status ||
                "finalizada"
              )

          };

        }
      );


    // ----------------------------------------------------
    // FALLBACK DE ORDENAÇÃO
    // ----------------------------------------------------

    sales.sort(
      (a, b) => {

        const dateA =
          getTimestampMillis(
            a.createdAt
          );

        const dateB =
          getTimestampMillis(
            b.createdAt
          );

        return dateB - dateA;

      }
    );


    console.log(
      "Vendas carregadas:",
      sales
    );


    renderSales();


  } catch (error) {

    console.error(
      "Erro ao carregar histórico:",
      error
    );


    showToast(
      "Erro ao carregar o histórico de vendas."
    );

  }

}


// ======================================================
// CONVERTER TIMESTAMP PARA MILISSEGUNDOS
// ======================================================

function getTimestampMillis(
  timestamp
) {

  if (!timestamp) {
    return 0;
  }


  if (
    typeof timestamp.toMillis ===
    "function"
  ) {

    return timestamp.toMillis();

  }


  if (
    typeof timestamp.toDate ===
    "function"
  ) {

    return timestamp.toDate().getTime();

  }


  const date =
    new Date(timestamp);


  return Number.isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();

}


// ======================================================
// RENDERIZAR PRODUTOS
// ======================================================

function renderProducts() {

  const search =
    searchInput.value
      .trim()
      .toLowerCase();


  const filtered =
    products.filter(
      product => {

        if (
          product.available !== true
        ) {
          return false;
        }


        if (
          product.stock <= 0
        ) {
          return false;
        }


        const category =
          String(
            product.category || ""
          );


        const matchesCategory =
          activeCategory === "Todos" ||
          category === activeCategory;


        const name =
          String(
            product.name || ""
          );


        const description =
          String(
            product.description || ""
          );


        const matchesSearch =
          name
            .toLowerCase()
            .includes(search) ||

          description
            .toLowerCase()
            .includes(search);


        return (
          matchesCategory &&
          matchesSearch
        );

      }
    );


  productGrid.innerHTML =
    filtered
      .map(
        product => `

          <article class="product-card">

            <div class="product-image">
              ${product.emoji}
            </div>

            <div class="product-body">

              <span class="product-category">
                ${String(
                  product.category
                ).toUpperCase()}
              </span>

              <h4>
                ${product.name}
              </h4>

              <p>
                ${product.description}
              </p>

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

        `
      )
      .join("");


  productResult.textContent =
    `${filtered.length} produto${
      filtered.length === 1
        ? ""
        : "s"
    }`;


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
// VERIFICAR DISPONIBILIDADE
// ======================================================

function canAddProduct(
  product,
  quantity = 1
) {

  if (!product) {
    return false;
  }


  if (
    product.available !== true
  ) {

    showToast(
      `${product.name} está indisponível.`
    );

    return false;

  }


  if (
    product.stock <= 0
  ) {

    showToast(
      `${product.name} está sem estoque.`
    );

    return false;

  }


  const existing =
    cart.find(
      item =>
        item.id === product.id
    );


  const currentQuantity =
    existing
      ? existing.quantity
      : 0;


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

function addToCart(
  productId,
  quantity = 1
) {

  const product =
    products.find(
      item =>
        item.id === productId
    );


  if (!product) {
    return;
  }


  if (
    !canAddProduct(
      product,
      quantity
    )
  ) {
    return;
  }


  const existing =
    cart.find(
      item =>
        item.id === productId
    );


  if (existing) {

    existing.quantity +=
      quantity;

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

function updateQuantity(
  productId,
  delta
) {

  const item =
    cart.find(
      product =>
        product.id === productId
    );


  if (!item) {
    return;
  }


  if (
    delta > 0 &&
    !canAddProduct(
      item,
      delta
    )
  ) {

    return;

  }


  item.quantity +=
    delta;


  if (
    item.quantity <= 0
  ) {

    cart =
      cart.filter(
        product =>
          product.id !== productId
      );

  }


  renderCart();

}


// ======================================================
// RENDERIZAR CARRINHO
// ======================================================

function renderCart() {

  if (
    cart.length === 0
  ) {

    cartItems.innerHTML = `

      <div class="cart-empty">

        <div>
          🛒
        </div>

        <strong>
          Seu carrinho está vazio
        </strong>

        <span>
          Adicione produtos do cardápio.
        </span>

      </div>

    `;

  } else {

    cartItems.innerHTML =
      cart
        .map(
          item => `

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
                ${brl(
                  item.price *
                  item.quantity
                )}
              </div>

            </div>

          `
        )
        .join("");

  }


  const subtotal =
    cart.reduce(
      (sum, item) =>
        sum +
        (
          Number(item.price) || 0
        ) *
        item.quantity,
      0
    );


  const discount =
    0;


  const total =
    subtotal -
    discount;


  const quantity =
    cart.reduce(
      (sum, item) =>
        sum + item.quantity,
      0
    );


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

function openProductModal(
  productId
) {

  selectedProduct =
    products.find(
      item =>
        item.id === productId
    );


  if (!selectedProduct) {
    return;
  }


  if (
    selectedProduct.available !== true
  ) {

    showToast(
      `${selectedProduct.name} está indisponível.`
    );

    return;

  }


  if (
    selectedProduct.stock <= 0
  ) {

    showToast(
      `${selectedProduct.name} está sem estoque.`
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
      selectedProduct.category ||
      "Outros"
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
    brl(
      selectedProduct.price
    );


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

function closeModal(
  modal
) {

  modal.classList.add(
    "hidden"
  );

}


// ======================================================
// TOAST
// ======================================================

function showToast(
  message
) {

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
      () => {

        toast.classList.add(
          "hidden"
        );

      },
      3000
    );

}


// ======================================================
// RENDERIZAR HISTÓRICO
// ======================================================

function renderSales() {

  const searchInputHistory =
    document.getElementById(
      "historySearchInput"
    );


  const paymentFilter =
    document.getElementById(
      "historyPaymentFilter"
    );


  const search =
    searchInputHistory
      ? searchInputHistory.value
          .trim()
          .toLowerCase()
      : "";


  const payment =
    paymentFilter
      ? paymentFilter.value
      : "Todos";


  const filteredSales =
    sales.filter(
      sale => {

        const matchesCustomer =
          sale.customerName
            .toLowerCase()
            .includes(search);


        const matchesPayment =
          payment === "Todos" ||
          sale.payment === payment;


        return (
          matchesCustomer &&
          matchesPayment
        );

      }
    );


  const salesList =
    document.getElementById(
      "salesList"
    );


  const salesEmptyState =
    document.getElementById(
      "salesEmptyState"
    );


  const historyCount =
    document.getElementById(
      "historyCount"
    );


  const historyTotal =
    document.getElementById(
      "historyTotal"
    );


  // ====================================================
  // TOTAL
  // ====================================================

  const total =
    filteredSales.reduce(
      (sum, sale) =>
        sum +
        (
          Number(sale.total) || 0
        ),
      0
    );


  historyCount.textContent =
    filteredSales.length;


  historyTotal.textContent =
    brl(total);


  // ====================================================
  // ESTADO VAZIO
  // ====================================================

  if (
    filteredSales.length === 0
  ) {

    salesList.innerHTML = "";

    salesEmptyState.classList.remove(
      "hidden"
    );

    return;

  }


  salesEmptyState.classList.add(
    "hidden"
  );


  // ====================================================
  // LISTA
  // ====================================================

  salesList.innerHTML =
    filteredSales
      .map(
        sale => {

          const itemsCount =
            sale.items.reduce(
              (sum, item) =>
                sum +
                (
                  Number(
                    item.quantity
                  ) || 0
                ),
              0
            );


          return `

            <article
              class="sale-card"
              data-sale-id="${sale.id}">

              <div class="sale-card-main">

                <div class="sale-icon">
                  🧾
                </div>

                <div class="sale-info">

                  <strong>
                    ${escapeHtml(
                      sale.customerName
                    )}
                  </strong>

                  <span>
                    ${formatDate(
                      sale.createdAt
                    )}
                  </span>

                </div>

              </div>


              <div class="sale-card-middle">

                <span class="sale-payment">
                  ${escapeHtml(
                    sale.payment
                  )}
                </span>

                <span>
                  ${itemsCount}
                  ${
                    itemsCount === 1
                      ? " item"
                      : " itens"
                  }
                </span>

              </div>


              <div class="sale-card-total">

                <strong>
                  ${brl(
                    sale.total
                  )}
                </strong>

                <button
                  class="detail-button"
                  data-sale-action="details"
                  data-sale-id="${sale.id}"
                  type="button">

                  Ver detalhes

                </button>

              </div>

            </article>

          `;

        }
      )
      .join("");

}


// ======================================================
// ESCAPAR HTML
// ======================================================

function escapeHtml(
  value
) {

  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );

}


// ======================================================
// ABRIR DETALHES DA VENDA
// ======================================================

function openSaleDetails(
  saleId
) {

  const sale =
    sales.find(
      item =>
        item.id === saleId
    );


  if (!sale) {
    return;
  }


  document.getElementById(
    "detailCustomer"
  ).textContent =
    sale.customerName;


  document.getElementById(
    "detailPayment"
  ).textContent =
    sale.payment;


  document.getElementById(
    "detailDate"
  ).textContent =
    formatDate(
      sale.createdAt
    );


  document.getElementById(
    "detailTotal"
  ).textContent =
    brl(
      sale.total
    );


  const itemsContainer =
    document.getElementById(
      "saleDetailItems"
    );


  itemsContainer.innerHTML =
    sale.items
      .map(
        item => `

          <div class="sale-detail-item">

            <div>

              <strong>
                ${escapeHtml(
                  item.name
                )}
              </strong>

              <span>
                ${item.quantity} ×
                ${brl(item.price)}
              </span>

            </div>

            <strong>
              ${brl(
                item.subtotal
              )}
            </strong>

          </div>

        `
      )
      .join("");


  saleDetailsModal.classList.remove(
    "hidden"
  );

}


// ======================================================
// CATEGORIAS
// ======================================================

document
  .getElementById(
    "categoryButtons"
  )
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
        .querySelectorAll(
          ".category"
        )
        .forEach(
          item => {

            item.classList.toggle(
              "active",
              item === button
            );

          }
        );


      renderProducts();

    }
  );


// ======================================================
// PESQUISA DE PRODUTOS
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

      openProductModal(
        id
      );

    }


    if (
      button.dataset.action ===
      "add"
    ) {

      addToCart(
        id
      );

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
  .getElementById(
    "clearCartButton"
  )
  .addEventListener(
    "click",
    () => {

      if (
        !cart.length
      ) {
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
// IR PARA O CARRINHO
// ======================================================

document
  .getElementById(
    "openCartButton"
  )
  .addEventListener(
    "click",
    () => {

      document
        .getElementById(
          "cartPanel"
        )
        .scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

    }
  );


// ======================================================
// NAVEGAÇÃO PDV
// ======================================================

document
  .getElementById(
    "goToPdvButton"
  )
  .addEventListener(
    "click",
    () => {

      document
        .getElementById(
          "pdvSection"
        )
        .classList.remove(
          "hidden"
        );


      document
        .getElementById(
          "historySection"
        )
        .classList.add(
          "hidden"
        );


      document
        .getElementById(
          "goToPdvButton"
        )
        .classList.add(
          "active"
        );


      document
        .getElementById(
          "goToHistoryButton"
        )
        .classList.remove(
          "active"
        );

    }
  );


// ======================================================
// NAVEGAÇÃO HISTÓRICO
// ======================================================

document
  .getElementById(
    "goToHistoryButton"
  )
  .addEventListener(
    "click",
    async () => {

      document
        .getElementById(
          "pdvSection"
        )
        .classList.add(
          "hidden"
        );


      document
        .getElementById(
          "historySection"
        )
        .classList.remove(
          "hidden"
        );


      document
        .getElementById(
          "goToPdvButton"
        )
        .classList.remove(
          "active"
        );


      document
        .getElementById(
          "goToHistoryButton"
        )
        .classList.add(
          "active"
        );


      await loadSales();

    }
  );


// ======================================================
// ATUALIZAR HISTÓRICO
// ======================================================

document
  .getElementById(
    "refreshHistoryButton"
  )
  .addEventListener(
    "click",
    async () => {

      await loadSales();


      showToast(
        "Histórico atualizado."
      );

    }
  );


// ======================================================
// FILTRO DO HISTÓRICO
// ======================================================

document
  .getElementById(
    "historySearchInput"
  )
  .addEventListener(
    "input",
    renderSales
  );


document
  .getElementById(
    "historyPaymentFilter"
  )
  .addEventListener(
    "change",
    renderSales
  );


// ======================================================
// CLIQUES NO HISTÓRICO
// ======================================================

document
  .getElementById(
    "salesList"
  )
  .addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          "[data-sale-action]"
        );


      if (!button) {
        return;
      }


      if (
        button.dataset.saleAction ===
        "details"
      ) {

        openSaleDetails(
          button.dataset.saleId
        );

      }

    }
  );


// ======================================================
// FECHAR MODAL DO PRODUTO
// ======================================================

document
  .getElementById(
    "closeProductModal"
  )
  .addEventListener(
    "click",
    () => {

      closeModal(
        productModal
      );

    }
  );


// ======================================================
// QUANTIDADE DO MODAL
// ======================================================

document
  .getElementById(
    "modalDecrease"
  )
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
// AUMENTAR QUANTIDADE
// ======================================================

document
  .getElementById(
    "modalIncrease"
  )
  .addEventListener(
    "click",
    () => {

      if (!selectedProduct) {
        return;
      }


      const existing =
        cart.find(
          item =>
            item.id ===
            selectedProduct.id
        );


      const alreadyInCart =
        existing
          ? existing.quantity
          : 0;


      const newTotal =
        alreadyInCart +
        modalQuantity +
        1;


      if (
        newTotal >
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
  .getElementById(
    "modalAddButton"
  )
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

    if (
      !cart.length
    ) {
      return;
    }


    const total =
      cart.reduce(
        (sum, item) =>
          sum +
          (
            Number(item.price) || 0
          ) *
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
// SALVAR VENDA + BAIXAR ESTOQUE
// ======================================================

async function finalizeSale() {

  if (
    !cart.length
  ) {

    showToast(
      "O carrinho está vazio."
    );

    return;

  }


  const customerName =
    document
      .getElementById(
        "customerName"
      )
      .value
      .trim() ||
    "Cliente não identificado";


  const paymentInput =
    document.querySelector(
      'input[name="payment"]:checked'
    );


  if (!paymentInput) {

    showToast(
      "Selecione uma forma de pagamento."
    );

    return;

  }


  const payment =
    paymentInput.value;


  const total =
    cart.reduce(
      (sum, item) =>
        sum +
        (
          Number(item.price) || 0
        ) *
        item.quantity,
      0
    );


  const confirmButton =
    document.getElementById(
      "confirmSaleButton"
    );


  confirmButton.disabled =
    true;


  confirmButton.textContent =
    "Processando venda...";


  try {

    console.log(
      "Iniciando finalização da venda..."
    );


    console.log(
      "Itens:",
      cart
    );


    const saleCollection =
      collection(
        window.db,
        "vendas"
      );


    const saleRef =
      doc(
        saleCollection
      );


    await runTransaction(
      window.db,
      async transaction => {

        const productReferences =
          cart.map(
            item => ({

              item,

              reference:
                doc(
                  window.db,
                  "produtos",
                  item.id
                )

            })
          );


        const productSnapshots =
          [];


        // ----------------------------------------------
        // LER PRODUTOS
        // ----------------------------------------------

        for (
          const productData
          of productReferences
        ) {

          const snapshot =
            await transaction.get(
              productData.reference
            );


          productSnapshots.push({

            ...productData,

            snapshot

          });

        }


        // ----------------------------------------------
        // VALIDAR ESTOQUE
        // ----------------------------------------------

        for (
          const productData
          of productSnapshots
        ) {

          const {
            item,
            snapshot
          } = productData;


          if (
            !snapshot.exists()
          ) {

            throw new Error(
              `O produto ${item.name} não existe mais no Firebase.`
            );

          }


          const data =
            snapshot.data();


          const currentStock =
            Number(
              data.stock
            ) || 0;


          const currentAvailable =
            data.available === true;


          if (
            !currentAvailable
          ) {

            throw new Error(
              `${item.name} está indisponível.`
            );

          }


          if (
            currentStock <
            item.quantity
          ) {

            throw new Error(
              `Estoque insuficiente para ${item.name}. Disponível: ${currentStock}.`
            );

          }

        }


        // ----------------------------------------------
        // BAIXAR ESTOQUE
        // ----------------------------------------------

        for (
          const productData
          of productSnapshots
        ) {

          const {
            item,
            snapshot
          } = productData;


          const data =
            snapshot.data();


          const currentStock =
            Number(
              data.stock
            ) || 0;


          const newStock =
            currentStock -
            item.quantity;


          transaction.update(
            productData.reference,
            {
              stock: newStock
            }
          );

        }


        // ----------------------------------------------
        // ITENS DA VENDA
        // ----------------------------------------------

        const saleItems =
          cart.map(
            item => ({

              productId:
                item.id,

              name:
                item.name,

              price:
                Number(
                  item.price
                ) || 0,

              quantity:
                item.quantity,

              subtotal:
                (
                  Number(
                    item.price
                  ) || 0
                ) *
                item.quantity

            })
          );


        // ----------------------------------------------
        // SALVAR VENDA
        // ----------------------------------------------

        transaction.set(
          saleRef,
          {

            customerName:

              customerName,

            payment:

              payment,

            subtotal:

              total,

            discount:

              0,

            total:

              total,

            items:

              saleItems,

            createdAt:

              serverTimestamp(),

            status:

              "finalizada"

          }
        );

      }
    );


    console.log(
      "Venda gravada com sucesso!"
    );


    console.log(
      "ID da venda:",
      saleRef.id
    );


    // ==================================================
    // LIMPAR CARRINHO
    // ==================================================

    cart = [];


    renderCart();


    // ==================================================
    // FECHAR CHECKOUT
    // ==================================================

    closeModal(
      checkoutModal
    );


    // ==================================================
    // LIMPAR CLIENTE
    // ==================================================

    document.getElementById(
      "customerName"
    ).value = "";


    // ==================================================
    // ATUALIZAR PRODUTOS
    // ==================================================

    await loadProducts();


    // ==================================================
    // ATUALIZAR HISTÓRICO
    // ==================================================

    await loadSales();


    // ==================================================
    // MENSAGEM
    // ==================================================

    showToast(
      `Venda finalizada! Total: ${brl(total)}`
    );


  } catch (error) {

    console.error(
      "ERRO AO FINALIZAR VENDA:",
      error
    );


    console.error(
      "Código do erro:",
      error.code
    );


    console.error(
      "Mensagem do erro:",
      error.message
    );


    showToast(
      `Não foi possível finalizar a venda: ${error.message}`
    );


  } finally {

    confirmButton.disabled =
      false;


    confirmButton.textContent =
      "Confirmar venda";

  }

}


// ======================================================
// CONFIRMAR VENDA
// ======================================================

document
  .getElementById(
    "confirmSaleButton"
  )
  .addEventListener(
    "click",
    finalizeSale
  );


// ======================================================
// FECHAR DETALHES DA VENDA
// ======================================================

document
  .getElementById(
    "closeSaleDetailsModal"
  )
  .addEventListener(
    "click",
    () => {

      closeModal(
        saleDetailsModal
      );

    }
  );


// ======================================================
// FECHAR MODAIS CLICANDO FORA
// ======================================================

[
  productModal,
  checkoutModal,
  saleDetailsModal
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
// ESC
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


    closeModal(
      saleDetailsModal
    );

  }
);


// ======================================================
// INICIALIZAÇÃO
// ======================================================

loadProducts();

loadSales();

renderCart();
