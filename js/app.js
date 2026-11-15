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
  increment,
  onSnapshot,
  query,
  where,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  brl,
  escapeHtml,
  renderProductImage,
  getSaleDate,
  formatSaleDate,
  getPaymentIcon,
  showToast,
  closeModal,
  fetchProducts
} from "./utils.js";

import {
  STATUS,
  ETAPAS_PEDIDO,
  STATUS_ATIVOS,
  TIPO,
  infoStatus,
  ehPix,
  ehMesa,
  etapasDoPedido,
  mensagemParaCliente,
  statusInicial,
  codigoPedido
} from "./pedidos.js";

import {
  gerarPixCopiaECola,
  gerarQrCodeSvg
} from "./pix.js";

import {
  PIX_CONFIG,
  CHAVE_PIX_EXEMPLO
} from "./config-pix.js";

import {
  ehEquipe,
  PAGINA_DO_PAPEL
} from "./papeis.js";

import {
  somenteDigitos,
  formatarCpf,
  formatarTelefone,
  formatarCep,
  formatarEndereco,
  problemasDoPerfil,
  perfilCompleto,
  buscarCep
} from "./perfil.js";


// ======================================================
// ESTADO DA APLICAÇÃO
// ======================================================

let products = [];
let cart = [];
let activeCategory = "Todos";
let selectedProduct = null;
let modalQuantity = 1;

// Rastreio: pedidos do cliente logado (tempo real)
let myOrders = [];
let stopOrdersListener = null;
let pixOrderId = null;

// Cadastro do cliente (perfis/{uid})
let myProfile = null;
let profileLoaded = false;
let afterProfileSave = null;


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

// ======================================================
// O pedido só abre com cadastro completo:
// - visitante (sessão anônima) vai para o login;
// - cliente sem cadastro completo preenche o perfil e,
//   ao salvar, o checkout abre sozinho em seguida.
// (As Security Rules também recusam pedido sem perfil.)
// ======================================================

function openCheckout() {

  if (!cart.length) {
    return;
  }


  if (
    !window.currentUser ||
    window.userRole === "visitante"
  ) {

    showToast(
      "Entre na sua conta para fazer o pedido."
    );

    setTimeout(
      () => {
        window.location.href =
          "login.html";
      },
      1500
    );

    return;

  }


  if (!perfilCompleto(myProfile)) {

    openProfileModal({
      motivo: "pedido",
      depois: openCheckout
    });

    return;

  }


  document.getElementById(
    "checkoutTotal"
  ).textContent =
    brl(getCartTotal());


  // Resumo de entrega vindo do cadastro
  document.getElementById(
    "checkoutDeliveryName"
  ).textContent =
    myProfile.nome;

  document.getElementById(
    "checkoutDeliveryPhone"
  ).textContent =
    `📞 ${formatarTelefone(myProfile.telefone)}`;

  document.getElementById(
    "checkoutDeliveryAddress"
  ).textContent =
    `📍 ${formatarEndereco(myProfile.endereco)}`;


  checkoutModal.classList.remove(
    "hidden"
  );

}


checkoutButton.addEventListener(
  "click",
  openCheckout
);


