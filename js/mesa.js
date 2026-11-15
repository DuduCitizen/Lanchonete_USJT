// ======================================================
// MESA.JS — CLIENTE NO RESTAURANTE FÍSICO (mesa.html)
//
// 1. Lê o número da mesa do endereço (mesa.html?mesa=7),
//    que vem do QR Code colado na mesa.
// 2. Exige login normal (e-mail ou Google). NÃO pede o
//    cadastro de CPF/endereço: isso é só do delivery.
// 3. Mostra o cardápio; o pedido vai para a fila da
//    cozinha com o número da mesa (js/pedido-mesa.js).
// 4. "Seus pedidos" acompanha o status em tempo real e
//    permite cancelar enquanto o pedido está "Recebido",
//    com o aviso de que um pedido novo entra no fim da fila.
// 5. Não paga aqui: o garçom fecha a conta no final.
// ======================================================

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  db,
  auth
} from "./firebase.js";

import {
  brl,
  escapeHtml,
  renderProductImage,
  formatSaleDate,
  getSaleDate,
  showToast,
  closeModal,
  fetchProducts
} from "./utils.js";

import {
  STATUS,
  CONTA,
  infoStatus,
  etapasDoPedido,
  mensagemParaCliente,
  codigoPedido
} from "./pedidos.js";

import {
  criarPedidoMesa,
  cancelarPedidoMesaCliente
} from "./pedido-mesa.js";

import {
  normalizarPapel,
  ehEquipe,
  PAGINA_DO_PAPEL
} from "./papeis.js";

import { NUMERO_DE_MESAS } from "./config-restaurante.js";


// ======================================================
// MESA DO ENDEREÇO
// ======================================================

const parametroMesa =
  new URLSearchParams(window.location.search).get("mesa");

const MESA =
  /^\d{1,2}$/.test(parametroMesa || "") &&
  Number(parametroMesa) >= 1 &&
  Number(parametroMesa) <= NUMERO_DE_MESAS
    ? Number(parametroMesa)
    : null;


// ======================================================
// ESTADO E ELEMENTOS
// ======================================================

let produtos = [];
let categoriaAtiva = "Todos";
let carrinho = [];          // [{ id, name, price, quantity }]
let meusPedidos = [];
let pedidoParaCancelar = null;

const $ = id =>
  document.getElementById(id);

const produtosGrid = $("mesaProdutos");
const categoriasEl = $("mesaCategorias");
const cartBar = $("mesaCartBar");
const cartModal = $("mesaCartModal");
const ordersModal = $("mesaOrdersModal");
const ordersList = $("mesaOrdersList");
const cancelarModal = $("cancelarModal");


// ======================================================
// CARDÁPIO
// ======================================================

const CATEGORIAS = [
  "Todos",
  "Lanches",
  "Combos",
  "Porções",
  "Bebidas",
  "Sobremesas"
];


function quantidadeNoCarrinho(id) {

  return carrinho.find(item => item.id === id)?.quantity || 0;

}


function renderCategorias() {

  categoriasEl.innerHTML =
    CATEGORIAS
      .map(
        categoria => `
          <button
            class="category ${categoria === categoriaAtiva ? "active" : ""}"
            type="button"
            data-categoria="${escapeHtml(categoria)}">
            ${escapeHtml(categoria)}
          </button>
        `
      )
      .join("");

}


function renderProdutos() {

  const visiveis =
    produtos.filter(
      produto =>
        produto.available &&
        produto.stock > 0 &&
        (
          categoriaAtiva === "Todos" ||
          produto.category === categoriaAtiva
        )
    );


  if (!visiveis.length) {

    produtosGrid.innerHTML = `
      <div class="empty-state">
        <div>🔎</div>
        <h3>Nada nesta categoria agora</h3>
        <p>Tente outra categoria.</p>
      </div>
    `;

    return;

  }


  produtosGrid.innerHTML =
    visiveis
      .map(
        produto => {

          const noCarrinho =
            quantidadeNoCarrinho(produto.id);

          return `
            <article class="product-card">

              <div class="product-image">
                ${renderProductImage(produto.emoji, produto.name)}
              </div>

              <div class="product-body">

                <span class="product-category">
                  ${escapeHtml(String(produto.category).toUpperCase())}
                </span>

                <h4>${escapeHtml(produto.name)}</h4>

                <p>${escapeHtml(produto.description)}</p>

                <div class="product-footer">

                  <span class="price">${brl(produto.price)}</span>

                  <div class="product-actions">
                    ${
                      noCarrinho
                        ? `<span class="mesa-no-carrinho">${noCarrinho} no pedido</span>`
                        : ""
                    }
                    <button
                      class="add-button"
                      type="button"
                      data-add="${escapeHtml(produto.id)}">
                      + Adicionar
                    </button>
                  </div>

                </div>

              </div>

            </article>
          `;

        }
      )
      .join("");

}


