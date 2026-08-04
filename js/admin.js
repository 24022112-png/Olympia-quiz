// Gọi API xóa cột trên Google Sheet
async function removePlayerFromGoogleSheet(name) {
  try {
    await fetch(webAppUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'removePlayer',
        playerName: name
      })
    });
    // Tải lại bảng điểm trên Admin sau 1.5 giây
    setTimeout(fetchSheetData, 1500);
  } catch (e) {
    console.error("Lỗi xóa cột trên Google Sheet:", e);
  }
}

// Hàm Đuổi thí sinh & xóa cột trên Sheet
function kickPlayer(pId) {
  if (confirm('Bạn có chắc muốn ĐUỔI thí sinh này khỏi phòng và XÓA CỘT trên Google Sheet?')) {
    db.ref(`players/${pId}`).once('value', (snapshot) => {
      const pData = snapshot.val();
      if (pData && pData.name) {
        removePlayerFromGoogleSheet(pData.name);
      }
      db.ref(`players/${pId}/kicked`).set(true);
    });
  }
}
