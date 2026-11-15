// ======================================================
// CONFIGURAÇÃO DO SALÃO (RESTAURANTE FÍSICO)
//
// Quantidade de mesas. Usado:
//   - pela página da mesa (mesa.html?mesa=N só aceita
//     números de 1 até aqui);
//   - pela tela do garçom (mostra uma caixinha por mesa);
//   - pela página de QR Codes (gera um QR por mesa).
//
// ⚠️ As Security Rules (firestore.rules) aceitam mesas de
// 1 a 50. Se um dia passar de 50 mesas, aumente lá também.
// ======================================================

export const NUMERO_DE_MESAS = 12;