document
  .getElementById("editProfileFromCheckout")
  .addEventListener(
    "click",
    () => {

      closeModal(
        checkoutModal
      );

      openProfileModal({
        motivo: "editar",
        depois: openCheckout
      });

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
// 4. criação da venda (com o custo de cada item, o dono
//    do pedido e o status inicial do rastreio)
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
  // CLIENTE (vem do cadastro obrigatório)
  //
  // Nome, CPF, telefone e endereço saem do perfil em
  // "perfis/{uid}". O pedido grava uma CÓPIA desses
  // dados, para a cozinha/motoboy ver para onde levar e
  // para o pedido antigo não mudar se o cliente trocar de
  // endereço depois.
  //
  // O telefone (só dígitos) continua sendo o ID do
  // documento do cliente em "clientes" (CRM).
  // ====================================================

  if (!perfilCompleto(myProfile)) {

    closeModal(
      checkoutModal
    );

    openProfileModal({
      motivo: "pedido",
      depois: openCheckout
    });

    return;

  }


  const customerName =
    myProfile.nome;

  const customerPhone =
    somenteDigitos(myProfile.telefone);

  const customerCpf =
    somenteDigitos(myProfile.cpf);

  const deliveryAddress = {
    ...myProfile.endereco
  };


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
  // STATUS INICIAL DO PEDIDO (RASTREIO)
  //
  // Pix nasce "aguardando_pagamento" (o admin confirma
  // o Pix à mão). Dinheiro/cartão nascem "recebido".
  // As Security Rules exigem exatamente essa regra, então
  // ninguém cria um pedido Pix já marcado como pago.
  // ====================================================

  const status =
    statusInicial(payment);


  // Dono do pedido: só ele (e o admin) pode lê-lo depois
  const userId =
    window.currentUser
      ? window.currentUser.uid
      : null;


  if (!userId) {

    showToast(
      "Faça login para finalizar o pedido."
    );

    return;

  }


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
              customerPhone,

            // ---- dados de entrega (cópia do cadastro) ----

            customerCpf:
              customerCpf,

            deliveryAddress:
              deliveryAddress,

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

            // ---- rastreio do pedido ----

            userId:
              userId,

            tipo:
              TIPO.DELIVERY,

            status:
              status,

            statusUpdatedAt:
              serverTimestamp(),

            // horário de cada etapa (a cozinha preenche
            // as próximas ao avançar o pedido)
            statusTimes: {
              [status]:
                serverTimestamp()
            }

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

              cpf:
                customerCpf,

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


    // ==================================================
    // RECARREGAR PRODUTOS (estoque atualizado)
    // ==================================================

    await loadProducts();


    // ==================================================
    // PRÓXIMO PASSO PARA O CLIENTE
    //
    // Pix: abre o QR Code para pagar.
    // Outros: abre o rastreio do pedido.
    // ==================================================

    if (ehPix(payment)) {

      openPixModal({
        id: saleRef.id,
        total
      });

    } else {

      showToast(
        `Pedido ${codigoPedido(saleRef.id)} recebido! Total: ${brl(total)}`
      );

      openOrdersModal();

    }


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
// CADASTRO DO CLIENTE (PERFIL)
//
// Documento "perfis/{uid}" com nome completo, CPF,
// telefone e endereço de entrega. É obrigatório antes do
// primeiro pedido:
//   - abre sozinho depois do login se estiver incompleto;
//   - o botão "Finalizar venda" não abre o pagamento
//     enquanto ele não estiver completo;
//   - as Security Rules recusam pedido de quem não tem
//     perfil (proteção de verdade, não só na tela).
// ======================================================

const profileModal =
  document.getElementById("profileModal");

const profileForm =
  document.getElementById("profileForm");

const openProfileButton =
  document.getElementById("openProfileButton");

const profileAlert =
  document.getElementById("profileAlert");

const profileErrors =
  document.getElementById("profileErrors");

const profileFields = {
  nome: document.getElementById("profileName"),
  cpf: document.getElementById("profileCpf"),
  telefone: document.getElementById("profilePhone"),
  cep: document.getElementById("profileCep"),
  rua: document.getElementById("profileStreet"),
  numero: document.getElementById("profileNumber"),
  complemento: document.getElementById("profileComplement"),
  bairro: document.getElementById("profileDistrict"),
  cidade: document.getElementById("profileCity"),
  uf: document.getElementById("profileState"),
  referencia: document.getElementById("profileReference")
};


const PROFILE_INTRO = {

  primeiro:
    "Antes do primeiro pedido, complete seu cadastro. " +
    "Precisamos desses dados para entregar seu lanche. Você só preenche uma vez.",

  pedido:
    "Para finalizar o pedido, complete seu cadastro. " +
    "Assim que salvar, seguimos para o pagamento.",

  editar:
    "Confira ou atualize seus dados de entrega."

};


function updateProfileAlert() {

  profileAlert.classList.toggle(
    "hidden",
    perfilCompleto(myProfile)
  );

}


async function loadProfile() {

  try {

    const snapshot =
      await getDoc(
        doc(
          window.db,
          "perfis",
          window.currentUser.uid
        )
      );

    myProfile =
      snapshot.exists()
        ? snapshot.data()
        : null;

  } catch (error) {

    console.error(
      "Erro ao carregar o cadastro:",
      error
    );

    myProfile =
      null;

  }


  profileLoaded =
    true;

  updateProfileAlert();


  // Primeiro acesso (ou cadastro incompleto): já pede
  if (!perfilCompleto(myProfile)) {

    openProfileModal({
      motivo: "primeiro"
    });

  }

}


function fillProfileForm(perfil) {

  const e =
    perfil?.endereco || {};

  profileFields.nome.value = perfil?.nome || "";
  profileFields.cpf.value = formatarCpf(perfil?.cpf || "");
  profileFields.telefone.value = formatarTelefone(perfil?.telefone || "");
  profileFields.cep.value = formatarCep(e.cep || "");
  profileFields.rua.value = e.rua || "";
  profileFields.numero.value = e.numero || "";
  profileFields.complemento.value = e.complemento || "";
  profileFields.bairro.value = e.bairro || "";
  profileFields.cidade.value = e.cidade || "";
  profileFields.uf.value = e.uf || "";
  profileFields.referencia.value = e.referencia || "";

}


function openProfileModal({ motivo = "editar", depois = null } = {}) {

  if (!profileLoaded) {
    return;
  }


  afterProfileSave =
    depois;

  document.getElementById(
    "profileIntro"
  ).textContent =
    PROFILE_INTRO[motivo] ||
    PROFILE_INTRO.editar;

  fillProfileForm(myProfile);

  profileErrors.classList.add("hidden");

  document.getElementById(
    "profileCepStatus"
  ).textContent = "";

  profileModal.classList.remove(
    "hidden"
  );

}


function readProfileForm() {

  const valor = campo =>
    profileFields[campo].value
      .trim()
      .replace(/\s+/g, " ");

  return {

    nome:
      valor("nome"),

    cpf:
      somenteDigitos(profileFields.cpf.value),

    telefone:
      somenteDigitos(profileFields.telefone.value),

    endereco: {
      cep: somenteDigitos(profileFields.cep.value),
      rua: valor("rua"),
      numero: valor("numero"),
      complemento: valor("complemento"),
      bairro: valor("bairro"),
      cidade: valor("cidade"),
      uf: valor("uf").toUpperCase(),
      referencia: valor("referencia")
    }

  };

}


// ---- máscaras enquanto digita ----

function mascara(input, formatar, maxDigitos) {

  input.addEventListener(
    "input",
    () => {

      const digitos =
        somenteDigitos(input.value)
          .slice(0, maxDigitos);

      input.value =
        formatar(digitos);

    }
  );

}

const mascaraCpf = d =>
  d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");

const mascaraTelefone = d =>
  d.length <= 2
    ? d.replace(/^(\d{1,2})/, "($1")
    : d.length <= 6
      ? d.replace(/^(\d{2})(\d+)/, "($1) $2")
      : d.length <= 10
        ? d.replace(/^(\d{2})(\d{4})(\d+)/, "($1) $2-$3")
        : d.replace(/^(\d{2})(\d{5})(\d+)/, "($1) $2-$3");

const mascaraCep = d =>
  d.replace(/^(\d{5})(\d)/, "$1-$2");

mascara(profileFields.cpf, mascaraCpf, 11);
mascara(profileFields.telefone, mascaraTelefone, 11);
mascara(profileFields.cep, mascaraCep, 8);

profileFields.uf.addEventListener(
  "input",
  () => {
    profileFields.uf.value =
      profileFields.uf.value
        .replace(/[^A-Za-z]/g, "")
        .toUpperCase();
  }
);


// ---- CEP: completa rua, bairro, cidade e UF ----

profileFields.cep.addEventListener(
  "input",
  async () => {

    const status =
      document.getElementById("profileCepStatus");

    if (somenteDigitos(profileFields.cep.value).length !== 8) {
      status.textContent = "";
      return;
    }


    status.textContent =
      "Buscando endereço...";

    const endereco =
      await buscarCep(profileFields.cep.value);


    if (!endereco) {

      status.textContent =
        "CEP não encontrado. Preencha à mão.";

      return;

    }


    profileFields.rua.value = endereco.rua || profileFields.rua.value;
    profileFields.bairro.value = endereco.bairro || profileFields.bairro.value;
    profileFields.cidade.value = endereco.cidade || profileFields.cidade.value;
    profileFields.uf.value = endereco.uf || profileFields.uf.value;

    status.textContent =
      "✔ Endereço encontrado";

    profileFields.numero.focus();

  }
);


// Some com o aviso de erro assim que o cliente corrige
profileForm.addEventListener(
  "input",
  () => {
    profileErrors.classList.add("hidden");
  }
);


// ---- salvar ----

profileForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    const perfil =
      readProfileForm();

    const problemas =
      problemasDoPerfil(perfil);


    if (problemas.length) {

      profileErrors.textContent =
        `Confira: ${problemas.join(", ")}.`;

      profileErrors.classList.remove(
        "hidden"
      );

      return;

    }


    profileErrors.classList.add(
      "hidden"
    );


    const saveButton =
      document.getElementById("saveProfileButton");

    saveButton.disabled = true;
    saveButton.textContent = "Salvando...";


    try {

      await setDoc(
        doc(
          window.db,
          "perfis",
          window.currentUser.uid
        ),
        {
          ...perfil,
          atualizadoEm:
            serverTimestamp()
        }
      );


      myProfile =
        perfil;

      updateProfileAlert();

      closeModal(
        profileModal
      );

      showToast(
        "Cadastro salvo!"
      );


      // Veio do "Finalizar venda": segue para o pagamento
      const proximo =
        afterProfileSave;

      afterProfileSave =
        null;

      if (proximo) {
        proximo();
      }

    } catch (error) {

      console.error(
        "Erro ao salvar o cadastro:",
        error
      );

      profileErrors.textContent =
        `Não foi possível salvar: ${error.message}`;

      profileErrors.classList.remove(
        "hidden"
      );

    } finally {

      saveButton.disabled = false;
      saveButton.textContent = "Salvar cadastro";

    }

  }
);


