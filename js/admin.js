let isLocked = true;
const pageLoadTime = Date.now();

// Phát âm thanh chuông từ thư mục sound/buzzer.mp3
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
  btn.innerText = isLocked ? 'MỞ KHÓA CHUÔNG' : 'KHÓA CHUÔNG';
  btn.className = isLocked 
    ? 'btn-action py-3 bg-emerald-600 hover:bg-emerald-500 font-extrabold rounded uppercase tracking-wider text-sm transition shadow-lg shadow-emerald-900/50' 
    : 'btn-action py-3 bg-red-600 hover:bg-red-500 font-extrabold rounded uppercase tracking-wider text-sm transition shadow-lg shadow-red-900/50';
});

function clearBuzzers() {
  db.ref('buzzers').remove();
}

function clearAnswers() {
  db.ref('answers').remove();
}

function resetAllPlayers() {
  if (confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách thí sinh?')) {
    db.ref('players').remove();
  }
}

function toggleMuteBuzzer(pId, currentVal) {
  db.ref(`players/${pId}/muteBuzzer`).set(!currentVal);
}

function toggleMuteChat(pId, currentVal) {
  db.ref(`players/${pId}/muteChat`).set(!currentVal);
}

function kickPlayer(pId) {
  if (confirm('Bạn có chắc muốn ĐUỔI thí sinh này khỏi phòng?')) {
    db.ref(`players/${pId}/kicked`).set(true);
  }
}

function unkickPlayer(pId) {
  db.ref(`players/${pId}/kicked`).set(false);
}

// Quản lý thí sinh Realtime
db.ref('players').on('value', (snapshot) => {
  const container = document.getElementById('playerList');
  const countSpan = document.getElementById('playerCount');
  container.innerHTML = '';

  if (!snapshot.exists()) {
    container.innerHTML = '<p class="text-slate-500 italic text-sm col-span-full">Chưa có thí sinh nào tham gia...</p>';
    countSpan.innerText = '0 Thí sinh';
    return;
  }

  const players = snapshot.val();
  const playerKeys = Object.keys(players);
  countSpan.innerText = `${playerKeys.length} Thí sinh`;

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
          <span class="font-bold text-white text-base">${p.name || 'Không tên'}</span>
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

// Lắng nghe tiếng chuông Realtime để phát âm thanh
db.ref('buzzers').on('child_added', (snapshot) => {
  const data = snapshot.val();
  if (data && data.timestamp && data.timestamp > pageLoadTime - 2000) {
    playBuzzerSound();
  }
});

// Lắng nghe danh sách bấm chuông
db.ref('buzzers').orderByChild('timestamp').on('value', (snapshot) => {
  const list = document.getElementById('adminBuzzerList');
  list.innerHTML = '';

  if (!snapshot.exists()) {
    list.innerHTML = '<li class="text-slate-500 italic">Chưa có tín hiệu chuông...</li>';
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
      <span><b class="${rank === 1 ? 'text-yellow-400' : 'text-slate-400'}">#${rank}</b> ${data.name}</span>
      <span class="text-xs font-mono text-slate-400">${timeStr}</span>
    `;
    list.appendChild(item);
    rank++;
  });
});

// Lắng nghe TẤT CẢ câu trả lời
db.ref('answers').orderByChild('timestamp').on('value', (snapshot) => {
  const list = document.getElementById('adminAnswerList');
  list.innerHTML = '';

  if (!snapshot.exists()) {
    list.innerHTML = '<p class="text-slate-500 italic">Chưa nhận được câu trả lời nào...</p>';
    return;
  }

  snapshot.forEach((child) => {
    const data = child.val();
    const timeStr = new Date(data.timestamp).toLocaleTimeString();
    const item = document.createElement('div');
    item.className = 'p-2 rounded bg-slate-800 border border-slate-700 space-y-1';
    item.innerHTML = `
      <div class="flex justify-between text-xs">
        <span class="font-bold text-emerald-400">${data.name}</span>
        <span class="text-slate-400 font-mono">${timeStr}</span>
      </div>
      <div class="text-slate-100 font-medium">${data.text}</div>
    `;
    list.appendChild(item);
  });
});
