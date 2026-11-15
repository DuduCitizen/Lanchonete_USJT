// ======================================================
// GARCOM.JS — TELA DO GARÇOM (papel "garcom")
//
// Escuta em tempo real os pedidos de MESA com conta em
// aberto (tipo == "mesa" e contaStatus == "aberta") e monta:
//   - a grade de mesas (ocupada, total, lanche pronto);
//   - a conta de cada mesa (fechar na maquininha);
//   - a lista "prontos para levar";
//   - o formulário para anotar pedido pelo cliente.
//
// Fechar a conta marca TODOS os pedidos abertos da mesa
// como pagos, numa transação só. A partir daí eles entram
// no faturamento do admin, e a mesa fica livre para os
// próximos clientes.
// ======================================================

import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import { db } from "./firebase.js";

import {
  brl,
  escapeHtml,
  showToast,
  closeModal,
  fetchProducts
} from "./utils.js";

import {
  STATUS,
  CONTA,
  TIPO,
  infoStatus,
  codigoPedido
} from "./pedidos.js";

import {
  criarPedidoMesa
} from "./pedido-mesa.js";

import {
  protegerPagina,
  devolverEstoqueDeCancelados,
  mudarStatus,
  cancelarPedido,
  horarioEmMs,
  tempoDecorrido,
  atualizarTemposNaTela,
  itensHtml,
  bipe
} from "./equipe.js";

import { NUMERO_DE_MESAS } from "./config-restaurante.js";


const $ = id =>
  document.getElementById(id);


let pedidosAbertos = [];   // pedidos de mesa com conta aberta
let mesaAberta = null;     // mesa com a conta na tela
let produtos = [];
let novoPedido = {};       // { produtoId: quantidade }


// ======================================================
// ABAS
// ======================================================

function mostrarAba(nome) {

  document
    .querySelectorAll("[data-garcom-view]")
    .forEach(
      secao =>
        secao.classList.toggle(
          "hidden",
          secao.dataset.garcomView !== nome
        )
    );

  document
    .querySelectorAll("[data-tab]")
    .forEach(
      aba =>
        aba.classList.toggle(
          "is-active",
          aba.dataset.tab === nome
        )
    );

  window.scrollTo(0, 0);


  if (nome === "novo") {
    carregarCardapio();
  }

}


document
  .querySelector(".garcom-tabs")
  .addEventListener(
    "click",
    event => {

      const aba =
        event.target.closest("[data-tab]");

      if (aba) {
        mostrarAba(aba.dataset.tab);
      }

    }
  );


// ======================================================
// DADOS EM TEMPO REAL
// ======================================================

function pedidosDaMesa(mesa) {

  return pedidosAbertos
    .filter(
      pedido =>
        Number(pedido.mesa) === Number(mesa) &&
        pedido.status !== STATUS.CANCELADO
    )
    .sort(
      (a, b) =>
        horarioEmMs(a.createdAt) -
        horarioEmMs(b.createdAt)
    );

}


function totalDe(pedidos) {

  return Math.round(
    pedidos.reduce(
      (soma, pedido) =>
        soma + (Number(pedido.total) || 0),
      0
    ) * 100
  ) / 100;

}


function ouvirMesas() {

  const abertos =
    query(
      collection(db, "vendas"),
      where("tipo", "==", TIPO.MESA),
      where("contaStatus", "==", CONTA.ABERTA)
    );


  let primeiraCarga =
    true;


  onSnapshot(
    abertos,
    snapshot => {

      // Aviso quando um lanche fica pronto
      if (!primeiraCarga) {

        snapshot
          .docChanges()
          .forEach(
            mudanca => {

              const dados =
                mudanca.doc.data();

              const antes =
                pedidosAbertos.find(p => p.id === mudanca.doc.id);

              if (
                mudanca.type === "modified" &&
                dados.status === STATUS.PRONTO &&
                antes?.status !== STATUS.PRONTO
              ) {

                bipe();

                showToast(
                  `🔔 Mesa ${dados.mesa}: lanche pronto para levar!`
                );

              }

            }
          );

      }


      primeiraCarga =
        false;


      pedidosAbertos =
        snapshot.docs.map(
          documento => ({
            id: documento.id,
            ...documento.data()
          })
        );


      renderMesas();
      renderProntos();

      if (mesaAberta !== null) {
        renderConta();
      }

    },
    error => {

      console.error(
        "Erro ao acompanhar as mesas:",
        error
      );

      showToast(
        "Sem conexão com os pedidos das mesas."
      );

    }
  );

}


