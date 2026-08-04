let isLocked = true;
const pageLoadTime = Date.now();

// Phát tiếng chuông ở màn hình Admin khi có thí sinh bấm
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

// Lắng nghe tín hiệu chuông Realtime để phát âm thanh ở màn hình Admin
db.ref('buzzers').on('child_added', (snapshot) => {
  const data = snapshot.val();
  if (data && data.timestamp && data.timestamp > pageLoadTime - 2000) {
    playBuzzerSound();
  }
});

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

db.ref('answers').orderByChild('timestamp').on('value', (snapshot) => {
  const list = document.getElementById('adminAnswerList');
  list.innerHTML = '';

  if (!snapshot.exists()) {
    list.innerHTML = '<p class="text-slate-500 italic">Chưa nhận được câu trả lời...</p>';
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
