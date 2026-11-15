// ======================================================
// COZINHA.JS — FILA DE PREPARO (papel "cozinha")
//
// Mostra, em tempo real, os pedidos "recebido" e
// "em_preparo" de delivery E de mesa, numa fila só,
// do mais antigo para o mais novo. O critério é a hora em
// que o pedido ENTROU na fila (entradaNaFila): para Pix,
// quando o balcão confirmou o pagamento; para mesa e
// pagamento na entrega, quando o pedido foi feito.
//
// Pedido cancelado sai da fila. Se o cliente pedir de
// novo, o pedido novo entra no FIM da fila (ele é mais
// novo que todos os outros) — é esse o aviso que o
// cliente da mesa vê antes de cancelar.
// ======================================================

import {
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import { db } from "./firebase.js";

import {
  escapeHtml,
  showToast
} from "./utils.js";

import {
  STATUS,
  ehMesa,
  codigoPedido,
  entradaNaFila
} from "./pedidos.js";

import {
  protegerPagina,
  devolverEstoqueDeCancelados,
  mudarStatus,
  horarioEmMs,
  tempoDecorrido,
  atualizarTemposNaTela,
  itensHtml,
  bipe
} from "./equipe.js";


const fila =
  document.getElementById("filaCozinha");

const liveBadge =
  document.getElementById("liveBadge");

const soundButton =
  document.getElementById("soundButton");


let pedidos = [];
let somLigado = false;


// Etapa que a cozinha controla
const ACAO_COZINHA = {

  recebido: {
    para: STATUS.EM_PREPARO,
    botao: "🔥 Iniciar preparo",
    rotulo: "Na fila"
  },

  em_preparo: {
    para: STATUS.PRONTO,
    botao: "✅ Pronto",
    rotulo: "Em preparo"
  }

};


function tipoBadge(pedido) {

  return ehMesa(pedido)
    ? `<span class="tipo-badge mesa">🍽 Mesa ${escapeHtml(String(pedido.mesa))}</span>`
    : `<span class="tipo-badge delivery">🛵 Delivery</span>`;

}


function renderFila() {

  if (!pedidos.length) {

    fila.innerHTML = `
      <div class="fila-vazia">
        <div>🍳</div>
        Nenhum pedido na fila. Os novos aparecem aqui sozinhos.
      </div>
    `;

    return;

  }


  fila.innerHTML =
    pedidos
      .map(
        (pedido, indice) => {

          const acao =
            ACAO_COZINHA[pedido.status];

          const desde =
            horarioEmMs(
              entradaNaFila(pedido)
            );

          return `
            <article class="fila-card status-${escapeHtml(pedido.status)}">

              <span class="fila-posicao">${indice + 1}º</span>

              <div class="fila-head">
                <strong class="fila-code">${codigoPedido(pedido.id)}</strong>
                <span class="fila-tempo" data-since="${desde}">
                  ${tempoDecorrido(desde)}
                </span>
              </div>

              <div class="fila-head">
                ${tipoBadge(pedido)}
                <span class="fila-status">${acao ? acao.rotulo : ""}</span>
              </div>

              <ul class="fila-itens">
                ${itensHtml(pedido.items)}
              </ul>

              ${
                acao
                  ? `
                    <button
                      class="primary-button"
                      type="button"
                      data-id="${escapeHtml(pedido.id)}"
                      data-de="${escapeHtml(pedido.status)}"
                      data-para="${escapeHtml(acao.para)}">
                      ${acao.botao}
                    </button>
                  `
                  : ""
              }

            </article>
          `;

        }
      )
      .join("");

}


function ouvirFila() {

  const naCozinha =
    query(
      collection(db, "vendas"),
      where(
        "status",
        "in",
        [STATUS.RECEBIDO, STATUS.EM_PREPARO]
      )
    );


  let primeiraCarga =
    true;


  onSnapshot(
    naCozinha,
    snapshot => {

      if (!primeiraCarga) {

        const novos =
          snapshot
            .docChanges()
            .filter(
              mudanca =>
                mudanca.type === "added"
            );

        if (novos.length) {

          if (somLigado) {
            bipe();
          }

          showToast(
            novos.length === 1
              ? `Novo pedido na fila: ${codigoPedido(novos[0].doc.id)}`
              : `${novos.length} pedidos novos na fila!`
          );

        }

      }


      primeiraCarga =
        false;


      pedidos =
        snapshot.docs
          .map(
            documento => ({
              id: documento.id,
              ...documento.data()
            })
          )
          .sort(
            (a, b) =>
              horarioEmMs(entradaNaFila(a)) -
              horarioEmMs(entradaNaFila(b))
          );


      liveBadge.classList.remove("is-offline");
      liveBadge.textContent = "● Ao vivo";

      renderFila();

    },
    error => {

      console.error(
        "Erro ao acompanhar a fila:",
        error
      );

      liveBadge.classList.add("is-offline");
      liveBadge.textContent = "● Sem conexão";

    }
  );

}


fila.addEventListener(
  "click",
  async event => {

    const botao =
      event.target.closest("[data-para]");

    if (!botao) {
      return;
    }


    botao.disabled =
      true;


    try {

      await mudarStatus(
        botao.dataset.id,
        botao.dataset.de,
        botao.dataset.para
      );

      showToast(
        botao.dataset.para === STATUS.PRONTO
          ? `${codigoPedido(botao.dataset.id)} pronto!`
          : `${codigoPedido(botao.dataset.id)} em preparo`
      );

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


// O navegador só deixa tocar som depois de um clique
soundButton.addEventListener(
  "click",
  () => {

    somLigado =
      !somLigado;

    soundButton.classList.toggle(
      "is-on",
      somLigado
    );

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
  papeis: ["cozinha"],
  pagina: "cozinha.html"
}).then(
  () => {

    ouvirFila();
    devolverEstoqueDeCancelados();
    atualizarTemposNaTela();

  }
);