// ======================================================
// GRADE DE MESAS
// ======================================================

function renderMesas() {

  const caixas = [];

  for (let mesa = 1; mesa <= NUMERO_DE_MESAS; mesa++) {

    const pedidos =
      pedidosDaMesa(mesa);

    const prontos =
      pedidos.filter(
        pedido =>
          pedido.status === STATUS.PRONTO
      ).length;

    const classes = [
      "mesa-box",
      pedidos.length ? "ocupada" : "",
      prontos ? "tem-pronto" : ""
    ].join(" ");


    caixas.push(`
      <button class="${classes}" type="button" data-mesa="${mesa}">
        <strong>${mesa}</strong>
        ${
          pedidos.length
            ? `
              <span class="mesa-total">${brl(totalDe(pedidos))}</span>
              <small>${pedidos.length} pedido${pedidos.length > 1 ? "s" : ""}</small>
              ${prontos ? `<span class="mesa-flag">🔔 ${prontos} pronto${prontos > 1 ? "s" : ""}</span>` : ""}
            `
            : `<small>Livre</small>`
        }
      </button>
    `);

  }


  $("mesasGrid").innerHTML =
    caixas.join("");

}


$("mesasGrid").addEventListener(
  "click",
  event => {

    const caixa =
      event.target.closest("[data-mesa]");

    if (caixa) {
      abrirConta(Number(caixa.dataset.mesa));
    }

  }
);


// ======================================================
// PRONTOS PARA LEVAR
// ======================================================

function renderProntos() {

  const prontos =
    pedidosAbertos
      .filter(
        pedido =>
          pedido.status === STATUS.PRONTO
      )
      .sort(
        (a, b) =>
          horarioEmMs(a.statusTimes?.pronto) -
          horarioEmMs(b.statusTimes?.pronto)
      );


  $("prontosBadge").textContent =
    prontos.length;

  $("prontosBadge").classList.toggle(
    "hidden",
    prontos.length === 0
  );


  $("prontosLista").innerHTML =
    prontos.length
      ? prontos
          .map(
            pedido => {

              const desde =
                horarioEmMs(pedido.statusTimes?.pronto);

              return `
                <article class="kitchen-card status-pronto">

                  <header class="kitchen-card-head">
                    <span class="tipo-badge mesa">🍽 Mesa ${escapeHtml(String(pedido.mesa))}</span>
                    <span class="kitchen-elapsed" data-since="${desde}">
                      ${tempoDecorrido(desde)}
                    </span>
                  </header>

                  <strong class="kitchen-code">${codigoPedido(pedido.id)}</strong>

                  <ul class="kitchen-items">
                    ${itensHtml(pedido.items)}
                  </ul>

                  <div class="kitchen-actions">
                    <button
                      class="primary-button"
                      type="button"
                      data-entregar="${escapeHtml(pedido.id)}">
                      ✔ Entregue na mesa
                    </button>
                  </div>

                </article>
              `;

            }
          )
          .join("")
      : `<p class="kitchen-empty">Nenhum lanche esperando para ser levado.</p>`;

}


async function entregarNaMesa(id, botao) {

  botao.disabled = true;

  try {

    await mudarStatus(
      id,
      STATUS.PRONTO,
      STATUS.ENTREGUE
    );

    showToast(
      `${codigoPedido(id)} entregue na mesa.`
    );

  } catch (error) {

    console.error(error);

    showToast(error.message);

    botao.disabled = false;

  }

}


