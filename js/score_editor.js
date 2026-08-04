// Lắng nghe realtime danh sách thí sinh từ Firebase
db.ref('players').on('value', (snapshot) => {
  const container = document.getElementById('playerList');
  if (!container) return;

  container.innerHTML = '';

  if (!snapshot.exists()) {
    container.innerHTML = '<p class="text-slate-500 italic text-center text-sm py-4">Chưa có thí sinh nào trong phòng.</p>';
    return;
  }

  const playersData = snapshot.val();
  const playersList = [];

  Object.keys(playersData).forEach(key => {
    const p = playersData[key];
    if (!p.kicked) {
      playersList.push({ key, ...p });
    }
  });

  // Sắp xếp thứ tự theo thời gian vào phòng
  playersList.sort((a, b) => (a.joinedAt || a.lastOnline || 0) - (b.joinedAt || b.lastOnline || 0));

  if (playersList.length === 0) {
    container.innerHTML = '<p class="text-slate-500 italic text-center text-sm py-4">Chưa có thí sinh nào trong phòng.</p>';
    return;
  }

  const cellLabels = ['B6', 'C6', 'D6', 'E6', 'F6'];

  playersList.forEach((p, idx) => {
    const cellName = cellLabels[idx] || `Cột ${idx + 1}`;
    const currentScore = p.score !== undefined ? p.score : 0;

    const card = document.createElement('div');
    card.className = 'bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-center gap-4';

    card.innerHTML = `
      <div class="w-full sm:w-auto">
        <div class="font-bold text-slate-200 text-base">
          ${escapeHtml(p.name)} 
          <span class="text-xs text-amber-400 font-mono ml-1">(${cellName})</span>
        </div>
        <div class="text-xs text-slate-500 mt-1">
          Điểm hiện tại: <span class="text-amber-400 font-bold text-sm">${currentScore}</span>
        </div>
      </div>

      <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
        <button onclick="adjustScore('${p.key}', ${currentScore - 10})" class="bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 px-3 py-1.5 rounded font-bold text-xs transition">
          -10
        </button>
        <button onclick="adjustScore('${p.key}', ${currentScore + 10})" class="bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded font-bold text-xs transition">
          +10
        </button>
        
        <input type="number" id="input_${p.key}" value="${currentScore}" class="w-20 bg-slate-900 border border-slate-700 text-center text-amber-400 font-bold px-2 py-1.5 rounded text-sm focus:outline-none focus:border-amber-500" />
        
        <button onclick="saveScore('${p.key}')" class="bg-amber-500 hover:bg-amber-600 text-slate-950 px-3 py-1.5 rounded font-bold text-xs transition">
          Lưu
        </button>
      </div>
    `;

    container.appendChild(card);
  });
});

// Hàm cộng/trừ điểm nhanh
function adjustScore(playerId, newScore) {
  db.ref(`players/${playerId}/score`).set(Number(newScore));
}

// Hàm lưu điểm nhập từ ô input
function saveScore(playerId) {
  const input = document.getElementById(`input_${playerId}`);
  if (!input) return;
  const newScore = Number(input.value);
  if (isNaN(newScore)) {
    alert('Vui lòng nhập số hợp lệ!');
    return;
  }
  db.ref(`players/${playerId}/score`).set(newScore);
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
