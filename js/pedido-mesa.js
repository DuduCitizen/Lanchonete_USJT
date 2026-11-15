// ======================================================
// PEDIDO DE MESA — CRIAR E CANCELAR
//
// Usado pela página da mesa (cliente) e pela tela do
// garçom (quando ele anota o pedido pelo cliente).
//
// Formato do pedido de mesa em "vendas":
//   tipo: "mesa", mesa: 7
//   status: "recebido"        (já entra na fila da cozinha)
//   contaStatus: "aberta"     (paga no fim, na maquininha)
//   payment: "Na mesa"        (o garçom troca pela forma
//                              real ao fechar a conta)
//   items, total, userId, criadoPor ("cliente"/"garcom")
//
// As Security Rules conferem esse formato.
// ======================================================

import {
  collection,
  doc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import { db } from "./firebase.js";

import {
  STATUS,
  TIPO,
  CONTA
} from "./pedidos.js";


export const PAGAMENTO_NA_MESA = "Na mesa";


// itens: [{ id, name, price, quantity }]
export async function criarPedidoMesa({ mesa, itens, criadoPor }) {

  if (!itens.length) {
    throw new Error("O pedido está vazio.");
  }


  const vendaRef =
    doc(collection(db, "vendas"));


  const total =
    Math.round(
      itens.reduce(
        (soma, item) =>
          soma + (Number(item.price) || 0) * item.quantity,
        0
      ) * 100
    ) / 100;


  await runTransaction(
    db,
    async transaction => {

      // 1. Ler todos os produtos (leituras antes das escritas)
      const lidos = [];

      for (const item of itens) {

        const ref =
          doc(db, "produtos", item.id);

        lidos.push({
          item,
          ref,
          snapshot: await transaction.get(ref)
        });

      }


      // 2. Validar disponibilidade e estoque
      for (const { item, snapshot } of lidos) {

        if (!snapshot.exists()) {
          throw new Error(`${item.name} não existe mais no cardápio.`);
        }

        const data =
          snapshot.data();

        if (data.available !== true) {
          throw new Error(`${item.name} está indisponível.`);
        }

        if ((Number(data.stock) || 0) < item.quantity) {
          throw new Error(`Estoque insuficiente para ${item.name}. Disponível: ${Number(data.stock) || 0}.`);
        }

      }


      // 3. Dar baixa no estoque
      for (const { item, ref, snapshot } of lidos) {

        transaction.update(
          ref,
          {
            stock:
              (Number(snapshot.data().stock) || 0) -
              item.quantity
          }
        );

      }


      // 4. Criar o pedido (com o custo de cada item, para
      //    o cálculo de lucro do financeiro)
      transaction.set(
        vendaRef,
        {
          tipo: TIPO.MESA,
          mesa: Number(mesa),

          userId: window.currentUser.uid,
          criadoPor: criadoPor,

          customerName: `Mesa ${mesa}`,
          customerPhone: null,

          items:
            lidos.map(
              ({ item, snapshot }) => ({
                productId: item.id,
                name: item.name,
                cost:
                  typeof snapshot.data().cost === "number"
                    ? snapshot.data().cost
                    : null,
                price: Number(item.price) || 0,
                quantity: item.quantity,
                subtotal: (Number(item.price) || 0) * item.quantity
              })
            ),

          subtotal: total,
          discount: 0,
          total: total,

          payment: PAGAMENTO_NA_MESA,

          status: STATUS.RECEBIDO,
          contaStatus: CONTA.ABERTA,

          createdAt: serverTimestamp(),
          statusUpdatedAt: serverTimestamp(),
          statusTimes: {
            recebido: serverTimestamp()
          }
        }
      );

    }
  );


  return {
    id: vendaRef.id,
    total
  };

}


// ------------------------------------------------------
// CANCELAMENTO PELO CLIENTE DA MESA
//
// Só enquanto o pedido está "recebido" (a cozinha ainda
// não começou). O cliente não tem permissão para aumentar
// estoque, então o pedido fica com estoqueDevolvido:
// false e a tela da equipe que estiver aberta devolve os
// itens (js/equipe.js → devolverEstoqueDeCancelados).
// ------------------------------------------------------

export async function cancelarPedidoMesaCliente(vendaId) {

  const vendaRef =
    doc(db, "vendas", vendaId);


  await runTransaction(
    db,
    async transaction => {

      const snapshot =
        await transaction.get(vendaRef);

      if (!snapshot.exists()) {
        throw new Error("O pedido não existe mais.");
      }

      if (snapshot.data().status !== STATUS.RECEBIDO) {
        throw new Error("A cozinha já começou a preparar este pedido. Ele não pode mais ser cancelado.");
      }


      transaction.update(
        vendaRef,
        {
          status: STATUS.CANCELADO,
          statusUpdatedAt: serverTimestamp(),
          "statusTimes.cancelado": serverTimestamp(),
          canceladoPor: "cliente",
          contaStatus: "cancelada",
          estoqueDevolvido: false
        }
      );

    }
  );

}
