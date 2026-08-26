import {
  collection,
  getDocs,
  doc,
  serverTimestamp,
  runTransaction
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
// HISTÓRICO DE VENDAS
// ======================================================

let sales = [];
let selectedSale = null;


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


// ======================================================
// ELEMENTOS DO HISTÓRICO
// ======================================================

const historySection =
  document.getElementById("historySection");

const pdvSection =
  document.getElementById("pdvSection");

const openHistoryButton =
  document.getElementById("openHistoryButton");

const backToPdvButton =
  document.getElementById("backToPdvButton");

const historySearchInput =
  document.getElementById("historySearchInput");

const historyDateFilter =
  document.getElementById("historyDateFilter");

const historyPaymentFilter =
  document.getElementById("historyPaymentFilter");

const clearHistoryFilters =
  document.getElementById("clearHistoryFilters");

const salesHistory =
  document.getElementById("salesHistory");

const historyEmptyState =
  document.getElementById("historyEmptyState");

const historyTotalSales =
  document.getElementById("historyTotalSales");

const historyRevenue =
  document.getElementById("historyRevenue");

const historyAverage =
  document.getElementById("historyAverage");

const saleDetailsModal =
  document.getElementById("saleDetailsModal");

const closeSaleDetailsModal =
  document.getElementById("closeSaleDetailsModal");


// ======================================================
// FORMATAÇÃO DE PREÇO
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


// ======================================================
// FORMATAÇÃO DE DATA
// ======================================================

function formatSaleDate(timestamp) {

  if (!timestamp) {
    return "Data não disponível";
  }


  try {

    let date;


    // Firestore Timestamp
    if (
      typeof timestamp.toDate === "function"
    ) {

      date =
        timestamp.toDate();

    }

    // Date normal
    else if (
      timestamp instanceof Date
    ) {

      date =
        timestamp;

    }

    // Timestamp em segundos
    else if (
      timestamp.seconds !== undefined
    ) {

      date =
        new Date(
          timestamp.seconds * 1000
        );

    }

    else {

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
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }
    );

  } catch (error) {

    console.error(
      "Erro ao formatar data:",
      error
    );

    return "Data inválida";

  }

}


// ======================================================
// CONVERTER DATA PARA FILTRO
// ======================================================

function getSaleDate(timestamp) {

  if (!timestamp) {
    return null;
  }


  try {

    if (
      typeof timestamp.toDate === "function"
    ) {

      return timestamp.toDate();

    }


    if (
      timestamp.seconds !== undefined
    ) {

      return new Date(
        timestamp.seconds * 1000
      );

    }


    if (
      timestamp instanceof Date
    ) {

      return timestamp;

    }


    const date =
      new Date(timestamp);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return null;

    }


    return date;

  } catch {

    return null;

  }

}


