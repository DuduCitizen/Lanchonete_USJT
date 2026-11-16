// ======================================================
// CRM.JS — MÓDULO DE CLIENTES (painel do administrador)
//
// Lista de clientes, indicadores, segmentação e modal de
// detalhe (contato, endereço, histórico e mais comprados).
//
// FONTE DOS NÚMEROS: as vendas (coleção "vendas"), não os
// contadores de "clientes". Assim a última compra e o total
// gasto ficam corretos mesmo depois de cancelamentos.
// A coleção "clientes" entra só para nome/CPF/telefone.
//
// Só conta pedido de delivery com telefone e que entra no
// faturamento (contaNoFaturamento). Pedido de mesa não tem
// cadastro, então não aparece aqui.
//
// Chamado por admin.js → loadView("crm") → carregarCrm().
// ======================================================

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  brl,
  escapeHtml,
  getSaleDate,
  formatSaleDate,
  getPaymentIcon,
  showToast,
  closeModal
} from "./utils.js";

import {
  ehMesa,
  infoStatus,
  contaNoFaturamento
} from "./pedidos.js";

import {
  somenteDigitos,
  formatarCpf,
  formatarTelefone,
  formatarEndereco
} from "./perfil.js";


const $ = id =>
  document.getElementById(id);

const DIA_MS = 24 * 60 * 60 * 1000;

// Sem compra há mais que isso = cliente inativo
const DIAS_INATIVO = 30;

// Compras para virar "recorrente"
const MIN_RECORRENTE = 3;

// VIP = top 10% em gasto (e pelo menos 2 compras)
const PERCENTUAL_VIP = 0.1;

const SEGMENTOS = {
  vip: "VIP",
  recorrente: "Recorrente",
  novo: "Novo",
  ocasional: "Ocasional",
  inativo: "Inativo"
};


let clientes = [];
let segmentoAtivo = "todos";


// ======================================================
// MONTAR OS CLIENTES A PARTIR DE clientes + vendas
// ======================================================

function novoCliente(telefone, dados = {}) {

  return {
    telefone,
    nome: String(dados.nome || "Cliente"),
    cpf: String(dados.cpf || ""),
    compras: 0,
    gasto: 0,
    primeira: null,
    ultima: null,
    endereco: null,
    enderecoEm: 0,
    pedidos: [],
    produtos: {},
    tags: []
  };

}


function montarClientes(docsClientes, docsVendas) {

  const mapa = {};

  docsClientes.forEach(
    documento => {
      mapa[documento.id] =
        novoCliente(documento.id, documento.data());
    }
  );


  docsVendas.forEach(
    documento => {

      const venda = {
        id: documento.id,
        ...documento.data()
      };

      if (ehMesa(venda) || !venda.customerPhone) {
        return;
      }


      const telefone =
        String(venda.customerPhone);

      if (!mapa[telefone]) {
        mapa[telefone] =
          novoCliente(
            telefone,
            {
              nome: venda.customerName,
              cpf: venda.customerCpf
            }
          );
      }


      const cliente =
        mapa[telefone];

      const quando =
        getSaleDate(venda.createdAt)?.getTime() || 0;


      // O histórico mostra todos os pedidos (inclusive
      // cancelados); os números só os que valem dinheiro.
      cliente.pedidos.push({
        ...venda,
        quando
      });


      // Endereço mais recente usado em um pedido
      if (venda.deliveryAddress && quando >= cliente.enderecoEm) {
        cliente.endereco = venda.deliveryAddress;
        cliente.enderecoEm = quando;
      }


      if (!contaNoFaturamento(venda)) {
        return;
      }


      cliente.compras += 1;
      cliente.gasto += Number(venda.total) || 0;

      if (quando) {

        if (!cliente.primeira || quando < cliente.primeira) {
          cliente.primeira = quando;
        }

        if (!cliente.ultima || quando > cliente.ultima) {
          cliente.ultima = quando;
        }

      }


      (Array.isArray(venda.items) ? venda.items : []).forEach(
        item => {

          const nome =
            String(item.name || "Produto");

          cliente.produtos[nome] =
            (cliente.produtos[nome] || 0) +
            (Number(item.quantity) || 0);

        }
      );

    }
  );


  clientes =
    Object.values(mapa);

  segmentar();

}