// ======================================================
// CARRINHO
// ======================================================

function totalCarrinho() {

  return carrinho.reduce(
    (soma, item) =>
      soma + item.price * item.quantity,
    0
  );

}


function adicionar(id, delta = 1) {

  const produto =
    produtos.find(item => item.id === id);

  if (!produto) {
    return;
  }


  const item =
    carrinho.find(linha => linha.id === id);

  const novaQuantidade =
    (item?.quantity || 0) + delta;


  if (novaQuantidade > produto.stock) {

    showToast(
      `Só temos ${produto.stock} de ${produto.name} agora.`
    );

    return;

  }


  if (novaQuantidade <= 0) {

    carrinho =
      carrinho.filter(linha => linha.id !== id);

  } else if (item) {

    item.quantity =
      novaQuantidade;

  } else {

    carrinho.push({
      id: produto.id,
      name: produto.name,
      price: produto.price,
      quantity: novaQuantidade
    });

  }


  if (delta > 0 && !item) {
    showToast(`${produto.name} adicionado.`);
  }

  renderCarrinho();
  renderProdutos();

}


function renderCarrinho() {

  const quantidade =
    carrinho.reduce(
      (soma, item) => soma + item.quantity,
      0
    );


  cartBar.classList.toggle(
    "hidden",
    quantidade === 0
  );

  $("mesaCartResumo").innerHTML =
    `🛒 ${quantidade} ${quantidade === 1 ? "item" : "itens"} · <b>${brl(totalCarrinho())}</b>`;


  $("mesaCartItens").innerHTML =
    carrinho.length
      ? carrinho
          .map(
            item => `
              <div class="mesa-cart-item">

                <div>
                  <strong>${escapeHtml(item.name)}</strong>
                  <small>${brl(item.price)} cada</small>
                </div>

                <div class="quantity-control mesa-qtd">
                  <button type="button" data-menos="${escapeHtml(item.id)}" aria-label="Diminuir">−</button>
                  <span>${item.quantity}</span>
                  <button type="button" data-mais="${escapeHtml(item.id)}" aria-label="Aumentar">+</button>
                </div>

              </div>
            `
          )
          .join("")
      : `<p class="mesa-cart-aviso">Seu pedido está vazio.</p>`;


  $("mesaCartTotal").textContent =
    brl(totalCarrinho());

}


async function enviarPedido() {

  const botao =
    $("enviarPedidoMesa");

  botao.disabled = true;
  botao.textContent = "Enviando...";


  try {

    const pedido =
      await criarPedidoMesa({
        mesa: MESA,
        itens: carrinho,
        criadoPor: "cliente"
      });


    carrinho = [];

    renderCarrinho();

    closeModal(cartModal);

    produtos =
      await fetchProducts();

    renderProdutos();

    showToast(
      `Pedido ${codigoPedido(pedido.id)} enviado para a cozinha!`
    );

    abrirPedidos();

  } catch (error) {

    console.error(
      "Erro ao enviar pedido:",
      error
    );

    showToast(
      `Não foi possível enviar: ${error.message}`
    );

  } finally {

    botao.disabled = false;
    botao.textContent = "Enviar para a cozinha";

  }

}


// ======================================================
// PEDIDOS DA MESA (TEMPO REAL)
//
// Pedidos DESTE cliente NESTA mesa, da conta em aberto
// (depois que o garçom fecha a conta, eles somem daqui).
// ======================================================

function ouvirMeusPedidos(uid) {

  const meus =
    query(
      collection(db, "vendas"),
      where("userId", "==", uid)
    );


  let primeiraCarga =
    true;


  onSnapshot(
    meus,
    snapshot => {

      if (!primeiraCarga) {

        snapshot
          .docChanges()
          .forEach(
            mudanca => {

              if (mudanca.type !== "modified") {
                return;
              }

              const antes =
                meusPedidos.find(p => p.id === mudanca.doc.id);

              const status =
                mudanca.doc.data().status;

              if (antes && antes.status !== status) {
                showToast(
                  `Pedido ${codigoPedido(mudanca.doc.id)}: ${infoStatus(status).label}`
                );
              }

            }
          );

      }


      primeiraCarga =
        false;


      meusPedidos =
        snapshot.docs
          .map(
            documento => ({
              id: documento.id,
              ...documento.data()
            })
          )
          .filter(
            pedido =>
              pedido.tipo === "mesa" &&
              Number(pedido.mesa) === MESA &&
              (
                pedido.contaStatus === CONTA.ABERTA ||
                // cancelado continua visível por 1 hora, para
                // o cliente ver que o cancelamento deu certo
                (
                  pedido.status === STATUS.CANCELADO &&
                  Date.now() -
                    (getSaleDate(pedido.statusTimes?.cancelado)?.getTime() || Date.now()) <
                    60 * 60 * 1000
                )
              )
          )
          .sort(
            (a, b) =>
              (getSaleDate(b.createdAt)?.getTime() || Date.now()) -
              (getSaleDate(a.createdAt)?.getTime() || Date.now())
          );


      renderMeusPedidos();

    },
    error =>
      console.error(
        "Erro ao acompanhar pedidos:",
        error
      )
  );

}


