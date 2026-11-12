// ======================================================
// APP.JS — PÁGINA DO CLIENTE
//
// Cardápio, carrinho e finalização da venda. Tudo que é
// do administrador (histórico, produtos, relatórios,
// financeiro, calculadora) agora vive em js/admin.js,
// servido pela página admin.html.
//
// Funções compartilhadas (formatação, imagens, toast)
// ficam em js/utils.js.
// ======================================================

import {
  collection,
  doc,
  serverTimestamp,
  runTransaction,
  increment
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  brl,
  escapeHtml,
  renderProductImage,
  showToast,
  closeModal,
  fetchProducts
} from "./utils.js";


// ======================================================
// ESTADO DA APLICAÇÃO
// ======================================================

let products = [];
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

const productModal =
  document.getElementById("productModal");

const checkoutModal =
  document.getElementById("checkoutModal");


// ======================================================
// CARREGAR PRODUTOS DO FIRESTORE
// ======================================================

async function loadProducts() {

  try {

    products =
      await fetchProducts();

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

        // O cliente só vê produto disponível e com estoque
        if (product.available !== true) {
          return false;
        }

        if (product.stock <= 0) {
          return false;
        }


        const matchesCategory =
          activeCategory === "Todos" ||
          String(product.category || "") === activeCategory;


        const matchesSearch =
          String(product.name || "")
            .toLowerCase()
            .includes(search) ||
          String(product.description || "")
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
              ${renderProductImage(product.emoji, product.name)}
            </div>

            <div class="product-body">

              <span class="product-category">
                ${escapeHtml(
                  String(product.category).toUpperCase()
                )}
              </span>

              <h4>
                ${escapeHtml(product.name)}
              </h4>

              <p>
                ${escapeHtml(product.description)}
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


  if (product.available !== true) {

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

  // ====================================================
  // VISITANTE (SESSÃO ANÔNIMA) NÃO COMPRA
  //
  // window.userRole é definido pelo script de
  // autenticação em index.html assim que a sessão
  // (anônima ou real) é confirmada. "Comprar" aqui
  // significa literalmente clicar em adicionar algo
  // ao carrinho — é o ponto único por onde passam tanto
  // o botão "+ Adicionar" do card quanto "Adicionar ao
  // pedido" do modal de detalhes.
  // ====================================================

  if (window.userRole === "visitante") {

    window.location.href =
      "login.html";

    return;

  }


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


  if (item.quantity <= 0) {

    cart =
      cart.filter(
        product =>
          product.id !== productId
      );

  }


  renderCart();

}


// ======================================================
// TOTAL DO CARRINHO
// ======================================================

function getCartTotal() {

  return cart.reduce(
    (sum, item) =>
      sum +
      (Number(item.price) || 0) *
      item.quantity,
    0
  );

}


// ======================================================
// RENDERIZAR CARRINHO
// ======================================================

function renderCart() {

  if (cart.length === 0) {

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
                ${renderProductImage(item.emoji, item.name)}
              </div>

              <div class="cart-item-info">

                <strong>
                  ${escapeHtml(item.name)}
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
    getCartTotal();

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

function openProductModal(productId) {

  selectedProduct =
    products.find(
      item =>
        item.id === productId
    );


  if (!selectedProduct) {
    return;
  }


  if (selectedProduct.available !== true) {

    showToast(
      `${selectedProduct.name} está indisponível.`
    );

    return;

  }


  if (selectedProduct.stock <= 0) {

    showToast(
      `${selectedProduct.name} está sem estoque.`
    );

    return;

  }


  modalQuantity = 1;


  document.getElementById(
    "modalProductImage"
  ).innerHTML =
    renderProductImage(
      selectedProduct.emoji,
      selectedProduct.name
    );


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


    if (button.dataset.action === "details") {

      openProductModal(id);

    }


    if (button.dataset.action === "add") {

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
      button.dataset.cartAction === "increase"
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
// QUANTIDADE NO MODAL
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


document
  .getElementById("modalIncrease")
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


      if (newTotal > selectedProduct.stock) {

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
// ABRIR / FECHAR CHECKOUT
// ======================================================

checkoutButton.addEventListener(
  "click",
  () => {

    if (!cart.length) {
      return;
    }


    document.getElementById(
      "checkoutTotal"
    ).textContent =
      brl(getCartTotal());


    checkoutModal.classList.remove(
      "hidden"
    );

  }
);


document
  .getElementById("closeCheckoutModal")
  .addEventListener(
    "click",
    () => {

      closeModal(
        checkoutModal
      );

    }
  );


// ======================================================
// SALVAR VENDA, DAR BAIXA NO ESTOQUE E ATUALIZAR CRM
//
// ATENÇÃO:
// A lógica desta função foi preservada. A transação faz:
// 1. leitura dos produtos
// 2. validação do estoque
// 3. baixa do estoque
// 4. criação da venda (com o custo de cada item)
// 5. criação/atualização do cliente (CRM)
//
// O Firestore exige que TODAS as leituras aconteçam
// antes de QUALQUER escrita dentro de uma transação.
// ======================================================

async function finalizeSale() {

  if (!cart.length) {

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
      .getElementById("customerName")
      .value
      .trim() ||
    "Cliente não identificado";


  // ====================================================
  // TELEFONE DO CLIENTE (chave do CRM)
  //
  // Mantém só dígitos, para usar como ID do documento
  // na coleção "clientes". Se vier vazio, a venda segue
  // sem vínculo de CRM (venda avulsa).
  // ====================================================

  const customerPhone =
    document
      .getElementById("customerPhone")
      .value
      .trim()
      .replace(/\D/g, "");


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
    getCartTotal();


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


    // ==================================================
    // ID DA VENDA
    // ==================================================

    const saleRef =
      doc(
        collection(
          window.db,
          "vendas"
        )
      );


    // ==================================================
    // REFERÊNCIA DO CLIENTE (CRM)
    //
    // O telefone normalizado (só dígitos) é usado como
    // ID do documento em "clientes". Assim, o mesmo
    // cliente é sempre encontrado em compras futuras.
    // ==================================================

    const clienteRef =
      customerPhone
        ? doc(
            window.db,
            "clientes",
            customerPhone
          )
        : null;


    // ==================================================
    // TRANSAÇÃO
    // ==================================================

    await runTransaction(
      window.db,
      async transaction => {

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


        for (const productData of productReferences) {

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
        // (SEM LEITURA DO CLIENTE)
        //
        // O documento em "clientes" só pode ser LIDO por
        // administrador (regra de segurança do CRM). Por
        // isso não fazemos transaction.get(clienteRef) aqui
        // — em vez de ler o total atual e somar na mão, a
        // gravação abaixo usa increment(), que soma no
        // servidor sem precisar ler o valor antes.
        // ----------------------------------------------


        // ----------------------------------------------
        // SEGUNDO: VALIDAR ESTOQUE
        // ----------------------------------------------

        for (const productData of productSnapshots) {

          const {
            item,
            snapshot
          } = productData;


          if (!snapshot.exists()) {

            throw new Error(
              `O produto ${item.name} não existe mais no Firebase.`
            );

          }


          const data =
            snapshot.data();


          const currentStock =
            Number(data.stock) || 0;


          if (data.available !== true) {

            throw new Error(
              `${item.name} está indisponível.`
            );

          }


          if (currentStock < item.quantity) {

            throw new Error(
              `Estoque insuficiente para ${item.name}. Disponível: ${currentStock}.`
            );

          }

        }


        // ----------------------------------------------
        // TERCEIRO: DAR BAIXA NO ESTOQUE
        // ----------------------------------------------

        for (const productData of productSnapshots) {

          const {
            item,
            snapshot
          } = productData;


          const currentStock =
            Number(snapshot.data().stock) || 0;


          transaction.update(
            productData.reference,
            {
              stock:
                currentStock -
                item.quantity
            }
          );

        }


        // ----------------------------------------------
        // QUARTO: SALVAR VENDA
        //
        // O custo de cada item é lido aqui dentro, do
        // próprio documento do produto, para gravar na
        // venda o custo que valia NO MOMENTO da compra.
        // Produto sem custo cadastrado fica com null.
        // ----------------------------------------------

        const costById = {};


        productSnapshots.forEach(
          ({ item, snapshot }) => {

            const productCost =
              snapshot.data().cost;

            costById[item.id] =
              typeof productCost === "number"
                ? productCost
                : null;

          }
        );


        const saleItems =
          cart.map(
            item => ({

              productId:
                item.id,

              name:
                item.name,

              cost:
                costById[item.id] ?? null,

              price:
                Number(item.price) || 0,

              quantity:
                item.quantity,

              subtotal:
                (Number(item.price) || 0) *
                item.quantity

            })
          );


        transaction.set(
          saleRef,
          {

            customerName:
              customerName,

            customerPhone:
              customerPhone ||
              null,

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


        // ----------------------------------------------
        // QUINTO: ATUALIZAR CRM DO CLIENTE
        //
        // Usa set com merge: true + increment(), então
        // funciona igual para "criar pela primeira vez" e
        // "atualizar quem já existe" — sem precisar ler o
        // documento antes (o que exigiria permissão de
        // leitura que o cliente não tem).
        // ----------------------------------------------

        if (clienteRef) {

          transaction.set(
            clienteRef,
            {

              nome:
                customerName,

              telefone:
                customerPhone,

              totalGasto:
                increment(total),

              quantidadeCompras:
                increment(1),

              ultimaCompra:
                serverTimestamp()

            },
            {
              merge: true
            }
          );

        }

      }
    );


    console.log(
      "Venda gravada com sucesso! ID:",
      saleRef.id
    );


    // ==================================================
    // LIMPAR CARRINHO E CAMPOS
    // ==================================================

    cart = [];

    renderCart();

    closeModal(
      checkoutModal
    );

    document.getElementById(
      "customerName"
    ).value = "";

    document.getElementById(
      "customerPhone"
    ).value = "";


    // ==================================================
    // RECARREGAR PRODUTOS (estoque atualizado)
    // ==================================================

    await loadProducts();


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


document
  .getElementById("confirmSaleButton")
  .addEventListener(
    "click",
    finalizeSale
  );


// ======================================================
// FECHAR MODAIS COM ESC
// ======================================================

document.addEventListener(
  "keydown",
  event => {

    if (event.key !== "Escape") {
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

// renderCart() não depende de nenhuma leitura no
// Firestore, então pode rodar assim que o script carrega.

renderCart();


// ======================================================
// FUNÇÃO EXPOSTA PARA O SCRIPT DE AUTENTICAÇÃO
//
// loadProducts() faz leitura no Firestore, e as Security
// Rules dependem de existir uma sessão (anônima ou de
// verdade). Por isso ela NÃO roda assim que o app.js
// carrega: index.html chama window.iniciarApp() só depois
// que o Firebase confirma a sessão.
//
// ADMINISTRADOR: não usa o cardápio. Quem tem papel de
// administrador é enviado direto para o painel
// (admin.html). Para testar a página do cliente estando
// logado como admin, abra index.html?cliente=1.
// ======================================================

window.iniciarApp = () => {

  const querVerComoCliente =
    new URLSearchParams(
      window.location.search
    ).has("cliente");


  if (
    window.userRole === "administrador" &&
    !querVerComoCliente
  ) {

    // Esconde a página para não piscar o cardápio

    document.body.style.visibility =
      "hidden";

    window.location.replace(
      "admin.html"
    );

    return;

  }


  loadProducts();

};
