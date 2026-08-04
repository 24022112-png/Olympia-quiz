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
let maxPlayers = 0; // 0: không giới hạn
let currentPlayersCount = 0;
let isPlayerRegistered = false;
const pageLoadTime = Date.now();

// Link Google Sheet dạng CSV
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1ngiCqrQWG_2Mz93NtBoRP2bDm3DtYmZSX0VnlOqMplQ/export?format=csv&gid=0';

// Phát âm thanh chuông
function playBuzzerSound() {
  const audio = new Audio('sound/buzzer.mp3');
  audio.currentTime = 0;
  audio.play().catch(e => console.log("Không thể phát âm thanh:", e));
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

// Lắng nghe cấu hình giới hạn số người chơi từ Admin
db.ref('settings/maxPlayers').on('value', (snapshot) => {
  maxPlayers = snapshot.val() || 0;
  updateMaxPlayerNotice();
});

function updateMaxPlayerNotice() {
  const notice = document.getElementById('maxPlayerNotice');
  if (notice) {
    notice.innerText = maxPlayers > 0 ? `(Giới hạn: ${currentPlayersCount}/${maxPlayers} người)` : '';
  }
}

if (nickname) {
  document.getElementById('nicknameModal').classList.add('hidden');
  document.getElementById('userDisplay').innerText = nickname;
  registerPlayerToFirebase();
}

function saveNickname() {
  const input = document.getElementById('nicknameInput').value.trim();
  if (!input) return alert('Vui lòng nhập biệt danh!');
  
  // Kiểm tra nếu đã đủ giới hạn người chơi và đây là người chơi mới
  if (maxPlayers > 0 && currentPlayersCount >= maxPlayers && !isPlayerRegistered) {
    return alert(`Phòng đã đủ số lượng người chơi tối đa (${maxPlayers} người)!`);
  }

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

// Lắng nghe toàn bộ thí sinh để đếm số lượng
db.ref('players').on('value', (snapshot) => {
  if (snapshot.exists()) {
    const players = snapshot.val();
    currentPlayersCount = Object.keys(players).length;
    isPlayerRegistered = !!players[playerId];
  } else {
    currentPlayersCount = 0;
    isPlayerRegistered = false;
  }
  updateMaxPlayerNotice();
});

// Lắng nghe trạng thái riêng của thí sinh này
db.ref('players/' + playerId).on('value', (snapshot) => {
  if (!snapshot.exists()) return;
  const data = snapshot.val();

  isKicked = data.kicked ?? false;
  isMuteBuzzer = data.muteBuzzer ?? false;
  isMuteChat = data.muteChat ?? false;

  if (isKicked) {
    document.getElementById('kickedModal').classList.remove('hidden');
    document.getElementById('buzzerBtn').disabled = true;
    document.getElementById('sendBtn').disabled = true;
    return;
  } else {
    document.getElementById('kickedModal').classList.add('hidden');
  }

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

// Lắng nghe tín hiệu chuông Realtime để phát âm thanh
db.ref('buzzers').on('child_added', (snapshot) => {
  const data = snapshot.val();
  if (data && data.timestamp && data.timestamp > pageLoadTime - 2000) {
    playBuzzerSound();
  }
});

// Thứ tự bấm chuông (CÔNG KHAI)
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

// Lắng nghe tin nhắn cá nhân
db.ref('answers').orderByChild('timestamp').on('value', (snapshot) => {
  const list = document.getElementById('answerStream');
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

// --- CHỨC NĂNG BẢNG XẾP HẠNG TỪ GOOGLE SHEET ---
async function loadLeaderboard() {
  const container = document.getElementById('leaderboardBody');
  if (!container) return;

  try {
    const res = await fetch(SHEET_CSV_URL + '&t=' + Date.now());
    const csvText = await res.text();
    
    // Tách dòng và tách ô CSV
    const rows = csvText.split('\n').map(row => 
      row.split(',').map(cell => cell.replace(/^"(.*)"$/, '$1').trim())
    );

    if (rows.length < 6) return;

    const headers = rows[0]; // Nhóm 1, Nhóm 2,...
    const teams = [];

    for (let col = 1; col < headers.length; col++) {
      const name = headers[col];
      if (!name) continue;

      const khoiDong = parseInt(rows[1][col]) || 0;
      const vcnv = parseInt(rows[2][col]) || 0;
      const tangToc = parseInt(rows[3][col]) || 0;
      const veDich = parseInt(rows[4][col]) || 0;
      const tongDiem = parseInt(rows[5][col]) || 0;

      teams.push({ name, khoiDong, vcnv, tangToc, veDich, tongDiem });
    }

    // Sắp xếp giảm dần theo Tổng điểm
    teams.sort((a, b) => b.tongDiem - a.tongDiem);

    container.innerHTML = '';
    teams.forEach((team, index) => {
      const isTop1 = index === 0;
      const tr = document.createElement('tr');
      tr.className = isTop1 
        ? 'bg-yellow-950/60 border-b border-yellow-500/50 text-yellow-300 font-bold' 
        : 'border-b border-slate-800 hover:bg-slate-800/50';

      tr.innerHTML = `
        <td class="p-2 text-center">${index + 1} ${isTop1 ? '👑' : ''}</td>
        <td class="p-2 font-semibold text-left">${team.name}</td>
        <td class="p-2 text-center text-slate-300">${team.khoiDong}</td>
        <td class="p-2 text-center text-slate-300">${team.vcnv}</td>
        <td class="p-2 text-center text-slate-300">${team.tangToc}</td>
        <td class="p-2 text-center text-slate-300">${team.veDich}</td>
        <td class="p-2 text-center font-bold text-emerald-400 text-base">${team.tongDiem}</td>
      `;
      container.appendChild(tr);
    });
  } catch (err) {
    console.error("Lỗi cập nhật bảng điểm:", err);
  }
}

// Tự động tải bảng điểm mỗi 10 giây
loadLeaderboard();
setInterval(loadLeaderboard, 10000);