$("prontosLista").addEventListener(
  "click",
  event => {

    const botao =
      event.target.closest("[data-entregar]");

    if (botao) {
      entregarNaMesa(botao.dataset.entregar, botao);
    }

  }
);


// ======================================================
// CONTA DA MESA
// ======================================================

function abrirConta(mesa) {

  mesaAberta =
    mesa;

  $("contaPessoas").value =
    1;

  renderConta();

  $("contaModal").classList.remove("hidden");

}


function renderConta() {

  const pedidos =
    pedidosDaMesa(mesaAberta);

  const total =
    totalDe(pedidos);


  $("contaTitulo").textContent =
    `Mesa ${mesaAberta}`;

  $("contaSubtitulo").textContent =
    pedidos.length
      ? `${pedidos.length} pedido${pedidos.length > 1 ? "s" : ""} na conta`
      : "Mesa livre: nenhum pedido em aberto.";


  $("contaPedidos").innerHTML =
    pedidos
      .map(
        pedido => {

          const info =
            infoStatus(
              pedido.status === STATUS.ENTREGUE
                ? STATUS.ENTREGUE
                : pedido.status
            );

          return `
            <div class="conta-pedido status-${escapeHtml(pedido.status)}">

              <div class="conta-pedido-head">
                <span>${codigoPedido(pedido.id)} · ${pedido.criadoPor === "garcom" ? "anotado pelo garçom" : "pelo celular"}</span>
                <span class="order-status-badge status-${escapeHtml(pedido.status)}" style="--st: var(--st-${{
                  recebido: "recebido",
                  em_preparo: "preparo",
                  pronto: "pronto",
                  entregue: "entregue"
                }[pedido.status] || "recebido"})">
                  ${info.icone} ${escapeHtml(pedido.status === STATUS.ENTREGUE ? "Entregue na mesa" : info.label)}
                </span>
              </div>

              <ul class="conta-itens">
                ${(pedido.items || [])
                  .map(
                    item => `
                      <li>
                        <span>${Number(item.quantity) || 0}× ${escapeHtml(item.name || "Produto")}</span>
                        <span>${brl((Number(item.price) || 0) * (Number(item.quantity) || 0))}</span>
                      </li>
                    `
                  )
                  .join("")}
              </ul>

              ${
                pedido.status === STATUS.RECEBIDO
                  ? `<button class="detail-button kitchen-cancel" type="button" data-cancelar-pedido="${escapeHtml(pedido.id)}">
                       Cancelar este pedido
                     </button>`
                  : pedido.status === STATUS.PRONTO
                    ? `<button class="detail-button" type="button" data-entregar-conta="${escapeHtml(pedido.id)}">
                         ✔ Entregue na mesa
                       </button>`
                    : ""
              }

            </div>
          `;

        }
      )
      .join("");


  $("contaResumo").classList.toggle(
    "hidden",
    pedidos.length === 0
  );

  $("anotarParaMesa").classList.toggle(
    "hidden",
    false
  );

  $("contaTotal").textContent =
    brl(total);

  atualizarDivisao();


  // Aviso: ainda tem pedido na cozinha
  const naoEntregues =
    pedidos.filter(
      pedido =>
        pedido.status !== STATUS.ENTREGUE
    );

  $("contaAviso").classList.toggle(
    "hidden",
    naoEntregues.length === 0
  );

  $("contaAviso").textContent =
    naoEntregues.length
      ? `⚠️ ${naoEntregues.length} pedido(s) desta mesa ainda não foram entregues. Confira com os clientes antes de fechar.`
      : "";

}


function atualizarDivisao() {

  const pessoas =
    Math.min(
      30,
      Math.max(
        1,
        Math.floor(Number($("contaPessoas").value) || 1)
      )
    );

  const total =
    totalDe(pedidosDaMesa(mesaAberta));

  $("contaPorPessoa").textContent =
    brl(
      Math.ceil((total / pessoas) * 100) / 100
    );

}


