// ======================================================
// ADMIN.JS — PAINEL DO ADMINISTRADOR
//
// Módulos: Início, Vendas (histórico), Produtos (com
// calculadora de custo x lucro), Relatórios e Financeiro.
//
// O controle de acesso fica no script de autenticação do
// admin.html (só administrador chega até aqui) e, de
// verdade, nas Security Rules do Firestore. Este arquivo é
// carregado depois da autenticação ou antes dela — nos dois
// casos window.iniciarAdmin() roda uma única vez, quando o
// administrador está confirmado.
//
// Funções compartilhadas (formatação, imagens, toast) ficam
// em js/utils.js.
// ======================================================

import {
  collection,
  getDocs,
  doc,
  serverTimestamp,
  addDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  brl,
  round2,
  formatPercent,
  escapeHtml,
  renderProductImage,
  getSaleDate,
  formatSaleDate,
  getPaymentIcon,
  showToast,
  closeModal,
  fetchProducts
} from "./utils.js";


// ======================================================
// ESTADO
// ======================================================

let products = [];
let sales = [];
let expenses = [];

let activeView = null;
let suggestedPrice = null;


// ======================================================
// CONFIGURAÇÃO
//
// Produto disponível com stock igual ou menor que este
// valor entra em "Estoque baixo". stock === 0 é "crítico".
// ======================================================

const LOW_STOCK_THRESHOLD = 5;

const VIEWS = [
  "home",
  "sales",
  "products",
  "reports",
  "finance"
];


// ======================================================
// ATALHOS DE DOM
// ======================================================

const $ = id =>
  document.getElementById(id);


// Adiciona um evento só se o elemento existir

function on(element, type, handler) {

  if (element) {

    element.addEventListener(
      type,
      handler
    );

  }

}


// ---- Início ----

const homeMonthRevenue = $("homeMonthRevenue");
const homeTodaySales = $("homeTodaySales");
const homeLowStock = $("homeLowStock");

// ---- Dashboard do Início ----

const homeMonthFilter = $("homeMonthFilter");
const homeAllButton = $("homeAllButton");
const homeProfitNote = $("homeProfitNote");

// ---- Vendas ----

const historySearchInput = $("historySearchInput");
const historyDateFilter = $("historyDateFilter");
const historyPaymentFilter = $("historyPaymentFilter");
const clearHistoryFilters = $("clearHistoryFilters");
const salesHistory = $("salesHistory");
const historyEmptyState = $("historyEmptyState");
const historyTotalSales = $("historyTotalSales");
const historyRevenue = $("historyRevenue");
const historyAverage = $("historyAverage");
const saleDetailsModal = $("saleDetailsModal");
const closeSaleDetailsModal = $("closeSaleDetailsModal");

// ---- Produtos ----

const adminProductList = $("adminProductList");
const addProductButton = $("addProductButton");
const productFormModal = $("productFormModal");
const closeProductFormModal = $("closeProductFormModal");
const productForm = $("productForm");
const productFormTitle = $("productFormTitle");
const productFormId = $("productFormId");
const productFormName = $("productFormName");
const productFormCategory = $("productFormCategory");
const productFormEmoji = $("productFormEmoji");
const productFormPrice = $("productFormPrice");
const productFormStock = $("productFormStock");
const productFormCost = $("productFormCost");
const productFormTargetMargin = $("productFormTargetMargin");
const productFormDescription = $("productFormDescription");
const productFormAvailable = $("productFormAvailable");
const productFormSubmitButton = $("productFormSubmitButton");
const deleteProductButton = $("deleteProductButton");

const costCalcProfit = $("costCalcProfit");
const costCalcMargin = $("costCalcMargin");
const costCalcMarkup = $("costCalcMarkup");
const costCalcSuggestion = $("costCalcSuggestion");
const applySuggestedPriceButton = $("applySuggestedPriceButton");

// ---- Relatórios ----

const dailyRevenueList = $("dailyRevenueList");
const lowStockList = $("lowStockList");

// ---- Financeiro ----

const financeMonthFilter = $("financeMonthFilter");
const financeAllButton = $("financeAllButton");
const financeIncome = $("financeIncome");
const financeExpense = $("financeExpense");
const financeBalance = $("financeBalance");
const financeCategoryList = $("financeCategoryList");
const expenseList = $("expenseList");
const addExpenseButton = $("addExpenseButton");
const expenseFormModal = $("expenseFormModal");
const closeExpenseFormModal = $("closeExpenseFormModal");
const expenseForm = $("expenseForm");
const expenseFormTitle = $("expenseFormTitle");
const expenseFormId = $("expenseFormId");
const expenseFormDescription = $("expenseFormDescription");
const expenseFormCategory = $("expenseFormCategory");
const expenseFormAmount = $("expenseFormAmount");
const expenseFormDate = $("expenseFormDate");
const expenseFormSubmitButton = $("expenseFormSubmitButton");
const deleteExpenseButton = $("deleteExpenseButton");


// ======================================================
// DATAS (CHAVES "AAAA-MM-DD" E "AAAA-MM")
// ======================================================

function dateKey(date) {

  const year =
    String(date.getFullYear()).padStart(4, "0");

  const month =
    String(date.getMonth() + 1).padStart(2, "0");

  const day =
    String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;

}


function todayISO() {

  return dateKey(
    new Date()
  );

}


function saleDayKey(sale) {

  const date =
    getSaleDate(sale.createdAt);

  return date
    ? dateKey(date)
    : "";

}


function saleMonthKey(sale) {

  return saleDayKey(sale)
    .slice(0, 7);

}


function formatExpenseDate(iso) {

  const [year, month, day] =
    String(iso || "").split("-");

  return (year && month && day)
    ? `${day}/${month}/${year}`
    : "—";

}


// ======================================================
// NAVEGAÇÃO ENTRE MÓDULOS
//
// Qualquer elemento com data-view="nome" (botões da
// navegação e atalhos da tela inicial) leva ao módulo
// "nome". Cada módulo recarrega seus dados ao abrir.
// ======================================================

function showView(name, { updateHash = true } = {}) {

  if (!VIEWS.includes(name)) {
    name = "home";
  }


  activeView =
    name;


  document
    .querySelectorAll("[data-view-panel]")
    .forEach(
      panel => {

        panel.classList.toggle(
          "hidden",
          panel.dataset.viewPanel !== name
        );

      }
    );


  document
    .querySelectorAll("#adminNav [data-view]")
    .forEach(
      button => {

        const active =
          button.dataset.view === name;

        button.classList.toggle(
          "is-active",
          active
        );

        if (active) {

          button.setAttribute(
            "aria-current",
            "page"
          );

        } else {

          button.removeAttribute(
            "aria-current"
          );

        }

      }
    );


  if (updateHash) {

    history.replaceState(
      null,
      "",
      `#${name}`
    );

  }


  window.scrollTo(0, 0);

  loadView(name);

}


async function loadView(name) {

  if (name === "home") {

    await Promise.all([
      loadProducts(),
      loadSales(),
      loadExpenses()
    ]);

    renderHome();

    renderHomeDashboard();

  }


  if (name === "sales") {

    await loadSales();

  }


  if (name === "products") {

    await loadProducts();

    renderAdminProductList();

  }


  if (name === "reports") {

    await Promise.all([
      loadProducts(),
      loadSales()
    ]);

    renderDailyRevenue();

    renderLowStock();

  }


  if (name === "finance") {

    // Mês atual como padrão na primeira abertura
    if (
      financeMonthFilter &&
      !financeMonthFilter.value
    ) {

      financeMonthFilter.value =
        todayISO().slice(0, 7);

    }

    await Promise.all([
      loadSales(),
      loadExpenses()
    ]);

    renderFinance();

  }

}