// ======================================================
// SEGMENTAÇÃO (calculada na hora, nada é gravado)
// ======================================================

function diasDesde(timestamp) {

  return timestamp
    ? Math.floor((Date.now() - timestamp) / DIA_MS)
    : null;

}


function segmentar() {

  // Limite de gasto do top 10%
  const gastos =
    clientes
      .filter(cliente => cliente.compras > 0)
      .map(cliente => cliente.gasto)
      .sort((a, b) => b - a);

  const limiteVip =
    gastos.length
      ? gastos[Math.max(0, Math.ceil(gastos.length * PERCENTUAL_VIP) - 1)]
      : Infinity;


  clientes.forEach(
    cliente => {

      const tags = [];

      if (cliente.compras >= 2 && cliente.gasto >= limiteVip) {
        tags.push("vip");
      }

      if (cliente.compras >= MIN_RECORRENTE) {
        tags.push("recorrente");
      } else if (cliente.compras === 1) {
        tags.push("novo");
      } else if (cliente.compras === 2) {
        tags.push("ocasional");
      }

      if (
        cliente.compras > 0 &&
        diasDesde(cliente.ultima) > DIAS_INATIVO
      ) {
        tags.push("inativo");
      }

      cliente.tags = tags;

    }
  );

}


function tagsHtml(cliente) {

  return cliente.tags
    .map(
      tag => `
        <span class="crm-tag crm-tag-${tag}">
          ${SEGMENTOS[tag]}
        </span>
      `
    )
    .join("");

}


function textoUltimaCompra(cliente) {

  if (!cliente.ultima) {
    return "—";
  }

  const dias =
    diasDesde(cliente.ultima);

  if (dias <= 0) {
    return "Hoje";
  }

  return dias === 1
    ? "Ontem"
    : `Há ${dias} dias`;

}


// ======================================================
// INDICADORES
// ======================================================

function renderKpis() {

  const compradores =
    clientes.filter(cliente => cliente.compras > 0);

  const ativos =
    compradores.filter(
      cliente =>
        diasDesde(cliente.ultima) <= DIAS_INATIVO
    ).length;

  const totalCompras =
    compradores.reduce((soma, c) => soma + c.compras, 0);

  const totalGasto =
    compradores.reduce((soma, c) => soma + c.gasto, 0);

  const inicioMes =
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    ).getTime();

  const novosNoMes =
    compradores.filter(
      cliente =>
        cliente.primeira &&
        cliente.primeira >= inicioMes
    ).length;


  $("crmKpiTotal").textContent = compradores.length;
  $("crmKpiAtivos").textContent = ativos;
  $("crmKpiTicket").textContent =
    brl(totalCompras ? totalGasto / totalCompras : 0);
  $("crmKpiNovos").textContent = novosNoMes;

}


// ======================================================
// LISTA
// ======================================================

function ordenar(lista, criterio) {

  const ordens = {

    gasto: (a, b) => b.gasto - a.gasto,

    compras: (a, b) => b.compras - a.compras,

    recente: (a, b) => (b.ultima || 0) - (a.ultima || 0),

    nome: (a, b) => a.nome.localeCompare(b.nome, "pt-BR")

  };

  return lista.sort(ordens[criterio] || ordens.gasto);

}