// ======================================================
// CARREGAR PRODUTOS DO FIRESTORE
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
// VERIFICAR DISPONIBILIDADE E ESTOQUE
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


  if (delta > 0) {

    if (
      !canAddProduct(
        item,
        delta
      )
    ) {
      return;
    }

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


  const discount = 0;


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

function closeModal(modal) {

  if (!modal) {
    return;
  }

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
      () => {

        toast.classList.add(
          "hidden"
        );

      },
      3000
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
// ABRIR CARRINHO
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
// DIMINUIR QUANTIDADE NO MODAL
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
// AUMENTAR QUANTIDADE NO MODAL
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
// SALVAR VENDA E DAR BAIXA NO ESTOQUE
//
// ATENÇÃO:
// A lógica desta função foi preservada.
// A transação continua fazendo:
// 1. leitura dos produtos
// 2. validação do estoque
// 3. baixa do estoque
// 4. criação da venda
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


  // ====================================================
  // CLIENTE
  // ====================================================

  const customerName =
    document
      .getElementById(
        "customerName"
      )
      .value
      .trim() ||
    "Cliente não identificado";


  // ====================================================
  // PAGAMENTO
  // ====================================================

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


  // ====================================================
  // TOTAL
  // ====================================================

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


  // ====================================================
  // DESABILITAR BOTÃO
  // ====================================================

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


    // ==================================================
    // REFERÊNCIA DA COLEÇÃO DE VENDAS
    // ==================================================

    const saleCollection =
      collection(
        window.db,
        "vendas"
      );


    // ==================================================
    // ID DA VENDA
    // ==================================================

    const saleRef =
      doc(
        saleCollection
      );


    // ==================================================
    // TRANSAÇÃO
    // ==================================================

    await runTransaction(
      window.db,
      async transaction => {

        console.log(
          "Iniciando transação..."
        );


        // ----------------------------------------------
        // REFERÊNCIAS DOS PRODUTOS
        // ----------------------------------------------

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


        // ----------------------------------------------
        // PRIMEIRO: LER TODOS OS PRODUTOS
        // ----------------------------------------------

        const productSnapshots = [];


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
        // SEGUNDO: VALIDAR ESTOQUE
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


          console.log(
            `Produto ${item.id}: estoque atual = ${currentStock}`
          );


          // --------------------------------------------
          // VERIFICAR AVAILABLE
          // --------------------------------------------

          if (
            !currentAvailable
          ) {

            throw new Error(
              `${item.name} está indisponível.`
            );

          }


          // --------------------------------------------
          // VERIFICAR ESTOQUE
          // --------------------------------------------

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
        // TERCEIRO: DAR BAIXA NO ESTOQUE
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


          console.log(
            `Atualizando ${item.name}: ${currentStock} → ${newStock}`
          );


          transaction.update(
            productData.reference,
            {
              stock: newStock
            }
          );

        }


        // ----------------------------------------------
        // QUARTO: SALVAR VENDA
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


        console.log(
          "Venda preparada para gravação:",
          saleRef.id
        );

      }
    );


    // ==================================================
    // TRANSAÇÃO CONCLUÍDA
    // ==================================================

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
    // FECHAR MODAL
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
    // RECARREGAR PRODUTOS
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
// ======================================================
// HISTÓRICO DE VENDAS
// ======================================================
// ======================================================


// ======================================================
// CARREGAR VENDAS DO FIRESTORE
// ======================================================

async function loadSales() {

  if (!window.db) {

    console.error(
      "Firebase ainda não foi inicializado."
    );

    return;

  }


  try {

    console.log(
      "Carregando histórico de vendas..."
    );


    salesHistory.innerHTML = `

      <div class="history-loading">

        <div class="history-loading-icon">
          ⏳
        </div>

        <strong>
          Carregando vendas...
        </strong>

        <span>
          Buscando informações no Firebase.
        </span>

      </div>

    `;


    const salesCollection =
      collection(
        window.db,
        "vendas"
      );


    const snapshot =
      await getDocs(
        salesCollection
      );


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


    // ==================================================
    // ORDENAR DA MAIS RECENTE PARA A MAIS ANTIGA
    // ==================================================

    sales.sort(
      (a, b) => {

        const dateA =
          getSaleDate(
            a.createdAt
          );

        const dateB =
          getSaleDate(
            b.createdAt
          );


        if (!dateA && !dateB) {
          return 0;
        }


        if (!dateA) {
          return 1;
        }


        if (!dateB) {
          return -1;
        }


        return (
          dateB.getTime() -
          dateA.getTime()
        );

      }
    );


    console.log(
      "Vendas vindas do Firebase:",
      sales
    );


    renderSalesHistory();


  } catch (error) {

    console.error(
      "Erro ao carregar histórico:",
      error
    );


    salesHistory.innerHTML = `

      <div class="history-loading">

        <div class="history-loading-icon">
          ⚠️
        </div>

        <strong>
          Erro ao carregar vendas
        </strong>

        <span>
          ${error.message}
        </span>

      </div>

    `;


    showToast(
      "Não foi possível carregar o histórico."
    );

  }

}


// ======================================================
// CALCULAR QUANTIDADE TOTAL DE ITENS
// ======================================================

function getSaleItemsQuantity(sale) {

  if (
    !Array.isArray(
      sale.items
    )
  ) {
    return 0;
  }


  return sale.items.reduce(
    (sum, item) =>
      sum +
      (
        Number(
          item.quantity
        ) || 0
      ),
    0
  );

}


// ======================================================
// OBTER ÍCONES DE PAGAMENTO
// ======================================================

function getPaymentIcon(payment) {

  switch (
    String(payment).toLowerCase()
  ) {

    case "pix":
      return "⚡";

    case "dinheiro":
      return "💵";

    case "débito":
    case "debito":
      return "💳";

    case "crédito":
    case "credito":
      return "💳";

    default:
      return "💰";

  }

}


// ======================================================
// RENDERIZAR HISTÓRICO
// ======================================================

function renderSalesHistory() {

  if (
    !salesHistory
  ) {
    return;
  }


  const search =
    historySearchInput
      ? historySearchInput.value
          .trim()
          .toLowerCase()
      : "";


  const selectedDate =
    historyDateFilter
      ? historyDateFilter.value
      : "";


  const selectedPayment =
    historyPaymentFilter
      ? historyPaymentFilter.value
      : "Todos";


  // ==================================================
  // FILTRAR
  // ==================================================

  const filteredSales =
    sales.filter(
      sale => {

        // ----------------------------------------------
        // BUSCA
        // ----------------------------------------------

        let matchesSearch =
          true;


        if (search) {

          const customer =
            String(
              sale.customerName || ""
            ).toLowerCase();


          const saleId =
            String(
              sale.id || ""
            ).toLowerCase();


          const payment =
            String(
              sale.payment || ""
            ).toLowerCase();


          const productNames =
            sale.items
              .map(
                item =>
                  String(
                    item.name || ""
                  ).toLowerCase()
              )
              .join(" ");


          matchesSearch =
            customer.includes(search) ||
            saleId.includes(search) ||
            payment.includes(search) ||
            productNames.includes(search);

        }


        // ----------------------------------------------
        // DATA
        // ----------------------------------------------

        let matchesDate =
          true;


        if (selectedDate) {

          const saleDate =
            getSaleDate(
              sale.createdAt
            );


          if (!saleDate) {

            matchesDate = false;

          } else {

            const year =
              saleDate.getFullYear()
                .toString()
                .padStart(4, "0");


            const month =
              String(
                saleDate.getMonth() + 1
              ).padStart(2, "0");


            const day =
              String(
                saleDate.getDate()
              ).padStart(2, "0");


            const saleDateString =
              `${year}-${month}-${day}`;


            matchesDate =
              saleDateString ===
              selectedDate;

          }

        }


        // ----------------------------------------------
        // PAGAMENTO
        // ----------------------------------------------

        const matchesPayment =
          selectedPayment === "Todos" ||
          sale.payment === selectedPayment;


        return (
          matchesSearch &&
          matchesDate &&
          matchesPayment
        );

      }
    );


  // ==================================================
  // ATUALIZAR INDICADORES
  // ==================================================

  updateHistoryStats(
    filteredSales
  );


  // ==================================================
  // ESTADO VAZIO
  // ==================================================

  if (
    filteredSales.length === 0
  ) {

    salesHistory.innerHTML = "";

    historyEmptyState.classList.remove(
      "hidden"
    );

    return;

  }


  historyEmptyState.classList.add(
    "hidden"
  );


  // ==================================================
  // RENDERIZAR VENDAS
  // ==================================================

  salesHistory.innerHTML =
    filteredSales
      .map(
        sale => {

          const itemsQuantity =
            getSaleItemsQuantity(
              sale
            );


          const paymentIcon =
            getPaymentIcon(
              sale.payment
            );


          const date =
            formatSaleDate(
              sale.createdAt
            );


          const shortId =
            sale.id.length > 10
              ? `${sale.id.substring(0, 10)}...`
              : sale.id;


          return `

            <div
              class="sale-row"
              data-sale-id="${sale.id}">


              <!-- VENDA -->

              <div
                class="sale-cell sale-id-cell"
                data-label="Venda">

                <strong>
                  #${shortId}
                </strong>

                <small>
                  ID da venda
                </small>

              </div>


              <!-- CLIENTE -->

              <div
                class="sale-cell"
                data-label="Cliente">

                <strong>
                  ${escapeHtml(
                    sale.customerName
                  )}
                </strong>

              </div>


              <!-- ITENS -->

              <div
                class="sale-cell"
                data-label="Itens">

                <strong>
                  ${itemsQuantity}
                </strong>

                <small>
                  ${itemsQuantity === 1
                    ? "item"
                    : "itens"}
                </small>

              </div>


              <!-- PAGAMENTO -->

              <div
                class="sale-cell"
                data-label="Pagamento">

                <span class="payment-badge">

                  ${paymentIcon}

                  ${escapeHtml(
                    sale.payment
                  )}

                </span>

              </div>


              <!-- TOTAL -->

              <div
                class="sale-cell sale-total-cell"
                data-label="Total">

                <strong>
                  ${brl(sale.total)}
                </strong>

              </div>


              <!-- DATA -->

              <div
                class="sale-cell sale-date-cell"
                data-label="Data">

                ${date}

              </div>


              <!-- AÇÃO -->

              <div
                class="sale-cell sale-action-cell"
                data-label="Ação">

                <button
                  class="sale-view-button"
                  type="button"
                  data-sale-action="view"
                  data-sale-id="${sale.id}">

                  Ver detalhes

                </button>

              </div>


            </div>

          `;

        }
      )
      .join("");

}


// ======================================================
// ATUALIZAR INDICADORES DO HISTÓRICO
// ======================================================

function updateHistoryStats(
  filteredSales
) {

  const totalSales =
    filteredSales.length;


  const revenue =
    filteredSales.reduce(
      (sum, sale) =>
        sum +
        (
          Number(
            sale.total
          ) || 0
        ),
      0
    );


  const average =
    totalSales > 0
      ? revenue / totalSales
      : 0;


  historyTotalSales.textContent =
    totalSales;


  historyRevenue.textContent =
    brl(revenue);


  historyAverage.textContent =
    brl(average);

}


// ======================================================
// ESCAPAR HTML
// Evita problemas quando nomes vêm do Firebase.
// ======================================================

function escapeHtml(value) {

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

    showToast(
      "Venda não encontrada."
    );

    return;

  }


  selectedSale =
    sale;


  // ==================================================
  // ID
  // ==================================================

  document.getElementById(
    "saleDetailsTitle"
  ).textContent =
    `Venda #${sale.id.substring(0, 10)}`;


  document.getElementById(
    "saleDetailsId"
  ).textContent =
    sale.id;


  // ==================================================
  // CLIENTE
  // ==================================================

  document.getElementById(
    "saleDetailsCustomer"
  ).textContent =
    sale.customerName;


  // ==================================================
  // PAGAMENTO
  // ==================================================

  document.getElementById(
    "saleDetailsPayment"
  ).textContent =
    `${getPaymentIcon(sale.payment)} ${sale.payment}`;


  // ==================================================
  // DATA
  // ==================================================

  document.getElementById(
    "saleDetailsDate"
  ).textContent =
    formatSaleDate(
      sale.createdAt
    );


  // ==================================================
  // STATUS
  // ==================================================

  const statusElement =
    document.getElementById(
      "saleDetailsStatus"
    );


  statusElement.textContent =
    sale.status;


  statusElement.className =
    "sale-status";


  if (
    sale.status === "finalizada"
  ) {

    statusElement.classList.add(
      "success"
    );

  }


  // ==================================================
  // ITENS
  // ==================================================

  const itemsContainer =
    document.getElementById(
      "saleDetailsItems"
    );


  if (
    !sale.items ||
    sale.items.length === 0
  ) {

    itemsContainer.innerHTML = `

      <div class="sale-no-items">
        Nenhum item registrado.
      </div>

    `;

  } else {

    itemsContainer.innerHTML =
      sale.items
        .map(
          item => {

            const quantity =
              Number(
                item.quantity
              ) || 0;


            const price =
              Number(
                item.price
              ) || 0;


            const subtotal =
              Number(
                item.subtotal
              ) ||
              (
                price *
                quantity
              );


            return `

              <div class="sale-detail-item">

                <div class="sale-detail-item-main">

                  <strong>
                    ${escapeHtml(
                      item.name
                    )}
                  </strong>

                  <span>
                    ${quantity} × ${brl(price)}
                  </span>

                </div>

                <strong>
                  ${brl(subtotal)}
                </strong>

              </div>

            `;

          }
        )
        .join("");

  }


  // ==================================================
  // RESUMO
  // ==================================================

  document.getElementById(
    "saleDetailsSubtotal"
  ).textContent =
    brl(
      sale.subtotal
    );


  document.getElementById(
    "saleDetailsDiscount"
  ).textContent =
    brl(
      sale.discount
    );


  document.getElementById(
    "saleDetailsTotal"
  ).textContent =
    brl(
      sale.total
    );


  // ==================================================
  // ABRIR MODAL
  // ==================================================

  saleDetailsModal.classList.remove(
    "hidden"
  );

}


