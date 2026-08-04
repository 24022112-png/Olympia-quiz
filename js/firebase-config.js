// js/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "du-an-cua-ban.firebaseapp.com",
  databaseURL: "https://du-an-cua-ban-default-rtdb.firebaseio.com", // BẮT BUỘC PHẢI CÓ DÒNG NÀY
  projectId: "du-an-cua-ban",
  storageBucket: "du-an-cua-ban.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

// Khởi tạo Firebase nếu chưa khởi tạo
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Khai báo biến db toàn cục dùng cho cả Admin và Player
const db = firebase.database();
