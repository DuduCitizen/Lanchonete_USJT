// ======================================================
// QR-MESAS.JS — QR CODE DE CADA MESA
//
// Cada QR é só um link: <site>/mesa.html?mesa=N.
// Usa o mesmo desenhador de QR do Pix (js/pix.js).
// ======================================================

import {
  escapeHtml
} from "./utils.js";

import {
  gerarQrCodeSvg
} from "./pix.js";

import {
  protegerPagina
} from "./equipe.js";

import { NUMERO_DE_MESAS } from "./config-restaurante.js";


const $ = id =>
  document.getElementById(id);


// Endereço da pasta onde está o site (sem o nome da página)
function enderecoPadrao() {

  return new URL(".", window.location.href)
    .href;

}


function linkDaMesa(base, mesa) {

  return new URL(
    `mesa.html?mesa=${mesa}`,
    base.endsWith("/") ? base : `${base}/`
  ).href;

}


function gerar() {

  const base =
    $("enderecoBase").value.trim() ||
    enderecoPadrao();


  // localhost / 127.0.0.1 só funciona no próprio computador
  const local =
    /\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.)/.test(base) ||
    base.startsWith("file:");

  $("avisoLocal").classList.toggle(
    "hidden",
    !local
  );

  $("avisoLocal").textContent =
    local
      ? "⚠️ Este endereço só funciona neste computador. Para o celular dos clientes abrir, " +
        "publique o site (ex.: GitHub Pages) e cole o endereço público no campo acima."
      : "";


  const cartoes = [];

  for (let mesa = 1; mesa <= NUMERO_DE_MESAS; mesa++) {

    const link =
      linkDaMesa(base, mesa);

    cartoes.push(`
      <div class="qr-card">
        ${gerarQrCodeSvg(link) || "<p>QR indisponível (sem internet para carregar o gerador)</p>"}
        <strong>MESA ${mesa}</strong>
        <small>Aponte a câmera do celular<br>para pedir pelo cardápio</small>
        <code>${escapeHtml(link)}</code>
      </div>
    `);

  }


  $("qrGrid").innerHTML =
    cartoes.join("");

}


$("gerarButton").addEventListener("click", gerar);
$("imprimirButton").addEventListener("click", () => window.print());


protegerPagina({
  papeis: ["administrador", "garcom"],
  pagina: "qr-mesas.html"
}).then(
  () => {

    $("enderecoBase").value =
      enderecoPadrao();

    gerar();

  }
);
