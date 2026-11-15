// ======================================================
// PEDIDOS — STATUS COMPARTILHADOS
//
// Usado pela página do cliente (rastreio do pedido) e pelo
// painel do administrador (aba "Pedidos" / cozinha).
//
// Fluxo de um pedido (campo "status" em "vendas"):
//
//   aguardando_pagamento  -> só Pix. O pedido nasce aqui
//          |                 e espera o admin confirmar
//          v                 que o Pix caiu na conta.
//   recebido              -> pagamento ok (ou pagamento no
//          |                 balcão: dinheiro/cartão nascem
//          v                 direto aqui).
//   em_preparo
//          |
//          v
//   pronto                -> lanche pronto, esperando o
//          |                 motoboy
//          v
//   saiu_para_entrega     -> motoboy a caminho do endereço
//          |                 do cadastro do cliente
//          v
//   entregue              -> fim
//
//   cancelado             -> a qualquer momento antes de
//                            "em_preparo"; o estoque volta.
//
// Vendas antigas, de antes do rastreio, têm status
// "finalizada" e continuam contando no faturamento.
//
// DOIS TIPOS DE PEDIDO (campo "tipo"):
//
//   "delivery" (fast food, index.html): paga antes, no
//      app. Fluxo completo acima.
//
//   "mesa" (restaurante físico, mesa.html): nasce
//      "recebido", vai para a cozinha e é ENTREGUE NA
//      MESA pelo garçom (não tem "saiu para entrega").
//      O pagamento é no FIM, na maquininha: o pedido tem
//      um segundo status, o da conta (campo "contaStatus"):
//         "aberta" -> ainda não pago
//         "paga"   -> garçom fechou a conta da mesa
//      Pedido de mesa só entra no faturamento quando a
//      conta é fechada.
//
// Pedidos antigos sem "tipo" são tratados como delivery.
// ======================================================

export const TIPO = {
  DELIVERY: "delivery",
  MESA: "mesa"
};


export const CONTA = {
  ABERTA: "aberta",
  PAGA: "paga"
};


export function ehMesa(pedido) {

  return pedido?.tipo === TIPO.MESA;

}

export const STATUS = {
  AGUARDANDO_PAGAMENTO: "aguardando_pagamento",
  RECEBIDO: "recebido",
  EM_PREPARO: "em_preparo",
  PRONTO: "pronto",
  SAIU_PARA_ENTREGA: "saiu_para_entrega",
  ENTREGUE: "entregue",
  CANCELADO: "cancelado",
  FINALIZADA: "finalizada"
};


export const STATUS_INFO = {

  aguardando_pagamento: {
    label: "Aguardando pagamento",
    curto: "Pagamento",
    icone: "⏳",
    mensagemCliente: "Estamos aguardando a confirmação do seu Pix."
  },

  recebido: {
    label: "Pedido recebido",
    curto: "Recebido",
    icone: "📥",
    mensagemCliente: "Recebemos seu pedido! Ele já está na fila da cozinha."
  },

  em_preparo: {
    label: "Em preparo",
    curto: "Preparo",
    icone: "🔥",
    mensagemCliente: "Seu pedido está sendo preparado."
  },

  pronto: {
    label: "Pronto",
    curto: "Pronto",
    icone: "✅",
    mensagemCliente: "Seu pedido está pronto e já vai sair para entrega."
  },

  saiu_para_entrega: {
    label: "Saiu para entrega",
    curto: "A caminho",
    icone: "🛵",
    mensagemCliente: "O motoboy está a caminho do seu endereço!"
  },

  entregue: {
    label: "Entregue",
    curto: "Entregue",
    icone: "🍔",
    mensagemCliente: "Pedido entregue. Bom apetite!"
  },

  cancelado: {
    label: "Cancelado",
    curto: "Cancelado",
    icone: "✖",
    mensagemCliente: "Este pedido foi cancelado."
  },

  finalizada: {
    label: "Finalizada",
    curto: "Finalizada",
    icone: "✅",
    mensagemCliente: "Venda finalizada."
  }

};


