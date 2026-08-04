<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Olympia Thí Sinh</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="css/style.css">

  <!-- 1. NAP THƯ VIỆN FIREBASE SDK (BẮT BUỘC LOAD TRƯỚC) -->
  <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-4 font-sans pb-12">

  <div class="max-w-md mx-auto space-y-5">

    <!-- HEADER & THÔNG TIN THÍ SINH -->
    <header class="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center shadow-md">
      <div>
        <h1 class="text-lg font-extrabold text-amber-400">⚡ OLYMPIA PLAYER</h1>
        <p class="text-xs text-slate-400">Thí sinh: <strong id="userDisplay" class="text-indigo-400">Chưa nhập</strong></p>
      </div>
      <button onclick="changeNickname()" class="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition">
        ✏️ Đổi tên
      </button>
    </header>

    <!-- NÚT BẤM CHUÔNG TẬP TRUNG -->
    <section class="bg-slate-900 p-6 rounded-2xl border border-slate-800 text-center shadow-xl">
      <button id="buzzerBtn" onclick="triggerBuzzer()" class="w-full py-12 rounded-2xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-2xl uppercase tracking-widest shadow-2xl transition transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
        🔔 BẤM CHUÔNG
      </button>
      <p id="buzzerNotice" class="mt-4 text-xs text-slate-400 font-medium">Đang kiểm tra trạng thái chuông...</p>
    </section>

    <!-- GỬI CÂU TRẢ LỜI -->
    <section class="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3 shadow-md">
      <h3 class="text-sm font-bold text-slate-300 flex justify-between items-center">
        <span>💬 Gửi câu trả lời</span>
      </h3>
      
      <div class="flex gap-2">
        <input id="answerInput" type="text" placeholder="Nhập đáp án của bạn..." class="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500">
        <button id="sendBtn" onclick="submitAnswer()" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow">
          Gửi
        </button>
      </div>
      <span id="chatNotice" class="text-xs"></span>
    </section>

    <!-- DANH SÁCH THÍ SINH TRONG PHÒNG -->
    <section class="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-sm font-bold text-slate-300">👥 Thí sinh trong phòng</h3>
        <span id="maxPlayerNotice" class="text-xs text-indigo-400 font-mono"></span>
      </div>
      <div id="activePlayersList" class="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
        <p class="text-slate-500 italic text-xs p-2">Đang tải danh sách...</p>
      </div>
    </section>

    <!-- THỨ TỰ BẤM CHUÔNG REALTIME -->
    <section class="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
      <h3 class="text-sm font-bold text-amber-400 mb-2">🔔 Thứ tự bấm chuông</h3>
      <ul id="buzzerQueue" class="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
        <li class="text-slate-500 italic text-xs">Chưa có ai bấm chuông...</li>
      </ul>
    </section>

    <!-- LỊCH SỬ CÂU TRẢ LỜI CỦA BẠN -->
    <section class="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
      <h3 class="text-sm font-bold text-emerald-400 mb-2">📝 Câu trả lời của bạn</h3>
      <div id="answerStream" class="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
        <p class="text-slate-500 italic text-xs">Chưa có câu trả lời nào...</p>
      </div>
    </section>

    <!-- BẢNG XẾP HẠNG TỔNG ĐIỂM (TỪ GOOGLE SHEET) -->
    <section class="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md">
      <h3 class="text-sm font-bold text-yellow-400 mb-3">🏆 Bảng Xếp Hạng Tổng Điểm</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-xs text-left">
          <thead class="uppercase bg-slate-800 text-slate-400">
            <tr>
              <th class="p-2 text-center">Hạng</th>
              <th class="p-2">Thí sinh</th>
              <th class="p-2 text-center">Tổng điểm</th>
            </tr>
          </thead>
          <tbody id="leaderboardBody" class="divide-y divide-slate-800">
            <tr><td colspan="3" class="text-center p-2 text-slate-500 italic">Đang tải điểm...</td></tr>
          </tbody>
        </table>
      </div>
    </section>

  </div>

  <!-- MODAL NHẬP BIỆT DANH -->
  <div id="nicknameModal" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 hidden">
    <div class="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm w-full space-y-4 text-center shadow-2xl">
      <h2 class="text-xl font-bold text-amber-400">CHÀO MỪNG BẠN!</h2>
      <p class="text-xs text-slate-400">Nhập biệt danh của bạn để tham gia phòng thi Olympia:</p>
      <input id="nicknameInput" type="text" placeholder="Nhập tên / biệt danh..." class="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 text-center">
      <button onclick="saveNickname()" class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold py-2 rounded-lg text-sm transition shadow">
        Vào Phòng Thi
      </button>
    </div>
  </div>

  <!-- MODAL BỊ ĐUỔI -->
  <div id="kickedModal" class="fixed inset-0 bg-red-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 hidden">
    <div class="bg-slate-900 border border-red-600 p-6 rounded-2xl max-w-sm w-full space-y-3 text-center shadow-2xl">
      <h2 class="text-2xl font-black text-red-500">🚫 BẠN ĐÃ BỊ ĐUỔI</h2>
      <p class="text-xs text-slate-300">Admin đã xóa bạn khỏi phòng thi và xóa cột tương ứng trên Google Sheet.</p>
    </div>
  </div>

  <!-- 2. NẠP CONFIG FIREBASE CỦA BẠN (BẮT BUỘC TRƯỚC PLAYER.JS) -->
  <script src="js/firebase-config.js"></script>
  <!-- 3. NẠP SCRIPT XỬ LÝ PLAYER -->
  <script src="js/player.js"></script>
</body>
</html>
