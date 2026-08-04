// Trạng thái của 5 ô miếng ghép
const tileStates = {
  1: false,
  2: false,
  3: false,
  4: false,
  5: false
};

// Hàm lật / đóng từng ô miếng ghép
function toggleTile(tileNumber) {
  tileStates[tileNumber] = !tileStates[tileNumber];
  const tileEl = document.getElementById(`tile-${tileNumber}`);
  if (!tileEl) return;

  if (tileStates[tileNumber]) {
    tileEl.classList.add('tile-open');
  } else {
    tileEl.classList.remove('tile-open');
  }
}

// Mở tất cả các ô
function openAllTiles() {
  for (let i = 1; i <= 5; i++) {
    tileStates[i] = true;
    const tileEl = document.getElementById(`tile-${i}`);
    if (tileEl) tileEl.classList.add('tile-open');
  }
}

// Đóng tất cả các ô
function resetAllTiles() {
  for (let i = 1; i <= 5; i++) {
    tileStates[i] = false;
    const tileEl = document.getElementById(`tile-${i}`);
    if (tileEl) tileEl.classList.remove('tile-open');
  }
}

// Thay đổi ảnh chướng ngại vật bằng URL
function changeImageByUrl() {
  const input = document.getElementById('imgUrlInput');
  if (!input || !input.value.trim()) {
    alert('Vui lòng nhập đường dẫn URL ảnh!');
    return;
  }
  const img = document.getElementById('obstacleImg');
  if (img) {
    img.src = input.value.trim();
    resetAllTiles();
  }
}

// Thay đổi ảnh chướng ngại vật bằng file từ máy tính
function uploadLocalImage(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = document.getElementById('obstacleImg');
    if (img) {
      img.src = e.target.result;
      resetAllTiles();
    }
  };
  reader.readAsDataURL(file);
}