async function fecharConta() {

  const pedidos =
    pedidosDaMesa(mesaAberta);

  if (!pedidos.length) {
    return;
  }


  const forma =
    document.querySelector(
      'input[name="contaPagamento"]:checked'
    ).value;

  const total =
    totalDe(pedidos);


  const confirmado =
    window.confirm(
      `Fechar a conta da Mesa ${mesaAberta}?\n\n` +
      `Total: ${brl(total)} no ${forma}.\n` +
      "Confirme que o pagamento foi aprovado na maquininha."
    );

  if (!confirmado) {
    return;
  }


  const botao =
    $("fecharContaButton");

  botao.disabled = true;
  botao.textContent = "Fechando...";


  try {

    await runTransaction(
      db,
      async transaction => {

        const refs =
          pedidos.map(
            pedido =>
              doc(db, "vendas", pedido.id)
          );

        const atuais = [];

        for (const ref of refs) {
          atuais.push(await transaction.get(ref));
        }


        // Se algo mudou nesse meio-tempo (outro garçom
        // fechou, pedido cancelado), para e avisa
        for (const atual of atuais) {

          if (
            !atual.exists() ||
            atual.data().contaStatus !== CONTA.ABERTA ||
            atual.data().status === STATUS.CANCELADO
          ) {
            throw new Error("A conta mudou enquanto você fechava. Confira de novo.");
          }

        }


        refs.forEach(
          ref =>
            transaction.update(
              ref,
              {
                contaStatus: CONTA.PAGA,
                payment: forma,
                paidAt: serverTimestamp(),
                contaFechadaEm: serverTimestamp(),
                fechadoPor: window.currentUser.uid
              }
            )
        );

      }
    );


    showToast(
      `Conta da Mesa ${mesaAberta} fechada: ${brl(total)} (${forma}).`
    );

    closeModal($("contaModal"));

    mesaAberta = null;

  } catch (error) {

    console.error(error);

    showToast(
      `Não foi possível fechar: ${error.message}`
    );

  } finally {

    botao.disabled = false;
    botao.textContent = "Fechar conta";

  }

}


$("contaPedidos").addEventListener(
  "click",
  async event => {

    const cancelar =
      event.target.closest("[data-cancelar-pedido]");

    const entregar =
      event.target.closest("[data-entregar-conta]");


    if (entregar) {
      entregarNaMesa(entregar.dataset.entregarConta, entregar);
    }


    if (cancelar) {

      const id =
        cancelar.dataset.cancelarPedido;

      if (
        !window.confirm(
          `Cancelar o pedido ${codigoPedido(id)}?\n\nOs itens voltam para o estoque e saem da conta da mesa.`
        )
      ) {
        return;
      }

      cancelar.disabled = true;

      try {

        await cancelarPedido(
          id,
          [STATUS.RECEBIDO]
        );

        showToast(
          `Pedido ${codigoPedido(id)} cancelado.`
        );

      } catch (error) {

        console.error(error);

        showToast(error.message);

        cancelar.disabled = false;

      }

    }

  }
);


$("contaPessoas").addEventListener("input", atualizarDivisao);
$("fecharContaButton").addEventListener("click", fecharConta);

$("fecharContaModal").addEventListener(
  "click",
  () => {
    closeModal($("contaModal"));
    mesaAberta = null;
  }
);

$("anotarParaMesa").addEventListener(
  "click",
  () => {

    $("novoPedidoMesa").value =
      String(mesaAberta);

    closeModal($("contaModal"));

    mesaAberta = null;

    mostrarAba("novo");

  }
);


// ======================================================
// ANOTAR PEDIDO PELO CLIENTE
// ======================================================

function preencherSelectMesas() {

  const opcoes = [];

  for (let mesa = 1; mesa <= NUMERO_DE_MESAS; mesa++) {
    opcoes.push(`<option value="${mesa}">Mesa ${mesa}</option>`);
  }

  $("novoPedidoMesa").innerHTML =
    opcoes.join("");

}