// Etapas mostradas na linha do tempo do cliente
export const ETAPAS_PEDIDO = [
  STATUS.AGUARDANDO_PAGAMENTO,
  STATUS.RECEBIDO,
  STATUS.EM_PREPARO,
  STATUS.PRONTO,
  STATUS.SAIU_PARA_ENTREGA,
  STATUS.ENTREGUE
];


// Pedidos que ainda estão "na cozinha" (aparecem no quadro)
export const STATUS_ATIVOS = [
  STATUS.AGUARDANDO_PAGAMENTO,
  STATUS.RECEBIDO,
  STATUS.EM_PREPARO,
  STATUS.PRONTO,
  STATUS.SAIU_PARA_ENTREGA
];


// Status que contam como dinheiro recebido (relatórios,
// dashboard, financeiro). Pix não confirmado e pedido
// cancelado ficam de fora.
export const STATUS_FATURADOS = [
  STATUS.RECEBIDO,
  STATUS.EM_PREPARO,
  STATUS.PRONTO,
  STATUS.SAIU_PARA_ENTREGA,
  STATUS.ENTREGUE,
  STATUS.FINALIZADA
];


// Recebe o pedido inteiro (ou só o status, no formato
// antigo). Mesa: só quando a conta foi fechada.
export function contaNoFaturamento(pedido) {

  if (
    pedido &&
    typeof pedido === "object"
  ) {

    if (ehMesa(pedido)) {

      return (
        pedido.contaStatus === CONTA.PAGA &&
        pedido.status !== STATUS.CANCELADO
      );

    }

    return contaNoFaturamento(
      pedido.status
    );

  }


  return STATUS_FATURADOS.includes(
    String(pedido || STATUS.FINALIZADA)
  );

}


// Etapas da linha do tempo para ESTE pedido
export function etapasDoPedido(pedido) {

  if (ehMesa(pedido)) {

    return [
      STATUS.RECEBIDO,
      STATUS.EM_PREPARO,
      STATUS.PRONTO,
      STATUS.ENTREGUE
    ];

  }


  return ETAPAS_PEDIDO.filter(
    etapa =>
      ehPix(pedido?.payment) ||
      etapa !== STATUS.AGUARDANDO_PAGAMENTO
  );

}


// Mensagem para o cliente (mesa tem textos próprios)
export function mensagemParaCliente(pedido) {

  if (ehMesa(pedido)) {

    const mensagensMesa = {
      recebido: "Recebemos seu pedido! Ele está na fila da cozinha.",
      em_preparo: "Seu pedido está sendo preparado.",
      pronto: "Seu pedido está pronto e já vai para a sua mesa.",
      entregue: "Pedido entregue na mesa. Bom apetite!",
      cancelado: "Este pedido foi cancelado."
    };

    if (mensagensMesa[pedido.status]) {
      return mensagensMesa[pedido.status];
    }

  }


  return infoStatus(pedido?.status).mensagemCliente;

}


// Momento em que o pedido ENTROU na fila da cozinha:
// quando ficou "recebido" (Pix confirmado / pedido de mesa)
// ou, se não houver esse registro, quando foi criado.
// A fila é do mais antigo para o mais novo por este valor.
export function entradaNaFila(pedido) {

  return (
    pedido?.statusTimes?.recebido ||
    pedido?.createdAt ||
    null
  );

}


export function infoStatus(status) {

  return (
    STATUS_INFO[status] || {
      label: String(status || "—"),
      curto: String(status || "—"),
      icone: "•",
      mensagemCliente: ""
    }
  );

}


// Pagamento em Pix (o radio do checkout usa "PIX")
export function ehPix(payment) {

  return String(payment || "")
    .trim()
    .toUpperCase() === "PIX";

}


// Status inicial de um pedido novo, conforme o pagamento.
// As Security Rules conferem exatamente esta regra.
export function statusInicial(payment) {

  return ehPix(payment)
    ? STATUS.AGUARDANDO_PAGAMENTO
    : STATUS.RECEBIDO;

}


// Código curto do pedido para mostrar na tela e falar no
// balcão ("pedido #K7Q2X"). Vem do ID do documento.
export function codigoPedido(id) {

  return "#" +
    String(id || "")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 5)
      .toUpperCase();

}
