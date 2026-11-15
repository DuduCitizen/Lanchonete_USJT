// ======================================================
// CONFIGURAÇÃO DO PIX
//
// Dados de quem RECEBE o Pix. Eles entram no QR Code e no
// código "copia e cola" gerados no checkout.
//
// ⚠️ TROCAR ANTES DE USAR DE VERDADE:
//   chave  -> chave Pix da lanchonete (e-mail, celular no
//             formato +5511999998888, CPF/CNPJ só números
//             ou chave aleatória)
//   nome   -> nome do recebedor (até 25 caracteres)
//   cidade -> cidade do recebedor (até 15 caracteres)
//
// Enquanto a chave for a de exemplo, o modal do Pix mostra
// um aviso de "QR Code de demonstração".
//
// Não existe gateway: o dinheiro cai direto na conta da
// chave, e o administrador confirma o pagamento à mão na
// aba "Pedidos" do painel.
// ======================================================

export const CHAVE_PIX_EXEMPLO =
  "chave-pix-de-exemplo@byteburger.com";


// Dados copiados do QR Code gerado pelo próprio app do
// banco (Inter), para ficarem idênticos ao cadastro da chave.
// Chave de celular vai no formato +55 DDD número, sem
// espaços nem traços.

export const PIX_CONFIG = {

  chave:
    "+5511987715766",

  nome:
    "LUCAS E S DA CUNHA",

  cidade:
    "SAO PAULO"

};
