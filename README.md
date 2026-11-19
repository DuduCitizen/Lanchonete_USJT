# 🍔 Byte Burger — Sistema PDV / ERP / CRM

> Sistema web de **ponto de venda (PDV)** para lanchonete, com cardápio digital, pedidos por delivery e por mesa, fila de cozinha em tempo real, controle de estoque, CRM de clientes e painel financeiro.

Projeto desenvolvido para a Unidade Curricular **Exploração Digital e Fundamentos Tecnológicos** — **Universidade São Judas Tadeu**.

**Professor:** Prof. Dr. Anacé Nunes da Silva
**Segmento:** Lanchonete (fast food + salão)

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-39ff14)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📑 Sumário

- [Visão geral](#-visão-geral)
- [Funcionalidades](#-funcionalidades)
- [Papéis e telas](#-papéis-e-telas)
- [Fluxo de um pedido](#-fluxo-de-um-pedido)
- [Tecnologias](#-tecnologias)
- [Arquitetura e estrutura de pastas](#-arquitetura-e-estrutura-de-pastas)
- [Modelo de dados (Firestore)](#-modelo-de-dados-firestore)
- [Segurança](#-segurança)
- [Como executar](#-como-executar)
- [Configuração](#-configuração)
- [Guia rápido de uso](#-guia-rápido-de-uso)
- [Módulos do ERP/CRM](#-módulos-do-erpcrm)
- [Integrantes](#-integrantes)
- [Licença](#-licença)

---

## 🎯 Visão geral

O **Byte Burger** atende dois tipos de cliente numa mesma plataforma:

| Tipo | Como pede | Como paga |
|------|-----------|-----------|
| **Delivery** (fast food) | Pelo cardápio digital (`index.html`) | Antes, no app: Somente Pix ate o momento |
| **Mesa** (salão) | Escaneando o QR Code da mesa (`mesa.html?mesa=N`) | No final, com o garçom, na maquininha |

Os dois tipos de pedido caem **na mesma fila da cozinha**, ordenados do mais antigo para o mais novo. Cada funcionário tem uma tela própria, de acordo com o seu papel.

Não há servidor próprio: todo o back-end é feito com **Firebase** (Authentication + Cloud Firestore) e o front-end é **HTML, CSS e JavaScript puro** (ES Modules), podendo ser publicado no **GitHub Pages**.

---

## ✨ Funcionalidades

### 🛒 Cliente (delivery) — `index.html`
- Cardápio público com **busca** e **filtro por categoria** (Lanches, Combos, Porções, Bebidas, Sobremesas).
- Exibe apenas produtos **disponíveis** e **com estoque**.
- Modal de detalhes do produto e **carrinho** com controle de quantidade e validação de estoque.
- **Login** com e-mail/senha ou **Google**. Visitantes (sessão anônima) apenas navegam; ao tentar comprar são levados ao login.
- **Cadastro obrigatório** antes do primeiro pedido: nome completo, **CPF válido** (dígitos verificadores), telefone com DDD e endereço com **autopreenchimento por CEP** (ViaCEP).
- Pagamento por **Pix** (QR Code + "copia e cola" com valor e identificador do pedido), dinheiro, débito ou crédito.
- **Meus pedidos**: rastreio em **tempo real** com linha do tempo de etapas e avisos a cada mudança de status.

### 🍽️ Cliente na mesa — `mesa.html?mesa=N`
- Acesso pelo **QR Code** colado na mesa; o número da mesa é validado.
- Login normal, **sem** o cadastro de endereço do delivery.
- Pedido enviado direto para a fila da cozinha, com o número da mesa.
- Acompanhamento em tempo real e **cancelamento** enquanto o pedido está em "Recebido", com aviso de que um novo pedido entra no **fim da fila**.

### 🔥 Cozinha — `cozinha.html`
- **Fila única** (delivery + mesas), do mais antigo para o mais novo, com posição numérica.
- Botões **Iniciar preparo** e **Pronto**.
- Tempo decorrido por pedido, indicador "ao vivo", **aviso sonoro** e toast para novos pedidos.
- Pensada para ficar aberta em um tablet ou TV.

### 🧾 Balcão — `balcao.html`
- Quadro em tempo real com 4 colunas: **Aguardando pagamento**, **Na cozinha**, **Prontos** e **Em entrega**.
- **Confirma o Pix** conferindo valor e identificador do pedido no app do banco.
- Despacha ao motoboy (**Saiu para entrega**) e marca **Entregue**.
- Exibe telefone, endereço, ponto de referência e **link para o Google Maps**.
- **Cancela** pedidos antes do preparo: os itens voltam ao estoque e o CRM é desfeito.

### 🙋 Garçom — `garcom.html` (otimizado para celular)
- **Grade de mesas** (verde = conta aberta, laranja = lanche pronto).
- **Conta da mesa**: lista de pedidos, total, **divisão por pessoas**, forma de pagamento e **fechamento de conta** (transação atômica).
- Aba **Prontos**: lanches finalizados para levar e marcar "Entregue na mesa".
- Aba **Anotar**: lança pedido em nome do cliente.
- Pode cancelar pedidos que ainda estão em "Recebido".

### 🔳 QR Codes das mesas — `qr-mesas.html`
- Gera um QR Code por mesa e permite **imprimir** em layout próprio.
- Alerta quando o endereço é local (`localhost`) e não funcionaria no celular do cliente.

### 📊 Administrador — `admin.html`
- **Início:** indicadores (faturamento do mês, vendas do dia, produtos com estoque baixo) e **dashboard com Chart.js**: faturamento por dia, formas de pagamento, produtos mais vendidos e lucro do período, com filtro por mês.
- **Vendas:** histórico com busca, filtro por data e pagamento, ticket médio e **detalhes da venda** (cliente, entrega, itens, custo e lucro).
- **Produtos:** cadastro, edição, exclusão e ativação/desativação. Imagem por arquivo (`img/`) ou emoji. **Calculadora de custo × lucro × margem × markup** com **preço sugerido** para uma margem desejada.
- **Relatórios:** faturamento por dia e produtos com **estoque baixo/crítico**.
- **Financeiro:** lançamento de despesas por categoria, entradas, saídas, saldo, custo dos produtos vendidos, **lucro bruto** e **lucro líquido**.

### ⚙️ Recursos transversais
- **Baixa de estoque transacional** (`runTransaction`): evita vender além do estoque.
- **Custo gravado na venda**: o lucro histórico não muda se o custo do produto for alterado depois.
- **CRM automático**: cada compra atualiza `totalGasto`, `quantidadeCompras` e `ultimaCompra` do cliente (chave = telefone).
- **Devolução automática de estoque** em cancelamentos feitos pelo cliente da mesa.
- **Controle de acesso por papéis (RBAC)**.
- **Tempo real** com `onSnapshot` em todas as telas operacionais.
- **Interface responsiva** (computador, tablet e celular) com identidade visual neon.

---

## 👥 Papéis e telas

| Papel (`role`) | Tela | Responsabilidade |
|----------------|------|------------------|
| `administrador` | `admin.html` | Produtos, vendas, relatórios, financeiro e QR das mesas |
| `garcom` | `garcom.html` | Mesas, contas, entrega na mesa e anotar pedidos |
| `balconista` | `balcao.html` | Confirmar Pix, despachar delivery e cancelar |
| `cozinha` | `cozinha.html` | Fila de preparo |
| `cliente` | `index.html` / `mesa.html` | Pedir (delivery ou mesa) |
| *visitante* (anônimo) | `index.html` | Apenas navegar pelo cardápio |

O papel fica no campo `role` do documento `usuarios/{uid}`. Quem não tem documento é tratado como **cliente** (falha de forma segura). A equipe é redirecionada automaticamente para a sua tela.

---

## 🔄 Fluxo de um pedido

```
aguardando_pagamento  → só Pix; espera o balcão confirmar o recebimento
        ↓
    recebido          → entra na fila da cozinha (dinheiro/cartão/mesa nascem aqui)
        ↓
    em_preparo        → cozinha iniciou
        ↓
     pronto           → pronto para o motoboy (delivery) ou para o garçom (mesa)
        ↓
saiu_para_entrega     → somente delivery
        ↓
    entregue          → fim

cancelado             → possível antes do preparo; o estoque volta
```

**Pedidos de mesa** não têm "saiu para entrega" e possuem um segundo status, a **conta** (`contaStatus`): `aberta` → `paga`. Só entram no faturamento quando o garçom **fecha a conta**.

Vendas antigas (antes do rastreio) têm status `finalizada` e continuam contando no faturamento.

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Front-end | HTML5, CSS3, JavaScript (ES Modules, sem framework) |
| Autenticação | Firebase Authentication (e-mail/senha, Google e anônimo) |
| Banco de dados | Cloud Firestore (tempo real) |
| Gráficos | [Chart.js](https://www.chartjs.org/) 4.4.1 (CDN) |
| QR Code | [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4 (CDN) |
| Pix | BR Code (EMV) com CRC16 gerado no próprio código, **sem gateway** |
| Busca de CEP | API [ViaCEP](https://viacep.com.br/) |
| Fontes | Google Fonts: Bebas Neue, Orbitron e Montserrat |
| Versionamento e hospedagem | Git, GitHub e GitHub Pages |

---

## 🗂️ Arquitetura e estrutura de pastas

```
sistema-pdv-usjt/
├── index.html          # Cardápio e checkout (cliente delivery)
├── login.html          # Login (e-mail/senha e Google)
├── mesa.html           # Pedido na mesa (via QR Code)
├── garcom.html         # Tela do garçom
├── balcao.html         # Tela do balcão (delivery)
├── cozinha.html        # Fila da cozinha
├── qr-mesas.html       # Gerador de QR Codes das mesas
├── admin.html          # Painel do administrador
├── css/
│   ├── style.css       # Página do cliente
│   ├── admin.css       # Painel e base das telas da equipe
│   ├── equipe.css      # Cozinha, balcão, garçom e QR das mesas
│   └── login.css       # Login
├── js/
│   ├── app.js              # Cardápio, carrinho, checkout, perfil, Pix e rastreio
│   ├── admin.js            # Painel: dashboard, vendas, produtos, relatórios, financeiro
│   ├── mesa.js             # Cliente na mesa
│   ├── garcom.js           # Garçom
│   ├── balcao.js           # Balcão
│   ├── cozinha.js          # Cozinha
│   ├── qr-mesas.js         # QR das mesas
│   ├── equipe.js           # Funções comuns da equipe (proteção de página, status, cancelamento)
│   ├── pedido-mesa.js      # Criar/cancelar pedido de mesa
│   ├── pedidos.js          # Status, tipos e regras de pedido
│   ├── papeis.js           # Papéis e páginas de cada papel
│   ├── perfil.js           # Validação e formatação do cadastro (CPF, telefone, CEP)
│   ├── pix.js              # Geração do BR Code e QR Code do Pix
│   ├── utils.js            # Formatação, imagens, datas, toast e leitura de produtos
│   ├── firebase.js         # Conexão Firebase compartilhada
│   ├── config-pix.js       # Dados de quem recebe o Pix
│   └── config-restaurante.js # Número de mesas
├── img/                # Imagens dos produtos
├── LICENSE
└── README.md
```

---

## 🗃️ Modelo de dados (Firestore)

| Coleção | Documento | Conteúdo |
|---------|-----------|----------|
| `produtos` | auto-id | `name`, `category`, `price`, `cost`, `stock`, `description`, `image`, `available` |
| `vendas` | auto-id | `tipo` (delivery/mesa), `status`, `payment`, `items[]` (com `cost`), `subtotal`, `discount`, `total`, `userId`, `createdAt`, `statusTimes`, dados do cliente e entrega (delivery) ou `mesa`/`contaStatus` (salão) |
| `clientes` (CRM) | telefone (só dígitos) | `nome`, `telefone`, `cpf`, `totalGasto`, `quantidadeCompras`, `ultimaCompra` |
| `perfis` | `uid` | `nome`, `cpf`, `telefone`, `endereco{cep, rua, numero, complemento, bairro, cidade, uf, referencia}` |
| `usuarios` | `uid` | `role` |
| `despesas` | auto-id | `description`, `category`, `amount`, `date` (AAAA-MM-DD) |

---

## 🔐 Segurança

- **Security Rules do Firestore** são a garantia real: visitante anônimo não compra, cliente só lê os próprios pedidos, o status inicial do pedido é validado (Pix nasce `aguardando_pagamento`), e só o administrador altera produtos, despesas e dados do CRM.
- Ninguém consegue se autopromover: papéis são criados **somente pelo dono, no Firebase Console**.
- A verificação de papel no front-end (`protegerPagina`) apenas evita mostrar telas a quem não deve.
- Dados sensíveis do cliente (CPF, endereço) só são visíveis ao próprio cliente e à equipe autorizada.
- Todo texto vindo do banco é escapado (`escapeHtml`) para evitar injeção de HTML.
- Páginas da equipe usam `noindex, nofollow`.

> ℹ️ A `apiKey` do Firebase em aplicações web não é um segredo; a proteção vem das Security Rules e dos domínios autorizados no Firebase Authentication.

---

## 🚀 Como executar

### Pré-requisitos
- Navegador moderno.
- Um projeto no [Firebase](https://console.firebase.google.com/) com **Authentication** e **Cloud Firestore** ativados.
- Um servidor estático local (os ES Modules **não funcionam** abrindo o arquivo direto com `file://`).

### Passo a passo

```bash
# 1. Clonar o repositório
git clone https://github.com/<seu-usuario>/sistema-pdv-usjt.git
cd sistema-pdv-usjt

# 2. Subir um servidor estático (escolha um)
npx serve .
# ou
python -m http.server 5500
# ou use a extensão "Live Server" do VS Code
```

Acesse `http://localhost:5500` (ou a porta indicada).

### Publicar no GitHub Pages
1. No GitHub: **Settings → Pages**.
2. Em *Source*, escolha a branch `main` e a pasta `/ (root)`.
3. Em **Firebase Console → Authentication → Settings → Authorized domains**, adicione `<seu-usuario>.github.io`.

---

## ⚙️ Configuração

### 1. Firebase
Substitua o `firebaseConfig` em **todos** os pontos abaixo (use o do seu projeto):
`js/firebase.js`, `index.html`, `login.html` e `admin.html`.

No Firebase Console:
- **Authentication → Sign-in method:** ative **E-mail/senha**, **Google** e **Anônimo**.
- **Firestore:** crie o banco e publique as Security Rules do projeto.

### 2. Papéis da equipe
Em `usuarios/{uid}` (o `uid` aparece em *Authentication → Users*), crie o campo:

```
role: "administrador" | "garcom" | "balconista" | "cozinha"
```

### 3. Pix
Edite `js/config-pix.js` com a chave, o nome (até 25 caracteres) e a cidade (até 15) de quem **recebe**. Enquanto a chave for a de exemplo, o modal mostra um aviso de QR Code de demonstração.

### 4. Mesas
Edite `NUMERO_DE_MESAS` em `js/config-restaurante.js` (padrão: 12; as regras aceitam de 1 a 50).

### 5. Imagens
Coloque as imagens dos produtos em `img/` e informe o nome do arquivo (ex.: `x-burger.webp`) ou um emoji no cadastro do produto.

---

## 📖 Guia rápido de uso

<details>
<summary><b>👨‍💼 Administrador</b></summary>

1. Entre em **Produtos → + Novo produto** e preencha nome, categoria, imagem, preço, estoque e custo.
2. Use a calculadora para ver margem, markup e o preço sugerido.
3. Em **Financeiro**, lance despesas com **+ Nova despesa**.
4. Acompanhe os números em **Início**, **Vendas** e **Relatórios**.
5. Em **QR das mesas**, gere e imprima os códigos.
</details>

<details>
<summary><b>🛒 Cliente (delivery)</b></summary>

1. Navegue pelo cardápio e clique em **+ Adicionar**.
2. Clique em **Finalizar venda** e faça login.
3. Complete o cadastro (somente na primeira vez).
4. Escolha a forma de pagamento; no Pix, pague pelo QR Code ou "copia e cola".
5. Acompanhe em 📦 **Meus pedidos**.
</details>

<details>
<summary><b>🧾 Balconista</b></summary>

1. Pedidos Pix ficam em *Aguardando pagamento*: confira no banco e clique em **Confirmar Pix**.
2. Quando a cozinha marcar *Pronto*, entregue ao motoboy e clique em **Saiu para entrega**.
3. Ao concluir, clique em **Entregue**.
</details>

<details>
<summary><b>🔥 Cozinha</b></summary>

1. Ative o som em **🔇 Ativar som**.
2. Comece sempre pelo pedido nº 1: **Iniciar preparo** e depois **Pronto**.
</details>

<details>
<summary><b>🍽️ Cliente na mesa</b></summary>

1. Escaneie o QR Code da mesa e faça login.
2. Escolha os itens e clique em **Ver pedido → Enviar para a cozinha**.
3. Acompanhe em 🧾. Para pagar, chame o garçom.
</details>

<details>
<summary><b>🙋 Garçom</b></summary>

1. **Prontos:** leve o lanche e clique em **Entregue na mesa**.
2. **Mesas:** toque na mesa, confira o total, divida se quiser, escolha a forma de pagamento e clique em **Fechar conta**.
3. **Anotar:** escolha a mesa, adicione os itens e envie para a cozinha.
</details>

---

## 🧩 Módulos do ERP/CRM

| Módulo | Onde está |
|--------|-----------|
| Gestão de Produtos | Painel admin → Produtos |
| PDV | `index.html` (delivery), `mesa.html` e `garcom.html` (salão) |
| Estoque | Baixa transacional na venda, devolução no cancelamento, alerta de estoque baixo |
| CRM | Coleção `clientes` e cadastro em `perfis` |
| Financeiro | Painel admin → Financeiro (entradas, despesas, saldo e lucros) |
| Autenticação | Firebase Auth + papéis em `usuarios` |
| Dashboard | Painel admin → Início (Chart.js) |

---

## 👨‍💻 Integrantes

- **Lucas Eduardo Silva da Cunha**
- **Gabriel**
- **Maxwell**

---

## 📄 Licença

Distribuído sob a licença **MIT**. Veja o arquivo [`LICENSE`](LICENSE) para mais detalhes.

© 2026 Lucas
