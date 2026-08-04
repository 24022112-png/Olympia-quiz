const webAppUrl = 'https://script.google.com/macros/s/AKfycbxrZ6zJnqqUvNC7TF3FoYg426heDoP50DINEHOabc445LOT94Yf24PpB2OpKkBi89eD_A/exec';

let isLocked = true;
let maxPlayers = 0;
const pageLoadTime = Date.now();

function playBuzzerSound() {
  const audio = new Audio('sound/buzzer.mp3');
  audio.currentTime = 0;
  audio.play().catch(e => console.log("Không thể phát âm thanh:", e));
}

function toggleLock() {
  db.ref('settings/locked').set(!isLocked);
}

db.ref('settings/locked').on('value', (snapshot) => {
  isLocked = snapshot.val() ?? true;
  const btn = document.getElementById('toggleLockBtn');
  if (btn) {
    btn.innerText = isLocked ? 'MỞ KHÓA CHUÔNG' : 'KHÓA CHUÔNG';
    btn.className = isLocked 
      ? 'btn-action py-3 bg-emerald-600 hover:bg-emerald-500 font-extrabold rounded-lg uppercase tracking-wider text-sm transition shadow-lg shadow-emerald-900/50' 
      : 'btn-action py-3 bg-red-600 hover:bg-red-500 font-extrabold rounded-lg uppercase tracking-wider text-sm transition shadow-lg shadow-red-900/50';
  }
});

db.ref('settings/maxPlayers').on('value', (snapshot) => {
  maxPlayers = snapshot.val() || 0;
  const input = document.getElementById('maxPlayersInput');
  if (input) input.value = maxPlayers;
});

function setMaxPlayers() {
  const val = parseInt(document.getElementById('maxPlayersInput').value) || 0;
  db.ref('settings/maxPlayers').set(val);
  alert(`Đã cập nhật giới hạn người chơi: ${val === 0 ? 'Không giới hạn' : val + ' người'}`);
}

// HÀM RESET LƯỢT: TỰ ĐỘNG KHÓA CHUÔNG + XÓA DANH SÁCH BẤM CHUÔNG & CÂU TRẢ LỜI
function resetRound() {
  db.ref('settings/locked').set(true);
  db.ref('buzzers').remove();
  db.ref('answers').remove();
}

function resetAllPlayers() {
  if (confirm('Bạn có chắc chắn muốn xóa toàn bộ thí sinh?')) {
    db.ref('players').remove();
  }
}

function toggleMuteBuzzer(pId, currentVal) { db.ref(`players/${pId}/muteBuzzer`).set(!currentVal); }
function toggleMuteChat(pId, currentVal) { db.ref(`players/${pId}/muteChat`).set(!currentVal); }

// XÓA CỘT TRÊN GOOGLE SHEET KHI BỊ KICK
async function removePlayerFromGoogleSheet(playerName) {
  try {
    await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'removePlayer',
        playerName: playerName
      })
    });
    setTimeout(fetchSheetData, 1500);
  } catch (e) {
    console.error("Lỗi xóa cột trên Google Sheet:", e);
  }
}

function kickPlayer(pId) {
  if (confirm('Bạn có chắc muốn ĐUỔI thí sinh này khỏi phòng và XÓA CỘT trên Google Sheet?')) {
    db.ref(`players/${pId}`).once('value', (snapshot) => {
      const pData = snapshot.val();
      if (pData && pData.name) {
        removePlayerFromGoogleSheet(pData.name);
      }
      db.ref(`players/${pId}/kicked`).set(true);
    });
  }
}

function unkickPlayer(pId) { db.ref(`players/${pId}/kicked`).set(false); }

