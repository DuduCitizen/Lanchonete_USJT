// ======================================================
// FIREBASE — CONEXÃO COMPARTILHADA
//
// Usado pelas páginas novas (mesa, garçom, balcão,
// cozinha e QR das mesas). As páginas antigas (index,
// login e admin) continuam com a configuração dentro do
// próprio HTML, do jeito que já estavam.
//
// Se um dia trocar de projeto Firebase, troque aqui E
// nos <script> do index.html, login.html e admin.html.
// ======================================================

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

import {
  getAuth
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";


const firebaseConfig = {
  apiKey: "AIzaSyCDBhEvK6KxiSAFbQKxHWPdyfSe553M17s",
  authDomain: "sistema-pdv-usjt.firebaseapp.com",
  projectId: "sistema-pdv-usjt",
  storageBucket: "sistema-pdv-usjt.firebasestorage.app",
  messagingSenderId: "803225322517",
  appId: "1:803225322517:web:89b28e01bbd0d5f484ba1c"
};


export const app =
  initializeApp(firebaseConfig);

export const db =
  getFirestore(app);

export const auth =
  getAuth(app);


// As funções do utils.js (fetchProducts) leem window.db
window.db =
  db;
