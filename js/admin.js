let isLocked = true;

function toggleLock() {
  db.ref('settings/locked').set(!isLocked);
}

db.ref('settings/locked').on('value', (snapshot) => {
  isLocked = snapshot.val() ?? true;
  const btn = document.getElementById('toggleLockBtn');
  btn.innerText = isLocked ? 'MỞ KHÓA CHUÔNG' : 'KHÓA CHUÔNG';
  btn.className = isLocked 
    ? 'py-3 bg-emerald-600 hover:bg-emerald-500 font-extrabold rounded uppercase tracking-wider text-sm transition' 
    : 'py-3 bg-red-600 hover:bg-red-500 font-extrabold rounded uppercase tracking-wider text-sm transition';
});

function clearBuzzers() {
  db.ref('buzzers').remove();
}

function clearAnswers() {
  db.ref('answers').remove();
}

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
