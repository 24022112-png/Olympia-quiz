// Khai báo file âm thanh buzzer chuẩn
const buzzerAudio = new Audio('sound/buzzer.mp3');

// 1. Khởi tạo ID thí sinh
let playerId = localStorage.getItem('olympia_player_id');
if (!playerId) {
  playerId = 'player_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('olympia_player_id', playerId);
}

let playerName = localStorage.getItem('olympia_player_name') || '';
let isLocked = true;
let isMuteBuzzer = false;
let isMuteChat = false;
let hasBuzzed = false; // Biến kiểm tra thí sinh đã bấm chuông trong lượt này chưa

const userDisplay = document.getElementById('userDisplay');
const playerNameDisplay = document.getElementById('playerNameDisplay');
const playerScoreDisplay = document.getElementById('playerScoreDisplay');

if (userDisplay) userDisplay.innerText = playerName || 'Chưa nhập';
if (playerNameDisplay) playerNameDisplay.innerText = playerName || 'CHƯA NHẬP TÊN';

if (!playerName) {
  document.getElementById('nicknameModal').classList.remove('hidden');
} else {
  registerPlayer();
}

// 2. Đăng ký Thí Sinh vào Firebase
function registerPlayer() {
  if (!playerName) return;

  db.ref('settings/maxPlayers').once('value', (snapshot) => {
    const maxPlayers = snapshot.val() || 0;
    db.ref('players').once('value', (pSnapshot) => {
      const players = pSnapshot.val() || {};

      if (players[playerId] === undefined && maxPlayers > 0 && Object.keys(players).length >= maxPlayers) {
        alert(`Phòng đã đầy! Giới hạn tối đa là ${maxPlayers} thí sinh.`);
        return;
      }

      db.ref(`players/${playerId}`).update({
        name: playerName,
        lastOnline: Date.now(),
        kicked: false
      });

      if (!players[playerId] || players[playerId].score === undefined) {
        db.ref(`players/${playerId}/score`).set(0);
      }

      listenToPlayerState();
    });
  });
}

// 3. Lắng nghe Trạng thái Thí Sinh (KICK 1 LẦN VĂNG RA NHẬP TÊN LẠI)
function listenToPlayerState() {
  db.ref(`players/${playerId}`).off();

  db.ref(`players/${playerId}`).on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    // XỬ LÝ KICK 1 LẦN
    if (data.kicked === true) {
      db.ref(`players/${playerId}`).off();
      db.ref(`players/${playerId}`).remove();

      localStorage.removeItem('olympia_player_id');
      localStorage.removeItem('olympia_player_name');

      playerId = 'player_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('olympia_player_id', playerId);
      playerName = '';

      if (userDisplay) userDisplay.innerText = 'Chưa nhập tên';
      if (playerNameDisplay) playerNameDisplay.innerText = 'CHƯA NHẬP TÊN';
      if (playerScoreDisplay) playerScoreDisplay.innerText = '0';

      alert('Bạn đã bị Admin mời ra khỏi phòng thi!');
      const modal = document.getElementById('nicknameModal');
      const input = document.getElementById('nicknameInput');
      if (input) input.value = '';
      if (modal) modal.classList.remove('hidden');
      return;
    }

    isMuteBuzzer = data.muteBuzzer ?? false;
    isMuteChat = data.muteChat ?? false;

    if (playerScoreDisplay) {
      playerScoreDisplay.innerText = data.score !== undefined ? data.score : 0;
    }

    updateBuzzerUI();
    updateChatUI();
  });
}

// 4. Lưu Tên & Đổi Tên
function saveNickname() {
  const input = document.getElementById('nicknameInput');
  const val = input ? input.value.trim() : '';
  if (!val) return alert('Vui lòng nhập tên của bạn!');

  playerName = val;
  localStorage.setItem('olympia_player_name', playerName);
  if (userDisplay) userDisplay.innerText = playerName;
  if (playerNameDisplay) playerNameDisplay.innerText = playerName;

  document.getElementById('nicknameModal').classList.add('hidden');
  registerPlayer();
}

function changeNickname() {
  document.getElementById('nicknameModal').classList.remove('hidden');
}

// 5. Khóa/Mở Chuông từ Admin
db.ref('settings/locked').on('value', (snapshot) => {
  isLocked = snapshot.val() ?? true;
  updateBuzzerUI();
});