openProfileButton.addEventListener(
  "click",
  () => {

    openProfileModal({
      motivo:
        perfilCompleto(myProfile)
          ? "editar"
          : "primeiro"
    });

  }
);


document
  .getElementById("closeProfileModal")
  .addEventListener(
    "click",
    () => {

      afterProfileSave =
        null;

      closeModal(
        profileModal
      );

    }
  );


// ======================================================
// RASTREIO DO PEDIDO (MEUS PEDIDOS)
//
// Escuta em tempo real (onSnapshot) os pedidos do cliente
// logado: query em "vendas" com userId == uid. A Security
// Rule de leitura só libera pedidos do próprio usuário, e
// o Firestore exige que a consulta tenha esse mesmo filtro
// — por isso o where() abaixo é obrigatório.
//
// Quando a cozinha muda o status no painel, o Firestore
// avisa este listener, a tela se redesenha sozinha e o
// cliente recebe um aviso (toast).
// ======================================================

const openOrdersButton =
  document.getElementById("openOrdersButton");

const ordersCount =
  document.getElementById("ordersCount");

const ordersModal =
  document.getElementById("ordersModal");

const ordersList =
  document.getElementById("ordersList");

const pixModal =
  document.getElementById("pixModal");


// Quantos pedidos antigos (entregues/cancelados) mostrar
const MAX_PEDIDOS_ANTERIORES = 5;


