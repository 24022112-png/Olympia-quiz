// js/player.js

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

      // Kiểm tra giới hạn số người
      if (players[playerId] === undefined && maxPlayers > 0 && Object.keys(players).length >= maxPlayers) {
        alert(`Phòng đã đầy! Giới hạn tối đa là ${maxPlayers} thí sinh.`);
        return;
      }

      // Đăng ký thông tin mới
      db.ref(`players/${playerId}`).update({
        name: playerName,
        lastOnline: Date.now(),
        kicked: false
      });

      if (!players[playerId] || players[playerId].score === undefined) {
        db.ref(`players/${playerId}/score`).set(0);
      }

      // Bắt đầu lắng nghe trạng thái cá nhân
      listenToPlayerState();
    });
  });
}

// 3. Lắng nghe Trạng thái Thí Sinh (Đuổi, Điểm, Cấm)
function listenToPlayerState() {
  db.ref(`players/${playerId}`).off(); // Tắt listener cũ nếu có

  db.ref(`players/${playerId}`).on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) return;

    // XỬ LÝ ĐUỔI THÍ SINH (KICK 1 LẦN - VĂNG VỀ MÀN HÌNH NHẬP TÊN)
    if (data.kicked === true) {
      // Tắt kết nối cũ & dọn dẹp data trên Firebase
      db.ref(`players/${playerId}`).off();
      db.ref(`players/${playerId}`).remove();

      // Xóa thông tin cũ khỏi bộ nhớ trình duyệt
      localStorage.removeItem('olympia_player_id');
      localStorage.removeItem('olympia_player_name');

      // Tạo ID mới tinh cho lần chơi tiếp theo
      playerId = 'player_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('olympia_player_id', playerId);
      playerName = '';

      // Cập nhật lại giao diện
      if (userDisplay) userDisplay.innerText = 'Chưa nhập tên';
      if (playerNameDisplay) playerNameDisplay.innerText = 'CHƯA NHẬP TÊN';
      if (playerScoreDisplay) playerScoreDisplay.innerText = '0';

      // Thông báo và mở Modal đặt tên
      alert('Bạn đã bị Admin mời ra khỏi phòng thi!');
      const modal = document.getElementById('nicknameModal');
      const input = document.getElementById('nicknameInput');
      if (input) input.value = '';
      if (modal) modal.classList.remove('hidden');
      return;
    }

    isMuteBuzzer = data.muteBuzzer ?? false;
    isMuteChat = data.muteChat ?? false;

    // Cập nhật điểm số
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

// 5. Theo dõi trạng thái Khóa/Mở chuông từ Admin
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

// 6. Thao tác Chuông & Trả lời
function triggerBuzzer() {
  if (isLocked || isMuteBuzzer) return;
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

// 7. ÂM THANH & Bảng Bấm Chuông Realtime
let playerFirstLoad = true;
let playerPrevBuzzerCount = 0;

db.ref('buzzers').orderByChild('timestamp').on('value', (snapshot) => {
  const queue = document.getElementById('buzzerQueue');
  if (!queue) return;
  queue.innerHTML = '';
  const currentCount = snapshot.numChildren();

  if (!snapshot.exists()) {
    queue.innerHTML = '<li class="text-slate-500 italic text-xs">Chưa có ai bấm...</li>';
    playerPrevBuzzerCount = 0;
    playerFirstLoad = false;
    return;
  }

  if (!playerFirstLoad && currentCount > playerPrevBuzzerCount) {
    new Audio('sound/buzzer.mp3').play().catch(e => console.warn('Bị chặn Audio:', e));
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
