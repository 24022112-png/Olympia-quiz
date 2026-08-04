// js/player.js

// 1. Quản lý ID Thí Sinh trong LocalStorage
let playerId = localStorage.getItem('olympia_player_id');
if (!playerId) {
  playerId = 'player_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('olympia_player_id', playerId);
}

let playerName = localStorage.getItem('olympia_player_name') || '';
let isLocked = true;
let isMuteBuzzer = false;
let isMuteChat = false;
let isKicked = false;
let maxPlayers = 0;

// Hiển thị tên
const userDisplay = document.getElementById('userDisplay');
if (userDisplay) userDisplay.innerText = playerName || 'Chưa nhập';

// Nếu chưa có tên, mở Modal nhập tên
if (!playerName) {
  const modal = document.getElementById('nicknameModal');
  if (modal) modal.classList.remove('hidden');
} else {
  registerPlayer();
}

// 2. Đăng ký/Cập nhật Thí sinh lên Firebase
function registerPlayer() {
  if (!playerName) return;
  
  // Kiểm tra giới hạn số lượng người chơi trước khi cho vào
  db.ref('settings/maxPlayers').once('value', (snapshot) => {
    maxPlayers = snapshot.val() || 0;
    
    db.ref('players').once('value', (pSnapshot) => {
      const players = pSnapshot.val() || {};
      const currentKeys = Object.keys(players);
      const isAlreadyIn = players[playerId] !== undefined;

      if (!isAlreadyIn && maxPlayers > 0 && currentKeys.length >= maxPlayers) {
        alert(`Phòng đã đầy! Giới hạn tối đa là ${maxPlayers} thí sinh.`);
        return;
      }

      // Lưu thông tin thí sinh
      db.ref(`players/${playerId}`).update({
        name: playerName,
        lastOnline: Date.now()
      });
    });
  });
}

function saveNickname() {
  const input = document.getElementById('nicknameInput');
  const val = input ? input.value.trim() : '';
  if (!val) {
    alert('Vui lòng nhập tên!');
    return;
  }
  playerName = val;
  localStorage.setItem('olympia_player_name', playerName);
  if (userDisplay) userDisplay.innerText = playerName;
  
  const modal = document.getElementById('nicknameModal');
  if (modal) modal.classList.add('hidden');
  
  registerPlayer();
}

function changeNickname() {
  const modal = document.getElementById('nicknameModal');
  if (modal) modal.classList.remove('hidden');
}

// 3. Theo dõi trạng thái Chuông (Khóa / Mở)
db.ref('settings/locked').on('value', (snapshot) => {
  isLocked = snapshot.val() ?? true;
  updateBuzzerStatus();
});

// 4. Theo dõi thông tin cá nhân (Bị đuổi / Cấm chuông / Cấm chat)
db.ref(`players/${playerId}`).on('value', (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  isMuteBuzzer = data.muteBuzzer ?? false;
  isMuteChat = data.muteChat ?? false;
  isKicked = data.kicked ?? false;

  const kickedModal = document.getElementById('kickedModal');
  if (kickedModal) {
    if (isKicked) {
      kickedModal.classList.remove('hidden');
    } else {
      kickedModal.classList.add('hidden');
    }
  }

  updateBuzzerStatus();
  updateChatStatus();
});

function updateBuzzerStatus() {
  const btn = document.getElementById('buzzerBtn');
  const notice = document.getElementById('buzzerNotice');
  if (!btn || !notice) return;

  if (isKicked) {
    btn.disabled = true;
    notice.innerText = '🚫 BẠN ĐÃ BỊ ĐUỔI KHỎI PHÒNG';
    notice.className = 'mt-4 text-xs text-red-500 font-bold';
  } else if (isMuteBuzzer) {
    btn.disabled = true;
    notice.innerText = '🔇 BẠN ĐÃ BỊ CẤM BẤM CHUÔNG';
    notice.className = 'mt-4 text-xs text-yellow-500 font-bold';
  } else if (isLocked) {
    btn.disabled = true;
    notice.innerText = '🔒 CHUÔNG ĐANG BỊ KHÓA';
    notice.className = 'mt-4 text-xs text-slate-400 font-medium';
  } else {
    btn.disabled = false;
    notice.innerText = '🔔 CHUÔNG ĐÃ MỞ - HÃY BẤM NGAI!';
    notice.className = 'mt-4 text-xs text-emerald-400 font-bold animate-pulse';
  }
}

function updateChatStatus() {
  const input = document.getElementById('answerInput');
  const btn = document.getElementById('sendBtn');
  const notice = document.getElementById('chatNotice');
  if (!input || !btn) return;

  if (isMuteChat || isKicked) {
    input.disabled = true;
    btn.disabled = true;
    if (notice) {
      notice.innerText = '🔇 Bạn đã bị cấm gửi câu trả lời';
      notice.className = 'text-xs text-orange-500 font-bold';
    }
  } else {
    input.disabled = false;
    btn.disabled = false;
    if (notice) notice.innerText = '';
  }
}

// 5. Thao tác Bấm Chuông
function triggerBuzzer() {
  if (isLocked || isMuteBuzzer || isKicked) return;

  db.ref(`buzzers/${playerId}`).set({
    name: playerName,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
}

// 6. Thao tác Gửi Câu Trả Lời
function submitAnswer() {
  const input = document.getElementById('answerInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text || isMuteChat || isKicked) return;

  db.ref('answers').push({
    playerId: playerId,
    name: playerName,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });

  input.value = '';
}

// 7. Lắng nghe Thứ tự Bấm Chuông Realtime
db.ref('buzzers').orderByChild('timestamp').on('value', (snapshot) => {
  const queue = document.getElementById('buzzerQueue');
  if (!queue) return;
  queue.innerHTML = '';

  if (!snapshot.exists()) {
    queue.innerHTML = '<li class="text-slate-500 italic text-xs">Chưa có ai bấm...</li>';
    return;
  }

  let rank = 1;
  snapshot.forEach((child) => {
    const data = child.val();
    const item = document.createElement('li');
    item.className = `p-2 rounded flex justify-between items-center text-xs ${rank === 1 ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' : 'bg-slate-800 text-slate-300'}`;
    item.innerHTML = `<span>#${rank} ${escapeHtml(data.name)}</span>`;
    queue.appendChild(item);
    rank++;
  });
});

// 8. Lắng nghe Lịch sử Trả lời của bản thân
db.ref('answers').orderByChild('timestamp').on('value', (snapshot) => {
  const stream = document.getElementById('answerStream');
  if (!stream) return;
  stream.innerHTML = '';

  if (!snapshot.exists()) {
    stream.innerHTML = '<p class="text-slate-500 italic text-xs">Chưa có câu trả lời...</p>';
    return;
  }

  let hasData = false;
  snapshot.forEach((child) => {
    const data = child.val();
    if (data.playerId === playerId) {
      hasData = true;
      const item = document.createElement('div');
      item.className = 'p-2 rounded bg-slate-800 text-xs border border-slate-700 text-slate-200';
      item.innerText = data.text;
      stream.prepend(item);
    }
  });

  if (!hasData) {
    stream.innerHTML = '<p class="text-slate-500 italic text-xs">Chưa có câu trả lời...</p>';
  }
});

function escapeHtml(str) {
  return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
