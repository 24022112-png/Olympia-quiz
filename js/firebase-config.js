// js/firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyBIBD8xulzODI0Goz005FqYU0gm2VKMVpU",
  authDomain: "olympia-quiz.firebaseapp.com",
  databaseURL: "https://olympia-quiz-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "olympia-quiz",
  storageBucket: "olympia-quiz.firebasestorage.app",
  messagingSenderId: "1005473570114",
  appId: "1:1005473570114:web:34dac8abaa89163b1b7cdb",
  measurementId: "G-3ZLF3M9NK4"
};

// Khởi tạo Firebase (Kiểm tra tránh lặp phiên bản)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Khởi tạo biến kết nối CSDL Realtime dùng chung cho toàn hệ thống
const db = firebase.database();
