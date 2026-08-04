const webAppUrl = 'https://script.google.com/macros/s/AKfycbxrZ6zJnqqUvNC7TF3FoYg426heDoP50DINEHOabc445LOT94Yf24PpB2OpKkBi89eD_A/exec';

let playerId = localStorage.getItem('olympia_player_id');
if (!playerId) {
  playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  localStorage.setItem('olympia_player_id', playerId);
}

let nickname = localStorage.getItem('olympia_nickname') || '';
let isLocked = true;
let hasBuzzedInCurrentCycle = false;
let previousLockState = true;

let isMuteBuzzer = false;
let isMuteChat = false;
let isKicked = false;

let maxPlayers = 0; 
let currentPlayersCount = 0;
let isPlayerRegistered = false;

const pageLoadTime = Date.now();

function playBuzzerSound() {
  const audio = new Audio('sound/buzzer.mp3');
  audio.currentTime = 0;
  audio.play().catch(e => console.log("Không thể tự động phát âm thanh:", e));
}

// TỰ ĐỘNG THÊM THÍ SINH VÀO CỘT MỚI TRÊN GOOGLE SHEET
async function addPlayerToGoogleSheet(playerName) {
  if (!playerName) return;
  try {
    await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'addPlayer',
        playerName: playerName
      })
    });
  } catch (e) {
    console.error("Lỗi thêm thí sinh vào Google Sheet:", e);
  }
}

function registerPlayerToFirebase() {
  if (!nickname || !playerId) return;

  db.ref('players/' + playerId).update({
    id: playerId,
    name: nickname,
    lastActive: firebase.database.ServerValue.TIMESTAMP
  });

  addPlayerToGoogleSheet(nickname);
}

function updateMaxPlayerNotice() {
  const notice = document.getElementById('maxPlayerNotice');
  if (notice) {
    notice.innerText = maxPlayers > 0 ? `(Giới hạn: ${currentPlayersCount}/${maxPlayers} người)` : '';
  }
}

function saveNickname() {
  const inputEl = document.getElementById('nicknameInput');
  const inputVal = inputEl ? inputEl.value.trim() : '';

  if (!inputVal) return alert('Vui lòng nhập biệt danh của bạn!');

  if (maxPlayers > 0 && currentPlayersCount >= maxPlayers && !isPlayerRegistered) {
    return alert(`Phòng đã đủ số lượng người chơi tối đa (${maxPlayers} người)!`);
  }

  nickname = inputVal;
  localStorage.setItem('olympia_nickname', nickname);

  const userDisp = document.getElementById('userDisplay');
  if (userDisp) userDisp.innerText = nickname;

  const modal = document.getElementById('nicknameModal');
  if (modal) modal.classList.add('hidden');

  registerPlayerToFirebase();
}

function changeNickname() {
  localStorage.removeItem('olympia_nickname');
  const modal = document.getElementById('nicknameModal');
  if (modal) modal.classList.remove('hidden');
}

// LẮNG NGHE LỚP REALTIME
db.ref('settings/maxPlayers').on('value', (snapshot) => {
  maxPlayers = snapshot.val() || 0;
  updateMaxPlayerNotice();
});

// CẬP NHẬT REALTIME DANH SÁCH NGUỜI CHƠI ĐANG TRONG PHÒNG
db.ref('players').on('value', (snapshot) => {
  const container = document.getElementById('activePlayersList') || document.getElementById('playerList');

  if (snapshot.exists()) {
    const players = snapshot.val();
    const playerKeys = Object.keys(players);
    currentPlayersCount = playerKeys.length;
    isPlayerRegistered = !!players[playerId];

    if (container) {
      container.innerHTML = '';
      let countActive = 0;

      playerKeys.forEach((key) => {
        const p = players[key];
        const isMe = key === playerId;
        const pKicked = p.kicked ?? false;

        if (!pKicked) {
          countActive++;
          const item = document.createElement('div');
          item.className = `p-2 rounded-lg border text-xs flex justify-between items-center transition ${
            isMe 
              ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200 font-bold' 
              : 'bg-slate-800/80 border-slate-700 text-slate-200'
          }`;
          
          item.innerHTML = `
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>${escapeHtml(p.name)}</span>
            </div>
            ${isMe ? '<span class="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-normal">Bạn</span>' : ''}
          `;
          container.appendChild(item);
        }
      });

      if (countActive === 0) {
        container.innerHTML = '<p class="text-slate-500 italic text-xs p-2">Chưa có ai trong phòng...</p>';
      }
    }
  } else {
    currentPlayersCount = 0;
    isPlayerRegistered = false;
    if (container) {
      container.innerHTML = '<p class="text-slate-500 italic text-xs p-2">Chưa có người chơi nào...</p>';
    }
  }

  updateMaxPlayerNotice();
});