async function carregarCardapio() {

  try {

    produtos =
      (await fetchProducts())
        .sort(
          (a, b) =>
            a.category.localeCompare(b.category) ||
            a.name.localeCompare(b.name)
        );

  } catch (error) {

    console.error(error);

    showToast(
      "Não foi possível carregar o cardápio."
    );

  }

  renderCardapio();

}


function renderCardapio() {

  $("cardapioGarcom").innerHTML =
    produtos
      .map(
        produto => {

          const disponivel =
            produto.available &&
            produto.stock > 0;

          const qtd =
            novoPedido[produto.id] || 0;

          return `
            <div class="cardapio-item ${disponivel ? "" : "sem-estoque"}">

              <div>
                <strong>${escapeHtml(produto.name)}</strong>
                <small>
                  ${escapeHtml(produto.category)} · ${brl(produto.price)}
                  ${disponivel ? "" : " · indisponível"}
                </small>
              </div>

              <div class="qtd-control">
                <button type="button" data-menos="${escapeHtml(produto.id)}" ${qtd ? "" : "disabled"} aria-label="Diminuir">−</button>
                <span>${qtd}</span>
                <button type="button" data-mais="${escapeHtml(produto.id)}" ${disponivel && qtd < produto.stock ? "" : "disabled"} aria-label="Aumentar">+</button>
              </div>

            </div>
          `;

        }
      )
      .join("");


  const itens =
    itensDoNovoPedido();

  const quantidade =
    itens.reduce((soma, item) => soma + item.quantity, 0);

  $("novoPedidoQtd").textContent =
    `${quantidade} ${quantidade === 1 ? "item" : "itens"}`;

  $("novoPedidoTotal").textContent =
    brl(
      itens.reduce(
        (soma, item) =>
          soma + item.price * item.quantity,
        0
      )
    );

  $("enviarNovoPedido").disabled =
    quantidade === 0;

}


function itensDoNovoPedido() {

  return Object.entries(novoPedido)
    .filter(([, quantidade]) => quantidade > 0)
    .map(
      ([id, quantidade]) => {

        const produto =
          produtos.find(item => item.id === id);

        return {
          id,
          name: produto?.name || "Produto",
          price: produto?.price || 0,
          quantity: quantidade
        };

      }
    );

}


$("cardapioGarcom").addEventListener(
  "click",
  event => {

    const mais =
      event.target.closest("[data-mais]");

    const menos =
      event.target.closest("[data-menos]");

    if (mais) {
      const id = mais.dataset.mais;
      novoPedido[id] = (novoPedido[id] || 0) + 1;
    }

    if (menos) {
      const id = menos.dataset.menos;
      novoPedido[id] = Math.max(0, (novoPedido[id] || 0) - 1);
    }

    if (mais || menos) {
      renderCardapio();
    }

  }
);


$("enviarNovoPedido").addEventListener(
  "click",
  async () => {

    const mesa =
      Number($("novoPedidoMesa").value);

    const botao =
      $("enviarNovoPedido");

    botao.disabled = true;
    botao.textContent = "Enviando...";


    try {

      const pedido =
        await criarPedidoMesa({
          mesa,
          itens: itensDoNovoPedido(),
          criadoPor: "garcom"
        });

      novoPedido = {};

      showToast(
        `Pedido ${codigoPedido(pedido.id)} da Mesa ${mesa} enviado para a cozinha!`
      );

      await carregarCardapio();

      mostrarAba("mesas");

    } catch (error) {

      console.error(error);

      showToast(
        `Não foi possível enviar: ${error.message}`
      );

    } finally {

      botao.textContent = "Enviar para a cozinha";
      renderCardapio();

    }

  }
);


// ======================================================
// INICIALIZAÇÃO
// ======================================================

document.addEventListener(
  "keydown",
  event => {

    if (event.key === "Escape") {
      closeModal($("contaModal"));
      mesaAberta = null;
    }

  }
);


protegerPagina({
  papeis: ["garcom"],
  pagina: "garcom.html"
}).then(
  () => {

    preencherSelectMesas();
    renderMesas();
    ouvirMesas();
    devolverEstoqueDeCancelados();
    atualizarTemposNaTela();

  }
);
