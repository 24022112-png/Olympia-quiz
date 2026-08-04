// Tạo hoặc lấy Player ID duy nhất cho thiết bị
let playerId = localStorage.getItem('olympia_player_id');
if (!playerId) {
  playerId = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  localStorage.setItem('olympia_player_id', playerId);
}

let nickname = localStorage.getItem('olympia_nickname') || '';
let isLocked = true;
let hasBuzzedInCurrentCycle = false;
let previousLockState = true;
let isMuteBuzzer = false;
let isMuteChat = false;
let isKicked = false;
const pageLoadTime = Date.now();

// Phát tiếng chuông bằng Web Audio API
function playBuzzerSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4);

    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.log("Audio play blocked or unsupported:", e);
  }
}

// Cập nhật thông tin thí sinh lên Firebase
function registerPlayerToFirebase() {
  if (!nickname || !playerId) return;
  db.ref('players/' + playerId).update({
    id: playerId,
    name: nickname,
    lastActive: firebase.database.ServerValue.TIMESTAMP
  });
}

if (nickname) {
  document.getElementById('nicknameModal').classList.add('hidden');
  document.getElementById('userDisplay').innerText = nickname;
  registerPlayerToFirebase();
}

function saveNickname() {
  const input = document.getElementById('nicknameInput').value.trim();
  if (!input) return alert('Vui lòng nhập biệt danh!');
  nickname = input;
  localStorage.setItem('olympia_nickname', nickname);
  document.getElementById('userDisplay').innerText = nickname;
  document.getElementById('nicknameModal').classList.add('hidden');
  registerPlayerToFirebase();
}

function changeNickname() {
  localStorage.removeItem('olympia_nickname');
  document.getElementById('nicknameModal').classList.remove('hidden');
}

// Lắng nghe trạng thái riêng của thí sinh này từ Admin (Chặn/Đuổi)
db.ref('players/' + playerId).on('value', (snapshot) => {
  if (!snapshot.exists()) return;
  const data = snapshot.val();

  isKicked = data.kicked ?? false;
  isMuteBuzzer = data.muteBuzzer ?? false;
  isMuteChat = data.muteChat ?? false;

  // Xử lý khi bị đuổi
  if (isKicked) {
    document.getElementById('kickedModal').classList.remove('hidden');
    document.getElementById('buzzerBtn').disabled = true;
    document.getElementById('sendBtn').disabled = true;
    return;
  } else {
    document.getElementById('kickedModal').classList.add('hidden');
  }

  // Cập nhật trạng thái nút chat
  const sendBtn = document.getElementById('sendBtn');
  const answerInput = document.getElementById('answerInput');
  const chatNotice = document.getElementById('chatNotice');

  if (isMuteChat) {
    sendBtn.disabled = true;
    answerInput.disabled = true;
    chatNotice.innerText = '⚠️ Bạn đã bị Admin CHẶN gửi câu trả lời!';
    chatNotice.className = 'text-xs text-red-400 mt-1 block font-bold';
  } else {
    sendBtn.disabled = false;
    answerInput.disabled = false;
    chatNotice.innerText = '';
  }

  updateBuzzerButtonState();
});