// ======================================================
// ABRIR HISTÓRICO
// ======================================================

async function openHistory() {

  // Esconde o PDV
  pdvSection.classList.add(
    "hidden"
  );


  // Mostra histórico
  historySection.classList.remove(
    "hidden"
  );


  // Carrega dados atualizados
  await loadSales();


  // Scroll até histórico
  historySection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

}


// ======================================================
// VOLTAR PARA O PDV
// ======================================================

function backToPdv() {

  historySection.classList.add(
    "hidden"
  );


  pdvSection.classList.remove(
    "hidden"
  );


  pdvSection.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

}


// ======================================================
// BOTÃO HISTÓRICO
// ======================================================

if (openHistoryButton) {

  openHistoryButton.addEventListener(
    "click",
    openHistory
  );

}


// ======================================================
// BOTÃO VOLTAR AO PDV
// ======================================================

if (backToPdvButton) {

  backToPdvButton.addEventListener(
    "click",
    backToPdv
  );

}


// ======================================================
// PESQUISA NO HISTÓRICO
// ======================================================

if (historySearchInput) {

  historySearchInput.addEventListener(
    "input",
    renderSalesHistory
  );

}


// ======================================================
// FILTRO POR DATA
// ======================================================

if (historyDateFilter) {

  historyDateFilter.addEventListener(
    "change",
    renderSalesHistory
  );

}