function renderLista() {

  const busca =
    $("crmSearchInput").value.trim().toLowerCase();

  const buscaDigitos =
    somenteDigitos(busca);


  const filtrados =
    clientes.filter(
      cliente => {

        const bateBusca =
          !busca ||
          cliente.nome.toLowerCase().includes(busca) ||
          (
            buscaDigitos &&
            (
              cliente.telefone.includes(buscaDigitos) ||
              cliente.cpf.includes(buscaDigitos)
            )
          );

        const bateSegmento =
          segmentoAtivo === "todos" ||
          cliente.tags.includes(segmentoAtivo);

        return bateBusca && bateSegmento;

      }
    );


  ordenar(filtrados, $("crmSortSelect").value);


  $("crmContagem").textContent =
    `${filtrados.length} cliente${filtrados.length === 1 ? "" : "s"}`;

  $("crmEmpty").classList.toggle(
    "hidden",
    filtrados.length !== 0
  );


  $("crmLista").innerHTML =
    filtrados
      .map(
        cliente => `
          <div
            class="crm-row"
            data-crm-phone="${escapeHtml(cliente.telefone)}"
            tabindex="0"
            role="button"
            aria-label="Ver detalhes de ${escapeHtml(cliente.nome)}">

            <div class="sale-cell crm-nome-cell" data-label="Cliente">
              <strong>${escapeHtml(cliente.nome)}</strong>
              <small>${escapeHtml(formatarTelefone(cliente.telefone))}</small>
            </div>

            <div class="sale-cell crm-tags-cell" data-label="Perfil">
              ${tagsHtml(cliente) || "<small>—</small>"}
            </div>

            <div class="sale-cell" data-label="Compras">
              <strong>${cliente.compras}</strong>
            </div>

            <div class="sale-cell sale-total-cell" data-label="Total gasto">
              <strong>${brl(cliente.gasto)}</strong>
            </div>

            <div class="sale-cell" data-label="Ticket médio">
              <strong>${brl(cliente.compras ? cliente.gasto / cliente.compras : 0)}</strong>
            </div>

            <div class="sale-cell sale-date-cell" data-label="Última compra">
              ${escapeHtml(textoUltimaCompra(cliente))}
            </div>

          </div>
        `
      )
      .join("");

}


// ======================================================
// MODAL DE DETALHE DO CLIENTE
// ======================================================

function abrirDetalhe(telefone) {

  const cliente =
    clientes.find(item => item.telefone === telefone);

  if (!cliente) {
    return;
  }


  $("crmModalNome").textContent =
    cliente.nome;

  $("crmModalTags").innerHTML =
    tagsHtml(cliente);


  // ---- contato ----

  $("crmModalTelefone").textContent =
    formatarTelefone(cliente.telefone);

  $("crmModalCpf").textContent =
    cliente.cpf
      ? formatarCpf(cliente.cpf)
      : "—";

  $("crmModalDesde").textContent =
    cliente.primeira
      ? formatSaleDate(new Date(cliente.primeira))
      : "—";

  $("crmModalUltima").textContent =
    cliente.ultima
      ? `${formatSaleDate(new Date(cliente.ultima))} (${textoUltimaCompra(cliente).toLowerCase()})`
      : "—";

  $("crmModalEndereco").textContent =
    cliente.endereco
      ? [
          formatarEndereco(cliente.endereco),
          cliente.endereco.referencia
            ? `Ref.: ${cliente.endereco.referencia}`
            : ""
        ]
          .filter(Boolean)
          .join(" · ")
      : "Sem endereço registrado";

  $("crmWhatsapp").href =
    `https://wa.me/55${somenteDigitos(cliente.telefone)}`;


  // ---- números ----

  $("crmModalCompras").textContent =
    cliente.compras;

  $("crmModalGasto").textContent =
    brl(cliente.gasto);

  $("crmModalTicket").textContent =
    brl(cliente.compras ? cliente.gasto / cliente.compras : 0);


  // ---- mais comprados ----

  const top =
    Object.entries(cliente.produtos)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

  $("crmModalTop").innerHTML =
    top.length
      ? top
          .map(
            ([nome, quantidade]) => `
              <div class="sale-detail-item">
                <div class="sale-detail-item-main">
                  <strong>${escapeHtml(nome)}</strong>
                </div>
                <strong>${quantidade} un.</strong>
              </div>
            `
          )
          .join("")
      : `<div class="sale-no-items">Nenhum produto comprado ainda.</div>`;


  // ---- histórico de pedidos ----

  const pedidos =
    [...cliente.pedidos]
      .sort((a, b) => b.quando - a.quando);

  $("crmModalPedidos").innerHTML =
    pedidos.length
      ? pedidos
          .map(
            pedido => {

              const itens =
                (Array.isArray(pedido.items) ? pedido.items : [])
                  .map(
                    item =>
                      `${Number(item.quantity) || 0}× ${escapeHtml(item.name || "Produto")}`
                  )
                  .join(", ");

              return `
                <div class="sale-detail-item crm-pedido">

                  <div class="sale-detail-item-main">
                    <strong>
                      ${escapeHtml(formatSaleDate(pedido.createdAt))}
                    </strong>
                    <span>${itens || "Sem itens"}</span>
                    <span>
                      ${getPaymentIcon(pedido.payment)}
                      ${escapeHtml(pedido.payment || "")}
                      · ${escapeHtml(infoStatus(pedido.status).label)}
                    </span>
                  </div>

                  <strong>${brl(pedido.total)}</strong>

                </div>
              `;

            }
          )
          .join("")
      : `<div class="sale-no-items">Nenhum pedido.</div>`;


  $("crmModal").classList.remove("hidden");

}


