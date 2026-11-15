// ======================================================
// EQUIPE — FUNÇÕES COMUNS DAS TELAS DE TRABALHO
//
// Usado por garcom.html, balcao.html, cozinha.html e
// qr-mesas.html:
//
//   protegerPagina()  -> só deixa entrar quem tem o papel
//                        certo (os outros são mandados
//                        para a própria tela ou para o
//                        login). A garantia real continua
//                        nas Security Rules.
//   devolverEstoqueDeCancelados()
//                     -> quando o CLIENTE DA MESA cancela
//                        um pedido, ele não tem permissão
//                        para aumentar estoque. O pedido
//                        fica marcado com
//                        estoqueDevolvido: false e
//                        qualquer tela da equipe aberta
//                        devolve os itens ao estoque.
//   tempoDecorrido(), bipe(), itensHtml()...
// ======================================================

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  runTransaction,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  db,
  auth
} from "./firebase.js";

import {
  normalizarPapel,
  PAGINA_DO_PAPEL,
  NOME_DO_PAPEL,
  SIGLA_DO_PAPEL
} from "./papeis.js";

import {
  escapeHtml,
  getSaleDate
} from "./utils.js";


// ------------------------------------------------------
// PROTEGER A PÁGINA
//
// papeis: lista de papéis que podem abrir esta tela.
// Devolve uma Promise com { user, role } quando liberar.
// ------------------------------------------------------

export function protegerPagina({ papeis, pagina }) {

  return new Promise(
    resolve => {

      onAuthStateChanged(
        auth,
        async user => {

          // Sem login (ou visitante anônimo) -> login, e
          // depois volta para esta mesma tela
          if (!user || user.isAnonymous) {

            window.location.href =
              `login.html?voltar=${encodeURIComponent(pagina)}`;

            return;

          }


          let role =
            "cliente";

          try {

            const snapshot =
              await getDoc(
                doc(db, "usuarios", user.uid)
              );

            if (snapshot.exists()) {
              role =
                normalizarPapel(
                  snapshot.data().role
                );
            }

          } catch (error) {

            console.error(
              "Erro ao ler o papel do usuário:",
              error
            );

          }


          if (!papeis.includes(role)) {

            window.location.replace(
              PAGINA_DO_PAPEL[role] ||
              "index.html"
            );

            return;

          }


          window.currentUser = user;
          window.userRole = role;

          preencherCabecalho(role);

          document.body.style.visibility =
            "visible";

          resolve({
            user,
            role
          });

        }
      );

    }
  );

}


function preencherCabecalho(role) {

  const avatar =
    document.getElementById("userAvatar");

  const label =
    document.getElementById("userRoleLabel");

  if (avatar) {
    avatar.textContent =
      SIGLA_DO_PAPEL[role] || "??";
  }

  if (label) {
    label.textContent =
      NOME_DO_PAPEL[role] || role;
  }


  const sair =
    document.getElementById("logoutButton");

  if (sair) {

    sair.onclick = () => {

      signOut(auth).then(
        () => {
          window.location.href =
            "login.html";
        }
      );

    };

  }

}


// ------------------------------------------------------
// DEVOLVER ESTOQUE DE PEDIDOS CANCELADOS PELO CLIENTE
//
// Transação: confere que o estoque ainda não foi
// devolvido (duas telas abertas ao mesmo tempo não
// devolvem em dobro) e só então soma os itens de volta.
// ------------------------------------------------------

export function devolverEstoqueDeCancelados() {

  const pendentes =
    query(
      collection(db, "vendas"),
      where("estoqueDevolvido", "==", false)
    );


  return onSnapshot(
    pendentes,
    snapshot => {

      snapshot.docs.forEach(
        documento =>
          devolverEstoque(documento.id)
            .catch(
              error =>
                console.error(
                  "Erro ao devolver estoque:",
                  error
                )
            )
      );

    },
    error =>
      console.error(
        "Erro ao acompanhar cancelamentos:",
        error
      )
  );

}


async function devolverEstoque(vendaId) {

  const vendaRef =
    doc(db, "vendas", vendaId);


  await runTransaction(
    db,
    async transaction => {

      const venda =
        await transaction.get(vendaRef);

      if (
        !venda.exists() ||
        venda.data().estoqueDevolvido !== false
      ) {
        return;
      }


      const itens =
        Array.isArray(venda.data().items)
          ? venda.data().items
          : [];


      // Leituras antes das escritas (regra do Firestore)
      const produtos = [];

      for (const item of itens) {

        if (!item.productId) {
          continue;
        }

        const ref =
          doc(db, "produtos", item.productId);

        produtos.push({
          item,
          ref,
          snapshot: await transaction.get(ref)
        });

      }


      produtos.forEach(
        ({ item, ref, snapshot }) => {

          if (snapshot.exists()) {

            transaction.update(
              ref,
              {
                stock:
                  increment(
                    Number(item.quantity) || 0
                  )
              }
            );

          }

        }
      );


      transaction.update(
        vendaRef,
        {
          estoqueDevolvido: true
        }
      );

    }
  );

}