// THEO DÕI DANH SÁCH THÍ SINH REALTIME
db.ref('players').on('value', (snapshot) => {
  const container = document.getElementById('playerList');
  const countSpan = document.getElementById('playerCount');
  if (!container) return;
  
  container.innerHTML = '';

  if (!snapshot.exists()) {
    container.innerHTML = '<p class="text-slate-500 italic text-sm">Chưa có thí sinh nào...</p>';
    if (countSpan) countSpan.innerText = '0 Thí sinh';
    return;
  }

  const players = snapshot.val();
  const playerKeys = Object.keys(players);
  if (countSpan) countSpan.innerText = `${playerKeys.length}${maxPlayers > 0 ? '/' + maxPlayers : ''} Thí sinh`;

  playerKeys.forEach((key) => {
    const p = players[key];
    const isMuteBuzzer = p.muteBuzzer ?? false;
    const isMuteChat = p.muteChat ?? false;
    const isKicked = p.kicked ?? false;

    const card = document.createElement('div');
    card.className = `p-3 rounded-lg border flex flex-col justify-between space-y-3 ${isKicked ? 'bg-red-950/40 border-red-800 opacity-75' : 'bg-slate-900 border-slate-700'}`;
    
    card.innerHTML = `
      <div class="flex justify-between items-center">
        <div>
          <span class="font-bold text-white text-base">${escapeHtml(p.name || 'Không tên')}</span>
          <div class="flex gap-1 mt-1">
            ${isKicked ? '<span class="text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded font-bold">BỊ ĐUỔI</span>' : ''}
            ${isMuteBuzzer ? '<span class="text-[10px] bg-yellow-600 text-white px-1.5 py-0.5 rounded font-bold">CHẶN CHUÔNG</span>' : ''}
            ${isMuteChat ? '<span class="text-[10px] bg-orange-600 text-white px-1.5 py-0.5 rounded font-bold">CHẶN CHAT</span>' : ''}
            ${!isKicked && !isMuteBuzzer && !isMuteChat ? '<span class="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">BÌNH THƯỜNG</span>' : ''}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-1 pt-2 border-t border-slate-800">
        <button onclick="toggleMuteBuzzer('${key}', ${isMuteBuzzer})" class="btn-action text-[11px] py-1 px-2 rounded font-bold ${isMuteBuzzer ? 'bg-yellow-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">
          ${isMuteBuzzer ? 'Bỏ Chặn Chuông' : 'Chặn Chuông'}
        </button>
        <button onclick="toggleMuteChat('${key}', ${isMuteChat})" class="btn-action text-[11px] py-1 px-2 rounded font-bold ${isMuteChat ? 'bg-orange-500 text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}">
          ${isMuteChat ? 'Bỏ Chặn Chat' : 'Chặn Chat'}
        </button>
        ${isKicked ? `
          <button onclick="unkickPlayer('${key}')" class="btn-action text-[11px] py-1 px-2 rounded font-bold bg-emerald-700 hover:bg-emerald-600 text-white">
            Cho Vào Lại
          </button>
        ` : `
          <button onclick="kickPlayer('${key}')" class="btn-action text-[11px] py-1 px-2 rounded font-bold bg-red-700 hover:bg-red-600 text-white">
            Đuổi
          </button>
        `}
      </div>
    `;
    container.appendChild(card);
  });
});

db.ref('buzzers').on('child_added', (snapshot) => {
  const data = snapshot.val();
  if (data && data.timestamp && data.timestamp > pageLoadTime - 2000) {
    playBuzzerSound();
  }
});

