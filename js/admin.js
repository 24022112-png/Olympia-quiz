// Mật khẩu Admin
const ADMIN_PASSWORD = "20032006";
const adminBuzzerAudio = new Audio('sound/buzzer.mp3');

// Tham chiếu CSV trực tiếp từ Google Sheet
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
    startGoogleSheetSync();
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

// ĐỒNG BỘ ĐIỂM NGẦM TỪ GOOGLE SHEET CHUYỂN THẲNG TỚI THÍ SINH (B6 -> F6)
async function syncScoresFromGoogleSheet() {
  try {
    const res = await fetch(`${CSV_URL}&_t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);

    const text = await res.text();
    const lines = text.split(/\r?\n/).map(line => line.split(',').map(cell => cell.replace(/^"|"$/g, '').trim()));

    // Hàng 6 tương ứng Index 5
    const row6 = lines[5] || [];

    // Lấy giá trị các ô B6, C6, D6, E6, F6 (Index 1 -> 5)
    const sheetScores = row6.slice(1, 6).map(val => {
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    });

    const snapshot = await db.ref('players').once('value');
    if (!snapshot.exists()) return;

    const playersData = snapshot.val();

    // Sắp xếp thứ tự thí sinh theo thời gian gia nhập (joinedAt)
    const sortedPlayers = Object.keys(playersData)
      .map(key => ({ key, ...playersData[key] }))
      .filter(p => !p.kicked)
      .sort((a, b) => (a.joinedAt || a.lastOnline || 0) - (b.joinedAt || b.lastOnline || 0));

    // Gán điểm trực tiếp cho từng người: Người 1 -> B6, Người 2 -> C6, Người 3 -> D6, Người 4 -> E6, Người 5 -> F6
    sortedPlayers.forEach((player, index) => {
      if (index < sheetScores.length) {
        const targetScore = sheetScores[index];
        if (player.score !== targetScore) {
          db.ref(`players/${player.key}/score`).set(targetScore);
        }
      }
    });

    const sheetStatus = document.getElementById('sheetSyncStatus');
    if (sheetStatus) {
      const now = new Date().toLocaleTimeString();
      sheetStatus.innerText = `🟢 Đã tham chiếu B6:F6 [${sheetScores.join(', ')}] lúc ${now}`;
      sheetStatus.className = "text-[11px] text-emerald-400 font-mono mt-1 font-bold";
    }

  } catch (err) {
    console.error('Lỗi lấy điểm Google Sheet:', err);
    const sheetStatus = document.getElementById('sheetSyncStatus');
    if (sheetStatus) {
      sheetStatus.innerText = '🔴 Lỗi đọc Google Sheet! Hãy kiểm tra lại quyền Chia sẻ.';
      sheetStatus.className = "text-[11px] text-red-400 font-mono mt-1 font-bold";
    }
  }
}

function startGoogleSheetSync() {
  syncScoresFromGoogleSheet();
  if (sheetSyncInterval) clearInterval(sheetSyncInterval);
  sheetSyncInterval = setInterval(syncScoresFromGoogleSheet, 2000);
}

function startFirebaseListeners() {
  // 1. Khóa/Mở chuông
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

  // 2. Max players
  db.ref('settings/maxPlayers').on('value', (snapshot) => {
    const input = document.getElementById('maxPlayersInput');
    if (input) input.value = snapshot.val() || 0;
  });

  // 3. Chuông bấm Realtime
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
      adminBuzzerAudio.play().catch(e => console.warn('Bấm Admin 1 lần để bật tiếng:', e));
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

  // 4. Bảng Thí sinh (ĐÃ BỎ CỘT ĐIỂM)
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

    const playersList = [];
    snapshot.forEach((child) => {
      const p = child.val();
      if (!p.kicked) {
        playersList.push({ key: child.key, ...p });
      }
    });

    playersList.sort((a, b) => (a.joinedAt || a.lastOnline || 0) - (b.joinedAt || b.lastOnline || 0));

    const cellLabels = ['B6', 'C6', 'D6', 'E6', 'F6'];

    playersList.forEach((p, idx) => {
      const cellName = cellLabels[idx] || `Cột ${idx + 1}`;

      const row = document.createElement('tr');
      row.className = 'hover:bg-slate-800/50 transition';
      row.innerHTML = `
        <td class="p-2 font-semibold text-slate-200">
          ${escapeHtml(p.name)} 
          <span class="text-[10px] text-amber-400 font-mono ml-1">(${cellName})</span>
        </td>

        <td class="p-2 text-center">
          <button onclick="toggleMuteBuzzer('${p.key}', ${!p.muteBuzzer})" class="px-2 py-1 rounded text-[10px] font-bold ${p.muteBuzzer ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400'}">
            ${p.muteBuzzer ? '🔇 Đã Cấm' : '🔔 Bình Thường'}
          </button>
        </td>
        <td class="p-2 text-center">
          <button onclick="toggleMuteChat('${p.key}', ${!p.muteChat})" class="px-2 py-1 rounded text-[10px] font-bold ${p.muteChat ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400'}">
            ${p.muteChat ? '🔇 Đã Cấm' : '💬 Bình Thường'}
          </button>
        </td>
        <td class="p-2 text-center">
          <button onclick="kickPlayer('${p.key}')" class="bg-red-600/80 hover:bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded transition">❌</button>
        </td>
      `;
      tbody.appendChild(row);
    });
    if (countBadge) countBadge.innerText = `${playersList.length} thí sinh`;
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

// Thao tác Admin
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