// ======================================================
// FILTRO POR PAGAMENTO
// ======================================================

if (historyPaymentFilter) {

  historyPaymentFilter.addEventListener(
    "change",
    renderSalesHistory
  );

}


// ======================================================
// LIMPAR FILTROS
// ======================================================

if (clearHistoryFilters) {

  clearHistoryFilters.addEventListener(
    "click",
    () => {

      if (historySearchInput) {

        historySearchInput.value =
          "";

      }


      if (historyDateFilter) {

        historyDateFilter.value =
          "";

      }


      if (historyPaymentFilter) {

        historyPaymentFilter.value =
          "Todos";

      }


      renderSalesHistory();

    }
  );

}


// ======================================================
// CLIQUES NA LISTA DE VENDAS
// ======================================================

if (salesHistory) {

  salesHistory.addEventListener(
    "click",
    event => {

      const button =
        event.target.closest(
          "[data-sale-action]"
        );


      if (!button) {
        return;
      }


      const action =
        button.dataset.saleAction;


      const saleId =
        button.dataset.saleId;


      if (
        action === "view"
      ) {

        openSaleDetails(
          saleId
        );

      }

    }
  );

}


// ======================================================
// FECHAR MODAL DE DETALHES
// ======================================================

if (closeSaleDetailsModal) {

  closeSaleDetailsModal.addEventListener(
    "click",
    () => {

      closeModal(
        saleDetailsModal
      );

    }
  );

}


// ======================================================
// FECHAR MODAL DE DETALHES CLICANDO FORA
// ======================================================

if (saleDetailsModal) {

  saleDetailsModal.addEventListener(
    "click",
    event => {

      if (
        event.target ===
        saleDetailsModal
      ) {

        closeModal(
          saleDetailsModal
        );

      }

    }
  );

}


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


    closeModal(
      saleDetailsModal
    );

  }
);


// ======================================================
// INICIALIZAÇÃO
// ======================================================

loadProducts();

renderCart();


// ======================================================
// CARREGAR HISTÓRICO EM SEGUNDO PLANO
// ======================================================

loadSales();