function mapOrder(documentSnapshot) {

  const data =
    documentSnapshot.data();

  return {

    id:
      documentSnapshot.id,

    status:
      String(data.status || STATUS.FINALIZADA),

    payment:
      String(data.payment || "Não informado"),

    total:
      Number(data.total) || 0,

    items:
      Array.isArray(data.items)
        ? data.items
        : [],

    // null enquanto o servidor não confirma o horário
    createdAt:
      data.createdAt || null,

    statusTimes:
      data.statusTimes || {},

    tipo:
      String(data.tipo || TIPO.DELIVERY),

    mesa:
      data.mesa || null

  };

}


function orderTime(order) {

  const date =
    getSaleDate(order.createdAt);

  // Pedido acabou de ser criado e o horário do servidor
  // ainda não chegou
  return date
    ? date.getTime()
    : Date.now();

}


function formatHour(timestamp) {

  const date =
    getSaleDate(timestamp);

  if (!date) {
    return "";
  }

  return date.toLocaleTimeString(
    "pt-BR",
    {
      hour: "2-digit",
      minute: "2-digit"
    }
  );

}


function startOrdersListener() {

  if (
    stopOrdersListener ||
    !window.db ||
    !window.currentUser ||
    window.userRole === "visitante"
  ) {
    return;
  }


  openOrdersButton.classList.remove(
    "hidden"
  );


  const ordersQuery =
    query(
      collection(
        window.db,
        "vendas"
      ),
      where(
        "userId",
        "==",
        window.currentUser.uid
      )
    );


  let primeiraCarga =
    true;


  stopOrdersListener =
    onSnapshot(
      ordersQuery,
      snapshot => {

        // Avisa o cliente quando o status muda
        // (não na primeira carga, senão avisaria tudo)
        if (!primeiraCarga) {

          snapshot
            .docChanges()
            .forEach(
              change => {

                if (change.type !== "modified") {
                  return;
                }


                const novoStatus =
                  change.doc.data().status;

                const anterior =
                  myOrders.find(
                    order =>
                      order.id === change.doc.id
                  );


                if (
                  !anterior ||
                  anterior.status === novoStatus
                ) {
                  return;
                }


                showToast(
                  `Pedido ${codigoPedido(change.doc.id)}: ${infoStatus(novoStatus).label}`
                );


                // Pix confirmado com o QR Code aberto:
                // troca o QR pelo rastreio
                if (
                  pixOrderId === change.doc.id &&
                  novoStatus !== STATUS.AGUARDANDO_PAGAMENTO
                ) {

                  closeModal(
                    pixModal
                  );

                  pixOrderId =
                    null;

                  openOrdersModal();

                }

              }
            );

        }


        primeiraCarga =
          false;


        myOrders =
          snapshot.docs
            .map(mapOrder)
            .sort(
              (a, b) =>
                orderTime(b) -
                orderTime(a)
            );


        renderOrders();

      },
      error => {

        console.error(
          "Erro ao acompanhar pedidos:",
          error
        );

        ordersList.innerHTML = `
          <div class="orders-empty">
            <div>⚠️</div>
            <strong>Não foi possível carregar seus pedidos</strong>
            <span>${escapeHtml(error.message)}</span>
          </div>
        `;

      }
    );

}