function linhaDoTempo(pedido) {

  const etapas =
    etapasDoPedido(pedido);

  const atual =
    etapas.indexOf(pedido.status);

  if (atual < 0) {
    return "";
  }


  return `
    <ol class="order-timeline">
      ${etapas
        .map(
          (etapa, indice) => {

            const estado =
              indice < atual || pedido.status === STATUS.ENTREGUE
                ? "done"
                : indice === atual
                  ? "current"
                  : "todo";

            return `
              <li class="order-step ${estado}">
                <span class="order-step-dot" aria-hidden="true"></span>
                <span class="order-step-label">${infoStatus(etapa).curto}</span>
                <small></small>
              </li>
            `;

          }
        )
        .join("")}
    </ol>
  `;

}


function renderMeusPedidos() {

  const ativos =
    meusPedidos.filter(
      pedido =>
        pedido.status !== STATUS.CANCELADO &&
        pedido.status !== STATUS.ENTREGUE
    );


  $("mesaOrdersCount").textContent =
    ativos.length;

  $("mesaOrdersCount").classList.toggle(
    "hidden",
    ativos.length === 0
  );


  if (!meusPedidos.length) {

    ordersList.innerHTML = `
      <div class="orders-empty">
        <div>🧾</div>
        <strong>Nenhum pedido ainda</strong>
        <span>Escolha seus lanches no cardápio e envie para a cozinha.</span>
      </div>
    `;

    return;

  }


  const totalConta =
    meusPedidos
      .filter(pedido => pedido.status !== STATUS.CANCELADO)
      .reduce(
        (soma, pedido) =>
          soma + (Number(pedido.total) || 0),
        0
      );


  ordersList.innerHTML = `
    ${meusPedidos
      .map(
        pedido => {

          const info =
            infoStatus(pedido.status);

          return `
            <article class="order-card status-${escapeHtml(pedido.status)}">

              <header class="order-card-head">
                <div>
                  <strong class="order-code">${codigoPedido(pedido.id)}</strong>
                  <span class="order-date">
                    ${pedido.createdAt ? escapeHtml(formatSaleDate(pedido.createdAt)) : "Agora mesmo"}
                  </span>
                </div>
                <span class="order-status-badge status-${escapeHtml(pedido.status)}">
                  ${info.icone} ${escapeHtml(info.label)}
                </span>
              </header>

              <p class="order-message">
                ${escapeHtml(mensagemParaCliente(pedido))}
              </p>

              ${linhaDoTempo(pedido)}

              <ul class="order-items">
                ${(pedido.items || [])
                  .map(
                    item => `
                      <li>
                        <b>${Number(item.quantity) || 0}×</b>
                        ${escapeHtml(item.name || "Produto")}
                      </li>
                    `
                  )
                  .join("")}
              </ul>

              <footer class="order-card-foot">
                <span>🍽 Mesa ${MESA}</span>
                <strong>${brl(pedido.total)}</strong>
              </footer>

              ${
                pedido.status === STATUS.RECEBIDO
                  ? `<button
                       class="detail-button mesa-cancelar-button"
                       type="button"
                       data-cancelar="${escapeHtml(pedido.id)}">
                       Cancelar pedido
                     </button>`
                  : pedido.status === STATUS.EM_PREPARO
                    ? `<p class="mesa-sem-cancelar">
                         A cozinha já está preparando: não dá mais para cancelar.
                       </p>`
                    : ""
              }

            </article>
          `;

        }
      )
      .join("")}

    <div class="checkout-total mesa-total-conta">
      <span>Seus pedidos nesta mesa</span>
      <strong>${brl(totalConta)}</strong>
    </div>

    <p class="mesa-cart-aviso">
      Para pagar, chame o garçom: ele fecha a conta na maquininha.
    </p>
  `;

}


function abrirPedidos() {

  renderMeusPedidos();

  ordersModal.classList.remove("hidden");

}


// ======================================================
// CANCELAR (COM AVISO DA FILA)
// ======================================================

function pedirConfirmacaoCancelar(id) {

  const pedido =
    meusPedidos.find(item => item.id === id);

  if (!pedido) {
    return;
  }


  pedidoParaCancelar =
    pedido;

  $("cancelarResumo").textContent =
    `Pedido ${codigoPedido(pedido.id)} · ${brl(pedido.total)}`;

  cancelarModal.classList.remove("hidden");

}


