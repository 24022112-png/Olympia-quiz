// js/admin.js

// 1. Theo dõi Trạng thái Khóa / Mở chuông
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

// 2. Cấu hình Giới hạn Thí sinh
db.ref('settings/maxPlayers').on('value', (snapshot) => {
  const max = snapshot.val() || 0;
  const input = document.getElementById('maxPlayersInput');
  if (input) input.value = max;
});

function updateMaxPlayers() {
  const input = document.getElementById('maxPlayersInput');
  const val = parseInt(input.value) || 0;
  db.ref('settings/maxPlayers').set(val);
  alert('Đã cập nhật số lượng thí sinh tối đa!');
}

// 3. Khóa hoặc Mở Chuông
function setBuzzerLock(status) {
  db.ref('settings/locked').set(status);
}

// 4. Clear Chuông
function clearBuzzers() {
  db.ref('buzzers').remove();
}

// 5. Clear Câu trả lời
function clearAnswers() {
  db.ref('answers').remove();
}

// 6. Theo dõi Thứ tự Chuông
db.ref('buzzers').orderByChild('timestamp').on('value', (snapshot) => {
  const list = document.getElementById('adminBuzzerList');
  const countBadge = document.getElementById('buzzerCount');
  if (!list) return;
  list.innerHTML = '';

  if (!snapshot.exists()) {
    list.innerHTML = '<li class="text-slate-500 italic text-xs">Chưa có tín hiệu chuông nào...</li>';
    if (countBadge) countBadge.innerText = '0';
    return;
  }

  let rank = 1;
  snapshot.forEach((child) => {
    const data = child.val();
    const date = new Date(data.timestamp || Date.now());
    const timeStr = date.toTimeString().split(' ')[0] + '.' + String(date.getMilliseconds()).padStart(3, '0');

    const item = document.createElement('li');
    item.className = `p-2.5 rounded-lg border text-xs flex justify-between items-center ${
      rank === 1 
        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold' 
        : 'bg-slate-950 border-slate-800 text-slate-300'
    }`;
    item.innerHTML = `
      <span>#${rank} - <strong>${escapeHtml(data.name)}</strong></span>
      <span class="text-[10px] text-slate-500">${timeStr}</span>
    `;
    list.appendChild(item);
    rank++;
  });

  if (countBadge) countBadge.innerText = String(rank - 1);
});

// 7. Theo dõi Danh sách Thí sinh & Điều khiển (Cấm / Ép thoát)
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

    if (p.kicked) return; // Bỏ qua thí sinh đã bị kick

    total++;
    const row = document.createElement('tr');
    row.className = 'hover:bg-slate-800/50 transition';
    row.innerHTML = `
      <td class="p-2 font-semibold text-slate-200">${escapeHtml(p.name)}</td>
      <td class="p-2 text-center">
        <button onclick="toggleMuteBuzzer('${key}', ${!p.muteBuzzer})" 
          class="px-2 py-1 rounded text-[10px] font-bold ${p.muteBuzzer ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400'}">
          ${p.muteBuzzer ? '🔇 Đã Cấm' : '🔔 Bình Thường'}
        </button>
      </td>
      <td class="p-2 text-center">
        <button onclick="toggleMuteChat('${key}', ${!p.muteChat})" 
          class="px-2 py-1 rounded text-[10px] font-bold ${p.muteChat ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400'}">
          ${p.muteChat ? '🔇 Đã Cấm' : '💬 Bình Thường'}
        </button>
      </td>
      <td class="p-2 text-center">
        <button onclick="kickPlayer('${key}')" class="bg-red-600/80 hover:bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded transition">
          ❌ Đuổi
        </button>
      </td>
    `;
    tbody.appendChild(row);
  });

  if (countBadge) countBadge.innerText = `${total} thí sinh`;
});

function toggleMuteBuzzer(id, status) {
  db.ref(`players/${id}/muteBuzzer`).set(status);
}

function toggleMuteChat(id, status) {
  db.ref(`players/${id}/muteChat`).set(status);
}

function kickPlayer(id) {
  if (confirm('Bạn có chắc chắn muốn đuổi thí sinh này khỏi phòng?')) {
    db.ref(`players/${id}/kicked`).set(true);
  }
}

// 8. Theo dõi Luồng Câu trả lời của tất cả thí sinh
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
    const date = new Date(data.timestamp || Date.now());
    const timeStr = date.toTimeString().split(' ')[0];

    const item = document.createElement('div');
    item.className = 'p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex justify-between items-start gap-2';
    item.innerHTML = `
      <div>
        <span class="font-bold text-amber-400">${escapeHtml(data.name)}:</span>
        <span class="text-slate-200 ml-1">${escapeHtml(data.text)}</span>
      </div>
      <span class="text-[10px] text-slate-500 whitespace-nowrap">${timeStr}</span>
    `;
    stream.prepend(item);
  });
});

function escapeHtml(str) {
  return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