document.addEventListener(
  "click",
  event => {

    const target =
      event.target.closest(
        "[data-view]"
      );

    if (!target) {
      return;
    }

    showView(
      target.dataset.view
    );

  }
);


// ======================================================
// CARREGAMENTO DE DADOS
// ======================================================

async function loadProducts() {

  try {

    products =
      await fetchProducts();

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


async function loadSales() {

  if (!window.db) {

    console.error(
      "Firebase ainda não foi inicializado."
    );

    return;

  }


  const showingTable =
    activeView === "sales";


  if (showingTable) {

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

  }


  try {

    const snapshot =
      await getDocs(
        collection(
          window.db,
          "vendas"
        )
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

            customerPhone:
              data.customerPhone ||
              null,

            payment:
              String(
                data.payment ||
                "Não informado"
              ),

            subtotal:
              Number(data.subtotal) || 0,

            discount:
              Number(data.discount) || 0,

            total:
              Number(data.total) || 0,

            items:
              Array.isArray(data.items)
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


    // Da mais recente para a mais antiga

    sales.sort(
      (a, b) => {

        const dateA =
          getSaleDate(a.createdAt);

        const dateB =
          getSaleDate(b.createdAt);

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


    if (showingTable) {

      renderSalesHistory();

    }


  } catch (error) {

    console.error(
      "Erro ao carregar histórico:",
      error
    );


    if (showingTable) {

      salesHistory.innerHTML = `

        <div class="history-loading">

          <div class="history-loading-icon">
            ⚠️
          </div>

          <strong>
            Erro ao carregar vendas
          </strong>

          <span>
            ${escapeHtml(error.message)}
          </span>

        </div>

      `;

    }


    showToast(
      "Não foi possível carregar o histórico."
    );

  }

}


async function loadExpenses() {

  try {

    const snapshot =
      await getDocs(
        collection(
          window.db,
          "despesas"
        )
      );


    expenses =
      snapshot.docs.map(
        documentSnapshot => {

          const data =
            documentSnapshot.data();

          return {

            id:
              documentSnapshot.id,

            description:
              String(
                data.description ||
                "Despesa sem descrição"
              ),

            category:
              String(
                data.category ||
                "Outros"
              ),

            amount:
              Number(data.amount) || 0,

            date:
              String(data.date || "")

          };

        }
      );


    // Mais recentes primeiro
    expenses.sort(
      (a, b) =>
        b.date.localeCompare(a.date)
    );


  } catch (error) {

    console.error(
      "Erro ao carregar despesas:",
      error
    );

    showToast(
      "Não foi possível carregar as despesas."
    );

  }

}


// ======================================================
// INÍCIO — INDICADORES
// ======================================================

function renderHome() {

  const today =
    todayISO();

  const month =
    today.slice(0, 7);


  const monthRevenue =
    sales
      .filter(
        sale =>
          saleMonthKey(sale) === month
      )
      .reduce(
        (sum, sale) =>
          sum + (Number(sale.total) || 0),
        0
      );


  const todaySales =
    sales.filter(
      sale =>
        saleDayKey(sale) === today
    ).length;


  const lowStock =
    products.filter(
      product =>
        product.available &&
        product.stock <= LOW_STOCK_THRESHOLD
    ).length;


  homeMonthRevenue.textContent =
    brl(monthRevenue);

  homeTodaySales.textContent =
    todaySales;

  homeLowStock.textContent =
    lowStock;

}

// ======================================================
// ======================================================
// DASHBOARD DO INÍCIO (Chart.js)
// ======================================================
// ======================================================
//
// Reaproveita os mesmos dados do painel:
//   - sales    → faturamento, meios de pagamento,
//                top produtos e lucro
//   - expenses → lucro líquido do período
//
// O filtro de mês (#homeMonthFilter) vale para todos
// os gráficos. Sem mês, considera todo o período.
//
// Chart.js vem do CDN (UMD) e fica em window.Chart.
// Se ele não estiver disponível (CDN fora), os
// gráficos simplesmente não são montados — o resto do
// painel continua funcionando.
// ======================================================

const CHART_COLORS = {

  neon: "#39ff14",
  lime: "#b6ff00",
  neonDark: "#22c20a",
  danger: "#ff4d4d",
  text: "#a7ada7",
  grid: "rgba(57, 255, 20, .14)"

};

const CHART_FONT = {
  family: "Montserrat, sans-serif",
  size: 11
};

const PAYMENT_PALETTE = [
  CHART_COLORS.neon,
  CHART_COLORS.lime,
  "#1e90ff",
  "#ff9a3c",
  "#b76bff",
  "#ff4d4d"
];


// Referências das instâncias atuais (para destruir
// antes de recriar — evita canvas "fantasma")

let charts = {
  dailyRevenue: null,
  paymentMethods: null,
  topProducts: null,
  profit: null
};


function setupChartDefaults() {

  if (!window.Chart) {
    return;
  }

  window.Chart.defaults.color =
    CHART_COLORS.text;

  window.Chart.defaults.font.family =
    CHART_FONT.family;

  window.Chart.defaults.font.size =
    CHART_FONT.size;

  window.Chart.defaults.borderColor =
    CHART_COLORS.grid;

}


function destroyChart(name) {

  if (charts[name]) {

    charts[name].destroy();
    charts[name] = null;

  }

}


function setChartEmpty(canvasId, isEmpty, message = "") {

  const canvas =
    document.getElementById(canvasId);

  const wrap =
    canvas ? canvas.closest(".chart-wrap") : null;

  if (!wrap) {
    return;
  }


  let overlay =
    wrap.querySelector(".chart-empty");


  if (isEmpty) {

    if (!overlay) {

      overlay =
        document.createElement("div");

      overlay.className =
        "chart-empty";

      wrap.appendChild(overlay);

    }

    overlay.textContent = message;

  } else if (overlay) {

    overlay.remove();

  }

}


// ---- opções compartilhadas (barras / linhas) ----

function makeChartOptions({
  horizontal = false,
  valueFormat = null
} = {}) {

  const valueAxis = {

    beginAtZero: true,

    grid: { color: CHART_COLORS.grid },

    ticks: {
      color: CHART_COLORS.text,
      font: CHART_FONT,
      ...(valueFormat ? { callback: valueFormat } : {})
    }

  };


  const categoryAxis = {

    grid: { display: false },

    ticks: {
      color: CHART_COLORS.text,
      font: CHART_FONT
    }

  };


  return {

    responsive: true,

    maintainAspectRatio: false,

    indexAxis: horizontal ? "y" : "x",

    interaction: {
      mode: "nearest",
      intersect: false
    },

    plugins: {

      legend: { display: false },

      tooltip: {

        backgroundColor: "#0d100d",
        borderColor: CHART_COLORS.neon,
        borderWidth: 1,
        titleColor: CHART_COLORS.neon,
        bodyColor: "#ffffff",
        padding: 10,
        cornerRadius: 4

      }

    },

    scales: horizontal
      ? { x: valueAxis, y: categoryAxis }
      : { x: categoryAxis, y: valueAxis }

  };

}


// ---- orquestrador ----

function renderHomeDashboard() {

  // Chart.js ainda não carregou? Tenta de novo na
  // próxima vez que a Início for aberta.

  if (!window.Chart) {

    console.warn(
      "Chart.js não está disponível — dashboard não será renderizado."
    );

    return;

  }


  setupChartDefaults();


  const period =
    homeMonthFilter
      ? homeMonthFilter.value
      : "";


  const periodSales =
    period
      ? sales.filter(
          sale =>
            saleMonthKey(sale) === period
        )
      : sales;


  const periodExpenses =
    period
      ? expenses.filter(
          expense =>
            expense.date.startsWith(period)
        )
      : expenses;


  renderDailyRevenueChart(
    periodSales,
    period
  );

  renderPaymentMethodsChart(
    periodSales
  );

  renderTopProductsChart(
    periodSales
  );

  renderProfitChart(
    periodSales,
    periodExpenses
  );

}


// ---- 1) faturamento por dia ----

function renderDailyRevenueChart(periodSales, period) {

  destroyChart("dailyRevenue");


  const byDay = {};

  periodSales.forEach(
    sale => {

      const key =
        saleDayKey(sale);

      if (!key) {
        return;
      }

      byDay[key] =
        (byDay[key] || 0) +
        (Number(sale.total) || 0);

    }
  );


  const labels = [];
  const values = [];


  if (period) {

    // Mês selecionado: mostra todos os dias do mês
    // (inclusive os sem venda — o zero também conta).

    const [year, month] =
      period.split("-");

    const daysInMonth =
      new Date(
        Number(year),
        Number(month),
        0
      ).getDate();


    for (let day = 1; day <= daysInMonth; day++) {

      const key =
        `${year}-${month}-${String(day).padStart(2, "0")}`;

      labels.push(
        `${String(day).padStart(2, "0")}/${month}`
      );

      values.push(
        round2(byDay[key] || 0)
      );

    }

  } else {

    // Sem mês: últimos 14 dias que tiveram venda.

    const entries =
      Object.entries(byDay)
        .sort(
          (a, b) =>
            a[0].localeCompare(b[0])
        )
        .slice(-14);


    entries.forEach(
      ([key, value]) => {

        const [, month, day] =
          key.split("-");

        labels.push(`${day}/${month}`);

        values.push(round2(value));

      }
    );

  }


  if (!labels.length) {

    setChartEmpty(
      "chartDailyRevenue",
      true,
      "Nenhuma venda no período."
    );

    return;

  }


  setChartEmpty("chartDailyRevenue", false);


  const canvas =
    document.getElementById("chartDailyRevenue");


  charts.dailyRevenue =
    new window.Chart(canvas, {

      type: "line",

      data: {

        labels,

        datasets: [{

          label: "Faturamento",

          data: values,

          borderColor: CHART_COLORS.neon,

          backgroundColor: "rgba(57, 255, 20, .16)",

          pointBackgroundColor: CHART_COLORS.neon,

          pointBorderColor: "#050505",

          pointRadius: 3,

          pointHoverRadius: 6,

          borderWidth: 2,

          fill: true,

          tension: .35

        }]

      },

      options: {

        ...makeChartOptions({
          valueFormat: value => brl(value)
        }),

        plugins: {

          ...makeChartOptions().plugins,

          tooltip: {

            ...makeChartOptions().plugins.tooltip,

            callbacks: {
              label: context =>
                ` ${brl(context.parsed.y)}`
            }

          }

        }

      }

    });

}


// ---- 2) meios de pagamento ----

function renderPaymentMethodsChart(periodSales) {

  destroyChart("paymentMethods");


  const byPayment = {};

  periodSales.forEach(
    sale => {

      const key =
        sale.payment || "Não informado";

      if (!byPayment[key]) {

        byPayment[key] = {
          count: 0,
          total: 0
        };

      }

      byPayment[key].count += 1;

      byPayment[key].total +=
        Number(sale.total) || 0;

    }
  );


  const entries =
    Object.entries(byPayment)
      .sort(
        (a, b) =>
          b[1].total - a[1].total
      );


  if (!entries.length) {

    setChartEmpty(
      "chartPaymentMethods",
      true,
      "Nenhuma venda no período."
    );

    return;

  }


  setChartEmpty("chartPaymentMethods", false);


  const labels =
    entries.map(([label]) => label);

  const data =
    entries.map(
      ([, value]) =>
        round2(value.total)
    );


  const canvas =
    document.getElementById("chartPaymentMethods");


  charts.paymentMethods =
    new window.Chart(canvas, {

      type: "doughnut",

      data: {

        labels,

        datasets: [{

          data,

          backgroundColor:
            labels.map(
              (_, index) =>
                PAYMENT_PALETTE[
                  index % PAYMENT_PALETTE.length
                ]
            ),

          borderColor: "#050505",

          borderWidth: 2,

          hoverOffset: 8

        }]

      },

      options: {

        responsive: true,

        maintainAspectRatio: false,

        cutout: "62%",

        plugins: {

          legend: {

            position: "bottom",

            labels: {

              color: CHART_COLORS.text,

              boxWidth: 12,

              padding: 14,

              font: CHART_FONT

            }

          },

          tooltip: {

            backgroundColor: "#0d100d",
            borderColor: CHART_COLORS.neon,
            borderWidth: 1,
            titleColor: CHART_COLORS.neon,
            bodyColor: "#ffffff",
            padding: 10,
            cornerRadius: 4,

            callbacks: {

              label: context => {

                const entry =
                  entries[context.dataIndex];

                const value =
                  entry[1];

                const suffix =
                  value.count === 1
                    ? "venda"
                    : "vendas";

                return ` ${brl(value.total)} (${value.count} ${suffix})`;

              }

            }

          }

        }

      }

    });

}


// ---- 3) produtos mais vendidos ----

function renderTopProductsChart(periodSales) {

  destroyChart("topProducts");


  const byProduct = {};

  periodSales.forEach(
    sale => {

      (sale.items || []).forEach(
        item => {

          const name =
            String(item.name || "—");

          const quantity =
            Number(item.quantity) || 0;

          if (!name || quantity <= 0) {
            return;
          }

          byProduct[name] =
            (byProduct[name] || 0) +
            quantity;

        }
      );

    }
  );


  const entries =
    Object.entries(byProduct)
      .sort(
        (a, b) =>
          b[1] - a[1]
      )
      .slice(0, 5);


  if (!entries.length) {

    setChartEmpty(
      "chartTopProducts",
      true,
      "Nenhum produto vendido no período."
    );

    return;

  }


  setChartEmpty("chartTopProducts", false);


  const labels =
    entries.map(([label]) => label);

  const data =
    entries.map(([, value]) => value);


  const canvas =
    document.getElementById("chartTopProducts");


  const options =
    makeChartOptions({ horizontal: true });


  // Trunca rótulos longos no eixo Y (categorias)

  options.scales.y.ticks.callback =
    function (value) {

      const label =
        this.getLabelForValue(value);

      return label.length > 20
        ? `${label.slice(0, 18)}…`
        : label;

    };


  charts.topProducts =
    new window.Chart(canvas, {

      type: "bar",

      data: {

        labels,

        datasets: [{

          label: "Unidades vendidas",

          data,

          backgroundColor: "rgba(57, 255, 20, .38)",

          borderColor: CHART_COLORS.neon,

          borderWidth: 1.5,

          borderRadius: 3

        }]

      },

      options: {

        ...options,

        plugins: {

          ...options.plugins,

          tooltip: {

            ...options.plugins.tooltip,

            callbacks: {
              label: context =>
                ` ${context.parsed.x} unidade${context.parsed.x === 1 ? "" : "s"}`
            }

          }

        }

      }

    });

}


// ---- 4) lucro do período ----

function renderProfitChart(periodSales, periodExpenses) {

  destroyChart("profit");


  let totalRevenue = 0;
  let totalCost = 0;
  let grossProfit = 0;
  let withoutCost = 0;


  periodSales.forEach(
    sale => {

      totalRevenue +=
        Number(sale.total) || 0;


      const info =
        getSaleProfit(sale);


      if (!info.known) {

        withoutCost++;

        return;

      }

      totalCost += info.cost;
      grossProfit += info.profit;

    }
  );


  const operatingExpenses =
    periodExpenses
      .filter(
        expense =>
          expense.category !== "Insumos"
      )
      .reduce(
        (sum, expense) =>
          sum + expense.amount,
        0
      );


  const netProfit =
    round2(grossProfit - operatingExpenses);


  const labels = [
    "Receita",
    "Custo",
    "Lucro bruto",
    "Lucro líquido"
  ];

  const data = [
    round2(totalRevenue),
    round2(totalCost),
    round2(grossProfit),
    netProfit
  ];

  const fill = [
    "rgba(57, 255, 20, .38)",
    "rgba(255, 77, 77, .35)",
    "rgba(182, 255, 0, .5)",
    netProfit >= 0
      ? "rgba(57, 255, 20, .75)"
      : "rgba(255, 77, 77, .7)"
  ];

  const stroke = [
    CHART_COLORS.neon,
    CHART_COLORS.danger,
    CHART_COLORS.lime,
    netProfit >= 0
      ? CHART_COLORS.neon
      : CHART_COLORS.danger
  ];


  if (
    !periodSales.length &&
    !periodExpenses.length
  ) {

    setChartEmpty(
      "chartProfit",
      true,
      "Nenhum dado no período."
    );

  } else {

    setChartEmpty("chartProfit", false);


    const canvas =
      document.getElementById("chartProfit");


    charts.profit =
      new window.Chart(canvas, {

        type: "bar",

        data: {

          labels,

          datasets: [{

            data,

            backgroundColor: fill,

            borderColor: stroke,

            borderWidth: 1.5,

            borderRadius: 3

          }]

        },

        options: {

          ...makeChartOptions({
            valueFormat: value => brl(value)
          }),

          plugins: {

            ...makeChartOptions().plugins,

            tooltip: {

              ...makeChartOptions().plugins.tooltip,

              callbacks: {
                label: context =>
                  ` ${brl(context.parsed.y)}`
              }

            }

          }

        }

      });

  }


  // ---- nota de rodapé ----

  if (homeProfitNote) {

    const notes = [];

    if (withoutCost > 0) {

      notes.push(
        `${withoutCost} venda${withoutCost === 1 ? "" : "s"} do período sem custo registrado ficou${withoutCost === 1 ? "" : "ram"} fora do cálculo de lucro.`
      );

    }

    if (operatingExpenses > 0) {

      notes.push(
        "Lucro líquido desconta as despesas do período (exceto Insumos)."
      );

    }

    homeProfitNote.textContent =
      notes.join(" ");

  }

}


// ---- eventos do filtro ----

on(
  homeMonthFilter,
  "change",
  () => renderHomeDashboard()
);

on(
  homeAllButton,
  "click",
  () => {

    if (homeMonthFilter) {
      homeMonthFilter.value = "";
    }

    renderHomeDashboard();

  }
);


// ======================================================
// ======================================================
// VENDAS (HISTÓRICO)
// ======================================================
// ======================================================


function getSaleItemsQuantity(sale) {

  if (!Array.isArray(sale.items)) {
    return 0;
  }

  return sale.items.reduce(
    (sum, item) =>
      sum + (Number(item.quantity) || 0),
    0
  );

}


function renderSalesHistory() {

  const search =
    historySearchInput.value
      .trim()
      .toLowerCase();

  const selectedDate =
    historyDateFilter.value;

  const selectedPayment =
    historyPaymentFilter.value;


  const filteredSales =
    sales.filter(
      sale => {

        // ---- busca ----

        let matchesSearch = true;

        if (search) {

          const productNames =
            sale.items
              .map(
                item =>
                  String(item.name || "")
                    .toLowerCase()
              )
              .join(" ");

          matchesSearch =
            String(sale.customerName || "")
              .toLowerCase()
              .includes(search) ||
            String(sale.id || "")
              .toLowerCase()
              .includes(search) ||
            String(sale.payment || "")
              .toLowerCase()
              .includes(search) ||
            productNames.includes(search);

        }


        // ---- data ----

        const matchesDate =
          !selectedDate ||
          saleDayKey(sale) === selectedDate;


        // ---- pagamento ----

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


  updateHistoryStats(
    filteredSales
  );


  if (filteredSales.length === 0) {

    salesHistory.innerHTML = "";

    historyEmptyState.classList.remove(
      "hidden"
    );

    return;

  }


  historyEmptyState.classList.add(
    "hidden"
  );


  salesHistory.innerHTML =
    filteredSales
      .map(
        sale => {

          const itemsQuantity =
            getSaleItemsQuantity(sale);

          const shortId =
            sale.id.length > 10
              ? `${sale.id.substring(0, 10)}...`
              : sale.id;


          return `

            <div
              class="sale-row"
              data-sale-id="${sale.id}">

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

              <div
                class="sale-cell"
                data-label="Cliente">

                <strong>
                  ${escapeHtml(sale.customerName)}
                </strong>

              </div>

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

              <div
                class="sale-cell"
                data-label="Pagamento">

                <span class="payment-badge">

                  ${getPaymentIcon(sale.payment)}

                  ${escapeHtml(sale.payment)}

                </span>

              </div>

              <div
                class="sale-cell sale-total-cell"
                data-label="Total">

                <strong>
                  ${brl(sale.total)}
                </strong>

              </div>

              <div
                class="sale-cell sale-date-cell"
                data-label="Data">

                ${formatSaleDate(sale.createdAt)}

              </div>

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


function updateHistoryStats(filteredSales) {

  const totalSales =
    filteredSales.length;

  const revenue =
    filteredSales.reduce(
      (sum, sale) =>
        sum + (Number(sale.total) || 0),
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


// ---- detalhes de uma venda ----

function openSaleDetails(saleId) {

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


  $("saleDetailsTitle").textContent =
    `Venda #${sale.id.substring(0, 10)}`;

  $("saleDetailsId").textContent =
    sale.id;

  $("saleDetailsCustomer").textContent =
    sale.customerName;

  $("saleDetailsPayment").textContent =
    `${getPaymentIcon(sale.payment)} ${sale.payment}`;

  $("saleDetailsDate").textContent =
    formatSaleDate(sale.createdAt);


  // ---- status ----

  const statusElement =
    $("saleDetailsStatus");

  statusElement.textContent =
    sale.status;

  statusElement.className =
    "sale-status";

  if (sale.status === "finalizada") {

    statusElement.classList.add(
      "success"
    );

  }


  // ---- itens ----

  const itemsContainer =
    $("saleDetailsItems");


  if (!sale.items.length) {

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
              Number(item.quantity) || 0;

            const price =
              Number(item.price) || 0;

            const subtotal =
              Number(item.subtotal) ||
              (price * quantity);


            return `

              <div class="sale-detail-item">

                <div class="sale-detail-item-main">

                  <strong>
                    ${escapeHtml(item.name)}
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


  // ---- resumo ----

  $("saleDetailsSubtotal").textContent =
    brl(sale.subtotal);

  $("saleDetailsDiscount").textContent =
    brl(sale.discount);

  $("saleDetailsTotal").textContent =
    brl(sale.total);


  renderSaleProfit(
    sale
  );


  saleDetailsModal.classList.remove(
    "hidden"
  );

}


// ---- eventos de vendas ----

on(historySearchInput, "input", renderSalesHistory);
on(historyDateFilter, "change", renderSalesHistory);
on(historyPaymentFilter, "change", renderSalesHistory);

on(
  clearHistoryFilters,
  "click",
  () => {

    historySearchInput.value = "";
    historyDateFilter.value = "";
    historyPaymentFilter.value = "Todos";

    renderSalesHistory();

  }
);

on(
  salesHistory,
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-sale-action]"
      );

    if (
      button &&
      button.dataset.saleAction === "view"
    ) {

      openSaleDetails(
        button.dataset.saleId
      );

    }

  }
);

on(
  closeSaleDetailsModal,
  "click",
  () => closeModal(saleDetailsModal)
);

// Clicar fora do modal de detalhes também fecha

on(
  saleDetailsModal,
  "click",
  event => {

    if (event.target === saleDetailsModal) {

      closeModal(
        saleDetailsModal
      );

    }

  }
);


// ======================================================
// ======================================================
// PRODUTOS (GESTÃO) + CALCULADORA DE CUSTO x LUCRO
// ======================================================
// ======================================================
//
// Regras de segurança do Firestore:
// - criar/excluir produto e editar qualquer campo:
//   só administrador
// - o checkout (cliente) só consegue DIMINUIR "stock"
//
// - "cost" (custo unitário) fica no documento do produto.
// - No checkout, o custo de cada item é copiado para a
//   venda (items[].cost), então o lucro histórico não muda
//   se o custo do produto for alterado depois.
// - Vendas antigas, sem custo registrado, ficam fora dos
//   cálculos de lucro (continuam normais no faturamento).
//
// Margem  = lucro / preço de venda
// Markup  = lucro / custo
// Preço sugerido para uma margem M:  custo / (1 - M)
// ======================================================


function setValueSign(element, value) {

  if (!element) {
    return;
  }

  element.classList.toggle(
    "value-negative",
    value < 0
  );

  element.classList.toggle(
    "value-positive",
    value > 0
  );

}


// Custo digitado no formulário: vazio = sem custo (null)

function readCostInput() {

  if (productFormCost.value === "") {
    return null;
  }

  return Math.max(
    0,
    round2(productFormCost.value)
  );

}


// Texto de margem na lista de produtos

function formatMarginLabel(product) {

  if (
    typeof product.cost !== "number" ||
    !(product.price > 0)
  ) {
    return "Sem custo";
  }

  const margin =
    (
      (product.price - product.cost) /
      product.price
    ) * 100;

  return `Margem ${formatPercent(margin)}`;

}


// ---- lista de produtos ----

function renderAdminProductList() {

  if (!products.length) {

    adminProductList.innerHTML = `

      <div class="admin-empty">
        Nenhum produto cadastrado ainda. Clique em
        "+ Novo produto" para começar.
      </div>

    `;

    return;

  }


  adminProductList.innerHTML =
    products
      .map(
        product => {

          const statusClass =
            product.available
              ? "available"
              : "unavailable";

          const statusLabel =
            product.available
              ? (
                product.stock > 0
                  ? "Disponível"
                  : "Sem estoque"
              )
              : "Inativo";


          return `

            <div class="admin-product-row">

              <div class="admin-product-emoji">
                ${renderProductImage(product.emoji, product.name)}
              </div>

              <div class="admin-product-info">

                <strong>
                  ${escapeHtml(product.name)}
                </strong>

                <small>
                  ${escapeHtml(product.category)} •
                  ${brl(product.price)} •
                  Estoque: ${product.stock} •
                  ${formatMarginLabel(product)}
                </small>

              </div>

              <span class="admin-status-badge ${statusClass}">
                ${statusLabel}
              </span>

              <div class="admin-product-actions">

                <button
                  class="admin-icon-button"
                  type="button"
                  data-admin-action="edit"
                  data-id="${product.id}"
                  aria-label="Editar produto">
                  ✏️
                </button>

                <button
                  class="admin-icon-button"
                  type="button"
                  data-admin-action="toggle"
                  data-id="${product.id}"
                  aria-label="Ativar ou desativar produto">
                  ${product.available ? "🚫" : "✅"}
                </button>

                <button
                  class="admin-icon-button danger"
                  type="button"
                  data-admin-action="delete"
                  data-id="${product.id}"
                  aria-label="Excluir produto">
                  🗑️
                </button>

              </div>

            </div>

          `;

        }
      )
      .join("");

}


// ---- calculadora do formulário ----

function updateCostCalculator() {

  const price =
    productFormPrice.value === ""
      ? NaN
      : Number(productFormPrice.value);

  const cost =
    productFormCost.value === ""
      ? NaN
      : Number(productFormCost.value);

  const targetMargin =
    productFormTargetMargin.value === ""
      ? NaN
      : Number(productFormTargetMargin.value);


  let profitText = "—";
  let marginText = "—";
  let markupText = "—";
  let profitValue = 0;


  if (
    Number.isFinite(price) &&
    price > 0 &&
    Number.isFinite(cost) &&
    cost >= 0
  ) {

    const profit =
      price - cost;

    profitValue =
      profit;

    profitText =
      brl(profit);

    marginText =
      formatPercent(
        (profit / price) * 100
      );

    markupText =
      cost > 0
        ? formatPercent(
          (profit / cost) * 100
        )
        : "—";

  }


  costCalcProfit.textContent =
    profitText;

  costCalcMargin.textContent =
    marginText;

  costCalcMarkup.textContent =
    markupText;


  setValueSign(costCalcProfit, profitValue);
  setValueSign(costCalcMargin, profitValue);
  setValueSign(costCalcMarkup, profitValue);


  // ---- preço sugerido para a margem desejada ----

  suggestedPrice =
    null;


  if (
    Number.isFinite(cost) &&
    cost > 0 &&
    Number.isFinite(targetMargin) &&
    targetMargin > 0 &&
    targetMargin < 100
  ) {

    suggestedPrice =
      round2(
        cost /
        (1 - targetMargin / 100)
      );

  }


  if (suggestedPrice !== null) {

    costCalcSuggestion.textContent =
      `Para ${formatPercent(targetMargin)} de margem, o preço sugerido é ${brl(suggestedPrice)}.`;

    applySuggestedPriceButton.classList.remove(
      "hidden"
    );

  } else {

    costCalcSuggestion.textContent =
      "Informe o custo e a margem desejada para ver o preço sugerido.";

    applySuggestedPriceButton.classList.add(
      "hidden"
    );

  }

}


[
  productFormPrice,
  productFormCost,
  productFormTargetMargin
].forEach(
  field => on(field, "input", updateCostCalculator)
);


on(
  applySuggestedPriceButton,
  "click",
  () => {

    if (suggestedPrice === null) {
      return;
    }

    productFormPrice.value =
      suggestedPrice.toFixed(2);

    updateCostCalculator();

  }
);


// ---- formulário (criar ou editar) ----

function openProductForm(productId) {

  const product =
    productId
      ? products.find(
        item =>
          item.id === productId
      )
      : null;


  productFormId.value =
    product ? product.id : "";

  productFormTitle.textContent =
    product ? "Editar produto" : "Novo produto";

  productFormName.value =
    product ? product.name : "";

  productFormCategory.value =
    product ? product.category : "Lanches";

  productFormEmoji.value =
    product ? product.emoji : "🍔";

  productFormPrice.value =
    product ? product.price : "";

  productFormStock.value =
    product ? product.stock : "";

  productFormDescription.value =
    product ? product.description : "";

  productFormAvailable.checked =
    product ? product.available : true;

  productFormSubmitButton.textContent =
    product ? "Salvar alterações" : "Cadastrar produto";

  deleteProductButton.classList.toggle(
    "hidden",
    !product
  );


  productFormCost.value =
    product && typeof product.cost === "number"
      ? product.cost
      : "";

  productFormTargetMargin.value =
    "";

  updateCostCalculator();


  productFormModal.classList.remove(
    "hidden"
  );

}


// ---- ativar / desativar ----

async function toggleProductAvailability(productId) {

  const product =
    products.find(
      item =>
        item.id === productId
    );


  if (!product) {
    return;
  }


  try {

    await updateDoc(
      doc(
        window.db,
        "produtos",
        productId
      ),
      {
        available:
          !product.available
      }
    );


    showToast(
      `${product.name} agora está ${!product.available
        ? "disponível"
        : "inativo"
      }.`
    );


    await loadProducts();

    renderAdminProductList();


  } catch (error) {

    console.error(
      "Erro ao atualizar disponibilidade:",
      error
    );

    showToast(
      "Não foi possível atualizar o produto."
    );

  }

}


// ---- excluir ----
// Devolve true só se o produto foi mesmo excluído.

async function deleteProduct(productId) {

  const product =
    products.find(
      item =>
        item.id === productId
    );


  if (!product) {
    return false;
  }


  const confirmado =
    window.confirm(
      `Excluir "${product.name}" definitivamente? Essa ação não pode ser desfeita.`
    );


  if (!confirmado) {
    return false;
  }


  try {

    await deleteDoc(
      doc(
        window.db,
        "produtos",
        productId
      )
    );


    showToast(
      `${product.name} excluído.`
    );


    await loadProducts();

    renderAdminProductList();

    return true;


  } catch (error) {

    console.error(
      "Erro ao excluir produto:",
      error
    );

    showToast(
      "Não foi possível excluir o produto."
    );

    return false;

  }

}


// ---- eventos de produtos ----

on(
  addProductButton,
  "click",
  () => openProductForm(null)
);

on(
  adminProductList,
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-admin-action]"
      );

    if (!button) {
      return;
    }


    const id =
      button.dataset.id;

    const action =
      button.dataset.adminAction;


    if (action === "edit") {
      openProductForm(id);
    }

    if (action === "toggle") {
      toggleProductAvailability(id);
    }

    if (action === "delete") {
      deleteProduct(id);
    }

  }
);

on(
  closeProductFormModal,
  "click",
  () => closeModal(productFormModal)
);

on(
  deleteProductButton,
  "click",
  async () => {

    const id =
      productFormId.value;

    if (!id) {
      return;
    }

    // Só fecha o formulário se o produto foi excluído

    if (await deleteProduct(id)) {

      closeModal(
        productFormModal
      );

    }

  }
);


on(
  productForm,
  "submit",
  async event => {

    event.preventDefault();


    const id =
      productFormId.value;

    const name =
      productFormName.value.trim();


    if (!name) {

      showToast(
        "Informe o nome do produto."
      );

      return;

    }


    const productData = {

      name:
        name,

      category:
        productFormCategory.value,

      image:
        productFormEmoji.value.trim() ||
        "🍔",

      price:
        Number(productFormPrice.value) || 0,

      stock:
        Math.max(
          0,
          Number(productFormStock.value) || 0
        ),

      description:
        productFormDescription.value.trim() ||
        "Sem descrição disponível.",

      available:
        productFormAvailable.checked,

      cost:
        readCostInput()

    };


    productFormSubmitButton.disabled =
      true;

    productFormSubmitButton.textContent =
      "Salvando...";


    try {

      if (id) {

        await updateDoc(
          doc(
            window.db,
            "produtos",
            id
          ),
          productData
        );

        showToast(
          `${productData.name} atualizado.`
        );

      } else {

        await addDoc(
          collection(
            window.db,
            "produtos"
          ),
          productData
        );

        showToast(
          `${productData.name} cadastrado.`
        );

      }


      closeModal(
        productFormModal
      );

      await loadProducts();

      renderAdminProductList();


    } catch (error) {

      console.error(
        "Erro ao salvar produto:",
        error
      );

      showToast(
        "Não foi possível salvar o produto."
      );


    } finally {

      productFormSubmitButton.disabled =
        false;

      productFormSubmitButton.textContent =
        id
          ? "Salvar alterações"
          : "Cadastrar produto";

    }

  }
);


// ======================================================
// LUCRO DE UMA VENDA
//
// Só dá para calcular quando TODOS os itens têm custo
// registrado (vendas feitas depois da calculadora).
// ======================================================

function getSaleProfit(sale) {

  const items =
    Array.isArray(sale.items)
      ? sale.items
      : [];


  if (!items.length) {

    return {
      known: false,
      cost: 0,
      profit: 0
    };

  }


  let cost = 0;


  for (const item of items) {

    if (typeof item.cost !== "number") {

      return {
        known: false,
        cost: 0,
        profit: 0
      };

    }

    cost +=
      item.cost *
      (Number(item.quantity) || 0);

  }


  return {

    known: true,

    cost:
      round2(cost),

    profit:
      round2(
        (Number(sale.total) || 0) - cost
      )

  };

}


// Lucro no modal "Detalhes da venda"

function renderSaleProfit(sale) {

  const costRow =
    $("saleDetailsCostRow");

  const profitRow =
    $("saleDetailsProfitRow");

  const costEl =
    $("saleDetailsCost");

  const profitEl =
    $("saleDetailsProfit");


  const info =
    getSaleProfit(sale);


  costRow.classList.toggle(
    "hidden",
    !info.known
  );

  profitRow.classList.toggle(
    "hidden",
    !info.known
  );


  if (!info.known) {
    return;
  }


  costEl.textContent =
    brl(info.cost);

  profitEl.textContent =
    brl(info.profit);


  setValueSign(
    profitEl,
    info.profit
  );

}


// ======================================================
// ======================================================
// RELATÓRIOS — FATURAMENTO + ESTOQUE BAIXO
// ======================================================
// ======================================================


function calcularFaturamentoPorDia() {

  const porDia = {};


  sales.forEach(
    sale => {

      const chave =
        saleDayKey(sale);

      if (!chave) {
        return;
      }


      if (!porDia[chave]) {

        porDia[chave] = {

          faturamento: 0,

          quantidade: 0

        };

      }


      porDia[chave].faturamento +=
        Number(sale.total) || 0;

      porDia[chave].quantidade +=
        1;

    }
  );


  // Do dia mais recente para o mais antigo,
  // limitado aos últimos 14 dias com movimento

  return Object.entries(porDia)
    .sort(
      (a, b) =>
        b[0].localeCompare(a[0])
    )
    .slice(0, 14);

}


function renderDailyRevenue() {

  const dias =
    calcularFaturamentoPorDia();


  if (!dias.length) {

    dailyRevenueList.innerHTML = `

      <div class="reports-empty">
        Nenhuma venda registrada ainda.
      </div>

    `;

    return;

  }


  const maiorFaturamento =
    Math.max(
      ...dias.map(
        ([, dados]) =>
          dados.faturamento
      )
    );


  dailyRevenueList.innerHTML =
    dias
      .map(
        ([chave, dados]) => {

          const [ano, mes, dia] =
            chave.split("-");

          const percentual =
            maiorFaturamento > 0
              ? Math.round(
                (
                  dados.faturamento /
                  maiorFaturamento
                ) * 100
              )
              : 0;


          return `

            <div class="daily-revenue-row">

              <span class="daily-revenue-date">
                ${dia}/${mes}/${ano}
              </span>

              <div class="daily-revenue-bar-track">

                <div
                  class="daily-revenue-bar-fill"
                  style="width: ${percentual}%">
                </div>

              </div>

              <span class="daily-revenue-value">
                ${brl(dados.faturamento)}
              </span>

            </div>

          `;

        }
      )
      .join("");

}


function renderLowStock() {

  const produtosComEstoqueBaixo =
    products
      .filter(
        product =>
          product.available &&
          product.stock <= LOW_STOCK_THRESHOLD
      )
      .sort(
        (a, b) =>
          a.stock - b.stock
      );


  if (!produtosComEstoqueBaixo.length) {

    lowStockList.innerHTML = `

      <div class="reports-empty">
        Nenhum produto com estoque baixo. 🎉
      </div>

    `;

    return;

  }


  lowStockList.innerHTML =
    produtosComEstoqueBaixo
      .map(
        product => {

          const critico =
            product.stock === 0;


          return `

            <div class="low-stock-row">

              <div class="low-stock-emoji">
                ${renderProductImage(product.emoji, product.name)}
              </div>

              <div class="low-stock-info">

                <strong>
                  ${escapeHtml(product.name)}
                </strong>

                <small>
                  ${escapeHtml(product.category)}
                </small>

              </div>

              <span class="low-stock-badge ${critico
              ? "critico"
              : "baixo"
            }">
                ${critico
              ? "Sem estoque"
              : `${product.stock} un.`
            }
              </span>

            </div>

          `;

        }
      )
      .join("");

}


// ======================================================
// ======================================================
// FINANCEIRO — DESPESAS + RESULTADO
// ======================================================
// ======================================================
//
// Entradas = soma de "total" das vendas do período.
// Saídas   = soma de "amount" das despesas do período
//            (coleção "despesas").
// Saldo    = Entradas - Saídas (caixa simples).
//
// A data da despesa é guardada como texto "AAAA-MM-DD"
// (sem horário), assim não sofre com fuso horário.
//
// Só administrador lê/escreve em "despesas" — a garantia
// real está nas Security Rules do Firestore.
// ======================================================


function renderFinance() {

  const period =
    financeMonthFilter.value;


  const periodSales =
    period
      ? sales.filter(
        sale =>
          saleMonthKey(sale) === period
      )
      : sales;


  const periodExpenses =
    period
      ? expenses.filter(
        expense =>
          expense.date.startsWith(period)
      )
      : expenses;


  const income =
    periodSales.reduce(
      (sum, sale) =>
        sum + (Number(sale.total) || 0),
      0
    );


  const outcome =
    periodExpenses.reduce(
      (sum, expense) =>
        sum + expense.amount,
      0
    );


  const balance =
    round2(
      income - outcome
    );


  financeIncome.textContent =
    brl(income);

  financeExpense.textContent =
    brl(outcome);

  financeBalance.textContent =
    brl(balance);


  financeBalance.classList.toggle(
    "finance-negative",
    balance < 0
  );

  financeBalance.classList.toggle(
    "finance-positive",
    balance > 0
  );


  renderExpenseCategories(
    periodExpenses,
    outcome
  );

  renderExpenseList(
    periodExpenses
  );

  renderProfitSummary(
    periodSales,
    periodExpenses
  );

}


// ---- despesas por categoria ----

function renderExpenseCategories(
  periodExpenses,
  outcome
) {

  if (!periodExpenses.length) {

    financeCategoryList.innerHTML = `

      <div class="reports-empty">
        Nenhuma despesa neste período.
      </div>

    `;

    return;

  }


  const byCategory = {};


  periodExpenses.forEach(
    expense => {

      byCategory[expense.category] =
        (byCategory[expense.category] || 0) +
        expense.amount;

    }
  );


  financeCategoryList.innerHTML =
    Object.entries(byCategory)
      .sort(
        (a, b) =>
          b[1] - a[1]
      )
      .map(
        ([category, value]) => {

          const percent =
            outcome > 0
              ? Math.round(
                (value / outcome) * 100
              )
              : 0;


          return `

            <div class="finance-category-row">

              <span class="finance-category-name">
                ${escapeHtml(category)}
              </span>

              <div class="daily-revenue-bar-track">

                <div
                  class="daily-revenue-bar-fill"
                  style="width: ${percent}%">
                </div>

              </div>

              <span class="daily-revenue-value">
                ${brl(value)}
                (${percent}%)
              </span>

            </div>

          `;

        }
      )
      .join("");

}


// ---- lista de despesas ----

function renderExpenseList(periodExpenses) {

  if (!periodExpenses.length) {

    expenseList.innerHTML = `

      <div class="reports-empty">
        Nenhuma despesa lançada neste período.
        Clique em "+ Nova despesa" para começar.
      </div>

    `;

    return;

  }


  expenseList.innerHTML =
    periodExpenses
      .map(
        expense => `

          <div class="expense-row">

            <span class="expense-date">
              ${formatExpenseDate(expense.date)}
            </span>

            <div class="expense-info">

              <strong>
                ${escapeHtml(expense.description)}
              </strong>

              <small>
                ${escapeHtml(expense.category)}
              </small>

            </div>

            <span class="expense-amount">
              − ${brl(expense.amount)}
            </span>

            <div class="admin-product-actions">

              <button
                class="admin-icon-button"
                type="button"
                data-expense-action="edit"
                data-id="${expense.id}"
                aria-label="Editar despesa">
                ✏️
              </button>

              <button
                class="admin-icon-button danger"
                type="button"
                data-expense-action="delete"
                data-id="${expense.id}"
                aria-label="Excluir despesa">
                🗑️
              </button>

            </div>

          </div>

        `
      )
      .join("");

}


// ---- lucro no financeiro ----
//
// Custo dos produtos vendidos (CMV) = soma dos custos dos
//   itens das vendas do período que têm custo registrado.
// Lucro bruto   = vendas (com custo) - CMV.
// Lucro líquido = lucro bruto - despesas do período,
//   EXCETO a categoria "Insumos": a compra de insumos já
//   está embutida no custo dos produtos, então contá-la de
//   novo seria descontar o mesmo gasto duas vezes.

function renderProfitSummary(
  periodSales,
  periodExpenses
) {

  const costEl =
    $("financeCost");

  const grossEl =
    $("financeGrossProfit");

  const netEl =
    $("financeNetProfit");

  const noteEl =
    $("financeProfitNote");


  let totalCost = 0;
  let grossProfit = 0;
  let withoutCost = 0;


  periodSales.forEach(
    sale => {

      const info =
        getSaleProfit(sale);

      if (!info.known) {

        withoutCost++;

        return;

      }

      totalCost +=
        info.cost;

      grossProfit +=
        info.profit;

    }
  );


  const operatingExpenses =
    periodExpenses
      .filter(
        expense =>
          expense.category !== "Insumos"
      )
      .reduce(
        (sum, expense) =>
          sum + expense.amount,
        0
      );


  const netProfit =
    round2(
      grossProfit - operatingExpenses
    );


  costEl.textContent =
    brl(totalCost);

  grossEl.textContent =
    brl(grossProfit);

  netEl.textContent =
    brl(netProfit);


  setValueSign(grossEl, grossProfit);
  setValueSign(netEl, netProfit);


  const notes = [];

  if (withoutCost > 0) {

    notes.push(
      `${withoutCost} venda${withoutCost === 1 ? "" : "s"} do período sem custo registrado ficou${withoutCost === 1 ? "" : "ram"} fora do cálculo de lucro.`
    );

  }

  notes.push(
    'Lucro líquido = lucro bruto − despesas, sem contar "Insumos" (o custo dos produtos já cobre esse gasto).'
  );

  noteEl.textContent =
    notes.join(" ");

}


// ---- formulário de despesa (criar ou editar) ----

function openExpenseForm(expenseId) {

  const expense =
    expenseId
      ? expenses.find(
        item =>
          item.id === expenseId
      )
      : null;


  expenseFormId.value =
    expense ? expense.id : "";

  expenseFormTitle.textContent =
    expense ? "Editar despesa" : "Nova despesa";

  expenseFormDescription.value =
    expense ? expense.description : "";

  expenseFormCategory.value =
    expense ? expense.category : "Insumos";

  expenseFormAmount.value =
    expense ? expense.amount : "";

  expenseFormDate.value =
    expense ? expense.date : todayISO();

  expenseFormSubmitButton.textContent =
    expense ? "Salvar alterações" : "Lançar despesa";

  deleteExpenseButton.classList.toggle(
    "hidden",
    !expense
  );


  expenseFormModal.classList.remove(
    "hidden"
  );

}


// Devolve true só se a despesa foi mesmo excluída.

async function deleteExpense(expenseId) {

  const expense =
    expenses.find(
      item =>
        item.id === expenseId
    );


  if (!expense) {
    return false;
  }


  const confirmado =
    window.confirm(
      `Excluir a despesa "${expense.description}" (${brl(expense.amount)})? Essa ação não pode ser desfeita.`
    );


  if (!confirmado) {
    return false;
  }


  try {

    await deleteDoc(
      doc(
        window.db,
        "despesas",
        expenseId
      )
    );


    showToast(
      "Despesa excluída."
    );


    await loadExpenses();

    renderFinance();

    return true;


  } catch (error) {

    console.error(
      "Erro ao excluir despesa:",
      error
    );

    showToast(
      "Não foi possível excluir a despesa."
    );

    return false;

  }

}


// ---- eventos do financeiro ----

on(financeMonthFilter, "change", renderFinance);

on(
  financeAllButton,
  "click",
  () => {

    financeMonthFilter.value =
      "";

    renderFinance();

  }
);

on(
  addExpenseButton,
  "click",
  () => openExpenseForm(null)
);

on(
  closeExpenseFormModal,
  "click",
  () => closeModal(expenseFormModal)
);

on(
  expenseList,
  "click",
  event => {

    const button =
      event.target.closest(
        "[data-expense-action]"
      );

    if (!button) {
      return;
    }


    if (button.dataset.expenseAction === "edit") {

      openExpenseForm(
        button.dataset.id
      );

    }


    if (button.dataset.expenseAction === "delete") {

      deleteExpense(
        button.dataset.id
      );

    }

  }
);

on(
  deleteExpenseButton,
  "click",
  async () => {

    const id =
      expenseFormId.value;

    if (!id) {
      return;
    }

    // Só fecha o formulário se a despesa foi excluída

    if (await deleteExpense(id)) {

      closeModal(
        expenseFormModal
      );

    }

  }
);


on(
  expenseForm,
  "submit",
  async event => {

    event.preventDefault();


    const id =
      expenseFormId.value;

    const description =
      expenseFormDescription.value.trim();

    const amount =
      round2(expenseFormAmount.value);

    const date =
      expenseFormDate.value;


    if (!description) {

      showToast(
        "Informe a descrição da despesa."
      );

      return;

    }


    if (amount <= 0) {

      showToast(
        "Informe um valor maior que zero."
      );

      return;

    }


    if (!date) {

      showToast(
        "Informe a data da despesa."
      );

      return;

    }


    const expenseData = {

      description:
        description,

      category:
        expenseFormCategory.value,

      amount:
        amount,

      date:
        date,

      updatedAt:
        serverTimestamp()

    };


    expenseFormSubmitButton.disabled =
      true;

    expenseFormSubmitButton.textContent =
      "Salvando...";


    try {

      if (id) {

        await updateDoc(
          doc(
            window.db,
            "despesas",
            id
          ),
          expenseData
        );

        showToast(
          "Despesa atualizada."
        );

      } else {

        await addDoc(
          collection(
            window.db,
            "despesas"
          ),
          {

            ...expenseData,

            createdAt:
              serverTimestamp()

          }
        );

        showToast(
          "Despesa lançada."
        );

      }


      closeModal(
        expenseFormModal
      );

      await loadExpenses();

      renderFinance();


    } catch (error) {

      console.error(
        "Erro ao salvar despesa:",
        error
      );

      showToast(
        "Não foi possível salvar a despesa."
      );


    } finally {

      expenseFormSubmitButton.disabled =
        false;

      expenseFormSubmitButton.textContent =
        id
          ? "Salvar alterações"
          : "Lançar despesa";

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
      saleDetailsModal
    );

    closeModal(
      productFormModal
    );

    closeModal(
      expenseFormModal
    );

  }
);


// ======================================================
// INICIALIZAÇÃO
//
// O admin.html chama window.iniciarAdmin() quando confirma
// que o usuário é administrador. Se a confirmação terminou
// ANTES deste arquivo carregar, window.adminPronto já está
// true e a gente inicia por conta própria.
//
// O módulo inicial vem do endereço (admin.html#finance).
// ======================================================

let iniciado = false;


window.iniciarAdmin = () => {

  if (iniciado) {
    return;
  }

  iniciado = true;

  window.iniciarAdmin = () => {

  if (iniciado) {
    return;
  }

  iniciado = true;


  // Mês atual como padrão no dashboard (uma vez só)

  if (homeMonthFilter && !homeMonthFilter.value) {

    homeMonthFilter.value =
      todayISO().slice(0, 7);

  }


  const fromHash =
    window.location.hash
      .replace("#", "");


  showView(
    VIEWS.includes(fromHash)
      ? fromHash
      : "home",
    {
      updateHash: false
    }
  );

};


  const fromHash =
    window.location.hash
      .replace("#", "");


  showView(
    VIEWS.includes(fromHash)
      ? fromHash
      : "home",
    {
      updateHash: false
    }
  );

};


if (window.adminPronto) {

  window.iniciarAdmin();

}
