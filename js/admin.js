// Mật khẩu Admin
const ADMIN_PASSWORD = "20032006";
const adminBuzzerAudio = new Audio('sound/buzzer.mp3');

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
  sessionStorage.removeItem("olympia_admin_auth");
  window.location.reload();
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

  // 4. Bảng Thí sinh (Hiển thị danh sách & Quản lý Quyền)
  db.ref('players').on('value', (snapshot) => {
    const tbody = document.getElementById('playerTableBody');
    const countBadge = document.getElementById('playerCount');
    if (!tbody) return;

    // Tự động đảm bảo giao diện tiêu đề 4 cột
    const table = tbody.closest('table');
    if (table) {
      let thead = table.querySelector('thead');
      if (thead) {
        thead.innerHTML = `
          <tr class="bg-slate-900 text-slate-400 uppercase text-[10px]">
            <th class="p-2">Thí sinh</th>
            <th class="p-2 text-center">Chuông</th>
            <th class="p-2 text-center">Chat</th>
            <th class="p-2 text-center">Xóa</th>
          </tr>
        `;
      }
    }

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

// Các hàm thao tác Admin
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