// ------------------------------------------------------
// UTILITÁRIOS DE TELA
// ------------------------------------------------------

export function horarioEmMs(timestamp) {

  const date =
    getSaleDate(timestamp);

  return date
    ? date.getTime()
    : Date.now();

}


export function tempoDecorrido(desdeMs) {

  const minutos =
    Math.max(
      0,
      Math.floor(
        (Date.now() - desdeMs) / 60000
      )
    );

  if (minutos < 1) {
    return "agora";
  }

  if (minutos < 60) {
    return `há ${minutos} min`;
  }

  const horas =
    Math.floor(minutos / 60);

  return `há ${horas}h${String(minutos % 60).padStart(2, "0")}`;

}


// Atualiza todos os "há X min" da tela a cada 30 s
export function atualizarTemposNaTela() {

  setInterval(
    () => {

      document
        .querySelectorAll("[data-since]")
        .forEach(
          elemento => {

            elemento.textContent =
              tempoDecorrido(
                Number(elemento.dataset.since)
              );

          }
        );

    },
    30000
  );

}


// Lista de itens "2× X-Burger"
export function itensHtml(itens) {

  return (Array.isArray(itens) ? itens : [])
    .map(
      item => `
        <li>
          <b>${Number(item.quantity) || 0}×</b>
          ${escapeHtml(item.name || "Produto")}
        </li>
      `
    )
    .join("");

}


// Bipe curto (o navegador só toca som depois de algum
// clique na página — por isso as telas pedem um toque
// para "ativar o som")
export function bipe() {

  try {

    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    const context =
      bipe.context ||
      (bipe.context = new AudioContextClass());

    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    oscillator.type = "square";
    oscillator.frequency.value = 880;

    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);

  } catch {

    // Sem som: o aviso visual basta

  }

}


// ------------------------------------------------------
// MUDAR O STATUS DE UM PEDIDO
//
// Transação: só muda se o pedido ainda estiver no status
// esperado ("de"). Se outra pessoa já mexeu (dois
// aparelhos ao mesmo tempo), avisa em vez de pular etapa.
// ------------------------------------------------------

export async function mudarStatus(vendaId, de, para, extras = {}) {

  const vendaRef =
    doc(db, "vendas", vendaId);


  await runTransaction(
    db,
    async transaction => {

      const venda =
        await transaction.get(vendaRef);

      if (!venda.exists()) {
        throw new Error("O pedido não existe mais.");
      }

      if (venda.data().status !== de) {
        throw new Error("Esse pedido já foi atualizado por outra pessoa.");
      }


      transaction.update(
        vendaRef,
        {
          status: para,
          statusUpdatedAt: serverTimestamp(),
          [`statusTimes.${para}`]: serverTimestamp(),
          ...extras
        }
      );

    }
  );

}


// ------------------------------------------------------
// CANCELAR PEDIDO PELA EQUIPE (balcão / garçom)
//
// Devolve os itens ao estoque na mesma transação e, se o
// pedido tinha telefone (delivery), desfaz a soma no CRM.
// ------------------------------------------------------

export async function cancelarPedido(vendaId, statusPermitidos) {

  const vendaRef =
    doc(db, "vendas", vendaId);


  await runTransaction(
    db,
    async transaction => {

      const vendaSnap =
        await transaction.get(vendaRef);

      if (!vendaSnap.exists()) {
        throw new Error("O pedido não existe mais.");
      }


      const venda =
        vendaSnap.data();

      if (!statusPermitidos.includes(venda.status)) {
        throw new Error("Esse pedido já está em preparo e não pode mais ser cancelado.");
      }


      const itens =
        Array.isArray(venda.items)
          ? venda.items
          : [];

      const produtos = [];

      for (const item of itens) {

        if (!item.productId) {
          continue;
        }

        const ref =
          doc(db, "produtos", item.productId);

        produtos.push({
          item,
          ref,
          snapshot: await transaction.get(ref)
        });

      }


      produtos.forEach(
        ({ item, ref, snapshot }) => {

          if (snapshot.exists()) {

            transaction.update(
              ref,
              {
                stock:
                  increment(
                    Number(item.quantity) || 0
                  )
              }
            );

          }

        }
      );


      transaction.update(
        vendaRef,
        {
          status: "cancelado",
          statusUpdatedAt: serverTimestamp(),
          "statusTimes.cancelado": serverTimestamp(),
          canceladoPor: window.userRole || "equipe",
          estoqueDevolvido: true,

          // pedido de mesa cancelado sai da conta da mesa
          ...(
            venda.tipo === "mesa"
              ? { contaStatus: "cancelada" }
              : {}
          )
        }
      );


      if (venda.customerPhone) {

        transaction.set(
          doc(db, "clientes", String(venda.customerPhone)),
          {
            totalGasto:
              increment(-(Number(venda.total) || 0)),
            quantidadeCompras:
              increment(-1)
          },
          {
            merge: true
          }
        );

      }

    }
  );

}
