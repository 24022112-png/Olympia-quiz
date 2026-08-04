// Mật khẩu Admin
const ADMIN_PASSWORD = "20032006";
const adminBuzzerAudio = new Audio('sound/buzzer.mp3');

// Link xuất dữ liệu CSV trực tiếp từ Google Sheet
const SHEET_ID = '1ngiCqrQWG_2Mz93NtBoRP2bDm3DtYmZSX0VnlOqMplQ';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

let sheetSyncInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  initAuthCheck();
});

function initAuthCheck() {
  const isAuthenticated = sessionStorage.getItem("olympia_admin_auth") === "true";
  const loginModal = document.getElementById("loginModal");
  const app = document.getElementById("app");
  const template = document.getElementById("adminContent");

  if (isAuthenticated && template && app) {
    if (loginModal) loginModal.classList.add("hidden");
    app.innerHTML = "";
    app.appendChild(template.content.cloneNode(true));
    startFirebaseListeners();
    startGoogleSheetSync(); // Bắt đầu đọc điểm từ Google Sheet
  } else {
    if (loginModal) loginModal.classList.remove("hidden");
  }
}

function handleAdminLogin() {
  const passwordInput = document.getElementById("adminPasswordInput");
  const errorMsg = document.getElementById("loginError");
  const pwd = passwordInput ? passwordInput.value : "";

  if (pwd === ADMIN_PASSWORD) {
    sessionStorage.setItem("olympia_admin_auth", "true");
    if (errorMsg) errorMsg.classList.add("hidden");
    initAuthCheck();
  } else {
    if (errorMsg) errorMsg.classList.remove("hidden");
  }
}

function adminLogout() {
  if (sheetSyncInterval) clearInterval(sheetSyncInterval);
  sessionStorage.removeItem("olympia_admin_auth");
  window.location.reload();
}

