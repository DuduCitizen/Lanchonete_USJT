// ======================================================
// PAPÉIS (QUEM É QUEM NO SISTEMA)
//
// O papel fica no campo "role" do documento
// "usuarios/{uid}" no Firestore. Quem não tem documento
// (ou tem um papel desconhecido) é CLIENTE.
//
//   administrador -> dono: Início, Vendas, Produtos,
//                    Relatórios e Financeiro (admin.html)
//   garcom        -> mesas, contas e pedidos do salão
//                    (garcom.html)
//   balconista    -> pedidos do fast food/delivery:
//                    confirma Pix, despacha o motoboy
//                    (balcao.html)
//   cozinha       -> fila de preparo (cozinha.html)
//   cliente       -> delivery (index.html) ou mesa
//                    (mesa.html?mesa=N)
//
// Só o dono, pelo Firebase Console, cria/muda papéis (as
// Security Rules não deixam ninguém se autopromover).
// ======================================================

export const PAPEIS = {
  ADMIN: "administrador",
  GARCOM: "garcom",
  BALCONISTA: "balconista",
  COZINHA: "cozinha",
  CLIENTE: "cliente"
};


// Página inicial de cada papel da equipe
export const PAGINA_DO_PAPEL = {
  administrador: "admin.html",
  garcom: "garcom.html",
  balconista: "balcao.html",
  cozinha: "cozinha.html"
};


export const NOME_DO_PAPEL = {
  administrador: "Administrador",
  garcom: "Garçom",
  balconista: "Balconista",
  cozinha: "Cozinha",
  cliente: "Cliente",
  visitante: "Visitante"
};


export const SIGLA_DO_PAPEL = {
  administrador: "AD",
  garcom: "GA",
  balconista: "BA",
  cozinha: "CZ",
  cliente: "CL",
  visitante: "VI"
};


// Papel válido lido do Firestore (qualquer outra coisa
// vira "cliente": falha de forma segura)
export function normalizarPapel(role) {

  return Object.values(PAPEIS).includes(role)
    ? role
    : PAPEIS.CLIENTE;

}


export function ehEquipe(role) {

  return Boolean(PAGINA_DO_PAPEL[role]);

}
