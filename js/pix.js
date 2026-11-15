// ======================================================
// PIX — QR CODE E "COPIA E COLA" (SEM GATEWAY)
//
// Gera o "BR Code" do Pix: o texto padronizado pelo Banco
// Central que vai dentro do QR Code. Qualquer app de banco
// lê esse texto e já preenche chave, valor e identificador.
//
// Formato (EMV): uma sequência de campos ID + TAMANHO +
// VALOR. Ex.: "5802BR" = campo 58 (país), tamanho 02,
// valor "BR". O último campo (63) é um CRC16 que o app do
// banco usa para conferir se o código não foi corrompido.
//
// O desenho do QR Code usa a biblioteca qrcode-generator
// (CDN, carregada no index.html, fica em window.qrcode).
// Se ela não carregar, o "copia e cola" continua
// funcionando normalmente.
// ======================================================


// ------------------------------------------------------
// Campo EMV: ID (2 dígitos) + tamanho (2 dígitos) + valor
// ------------------------------------------------------

function campo(id, valor) {

  const texto =
    String(valor);

  return (
    id +
    String(texto.length).padStart(2, "0") +
    texto
  );

}


// ------------------------------------------------------
// Tira acentos e caracteres fora do básico. Alguns apps
// de banco recusam nome/cidade com acento no BR Code.
// ------------------------------------------------------

function limparTexto(valor, limite) {

  return String(valor || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-]/g, "")
    .trim()
    .slice(0, limite);

}


// ------------------------------------------------------
// Identificador da transação (txid): só letras e números,
// até 25 caracteres. Usamos o ID do pedido, assim o admin
// consegue achar o pedido pelo extrato do banco.
// ------------------------------------------------------

function limparTxid(valor) {

  const txid =
    String(valor || "")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 25);

  return txid || "***";

}


// ------------------------------------------------------
// CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF),
// exigido pelo padrão do Pix. Resultado em 4 dígitos hexa.
// ------------------------------------------------------

export function crc16(texto) {

  let crc = 0xFFFF;

  for (let i = 0; i < texto.length; i++) {

    crc ^= texto.charCodeAt(i) << 8;

    for (let bit = 0; bit < 8; bit++) {

      crc =
        (crc & 0x8000)
          ? ((crc << 1) ^ 0x1021)
          : (crc << 1);

      crc &= 0xFFFF;

    }

  }

  return crc
    .toString(16)
    .toUpperCase()
    .padStart(4, "0");

}


// ------------------------------------------------------
// MONTA O CÓDIGO "COPIA E COLA"
//
// { chave, nome, cidade, valor, txid }
// ------------------------------------------------------

export function gerarPixCopiaECola({
  chave,
  nome,
  cidade,
  valor,
  txid
}) {

  const contaRecebedor =
    campo("00", "br.gov.bcb.pix") +
    campo("01", String(chave).trim());

  const valorFormatado =
    (Math.round((Number(valor) || 0) * 100) / 100)
      .toFixed(2);

  const semCrc =
    campo("00", "01") +
    campo("26", contaRecebedor) +
    campo("52", "0000") +
    campo("53", "986") +                 // real (BRL)
    campo("54", valorFormatado) +
    campo("58", "BR") +
    campo("59", limparTexto(nome, 25) || "RECEBEDOR") +
    campo("60", limparTexto(cidade, 15) || "SAO PAULO") +
    campo("62", campo("05", limparTxid(txid))) +
    "6304";

  return semCrc + crc16(semCrc);

}


// ------------------------------------------------------
// DESENHA O QR CODE (SVG)
//
// Devolve o SVG em texto, ou null se a biblioteca de QR
// Code não carregou (sem internet / CDN fora do ar).
// ------------------------------------------------------

export function gerarQrCodeSvg(texto) {

  if (typeof window.qrcode !== "function") {
    return null;
  }


  try {

    // 0 = tamanho automático; "M" = correção de erro média
    const qr =
      window.qrcode(0, "M");

    qr.addData(texto);
    qr.make();


    const modulos =
      qr.getModuleCount();

    const margem = 4;

    const tamanho =
      modulos + margem * 2;


    let caminho = "";

    for (let linha = 0; linha < modulos; linha++) {

      for (let coluna = 0; coluna < modulos; coluna++) {

        if (qr.isDark(linha, coluna)) {

          caminho +=
            `M${coluna + margem} ${linha + margem}h1v1h-1z`;

        }

      }

    }


    return `<svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 ${tamanho} ${tamanho}"
      shape-rendering="crispEdges"
      role="img"
      aria-label="QR Code do Pix">
      <rect width="${tamanho}" height="${tamanho}" fill="#ffffff"/>
      <path d="${caminho}" fill="#000000"/>
    </svg>`;

  } catch (error) {

    console.error(
      "Erro ao gerar o QR Code do Pix:",
      error
    );

    return null;

  }

}