// ======================================================
// CARREGAR
// ======================================================

export async function carregarCrm() {

  if (!window.db) {
    return;
  }


  $("crmLista").innerHTML = `
    <div class="history-loading">
      <div class="history-loading-icon">⏳</div>
      <strong>Carregando clientes...</strong>
      <span>Buscando informações no Firebase.</span>
    </div>
  `;


  try {

    const [snapshotClientes, snapshotVendas] =
      await Promise.all([
        getDocs(collection(window.db, "clientes")),
        getDocs(collection(window.db, "vendas"))
      ]);

    montarClientes(
      snapshotClientes.docs,
      snapshotVendas.docs
    );

    renderKpis();
    renderLista();

  } catch (error) {

    console.error(
      "Erro ao carregar o CRM:",
      error
    );

    $("crmLista").innerHTML = `
      <div class="history-loading">
        <div class="history-loading-icon">⚠️</div>
        <strong>Erro ao carregar clientes</strong>
        <span>${escapeHtml(error.message)}</span>
      </div>
    `;

    showToast("Não foi possível carregar os clientes.");

  }

}


// ======================================================
// EVENTOS
// ======================================================

$("crmSearchInput").addEventListener("input", renderLista);
$("crmSortSelect").addEventListener("change", renderLista);

$("crmSegmentos").addEventListener(
  "click",
  event => {

    const botao =
      event.target.closest("[data-segmento]");

    if (!botao) {
      return;
    }

    segmentoAtivo =
      botao.dataset.segmento;

    document
      .querySelectorAll("#crmSegmentos [data-segmento]")
      .forEach(
        item =>
          item.classList.toggle(
            "is-active",
            item === botao
          )
      );

    renderLista();

  }
);

$("crmLista").addEventListener(
  "click",
  event => {

    const linha =
      event.target.closest("[data-crm-phone]");

    if (linha) {
      abrirDetalhe(linha.dataset.crmPhone);
    }

  }
);

// Teclado: Enter / espaço abrem o cliente em foco
$("crmLista").addEventListener(
  "keydown",
  event => {

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    const linha =
      event.target.closest("[data-crm-phone]");

    if (linha) {
      event.preventDefault();
      abrirDetalhe(linha.dataset.crmPhone);
    }

  }
);

$("closeCrmModal").addEventListener(
  "click",
  () => closeModal($("crmModal"))
);

$("crmModal").addEventListener(
  "click",
  event => {

    if (event.target === $("crmModal")) {
      closeModal($("crmModal"));
    }

  }
);

document.addEventListener(
  "keydown",
  event => {

    if (event.key === "Escape") {
      closeModal($("crmModal"));
    }

  }
);