function updateBuzzerUI() {
  const btn = document.getElementById('buzzerBtn');
  const notice = document.getElementById('buzzerNotice');
  if (!btn || !notice) return;

  if (isMuteBuzzer) {
    btn.disabled = true;
    notice.innerText = '🔇 BẠN ĐÃ BỊ CẤM BẤM CHUÔNG';
    notice.className = 'mt-4 text-xs text-yellow-500 font-bold';
  } else if (isLocked) {
    btn.disabled = true;
    notice.innerText = '🔒 CHUÔNG ĐANG BỊ KHÓA';
    notice.className = 'mt-4 text-xs text-slate-400 font-medium';
  } else if (hasBuzzed) {
    btn.disabled = true;
    notice.innerText = '✅ BẠN ĐÃ BẤM CHUÔNG (Chờ lượt tiếp theo)';
    notice.className = 'mt-4 text-xs text-amber-400 font-bold';
  } else {
    btn.disabled = false;
    notice.innerText = '🔔 CHUÔNG ĐÃ MỞ - HÃY BẤM NGAY!';
    notice.className = 'mt-4 text-xs text-emerald-400 font-bold animate-pulse';
  }
}

function updateChatUI() {
  const input = document.getElementById('answerInput');
  const btn = document.getElementById('sendBtn');
  const notice = document.getElementById('chatNotice');
  if (isMuteChat) {
    if (input) input.disabled = true;
    if (btn) btn.disabled = true;
    if (notice) notice.innerText = '🔇 Bạn đã bị cấm gửi câu trả lời';
  } else {
    if (input) input.disabled = false;
    if (btn) btn.disabled = false;
    if (notice) notice.innerText = '';
  }
}

// 6. THAO TÁC BẤM CHUÔNG (Chỉ cho phép bấm khi chưa từng bấm lượt này)
function triggerBuzzer() {
  if (isLocked || isMuteBuzzer || hasBuzzed) return;

  db.ref(`buzzers/${playerId}`).set({
    name: playerName,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
}

function submitAnswer() {
  const input = document.getElementById('answerInput');
  const text = input ? input.value.trim() : '';
  if (!text || isMuteChat) return;
  db.ref('answers').push({
    playerId: playerId,
    name: playerName,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  input.value = '';
}

// 7. BẢNG CHUÔNG REALTIME & PHÁT ÂM THANH TOÀN HỆ THỐNG
let playerFirstLoad = true;
let playerPrevBuzzerCount = 0;

db.ref('buzzers').orderByChild('timestamp').on('value', (snapshot) => {
  const queue = document.getElementById('buzzerQueue');
  const currentCount = snapshot.numChildren();

  // Kiểm tra xem ID của mình đã có trên Firebase chưa
  hasBuzzed = snapshot.exists() && snapshot.hasChild(playerId);
  updateBuzzerUI();

  if (!queue) return;
  queue.innerHTML = '';

  if (!snapshot.exists()) {
    queue.innerHTML = '<li class="text-slate-500 italic text-xs">Chưa có ai bấm...</li>';
    playerPrevBuzzerCount = 0;
    playerFirstLoad = false;
    return;
  }

  // PHÁT ÂM THANH CHUÔNG CHO TẤT CẢ NGƯỜI CHƠI KHI CÓ NGƯỜI MỚI BẤM
  if (!playerFirstLoad && currentCount > playerPrevBuzzerCount) {
    buzzerAudio.currentTime = 0;
    buzzerAudio.play().catch(e => console.warn('Cần click vị trí bất kỳ trên màn hình để bật âm thanh:', e));
  }
  playerPrevBuzzerCount = currentCount;
  playerFirstLoad = false;

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

// 8. Nhật ký câu trả lời cá nhân
db.ref('answers').orderByChild('timestamp').on('value', (snapshot) => {
  const stream = document.getElementById('answerStream');
  if (!stream) return;
  stream.innerHTML = '';
  let count = 0;
  snapshot.forEach((child) => {
    const data = child.val();
    if (data.playerId === playerId) {
      count++;
      const item = document.createElement('div');
      item.className = 'p-2 rounded bg-slate-800 text-xs border border-slate-700 text-slate-200';
      item.innerText = data.text;
      stream.prepend(item);
    }
  });
  if (count === 0) stream.innerHTML = '<p class="text-slate-500 italic text-xs">Chưa gửi câu trả lời nào...</p>';
});

function escapeHtml(str) {
  return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