db.ref('players/' + playerId).on('value', (snapshot) => {
  if (!snapshot.exists()) return;
  const data = snapshot.val();

  isKicked = data.kicked ?? false;
  isMuteBuzzer = data.muteBuzzer ?? false;
  isMuteChat = data.muteChat ?? false;

  const kickedModal = document.getElementById('kickedModal');
  const sendBtn = document.getElementById('sendBtn');
  const answerInput = document.getElementById('answerInput');
  const chatNotice = document.getElementById('chatNotice');

  if (isKicked) {
    if (kickedModal) kickedModal.classList.remove('hidden');
    const buzzerBtn = document.getElementById('buzzerBtn');
    if (buzzerBtn) buzzerBtn.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (answerInput) answerInput.disabled = true;
    return;
  } else {
    if (kickedModal) kickedModal.classList.add('hidden');
  }

  if (isMuteChat) {
    if (sendBtn) sendBtn.disabled = true;
    if (answerInput) answerInput.disabled = true;
    if (chatNotice) {
      chatNotice.innerText = '⚠️ Bạn đã bị Admin CHẶN gửi câu trả lời!';
      chatNotice.className = 'text-xs text-red-400 mt-1 block font-bold';
    }
  } else {
    if (sendBtn) sendBtn.disabled = false;
    if (answerInput) answerInput.disabled = false;
    if (chatNotice) chatNotice.innerText = '';
  }

  updateBuzzerButtonState();
});

db.ref('settings/locked').on('value', (snapshot) => {
  const newLockState = snapshot.val() ?? true;

  if (previousLockState === true && newLockState === false) {
    hasBuzzedInCurrentCycle = false;
  }

  isLocked = newLockState;
  previousLockState = newLockState;
  updateBuzzerButtonState();
});

db.ref('buzzers').on('child_added', (snapshot) => {
  const data = snapshot.val();
  if (data && data.timestamp && data.timestamp > pageLoadTime - 2000) {
    playBuzzerSound();
  }
});

