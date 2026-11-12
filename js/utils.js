// ======================================================
// UTILS — FUNÇÕES COMPARTILHADAS
//
// Usado pela página do cliente (js/app.js) e pelo painel
// do administrador (js/admin.js). Aqui ficam só coisas
// que as duas páginas precisam: formatação, imagem de
// produto, toast, fechar modal e a leitura de produtos.
//
// Não guarda estado nem mexe em elementos específicos de
// uma página. O Firestore vem de window.db, definido pelo
// script de cada HTML antes de qualquer função rodar.
// ======================================================

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";


// ======================================================
// FORMATAÇÃO DE PREÇO E NÚMEROS
// ======================================================

export const brl = value => {

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


export function round2(value) {

  return Math.round(
    (Number(value) || 0) * 100
  ) / 100;

}


export function formatPercent(value) {

  return `${
    (
      Math.round(value * 10) / 10
    ).toLocaleString("pt-BR")
  }%`;

}


// ======================================================
// ESCAPAR HTML
// Evita problemas quando nomes vêm do Firebase.
// ======================================================

export function escapeHtml(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}


// ======================================================
// IMAGENS DE PRODUTO
//
// O campo "image" do produto (Firestore) pode ser:
//   - um emoji (ex.: "🍔")                 -> mostra o emoji
//   - um arquivo (ex.: "x-burger.webp")    -> carrega de img/
//   - um caminho (ex.: "img/x.png") ou URL completa
//
// Se o arquivo não existir, cai automaticamente no emoji padrão.
// ======================================================

export const EMOJI_PADRAO = "🍔";

export const PASTA_IMAGENS_PRODUTOS = "img/";


export function isImagePath(value) {

  return /\.(png|jpe?g|webp|gif|svg|avif)(\?.*)?$/i.test(
    String(value || "").trim()
  );

}


export function resolveImageSrc(value) {

  const v =
    String(value || "").trim();

  // URL completa, caminho absoluto ou já com pasta
  if (
    /^(https?:|data:|\/)/i.test(v) ||
    v.includes("/")
  ) {
    return v;
  }

  // só o nome do arquivo -> assume a pasta padrão
  return PASTA_IMAGENS_PRODUTOS + v;

}


export function renderProductImage(value, alt = "") {

  const v =
    String(value || "").trim() ||
    EMOJI_PADRAO;

  if (!isImagePath(v)) {
    return escapeHtml(v);
  }

  return `<img
    class="product-img"
    src="${escapeHtml(resolveImageSrc(v))}"
    alt="${escapeHtml(alt)}"
    loading="lazy"
    onerror="this.replaceWith(document.createTextNode('${EMOJI_PADRAO}'))">`;

}


// ======================================================
// DATAS
//
// Aceita Timestamp do Firestore, Date, { seconds } ou
// qualquer coisa que o construtor Date entenda.
// ======================================================

export function getSaleDate(timestamp) {

  if (!timestamp) {
    return null;
  }


  try {

    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate();
    }

    if (timestamp.seconds !== undefined) {
      return new Date(timestamp.seconds * 1000);
    }

    if (timestamp instanceof Date) {
      return timestamp;
    }

    const date =
      new Date(timestamp);

    return Number.isNaN(date.getTime())
      ? null
      : date;

  } catch {

    return null;

  }

}


export function formatSaleDate(timestamp) {

  if (!timestamp) {
    return "Data não disponível";
  }


  const date =
    getSaleDate(timestamp);


  if (
    !date ||
    Number.isNaN(date.getTime())
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

}


// ======================================================
// PAGAMENTO
// ======================================================

export function getPaymentIcon(payment) {

  switch (String(payment).toLowerCase()) {

    case "pix":
      return "⚡";

    case "dinheiro":
      return "💵";

    case "débito":
    case "debito":
    case "crédito":
    case "credito":
      return "💳";

    default:
      return "💰";

  }

}


// ======================================================
// TOAST E MODAIS
//
// O elemento #toast existe nas duas páginas.
// ======================================================

export function showToast(message) {

  const toast =
    document.getElementById("toast");

  if (!toast) {
    return;
  }


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


export function closeModal(modal) {

  if (!modal) {
    return;
  }

  modal.classList.add(
    "hidden"
  );

}


// ======================================================
// PRODUTOS (LEITURA DO FIRESTORE)
//
// Devolve TODOS os produtos, já normalizados. Quem usa
// decide o que mostrar: o cardápio do cliente esconde
// indisponíveis e sem estoque; o painel admin mostra tudo.
// ======================================================

export function mapProduct(documentSnapshot) {

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
      Number(data.price) || 0,

    description:
      String(
        data.description ||
        "Sem descrição disponível."
      ),

    // campo "image" tem prioridade; "emoji" é o nome antigo
    emoji:
      String(
        data.image ||
        data.emoji ||
        EMOJI_PADRAO
      ),

    available:
      data.available === true,

    // custo unitário; null = ainda não cadastrado
    cost:
      data.cost === undefined ||
      data.cost === null
        ? null
        : Number(data.cost) || 0,

    stock:
      Number(data.stock) || 0

  };

}


export async function fetchProducts() {

  const snapshot =
    await getDocs(
      collection(
        window.db,
        "produtos"
      )
    );

  return snapshot.docs.map(
    mapProduct
  );

}