db.ref('buzzers').orderByChild('timestamp').on('value', (snapshot) => {
  const list = document.getElementById('adminBuzzerList');
  if (!list) return;
  list.innerHTML = '';

  if (!snapshot.exists()) {
    list.innerHTML = '<li class="text-slate-500 italic text-sm">Chưa có tín hiệu chuông...</li>';
    return;
  }

  let rank = 1;
  snapshot.forEach((child) => {
    const data = child.val();
    const date = new Date(data.timestamp);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${Math.floor(date.getMilliseconds()/100)}`;
    const item = document.createElement('li');
    item.className = `flex justify-between items-center p-2 rounded border ${rank === 1 ? 'gold-glow bg-yellow-950/60 border-yellow-400 font-bold' : 'bg-slate-800 border-slate-700'}`;
    item.innerHTML = `
      <span><b class="${rank === 1 ? 'text-yellow-400' : 'text-slate-400'}">#${rank}</b> ${escapeHtml(data.name)}</span>
      <span class="text-xs font-mono text-slate-400">${timeStr}</span>
    `;
    list.appendChild(item);
    rank++;
  });
});

db.ref('answers').orderByChild('timestamp').on('value', (snapshot) => {
  const list = document.getElementById('adminAnswerList');
  if (!list) return;
  list.innerHTML = '';

  if (!snapshot.exists()) {
    list.innerHTML = '<p class="text-slate-500 italic text-sm">Chưa nhận được câu trả lời...</p>';
    return;
  }

  snapshot.forEach((child) => {
    const data = child.val();
    const timeStr = new Date(data.timestamp).toLocaleTimeString();
    const item = document.createElement('div');
    item.className = 'p-2 rounded bg-slate-800 border border-slate-700 space-y-1';
    item.innerHTML = `
      <div class="flex justify-between text-xs">
        <span class="font-bold text-emerald-400">${escapeHtml(data.name)}</span>
        <span class="text-slate-400 font-mono">${timeStr}</span>
      </div>
      <div class="text-slate-100 font-medium">${escapeHtml(data.text)}</div>
    `;
    list.appendChild(item);
  });
});

// QUẢN LÝ DỮ LIỆU GOOGLE SHEET
function renderGroupInputs(groups = []) {
  const container = document.getElementById('groupInputsContainer');
  if (!container) return;
  container.innerHTML = '';

  const count = Math.max(groups.length, 4);
  for (let i = 0; i < count; i++) {
    const colLetter = String.fromCharCode(66 + i);
    const name = groups[i] ? groups[i].name : `Nhóm ${i + 1}`;

    const div = document.createElement('div');
    div.className = 'flex flex-col gap-1';
    div.innerHTML = `
      <label class="text-[11px] text-slate-400 font-mono font-bold">Ô ${colLetter}1:</label>
      <input type="text" value="${escapeHtml(name)}" class="group-name-input bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500">
    `;
    container.appendChild(div);
  }
}

function addGroupInput() {
  const container = document.getElementById('groupInputsContainer');
  if (!container) return;
  const count = container.children.length;
  const colLetter = String.fromCharCode(66 + count);

  const div = document.createElement('div');
  div.className = 'flex flex-col gap-1';
  div.innerHTML = `
    <label class="text-[11px] text-slate-400 font-mono font-bold">Ô ${colLetter}1:</label>
    <input type="text" value="Nhóm ${count + 1}" class="group-name-input bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500">
  `;
  container.appendChild(div);
}

async function fetchSheetData() {
  const tableBody = document.getElementById('leaderboardBody');
  if (!tableBody) return;

  try {
    const res = await fetch(webAppUrl);
    const data = await res.json();

    if (Array.isArray(data)) {
      renderGroupInputs(data);
      const sortedData = [...data].sort((a, b) => b.total - a.total);

      tableBody.innerHTML = '';
      if (sortedData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-3 text-slate-500 italic">Chưa có dữ liệu thí sinh trên Sheet.</td></tr>';
        return;
      }

      sortedData.forEach((item, index) => {
        const isTop1 = index === 0 && item.total > 0;
        const tr = document.createElement('tr');
        tr.className = isTop1 
          ? 'bg-yellow-950/60 border-b border-yellow-500/50 text-yellow-300 font-bold' 
          : 'border-b border-slate-800 hover:bg-slate-800/50';

        tr.innerHTML = `
          <td class="p-3 text-center">${index + 1} ${isTop1 ? '👑' : ''}</td>
          <td class="p-3 font-semibold text-slate-100">${escapeHtml(item.name)}</td>
          <td class="p-3 text-center text-slate-400 font-mono">Cột ${item.colLetter} (Ô ${item.colLetter}1 / Ô ${item.colLetter}6)</td>
          <td class="p-3 text-center font-bold text-emerald-400 text-base">${item.total}</td>
        `;
        tableBody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error("Lỗi đọc Google Sheet:", err);
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-3 text-red-400 font-bold">Lỗi kết nối Web App URL! Kiểm tra lại Google Apps Script.</td></tr>';
  }
}

async function updateSheetGroupNames() {
  const inputs = document.querySelectorAll('.group-name-input');
  const groupNames = Array.from(inputs).map(input => input.value.trim());

  try {
    await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ groupNames })
    });

    alert('Đã cập nhật tên nhóm lên Google Sheet!');
    setTimeout(fetchSheetData, 1500);
  } catch (err) {
    console.error("Lỗi cập nhật tên nhóm:", err);
    alert('Không thể cập nhật tên nhóm lên Google Sheet!');
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

fetchSheetData();
setInterval(fetchSheetData, 10000);