async function confirmarCancelamento() {

  if (!pedidoParaCancelar) {
    return;
  }


  const botao =
    $("confirmarCancelar");

  botao.disabled = true;


  try {

    await cancelarPedidoMesaCliente(
      pedidoParaCancelar.id
    );

    showToast(
      `Pedido ${codigoPedido(pedidoParaCancelar.id)} cancelado.`
    );

  } catch (error) {

    console.error(error);

    showToast(error.message);

  } finally {

    botao.disabled = false;

    pedidoParaCancelar = null;

    closeModal(cancelarModal);

  }

}


// ======================================================
// EVENTOS
// ======================================================

categoriasEl.addEventListener(
  "click",
  event => {

    const botao =
      event.target.closest("[data-categoria]");

    if (!botao) {
      return;
    }

    categoriaAtiva =
      botao.dataset.categoria;

    renderCategorias();
    renderProdutos();

  }
);

produtosGrid.addEventListener(
  "click",
  event => {

    const botao =
      event.target.closest("[data-add]");

    if (botao) {
      adicionar(botao.dataset.add, 1);
    }

  }
);

$("mesaCartItens").addEventListener(
  "click",
  event => {

    const mais =
      event.target.closest("[data-mais]");

    const menos =
      event.target.closest("[data-menos]");

    if (mais) {
      adicionar(mais.dataset.mais, 1);
    }

    if (menos) {
      adicionar(menos.dataset.menos, -1);
    }

    if (!carrinho.length) {
      closeModal(cartModal);
    }

  }
);

ordersList.addEventListener(
  "click",
  event => {

    const botao =
      event.target.closest("[data-cancelar]");

    if (botao) {
      pedirConfirmacaoCancelar(botao.dataset.cancelar);
    }

  }
);

$("openMesaCartButton").addEventListener("click", () => cartModal.classList.remove("hidden"));
$("closeMesaCartModal").addEventListener("click", () => closeModal(cartModal));
$("enviarPedidoMesa").addEventListener("click", enviarPedido);
$("openMesaOrdersButton").addEventListener("click", abrirPedidos);
$("closeMesaOrdersModal").addEventListener("click", () => closeModal(ordersModal));
$("voltarCancelar").addEventListener("click", () => { pedidoParaCancelar = null; closeModal(cancelarModal); });
$("confirmarCancelar").addEventListener("click", confirmarCancelamento);

$("logoutButton").addEventListener(
  "click",
  () => {

    signOut(auth).then(
      () => {
        window.location.href =
          `login.html?voltar=${encodeURIComponent(`mesa.html?mesa=${MESA}`)}`;
      }
    );

  }
);

document.addEventListener(
  "keydown",
  event => {

    if (event.key === "Escape") {
      closeModal(cartModal);
      closeModal(ordersModal);
      closeModal(cancelarModal);
      pedidoParaCancelar = null;
    }

  }
);


// ======================================================
// INICIALIZAÇÃO
// ======================================================

if (!MESA) {

  // Link sem mesa válida: mostra o aviso, sem cardápio
  $("mesaConteudo").classList.add("hidden");
  $("mesaInvalida").classList.remove("hidden");
  $("openMesaOrdersButton").classList.add("hidden");
  $("mesaBadge").classList.add("hidden");

  document.body.style.visibility =
    "visible";

} else {

  $("mesaBadge").textContent = `🍽 Mesa ${MESA}`;
  $("mesaTitulo").textContent = `Mesa ${MESA}`;
  document.title = `Byte Burger | Mesa ${MESA}`;


  onAuthStateChanged(
    auth,
    async user => {

      // Precisa de login normal; depois volta para esta mesa
      if (!user || user.isAnonymous) {

        window.location.href =
          `login.html?voltar=${encodeURIComponent(`mesa.html?mesa=${MESA}`)}`;

        return;

      }


      // Equipe vai para a própria tela
      try {

        const perfil =
          await getDoc(doc(db, "usuarios", user.uid));

        const papel =
          perfil.exists()
            ? normalizarPapel(perfil.data().role)
            : "cliente";

        if (ehEquipe(papel)) {

          window.location.replace(
            PAGINA_DO_PAPEL[papel]
          );

          return;

        }

      } catch (error) {

        console.error(
          "Erro ao ler o papel:",
          error
        );

      }


      window.currentUser =
        user;

      document.body.style.visibility =
        "visible";


      renderCategorias();
      renderCarrinho();

      try {

        produtos =
          await fetchProducts();

      } catch (error) {

        console.error(error);

        showToast(
          "Não foi possível carregar o cardápio."
        );

      }

      renderProdutos();

      ouvirMeusPedidos(user.uid);

    }
  );

}
