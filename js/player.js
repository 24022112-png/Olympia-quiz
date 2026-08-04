let nickname = localStorage.getItem('olympia_nickname') || '';
let isLocked = true;

if (nickname) {
  document.getElementById('nicknameModal').classList.add('hidden');
  document.getElementById('userDisplay').innerText = nickname;
}

function saveNickname() {
  const input = document.getElementById('nicknameInput').value.trim();
  if (!input) return alert('Vui lòng nhập biệt danh!');
  nickname = input;
  localStorage.setItem('olympia_nickname', nickname);
  document.getElementById('userDisplay').innerText = nickname;
  document.getElementById('nicknameModal').classList.add('hidden');
}

function changeNickname() {
  localStorage.removeItem('olympia_nickname');
  document.getElementById('nicknameModal').classList.remove('hidden');
}

// Bấm chuông
function triggerBuzzer() {
  if (isLocked) return alert('Chuông đang bị khóa bởi Admin!');
  if (!nickname) return;

  db.ref('buzzers').push({
    name: nickname,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
}

// Gửi câu trả lời
function submitAnswer() {
  const text = document.getElementById('answerInput').value.trim();
  if (!text) return alert('Vui lòng nhập nội dung câu trả lời!');
  if (!nickname) return;

  db.ref('answers').push({
    name: nickname,
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP
  });
  document.getElementById('answerInput').value = '';
}

// Trạng thái Khóa / Mở Chuông
db.ref('settings/locked').on('value', (snapshot) => {
  isLocked = snapshot.val() ?? true;
  const btn = document.getElementById('buzzerBtn');
  const notice = document.getElementById('buzzerNotice');
  btn.disabled = isLocked;
  notice.innerText = isLocked ? 'Chuông hiện đang bị KHÓA' : 'Chuông SẴN SÀNG! Bấm ngay!';
});

// Sắp xếp thứ tự bấm chuông theo thời gian
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

// Sắp xếp đáp án theo thời gian gửi
db.ref('answers').orderByChild('timestamp').on('value', (snapshot) => {
  const list = document.getElementById('answerStream');
  list.innerHTML = '';

  if (!snapshot.exists()) {
    list.innerHTML = '<p class="text-slate-500 italic">Chưa có câu trả lời nào...</p>';
    return;
  }

  snapshot.forEach((child) => {
    const data = child.val();
    const timeStr = new Date(data.timestamp).toLocaleTimeString();
    const item = document.createElement('div');
    item.className = 'p-2 rounded bg-slate-800 border border-slate-700 space-y-1';
    item.innerHTML = `
      <div class="flex justify-between text-xs">
        <span class="font-bold text-yellow-400">${data.name}</span>
        <span class="text-slate-400 font-mono">${timeStr}</span>
      </div>
      <div class="text-slate-100 font-medium">${data.text}</div>
    `;
    list.appendChild(item);
  });
});