db.ref('buzzers').orderByChild('timestamp').on('value', (snapshot) => {
  const list = document.getElementById('buzzerQueue');
  if (!list) return;
  list.innerHTML = '';
  
  if (!snapshot.exists()) {
    list.innerHTML = '<li class="text-slate-500 italic text-xs">Chưa có ai bấm chuông...</li>';
    return;
  }

  let rank = 1;
  snapshot.forEach((child) => {
    const data = child.val();
    const date = new Date(data.timestamp);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${Math.floor(date.getMilliseconds()/100)}`;
    const isMe = data.playerId === playerId;
    
    const item = document.createElement('li');
    item.className = `flex justify-between items-center p-2 rounded border ${
      rank === 1 ? 'gold-glow bg-yellow-950/60 border-yellow-400 font-bold' : 'bg-slate-800 border-slate-700'
    }`;
    
    item.innerHTML = `
      <span>
        <b class="${rank === 1 ? 'text-yellow-400' : 'text-slate-400'}">#${rank}</b> 
        ${escapeHtml(data.name)} 
        ${isMe ? '<span class="text-[10px] bg-yellow-500 text-slate-950 px-1 rounded ml-1 font-bold">BẠN</span>' : ''}
      </span>
      <span class="text-[10px] font-mono text-slate-400">${timeStr}</span>
    `;
    list.appendChild(item);
    rank++;
  });
});

db.ref('answers').orderByChild('timestamp').on('value', (snapshot) => {
  const list = document.getElementById('answerStream');
  if (!list) return;
  list.innerHTML = '';

  let myCount = 0;
  if (snapshot.exists()) {
    snapshot.forEach((child) => {
      const data = child.val();
      if (data.playerId === playerId || data.name === nickname) {
        myCount++;
        const timeStr = new Date(data.timestamp).toLocaleTimeString();
        const item = document.createElement('div');
        item.className = 'p-2 rounded bg-slate-800 border border-emerald-500/50 space-y-1';
        item.innerHTML = `
          <div class="flex justify-between text-[10px]">
            <span class="font-bold text-emerald-400">${escapeHtml(data.name)} (Bạn)</span>
            <span class="text-slate-400 font-mono">${timeStr}</span>
          </div>
          <div class="text-slate-100 font-medium text-sm">${escapeHtml(data.text)}</div>
        `;
        list.appendChild(item);
      }
    });
  }

  if (myCount === 0) {
    list.innerHTML = '<p class="text-slate-500 italic text-xs">Chưa có câu trả lời nào của bạn...</p>';
  }
});

function triggerBuzzer() {
  if (isKicked) return alert('Bạn đã bị Admin đuổi khỏi phòng!');
  if (isMuteBuzzer) return alert('Bạn đang bị Admin CHẶN bấm chuông!');
  if (isLocked) return alert('Chuông đang bị khóa bởi Admin!');
  if (hasBuzzedInCurrentCycle) return alert('Bạn đã bấm chuông trong lượt này rồi!');
  if (!nickname) return alert('Vui lòng nhập biệt danh!');

  hasBuzzedInCurrentCycle = true;
  updateBuzzerButtonState();

  db.ref('buzzers').push({
    playerId: playerId,
    name: nickname,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
}

function submitAnswer() {
  if (isKicked) return alert('Bạn đã bị Admin đuổi khỏi phòng!');
  if (isMuteChat) return alert('Bạn đang bị Admin CHẶN gửi câu trả lời!');
  
  const textInput = document.getElementById('answerInput');
  const text = textInput ? textInput.value.trim() : '';
  if (!text) return alert('Vui lòng nhập nội dung câu trả lời!');
  if (!nickname) return alert('Vui lòng nhập biệt danh trước!');

  db.ref('answers').push({
    playerId: playerId,
    name: nickname,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });

  if (textInput) textInput.value = '';
}

function updateBuzzerButtonState() {
  const btn = document.getElementById('buzzerBtn');
  const notice = document.getElementById('buzzerNotice');
  if (!btn || !notice) return;

  if (isKicked) {
    btn.disabled = true;
    notice.innerText = 'Bạn đã bị đuổi khỏi phòng!';
    notice.className = 'mt-4 text-xs text-red-500 font-bold';
  } else if (isMuteBuzzer) {
    btn.disabled = true;
    notice.innerText = '⚠️ Bạn đã bị Admin CHẶN bấm chuông!';
    notice.className = 'mt-4 text-xs text-red-400 font-bold';
  } else if (isLocked) {
    btn.disabled = true;
    notice.innerText = 'Chuông hiện đang bị KHÓA';
    notice.className = 'mt-4 text-xs text-slate-400';
  } else if (hasBuzzedInCurrentCycle) {
    btn.disabled = true;
    notice.innerText = 'Bạn đã bấm chuông lượt này! Chờ Admin mở lượt mới...';
    notice.className = 'mt-4 text-xs text-yellow-400 font-bold';
  } else {
    btn.disabled = false;
    notice.innerText = 'Chuông SẴN SÀNG! Bấm ngay!';
    notice.className = 'mt-4 text-xs text-emerald-400 font-bold animate-pulse';
  }
}

async function loadLeaderboard() {
  const container = document.getElementById('leaderboardBody');
  if (!container) return;

  try {
    const res = await fetch(webAppUrl);
    if (!res.ok) throw new Error("Không thể kết nối Web App");

    const data = await res.json();
    if (!Array.isArray(data)) return;

    const sortedData = [...data].sort((a, b) => b.total - a.total);

    container.innerHTML = '';
    if (sortedData.length === 0) {
      container.innerHTML = '<tr><td colspan="3" class="text-center p-2 text-slate-500 italic">Chưa có dữ liệu thí sinh...</td></tr>';
      return;
    }

    sortedData.forEach((item, index) => {
      const isTop1 = index === 0 && item.total > 0;
      const isMe = item.name === nickname;

      const tr = document.createElement('tr');
      tr.className = isTop1 
        ? 'bg-yellow-950/60 border-b border-yellow-500/50 text-yellow-300 font-bold' 
        : (isMe ? 'bg-indigo-950/60 border-b border-indigo-500/50 font-bold' : 'border-b border-slate-800 hover:bg-slate-800/50');

      tr.innerHTML = `
        <td class="p-2 text-center">${index + 1} ${isTop1 ? '👑' : ''}</td>
        <td class="p-2 font-semibold text-left text-slate-100">
          ${escapeHtml(item.name)} ${isMe ? '<span class="text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-normal">Bạn</span>' : ''}
        </td>
        <td class="p-2 text-center font-bold text-emerald-400 text-sm">${item.total}</td>
      `;
      container.appendChild(tr);
    });
  } catch (err) {
    console.error("Lỗi cập nhật bảng điểm Google Sheet:", err);
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

document.addEventListener('DOMContentLoaded', () => {
  if (nickname) {
    const modal = document.getElementById('nicknameModal');
    const userDisp = document.getElementById('userDisplay');
    if (modal) modal.classList.add('hidden');
    if (userDisp) userDisp.innerText = nickname;
    registerPlayerToFirebase();
  } else {
    const modal = document.getElementById('nicknameModal');
    if (modal) modal.classList.remove('hidden');
  }

  loadLeaderboard();
  setInterval(loadLeaderboard, 10000);
});
