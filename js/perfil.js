// ======================================================
// PERFIL DO CLIENTE — VALIDAÇÃO E FORMATAÇÃO
//
// Usado pela página do cliente (cadastro obrigatório antes
// do primeiro pedido) e pelo painel admin (dados de entrega
// do pedido na tela da cozinha).
//
// O perfil fica em "perfis/{uid}" no Firestore:
//
//   nome       "Lucas Eduardo Silva da Cunha"
//   cpf        "12345678909"      (só dígitos)
//   telefone   "11987654321"      (só dígitos, com DDD)
//   endereco: {
//     cep, rua, numero, complemento, bairro,
//     cidade, uf, referencia
//   }
//
// Cada pedido guarda uma CÓPIA desses dados (nome, CPF,
// telefone e endereço de entrega). Assim, se o cliente
// mudar de endereço depois, o pedido antigo continua com
// o endereço para onde ele foi entregue de verdade.
//
// A validação daqui é para ajudar o cliente a preencher
// certo. A garantia de verdade fica nas Security Rules
// (firestore.rules), que recusam perfil ou pedido fora
// do formato mesmo se alguém mexer no JavaScript.
// ======================================================


export const somenteDigitos = valor =>
  String(valor || "").replace(/\D/g, "");


// ------------------------------------------------------
// CPF: confere os dois dígitos verificadores
// ------------------------------------------------------

export function cpfValido(valor) {

  const cpf =
    somenteDigitos(valor);

  // 11 dígitos e não pode ser tudo igual (111.111.111-11)
  if (
    cpf.length !== 11 ||
    /^(\d)\1{10}$/.test(cpf)
  ) {
    return false;
  }


  const digito = tamanho => {

    let soma = 0;

    for (let i = 0; i < tamanho; i++) {
      soma += Number(cpf[i]) * (tamanho + 1 - i);
    }

    const resto =
      (soma * 10) % 11;

    return resto === 10
      ? 0
      : resto;

  };


  return (
    digito(9) === Number(cpf[9]) &&
    digito(10) === Number(cpf[10])
  );

}


// Celular (11 dígitos) ou fixo (10 dígitos), com DDD
export function telefoneValido(valor) {

  return /^[1-9]{2}\d{8,9}$/.test(
    somenteDigitos(valor)
  );

}


export function cepValido(valor) {

  return /^\d{8}$/.test(
    somenteDigitos(valor)
  );

}


// ------------------------------------------------------
// FORMATAÇÃO PARA MOSTRAR NA TELA
// ------------------------------------------------------

export function formatarCpf(valor) {

  const cpf =
    somenteDigitos(valor);

  return cpf.length === 11
    ? cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : cpf;

}


export function formatarTelefone(valor) {

  const tel =
    somenteDigitos(valor);

  if (tel.length === 11) {
    return tel.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }

  if (tel.length === 10) {
    return tel.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }

  return tel;

}


export function formatarCep(valor) {

  const cep =
    somenteDigitos(valor);

  return cep.length === 8
    ? cep.replace(/(\d{5})(\d{3})/, "$1-$2")
    : cep;

}


// "Rua X, 123 - Apto 4 - Bairro, Cidade/UF - CEP 00000-000"
export function formatarEndereco(endereco) {

  if (!endereco) {
    return "";
  }


  const linha1 =
    [
      endereco.rua,
      endereco.numero
    ]
      .filter(Boolean)
      .join(", ") +
    (
      endereco.complemento
        ? ` - ${endereco.complemento}`
        : ""
    );

  const cidade =
    [
      endereco.cidade,
      endereco.uf
    ]
      .filter(Boolean)
      .join("/");

  return [
    linha1,
    endereco.bairro,
    cidade,
    endereco.cep
      ? `CEP ${formatarCep(endereco.cep)}`
      : ""
  ]
    .filter(Boolean)
    .join(" - ");

}


// Link do Google Maps com o endereço (para o motoboy)
export function linkMapa(endereco) {

  const texto =
    [
      endereco?.rua,
      endereco?.numero,
      endereco?.bairro,
      endereco?.cidade,
      endereco?.uf,
      formatarCep(endereco?.cep)
    ]
      .filter(Boolean)
      .join(", ");

  return "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(texto);

}


// ------------------------------------------------------
// PERFIL COMPLETO?
//
// Devolve a lista de problemas (vazia = pode pedir).
// ------------------------------------------------------

export function problemasDoPerfil(perfil) {

  const problemas = [];

  if (!perfil) {
    return ["Cadastro não preenchido"];
  }


  const nome =
    String(perfil.nome || "").trim();

  // Nome completo: pelo menos nome e sobrenome
  if (
    nome.length < 5 ||
    nome.split(/\s+/).length < 2
  ) {
    problemas.push("Nome completo (nome e sobrenome)");
  }

  if (!cpfValido(perfil.cpf)) {
    problemas.push("CPF válido");
  }

  if (!telefoneValido(perfil.telefone)) {
    problemas.push("Telefone com DDD");
  }


  const e =
    perfil.endereco || {};

  if (!cepValido(e.cep)) problemas.push("CEP");
  if (!String(e.rua || "").trim()) problemas.push("Rua");
  if (!String(e.numero || "").trim()) problemas.push("Número");
  if (!String(e.bairro || "").trim()) problemas.push("Bairro");
  if (!String(e.cidade || "").trim()) problemas.push("Cidade");
  if (!/^[A-Za-z]{2}$/.test(String(e.uf || ""))) problemas.push("UF");

  return problemas;

}


export function perfilCompleto(perfil) {

  return problemasDoPerfil(perfil).length === 0;

}


// ------------------------------------------------------
// BUSCA DE CEP (ViaCEP — gratuito, sem cadastro)
//
// Só preenche rua/bairro/cidade/UF para adiantar o
// cadastro. Se a busca falhar, o cliente digita à mão.
// ------------------------------------------------------

export async function buscarCep(valor) {

  const cep =
    somenteDigitos(valor);

  if (cep.length !== 8) {
    return null;
  }


  try {

    const resposta =
      await fetch(`https://viacep.com.br/ws/${cep}/json/`);

    if (!resposta.ok) {
      return null;
    }

    const dados =
      await resposta.json();

    if (dados.erro) {
      return null;
    }

    return {
      rua: dados.logradouro || "",
      bairro: dados.bairro || "",
      cidade: dados.localidade || "",
      uf: dados.uf || ""
    };

  } catch {

    return null;

  }

}