function triggerBuzzer() {
  if (isKicked) return alert('Bạn đã bị Admin đuổi khỏi phòng!');
  if (isMuteBuzzer) return alert('Bạn đang bị Admin CHẶN chuông!');
  if (isLocked) return alert('Chuông đang bị khóa bởi Admin!');
  if (hasBuzzedInCurrentCycle) return alert('Bạn đã bấm chuông trong lượt này rồi!');
  if (!nickname) return;

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
  
  const text = document.getElementById('answerInput').value.trim();
  if (!text) return alert('Vui lòng nhập nội dung câu trả lời!');
  if (!nickname) return;

  db.ref('answers').push({
    playerId: playerId,
    name: nickname,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  document.getElementById('answerInput').value = '';
}

function updateBuzzerButtonState() {
  const btn = document.getElementById('buzzerBtn');
  const notice = document.getElementById('buzzerNotice');

  if (isKicked) {
    btn.disabled = true;
    notice.innerText = 'Bạn đã bị đuổi khỏi phòng';
    notice.className = 'mt-4 text-xs text-red-500 font-bold';
  } else if (isMuteBuzzer) {
    btn.disabled = true;
    notice.innerText = '⚠️ Bạn đã bị Admin CHẶN bấm chuông';
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

// Lắng nghe trạng thái Khóa/Mở từ Admin
db.ref('settings/locked').on('value', (snapshot) => {
  const newLockState = snapshot.val() ?? true;

  if (previousLockState === true && newLockState === false) {
    hasBuzzedInCurrentCycle = false;
  }

  isLocked = newLockState;
  previousLockState = newLockState;
  updateBuzzerButtonState();
});

// Lắng nghe tín hiệu chuông Realtime để phát âm thanh ở tất cả các máy
db.ref('buzzers').on('child_added', (snapshot) => {
  const data = snapshot.val();
  if (data && data.timestamp && data.timestamp > pageLoadTime - 2000) {
    playBuzzerSound();
  }
});

// Thứ tự bấm chuông (CÔNG KHAI CHO TẤT CẢ THÍ SINH)
db.ref('buzzers').orderByChild('timestamp').on('value', (snapshot) => {
  const list = document.getElementById('buzzerQueue');
  list.innerHTML = '';
  
  if (!snapshot.exists()) {
    list.innerHTML = '<li class="text-slate-500 italic">Chưa có ai bấm chuông...</li>';
    return;
  }

  let rank = 1;
  snapshot.forEach((child) => {
    const data = child.val();
    const date = new Date(data.timestamp);
    const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}.${Math.floor(date.getMilliseconds()/100)}`;
    const isMe = data.playerId === playerId;
    const item = document.createElement('li');
    item.className = `flex justify-between items-center p-2 rounded border ${rank === 1 ? 'gold-glow bg-yellow-950/60 border-yellow-400 font-bold' : 'bg-slate-800 border-slate-700'}`;
    item.innerHTML = `
      <span><b class="${rank === 1 ? 'text-yellow-400' : 'text-slate-400'}">#${rank}</b> ${data.name} ${isMe ? '<span class="text-xs bg-yellow-500 text-slate-950 px-1 rounded ml-1 font-bold">BẠN</span>' : ''}</span>
      <span class="text-xs font-mono text-slate-400">${timeStr}</span>
    `;
    list.appendChild(item);
    rank++;
  });
});

// Lắng nghe tin nhắn (CHỈ HIỂN THỊ TIN NHẮN CỦA CHÍNH THÍ SINH NÀY)
db.ref('answers').orderByChild('timestamp').on('value', (snapshot) => {
  const list = document.getElementById('answerStream');
  list.innerHTML = '';

  let myCount = 0;
  if (snapshot.exists()) {
    snapshot.forEach((child) => {
      const data = child.val();
      // CHỈ HIỂN THỊ CÂU TRẢ LỜI CỦA MÌNH
      if (data.playerId === playerId || data.name === nickname) {
        myCount++;
        const timeStr = new Date(data.timestamp).toLocaleTimeString();
        const item = document.createElement('div');
        item.className = 'p-2 rounded bg-slate-800 border border-emerald-500/50 space-y-1';
        item.innerHTML = `
          <div class="flex justify-between text-xs">
            <span class="font-bold text-emerald-400">${data.name} (Bạn)</span>
            <span class="text-slate-400 font-mono">${timeStr}</span>
          </div>
          <div class="text-slate-100 font-medium">${data.text}</div>
        `;
        list.appendChild(item);
      }
    });
  }

  if (myCount === 0) {
    list.innerHTML = '<p class="text-slate-500 italic">Chưa có câu trả lời nào của bạn...</p>';
  }
});
