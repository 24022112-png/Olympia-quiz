// Đường dẫn Web App URL của bạn
const webAppUrl = 'https://script.google.com/macros/s/AKfycbxrZ6zJnqqUvNC7TF3FoYg426heDoP50DINEHOabc445LOT94Yf24PpB2OpKkBi89eD_A/exec';

// 1. TẢI BẢNG ĐIỂM TỪ GOOGLE SHEET
async function fetchSheetData() {
  const tableBody = document.getElementById('leaderboard-body'); // ID thẻ <tbody> hiển thị bảng điểm
  
  try {
    const response = await fetch(webAppUrl);
    if (!response.ok) throw new Error("Không thể kết nối Web App");
    
    const data = await response.json();

    if (data.error) {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Lỗi Apps Script: ${data.error}</td></tr>`;
      return;
    }

    // Sắp xếp thí sinh theo TỔNG ĐIỂM giảm dần (Hạng 1 -> Hạng cuối)
    data.sort((a, b) => b.total - a.total);

    renderLeaderboardUI(data);

  } catch (error) {
    console.error("Lỗi fetchSheetData:", error);
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="4" style="text-align:center; color:#ff4d4d; padding:15px; font-weight:bold;">
            Lỗi kết nối Web App URL! Kiểm tra lại cấu hình Google Apps Script (Thực thi: Tôi, Truy cập: Tất cả mọi người).
          </td>
        </tr>`;
    }
  }
}

// 2. HIỂN THỊ BẢNG XẾP HẠNG
function renderLeaderboardUI(players) {
  const tableBody = document.getElementById('leaderboard-body');
  if (!tableBody) return;

  if (players.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center">Chưa có dữ liệu thí sinh</td></tr>`;
    return;
  }

  let html = '';
  players.forEach((player, index) => {
    html += `
      <tr>
        <td style="text-align: center; font-weight: bold; color: #f1c40f;">#${index + 1}</td>
        <td><strong>${escapeHtml(player.name)}</strong></td>
        <td style="text-align: center; color: #1abc9c;">Cột ${player.colLetter} (Ô ${player.colLetter}1)</td>
        <td style="text-align: center; font-weight: bold; color: #2ecc71;">${player.total}</td>
      </tr>
    `;
  });

  tableBody.innerHTML = html;
}

// 3. XÓA CỘT TRÊN GOOGLE SHEET KHI KICK THÍ SINH
async function removePlayerFromGoogleSheet(playerName) {
  try {
    await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Dùng text/plain để tránh lỗi CORS
      body: JSON.stringify({
        action: 'removePlayer',
        playerName: playerName
      })
    });
    // Tải lại bảng điểm sau 1.5s để thấy kết quả đã dồn cột
    setTimeout(fetchSheetData, 1500);
  } catch (e) {
    console.error("Lỗi xóa cột trên Google Sheet:", e);
  }
}

// 4. HÀM ĐUỔI THÍ SINH (GỌI KHI BẤM NÚT "ĐUỔI" TRÊN ADMIN)
function kickPlayer(playerId) {
  if (confirm('Bạn có chắc muốn ĐUỔI thí sinh này khỏi phòng và XÓA CỘT tương ứng trên Google Sheet?')) {
    // Lấy thông tin thí sinh từ Firebase
    db.ref(`players/${playerId}`).once('value', (snapshot) => {
      const playerData = snapshot.val();
      if (playerData && playerData.name) {
        // Gọi lệnh xóa cột trên Google Sheet
        removePlayerFromGoogleSheet(playerData.name);
      }
      // Khóa thí sinh trên Firebase
      db.ref(`players/${playerId}/kicked`).set(true);
    });
  }
}

// Hàm hỗ trợ chống XSS
function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Tự động tải bảng điểm mỗi 5 giây
setInterval(fetchSheetData, 5000);
fetchSheetData(); // Gọi chạy ngay lần đầu
