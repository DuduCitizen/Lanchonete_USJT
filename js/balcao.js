// ======================================================
// BALCAO.JS — PEDIDOS DO DELIVERY (papel "balconista")
//
// Quadro em tempo real com os pedidos de delivery em
// andamento. O balconista:
//   - confere o Pix no app do banco e clica em
//     "Confirmar Pix" (o pedido vai para a fila da cozinha);
//   - acompanha o preparo (quem marca "em preparo" e
//     "pronto" é a cozinha);
//   - entrega o lanche pronto ao motoboy ("Saiu para
//     entrega") e depois marca "Entregue";
//   - cancela, se precisar, enquanto o preparo não começou
//     (o estoque volta e o CRM é desfeito). O cliente do
//     fast food não cancela sozinho.
// ======================================================

import {
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import { db } from "./firebase.js";

import {
  brl,
  escapeHtml,
  getPaymentIcon,
  showToast
} from "./utils.js";

import {
  STATUS,
  STATUS_ATIVOS,
  infoStatus,
  ehMesa,
  ehPix,
  codigoPedido
} from "./pedidos.js";

import {
  formatarTelefone,
  formatarEndereco,
  linkMapa
} from "./perfil.js";

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


const board =
  document.getElementById("balcaoBoard");

const liveBadge =
  document.getElementById("liveBadge");

const soundButton =
  document.getElementById("soundButton");


let pedidos = [];
let somLigado = false;


const COLUNAS = [
  {
    chave: "pagamento",
    status: [STATUS.AGUARDANDO_PAGAMENTO],
    titulo: "⏳ Aguardando pagamento",
    classe: "status-aguardando_pagamento",
    vazio: "Nenhum Pix para conferir."
  },
  {
    chave: "cozinha",
    status: [STATUS.RECEBIDO, STATUS.EM_PREPARO],
    titulo: "🔥 Na cozinha",
    classe: "status-em_preparo",
    vazio: "Nada sendo preparado."
  },
  {
    chave: "prontos",
    status: [STATUS.PRONTO],
    titulo: "✅ Prontos",
    classe: "status-pronto",
    vazio: "Nada esperando o motoboy."
  },
  {
    chave: "entrega",
    status: [STATUS.SAIU_PARA_ENTREGA],
    titulo: "🛵 Em entrega",
    classe: "status-saiu_para_entrega",
    vazio: "Nenhum motoboy na rua."
  }
];


// O que o balcão pode fazer em cada status
const ACOES = {

  aguardando_pagamento: {
    para: STATUS.RECEBIDO,
    botao: "✔ Confirmar Pix",
    extras: () => ({ paidAt: serverTimestamp() })
  },

  pronto: {
    para: STATUS.SAIU_PARA_ENTREGA,
    botao: "🛵 Saiu para entrega"
  },

  saiu_para_entrega: {
    para: STATUS.ENTREGUE,
    botao: "✔ Entregue"
  }

};


const CANCELAVEIS = [
  STATUS.AGUARDANDO_PAGAMENTO,
  STATUS.RECEBIDO
];


function clienteHtml(pedido) {

  const endereco =
    pedido.deliveryAddress;

  return `
    <div class="kitchen-customer">

      <strong>👤 ${escapeHtml(pedido.customerName || "Cliente")}</strong>

      ${
        pedido.customerPhone
          ? `<a class="kitchen-phone" href="tel:+55${escapeHtml(pedido.customerPhone)}">
               📞 ${escapeHtml(formatarTelefone(pedido.customerPhone))}
             </a>`
          : ""
      }

      ${
        endereco
          ? `<div class="kitchen-address">
               <span>📍 ${escapeHtml(formatarEndereco(endereco))}</span>
               ${
                 endereco.referencia
                   ? `<small>Ref.: ${escapeHtml(endereco.referencia)}</small>`
                   : ""
               }
               <a href="${escapeHtml(linkMapa(endereco))}" target="_blank" rel="noopener">
                 Abrir no mapa ↗
               </a>
             </div>`
          : ""
      }

    </div>
  `;

}


function cartaoHtml(pedido) {

  const acao =
    ACOES[pedido.status];

  const desde =
    horarioEmMs(pedido.createdAt);


  const conferirPix =
    pedido.status === STATUS.AGUARDANDO_PAGAMENTO
      ? `
        <p class="kitchen-pix-check">
          Confira no banco um Pix de <b>${brl(pedido.total)}</b>
          com identificador
          <code>${escapeHtml(pedido.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 25))}</code>
        </p>
      `
      : "";


  return `
    <article class="kitchen-card status-${escapeHtml(pedido.status)}">

      <header class="kitchen-card-head">
        <strong class="kitchen-code">${codigoPedido(pedido.id)}</strong>
        <span class="kitchen-elapsed" data-since="${desde}">
          ${tempoDecorrido(desde)}
        </span>
      </header>

      ${
        [STATUS.RECEBIDO, STATUS.EM_PREPARO].includes(pedido.status)
          ? `<span class="fila-status" style="--st: var(--st-${pedido.status === STATUS.RECEBIDO ? "recebido" : "preparo"})">
               ${escapeHtml(infoStatus(pedido.status).label)}
             </span>`
          : ""
      }

      ${clienteHtml(pedido)}

      <ul class="kitchen-items">
        ${itensHtml(pedido.items)}
      </ul>

      <div class="kitchen-card-foot">
        <span>${getPaymentIcon(pedido.payment)} ${escapeHtml(pedido.payment || "")}</span>
        <strong>${brl(pedido.total)}</strong>
      </div>

      ${conferirPix}

      <div class="kitchen-actions">

        ${
          acao
            ? `<button
                 class="primary-button"
                 type="button"
                 data-acao="avancar"
                 data-id="${escapeHtml(pedido.id)}">
                 ${acao.botao}
               </button>`
            : ""
        }

        ${
          CANCELAVEIS.includes(pedido.status)
            ? `<button
                 class="detail-button kitchen-cancel"
                 type="button"
                 data-acao="cancelar"
                 data-id="${escapeHtml(pedido.id)}">
                 Cancelar
               </button>`
            : ""
        }

      </div>

    </article>
  `;

}


function renderBoard() {

  board.innerHTML =
    COLUNAS
      .map(
        coluna => {

          const daColuna =
            pedidos.filter(
              pedido =>
                coluna.status.includes(pedido.status)
            );

          return `
            <section class="kitchen-column ${coluna.classe}">

              <h3 class="kitchen-column-title">
                <span>${coluna.titulo}</span>
                <b>${daColuna.length}</b>
              </h3>

              <div class="kitchen-column-body">
                ${
                  daColuna.length
                    ? daColuna.map(cartaoHtml).join("")
                    : `<p class="kitchen-empty">${coluna.vazio}</p>`
                }
              </div>

            </section>
          `;

        }
      )
      .join("");

}


function ouvirPedidos() {

  const ativos =
    query(
      collection(db, "vendas"),
      where("status", "in", STATUS_ATIVOS)
    );


  let primeiraCarga =
    true;


  onSnapshot(
    ativos,
    snapshot => {

      const delivery =
        documento =>
          !ehMesa(documento.data());


      if (!primeiraCarga) {

        const novos =
          snapshot
            .docChanges()
            .filter(
              mudanca =>
                mudanca.type === "added" &&
                delivery(mudanca.doc)
            );

        if (novos.length) {

          if (somLigado) {
            bipe();
          }

          showToast(
            `Novo pedido de delivery: ${codigoPedido(novos[0].doc.id)}`
          );

        }

      }


      primeiraCarga =
        false;


      // Mais antigo primeiro em todas as colunas
      pedidos =
        snapshot.docs
          .filter(delivery)
          .map(
            documento => ({
              id: documento.id,
              ...documento.data()
            })
          )
          .sort(
            (a, b) =>
              horarioEmMs(a.createdAt) -
              horarioEmMs(b.createdAt)
          );


      liveBadge.classList.remove("is-offline");
      liveBadge.textContent = "● Ao vivo";

      renderBoard();

    },
    error => {

      console.error(
        "Erro ao acompanhar pedidos:",
        error
      );

      liveBadge.classList.add("is-offline");
      liveBadge.textContent = "● Sem conexão";

    }
  );

}


board.addEventListener(
  "click",
  async event => {

    const botao =
      event.target.closest("[data-acao]");

    if (!botao) {
      return;
    }


    const pedido =
      pedidos.find(
        item =>
          item.id === botao.dataset.id
      );

    if (!pedido) {
      return;
    }


    botao.disabled =
      true;


    try {

      if (botao.dataset.acao === "avancar") {

        const acao =
          ACOES[pedido.status];

        await mudarStatus(
          pedido.id,
          pedido.status,
          acao.para,
          acao.extras ? acao.extras() : {}
        );

        showToast(
          `${codigoPedido(pedido.id)}: ${infoStatus(acao.para).label}`
        );

      }


      if (botao.dataset.acao === "cancelar") {

        const confirmado =
          window.confirm(
            `Cancelar o pedido ${codigoPedido(pedido.id)} (${brl(pedido.total)})?\n\n` +
            "Os itens voltam para o estoque." +
            (
              ehPix(pedido.payment) &&
              pedido.status !== STATUS.AGUARDANDO_PAGAMENTO
                ? "\n\nAtenção: o Pix já foi confirmado. Devolva o dinheiro ao cliente pelo app do banco."
                : ""
            )
          );

        if (!confirmado) {
          botao.disabled = false;
          return;
        }

        await cancelarPedido(
          pedido.id,
          CANCELAVEIS
        );

        showToast(
          `Pedido ${codigoPedido(pedido.id)} cancelado. Estoque devolvido.`
        );

      }

    } catch (error) {

      console.error(error);

      showToast(
        `Não foi possível atualizar: ${error.message}`
      );

      botao.disabled =
        false;

    }

  }
);


soundButton.addEventListener(
  "click",
  () => {

    somLigado =
      !somLigado;

    soundButton.classList.toggle("is-on", somLigado);

    soundButton.textContent =
      somLigado
        ? "🔔 Som ligado"
        : "🔇 Ativar som";

    if (somLigado) {
      bipe();
    }

  }
);


protegerPagina({
  papeis: ["balconista"],
  pagina: "balcao.html"
}).then(
  () => {

    ouvirPedidos();
    devolverEstoqueDeCancelados();
    atualizarTemposNaTela();

  }
);