function renderOrderTimeline(order) {

  // Pedido fora do fluxo (cancelado / venda antiga)
  if (!ETAPAS_PEDIDO.includes(order.status)) {
    return "";
  }


  // Pix passa por "aguardando pagamento"; pedido de mesa
  // não tem "saiu para entrega" (ver pedidos.js)
  const etapas =
    etapasDoPedido(order);


  const atual =
    etapas.indexOf(order.status);


  return `
    <ol class="order-timeline">
      ${etapas
        .map(
          (etapa, index) => {

            const estado =
              index < atual ||
              order.status === STATUS.ENTREGUE
                ? "done"
                : index === atual
                  ? "current"
                  : "todo";

            const hora =
              formatHour(
                order.statusTimes[etapa]
              );

            return `
              <li class="order-step ${estado}">
                <span class="order-step-dot" aria-hidden="true"></span>
                <span class="order-step-label">
                  ${infoStatus(etapa).curto}
                </span>
                <small>${hora}</small>
              </li>
            `;

          }
        )
        .join("")}
    </ol>
  `;

}


function renderOrderCard(order) {

  const info =
    infoStatus(order.status);

  const itens =
    order.items
      .map(
        item => `
          <li>
            <b>${Number(item.quantity) || 0}×</b>
            ${escapeHtml(item.name || "Produto")}
          </li>
        `
      )
      .join("");

  const quando =
    order.createdAt
      ? formatSaleDate(order.createdAt)
      : "Agora mesmo";

  const podePagar =
    order.status ===
    STATUS.AGUARDANDO_PAGAMENTO;


  return `
    <article class="order-card status-${escapeHtml(order.status)}">

      <header class="order-card-head">

        <div>
          <strong class="order-code">
            ${codigoPedido(order.id)}
          </strong>
          <span class="order-date">
            ${escapeHtml(quando)}
          </span>
        </div>

        <span class="order-status-badge status-${escapeHtml(order.status)}">
          ${info.icone} ${escapeHtml(info.label)}
        </span>

      </header>

      <p class="order-message">
        ${
          ehMesa(order)
            ? `🍽 Mesa ${escapeHtml(String(order.mesa))} · `
            : ""
        }${escapeHtml(mensagemParaCliente(order))}
      </p>

      ${renderOrderTimeline(order)}

      <ul class="order-items">
        ${itens}
      </ul>

      <footer class="order-card-foot">
        <span>
          ${getPaymentIcon(order.payment)}
          ${escapeHtml(order.payment)}
        </span>
        <strong>
          ${brl(order.total)}
        </strong>
      </footer>

      ${
        podePagar
          ? `
            <button
              class="primary-button order-pay-button"
              type="button"
              data-pay-order="${escapeHtml(order.id)}">
              ⚡ Pagar com Pix
            </button>
          `
          : ""
      }

    </article>
  `;

}