// HÀM ĐỌC ĐIỂM TỪ GOOGLE SHEET (HÀNG 6, CỘT B ĐẾN F)
async function syncScoresFromGoogleSheet() {
  try {
    // Thêm timestamp để tránh bị trình duyệt cache dữ liệu cũ
    const res = await fetch(`${CSV_URL}&_t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

    const text = await res.text();

    // Tách các dòng trong file CSV
    const lines = text.split(/\r?\n/).map(line => {
      return line.split(',').map(cell => cell.replace(/^"|"$/g, '').trim());
    });

    // Hàng 5 (Index 4) là B5:F5 (Tên thí sinh nếu có)
    // Hàng 6 (Index 5) là B6:F6 (Điểm thí sinh)
    const row5 = lines[4] || [];
    const row6 = lines[5] || [];

    // Lấy cột B đến F (Index 1 đến 5)
    const sheetNames = row5.slice(1, 6);
    const sheetScores = row6.slice(1, 6).map(val => {
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    });

    // Cập nhật lên Firebase
    const snapshot = await db.ref('players').once('value');
    if (!snapshot.exists()) return;

    const players = snapshot.val();
    const playerKeys = Object.keys(players);

    playerKeys.forEach((key, index) => {
      const player = players[key];
      if (player.kicked) return;

      let newScore = null;

      // 1. Khớp theo Tên nếu dòng 5 có tên trùng khớp
      if (sheetNames.length > 0) {
        const matchIndex = sheetNames.findIndex(n => n && n.toLowerCase() === (player.name || '').trim().toLowerCase());
        if (matchIndex !== -1) {
          newScore = sheetScores[matchIndex];
        }
      }

      // 2. Khớp theo thứ tự vào phòng (Người 1 -> B6, Người 2 -> C6, Người 3 -> D6, Người 4 -> E6, Người 5 -> F6)
      if (newScore === null && index < sheetScores.length) {
        newScore = sheetScores[index];
      }

      if (newScore !== null && player.score !== newScore) {
        db.ref(`players/${key}/score`).set(newScore);
      }
    });

    const sheetStatus = document.getElementById('sheetSyncStatus');
    if (sheetStatus) {
      const now = new Date().toLocaleTimeString();
      sheetStatus.innerText = `🟢 Đã nhận điểm từ Sheet B6:F6 [${sheetScores.join(', ')}] lúc ${now}`;
      sheetStatus.className = "text-[11px] text-emerald-400 font-mono mt-1 font-bold";
    }

  } catch (err) {
    console.error('Lỗi đọc Google Sheet:', err);
    const sheetStatus = document.getElementById('sheetSyncStatus');
    if (sheetStatus) {
      sheetStatus.innerText = '🔴 Không thể đọc Google Sheet! Hãy kiểm tra quyền "Bất kỳ ai có liên kết".';
      sheetStatus.className = "text-[11px] text-red-400 font-mono mt-1 font-bold";
    }
  }
}

function startGoogleSheetSync() {
  syncScoresFromGoogleSheet();
  if (sheetSyncInterval) clearInterval(sheetSyncInterval);
  sheetSyncInterval = setInterval(syncScoresFromGoogleSheet, 2000); // Tự động đọc lại mỗi 2 giây
}

function startFirebaseListeners() {
  // 1. Trạng thái Khóa/Mở chuông
  db.ref('settings/locked').on('value', (snapshot) => {
    const isLocked = snapshot.val() ?? true;
    const badge = document.getElementById('statusBadge');
    if (badge) {
      if (isLocked) {
        badge.innerText = '🔒 CHUÔNG ĐANG KHÓA';
        badge.className = 'text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30';
      } else {
        badge.innerText = '🔓 CHUÔNG ĐANG MỞ';
        badge.className = 'text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse';
      }
    }
  });

  // 2. Giới hạn số thí sinh
  db.ref('settings/maxPlayers').on('value', (snapshot) => {
    const input = document.getElementById('maxPlayersInput');
    if (input) input.value = snapshot.val() || 0;
  });

  // 3. Danh sách chuông bấm Realtime
  let adminFirstLoad = true;
  let adminPrevBuzzerCount = 0;

  db.ref('buzzers').orderByChild('timestamp').on('value', (snapshot) => {
    const list = document.getElementById('adminBuzzerList');
    const countBadge = document.getElementById('buzzerCount');
    if (!list) return;

    const currentCount = snapshot.numChildren();

    if (!snapshot.exists()) {
      list.innerHTML = '<li class="text-slate-500 italic text-xs">Chưa có tín hiệu chuông nào...</li>';
      if (countBadge) countBadge.innerText = '0';
      adminPrevBuzzerCount = 0;
      adminFirstLoad = false;
      return;
    }

    if (!adminFirstLoad && currentCount > adminPrevBuzzerCount) {
      adminBuzzerAudio.currentTime = 0;
      adminBuzzerAudio.play().catch(e => console.warn('Bấm vào giao diện Admin 1 lần để phát âm thanh:', e));
    }
    adminPrevBuzzerCount = currentCount;
    adminFirstLoad = false;

    list.innerHTML = '';
    let rank = 1;
    snapshot.forEach((child) => {
      const data = child.val();
      const date = new Date(data.timestamp || Date.now());
      const timeStr = date.toTimeString().split(' ')[0] + '.' + String(date.getMilliseconds()).padStart(3, '0');
      const item = document.createElement('li');
      item.className = `p-2.5 rounded-lg border text-xs flex justify-between items-center ${rank === 1 ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold' : 'bg-slate-950 border-slate-800 text-slate-300'}`;
      item.innerHTML = `<span>#${rank} - <strong>${escapeHtml(data.name)}</strong></span><span class="text-[10px] text-slate-500">${timeStr}</span>`;
      list.appendChild(item);
      rank++;
    });
    if (countBadge) countBadge.innerText = String(rank - 1);
  });

  // 4. Bảng Thí sinh (Cập nhật tự động từ Google Sheet)
  db.ref('players').on('value', (snapshot) => {
    const tbody = document.getElementById('playerTableBody');
    const countBadge = document.getElementById('playerCount');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!snapshot.exists()) {
      tbody.innerHTML = '<tr><td colspan="4" class="p-3 text-center text-slate-500 italic">Chưa có thí sinh nào vào phòng...</td></tr>';
      if (countBadge) countBadge.innerText = '0 thí sinh';
      return;
    }

    let total = 0;
    snapshot.forEach((child) => {
      const key = child.key;
      const p = child.val();
      if (p.kicked) return;

      total++;
      const currentScore = p.score || 0;
      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-800/50 transition';
      row.innerHTML = `
        <td class="p-2 font-semibold text-slate-200">${escapeHtml(p.name)}</td>
        
        <td class="p-2 text-center">
          <span class="font-black text-amber-400 text-sm bg-slate-950 px-3 py-1 rounded border border-slate-800">${currentScore}</span>
        </td>

        <td class="p-2 text-center">
          <button onclick="toggleMuteBuzzer('${key}', ${!p.muteBuzzer})" class="px-2 py-1 rounded text-[10px] font-bold ${p.muteBuzzer ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400'}">
            ${p.muteBuzzer ? '🔇 Đã Cấm' : '🔔 Bình Thường'}
          </button>
        </td>
        <td class="p-2 text-center">
          <button onclick="toggleMuteChat('${key}', ${!p.muteChat})" class="px-2 py-1 rounded text-[10px] font-bold ${p.muteChat ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400'}">
            ${p.muteChat ? '🔇 Đã Cấm' : '💬 Bình Thường'}
          </button>
        </td>
        <td class="p-2 text-center">
          <button onclick="kickPlayer('${key}')" class="bg-red-600/80 hover:bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded transition">❌</button>
        </td>
      `;
      tbody.appendChild(row);
    });
    if (countBadge) countBadge.innerText = `${total} thí sinh`;
  });

  // 5. Câu trả lời Realtime
  db.ref('answers').orderByChild('timestamp').on('value', (snapshot) => {
    const stream = document.getElementById('adminAnswerStream');
    if (!stream) return;
    stream.innerHTML = '';
    if (!snapshot.exists()) {
      stream.innerHTML = '<p class="text-slate-500 italic text-xs">Chưa có câu trả lời nào...</p>';
      return;
    }
    snapshot.forEach((child) => {
      const data = child.val();
      const timeStr = new Date(data.timestamp || Date.now()).toTimeString().split(' ')[0];
      const item = document.createElement('div');
      item.className = 'p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex justify-between items-start gap-2';
      item.innerHTML = `<div><span class="font-bold text-amber-400">${escapeHtml(data.name)}:</span><span class="text-slate-200 ml-1">${escapeHtml(data.text)}</span></div><span class="text-[10px] text-slate-500 whitespace-nowrap">${timeStr}</span>`;
      stream.prepend(item);
    });
  });
}

// Các hàm điều khiển Admin
function setBuzzerLock(status) { db.ref('settings/locked').set(status); }
function clearBuzzers() { db.ref('buzzers').remove(); }
function clearAnswers() { db.ref('answers').remove(); }
function updateMaxPlayers() { db.ref('settings/maxPlayers').set(parseInt(document.getElementById('maxPlayersInput').value) || 0); alert('Đã cập nhật!'); }
function toggleMuteBuzzer(id, status) { db.ref(`players/${id}/muteBuzzer`).set(status); }
function toggleMuteChat(id, status) { db.ref(`players/${id}/muteChat`).set(status); }
function kickPlayer(id) {
  if (confirm('Đuổi thí sinh này ra màn hình đăng nhập lại?')) {
    db.ref(`players/${id}/kicked`).set(true);
  }
}

function escapeHtml(str) { return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