function renderOrders() {

  const ativos =
    myOrders.filter(
      order =>
        STATUS_ATIVOS.includes(order.status)
    );

  const anteriores =
    myOrders
      .filter(
        order =>
          !STATUS_ATIVOS.includes(order.status)
      )
      .slice(
        0,
        MAX_PEDIDOS_ANTERIORES
      );


  // Contador no botão do topo
  ordersCount.textContent =
    ativos.length;

  ordersCount.classList.toggle(
    "hidden",
    ativos.length === 0
  );


  if (!myOrders.length) {

    ordersList.innerHTML = `
      <div class="orders-empty">
        <div>📦</div>
        <strong>Você ainda não fez pedidos</strong>
        <span>Quando fizer, o andamento aparece aqui em tempo real.</span>
      </div>
    `;

    return;

  }


  ordersList.innerHTML = `
    ${
      ativos.length
        ? `
          <h3 class="orders-group-title">Em andamento</h3>
          ${ativos.map(renderOrderCard).join("")}
        `
        : ""
    }
    ${
      anteriores.length
        ? `
          <h3 class="orders-group-title">Anteriores</h3>
          ${anteriores.map(renderOrderCard).join("")}
        `
        : ""
    }
  `;

}


function openOrdersModal() {

  if (!stopOrdersListener) {

    showToast(
      "Entre na sua conta para acompanhar pedidos."
    );

    return;

  }


  renderOrders();

  ordersModal.classList.remove(
    "hidden"
  );

}


// ======================================================
// PIX — QR CODE DO PEDIDO
//
// Monta o "copia e cola" com o valor e o ID do pedido
// (o ID vai como identificador da transação, ajudando o
// admin a conferir no extrato) e desenha o QR Code.
// ======================================================

function openPixModal(order) {

  pixOrderId =
    order.id;


  const codigo =
    gerarPixCopiaECola({
      ...PIX_CONFIG,
      valor: order.total,
      txid: order.id
    });


  document.getElementById(
    "pixOrderCode"
  ).textContent =
    codigoPedido(order.id);

  document.getElementById(
    "pixTotal"
  ).textContent =
    brl(order.total);

  document.getElementById(
    "pixCode"
  ).value =
    codigo;


  document
    .getElementById("pixDemoWarning")
    .classList.toggle(
      "hidden",
      PIX_CONFIG.chave !== CHAVE_PIX_EXEMPLO
    );


  const svg =
    gerarQrCodeSvg(codigo);

  document.getElementById(
    "pixQr"
  ).innerHTML =
    svg ||
    `<p class="pix-qr-fallback">
       Não foi possível desenhar o QR Code agora.
       Use o código "copia e cola" abaixo.
     </p>`;


  closeModal(
    ordersModal
  );

  pixModal.classList.remove(
    "hidden"
  );

}


async function copyPixCode() {

  const textarea =
    document.getElementById("pixCode");

  try {

    await navigator.clipboard.writeText(
      textarea.value
    );

  } catch {

    // Navegadores sem acesso à área de transferência
    textarea.select();
    document.execCommand("copy");

  }


  showToast(
    "Código Pix copiado!"
  );

}


openOrdersButton.addEventListener(
  "click",
  openOrdersModal
);


document
  .getElementById("closeOrdersModal")
  .addEventListener(
    "click",
    () => {

      closeModal(
        ordersModal
      );

    }
  );


document
  .getElementById("closePixModal")
  .addEventListener(
    "click",
    () => {

      closeModal(
        pixModal
      );

      pixOrderId =
        null;

    }
  );


document
  .getElementById("copyPixButton")
  .addEventListener(
    "click",
    copyPixCode
  );


document
  .getElementById("pixTrackButton")
  .addEventListener(
    "click",
    () => {

      closeModal(
        pixModal
      );

      pixOrderId =
        null;

      openOrdersModal();

    }
  );


// "Pagar com Pix" dentro de Meus pedidos
ordersList.addEventListener(
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-pay-order]"
      );

    if (!button) {
      return;
    }


    const order =
      myOrders.find(
        item =>
          item.id === button.dataset.payOrder
      );

    if (order) {
      openPixModal(order);
    }

  }
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

    closeModal(
      ordersModal
    );

    closeModal(
      pixModal
    );

    pixOrderId =
      null;

    closeModal(
      profileModal
    );

    afterProfileSave =
      null;

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
// EQUIPE: não usa o cardápio. Cada papel vai direto para
// a sua tela (admin.html, garcom.html, balcao.html,
// cozinha.html — ver js/papeis.js). Para testar a página
// do cliente logado como admin, abra index.html?cliente=1.
// ======================================================

window.iniciarApp = () => {

  const querVerComoCliente =
    new URLSearchParams(
      window.location.search
    ).has("cliente");


  if (
    ehEquipe(window.userRole) &&
    !(
      querVerComoCliente &&
      window.userRole === "administrador"
    )
  ) {

    // Esconde a página para não piscar o cardápio

    document.body.style.visibility =
      "hidden";

    window.location.replace(
      PAGINA_DO_PAPEL[window.userRole]
    );

    return;

  }


  loadProducts();


  // Só para quem está logado de verdade (visitante
  // anônimo não compra): cadastro + rastreio em tempo real
  if (
    window.currentUser &&
    window.userRole !== "visitante"
  ) {

    openProfileButton.classList.remove(
      "hidden"
    );

    loadProfile();

    startOrdersListener();

  }

};
