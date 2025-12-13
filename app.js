// ==========================================================
// 1. CẤU HÌNH FIREBASE
// ==========================================================
var firebaseConfig = {
  apiKey: "AIzaSyDE1uDPk041Iaskaym5KYjF-L_DEapChNM",
  authDomain: "phuong-va-nhung-nguoi-ban.firebaseapp.com",
  databaseURL: "https://phuong-va-nhung-nguoi-ban-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "phuong-va-nhung-nguoi-ban",
  storageBucket: "phuong-va-nhung-nguoi-ban.firebasestorage.app",
  messagingSenderId: "324292791840",
  appId: "1:324292791840:web:68feb5c43e71a2b7bb7645",
};

firebase.initializeApp(firebaseConfig);
var db = firebase.database();

// ==========================================================
// 2. BIẾN TOÀN CỤC & STATE
// ==========================================================
var telemetryData = [];
var speedChartInstance = null;
var tempChartInstance = null;

// Biến chứa kiến thức 
var KNOWLEDGE_BASE = "Đang tải dữ liệu...";

// ==========================================================
// 3. HÀM NẠP DỮ LIỆU TRAINING (TỪ FILE TXT)
// ==========================================================
async function loadTrainingData() {
  try {
    // Gọi file trong thư mục data
    const response = await fetch('Train/Train.txt');
    
    if (response.ok) {
      KNOWLEDGE_BASE = await response.text();
      console.log("✅ Đã nạp thành công dữ liệu!");
    } else {
      console.warn("⚠️ Không tìm thấy file ");
      KNOWLEDGE_BASE = "Không có dữ liệu luật. Hãy trả lời dựa trên kiến thức chung.";
    }
  } catch (e) {
    console.error("❌ Lỗi khi đọc file dữ liệu:", e);
    console.log("👉 Lưu ý: Bạn cần chạy bằng Live Server để đọc được file.");
  }
}

// ==========================================================
// 4. HÀM SOS KHẨN CẤP
// ==========================================================
function triggerSOS() {
  var ok = confirm("XÁC NHẬN KHẨN CẤP:\nBạn muốn gửi yêu cầu cứu hộ và gọi điện ngay lập tức?");
  if (!ok) return;

  var latest = telemetryData.length > 0 ? telemetryData[telemetryData.length - 1] : {};

  try {
    db.ref("sosRequests").push({
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      note: "Yêu cầu khẩn cấp (Dashboard/Chat)",
      lat: latest.lat != null ? latest.lat : null,
      lng: latest.lng != null ? latest.lng : null,
    });
    console.log("Đã gửi tín hiệu SOS lên Firebase");
  } catch (e) {
    console.warn("Log SOS lỗi:", e);
  }
  window.location.href = "tel:0972723011";
}

// ==========================================================
// 5. TIỆN ÍCH: ĐỒNG HỒ & XỬ LÝ CHUỖI
// ==========================================================
function updateClock() {
  var now = new Date();
  var pad = (n) => (n < 10 ? "0" + n : "" + n);
  var str = pad(now.getDate()) + "/" + pad(now.getMonth() + 1) + "/" + now.getFullYear() +
    " " + pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
  var el = document.getElementById("realtime-clock");
  if (el) el.textContent = str;
}

function removeVietnameseTones(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

// ==========================================================
// 6. PHÂN LOẠI TRẠNG THÁI XE
// ==========================================================
function classifySpeed(speed) {
  if (speed == null) return null;
  if (speed <= 60) return { level: "safe", text: "An toàn", className: "status-safe" };
  if (speed <= 90) return { level: "warning", text: "Cao (cần chú ý)", className: "status-warning" };
  return { level: "danger", text: "Quá cao", className: "status-danger" };
}

function classifyTilt(tilt) {
  if (tilt == null) return null;
  var abs = Math.abs(tilt);
  if (abs < 25) return { level: "safe", text: "Trong ngưỡng an toàn", className: "status-safe" };
  if (abs <= 40) return { level: "warning", text: "Nghiêng nhiều – rủi ro trượt", className: "status-warning" };
  return { level: "danger", text: "Nghiêng quá lớn – nguy hiểm", className: "status-danger" };
}

function classifyTemp(temp) {
  if (temp == null) return null;
  if (temp < 90) return { level: "safe", badge: "AN TOÀN", text: "Nhiệt độ ổn định.", className: "status-safe" };
  if (temp <= 110) return { level: "warning", badge: "CẢNH BÁO", text: "Nhiệt độ cao, nên giảm tải.", className: "status-warning" };
  return { level: "danger", badge: "QUÁ NHIỆT", text: "Dừng xe ngay lập tức!", className: "status-danger" };
}

function classifyRecordOverall(d) {
  var s = classifySpeed(d.speed);
  var ti = classifyTilt(d.tilt);
  var te = classifyTemp(d.temp);
  var order = { safe: 0, warning: 1, danger: 2 };
  var best = null;
  [s, ti, te].forEach((c) => {
    if (!c) return;
    if (!best || order[c.level] > order[best.level]) best = c;
  });
  if (!best) return null;
  if (best.level === "safe") return { key: "safe", label: "An toàn", className: "status-safe" };
  if (best.level === "warning") return { key: "warning", label: "Cảnh báo", className: "status-warning" };
  return { key: "danger", label: "Nguy hiểm", className: "status-danger" };
}

// ==========================================================
// 7. RENDER GIAO DIỆN
// ==========================================================
function renderDashboard() {
  if (!telemetryData.length) return;
  var latest = telemetryData[telemetryData.length - 1];
  var speed = latest.speed; var tilt = latest.tilt; var temp = latest.temp;

  // Speed
  var speedEl = document.getElementById("speed-current-detail");
  var speedBar = document.getElementById("speed-bar-fill");
  if (speedEl) speedEl.textContent = speed != null ? speed : "--";
  if (speedBar) {
    var pct = speed != null ? Math.max(0, Math.min(100, (speed / 120) * 100)) : 0;
    speedBar.style.width = pct + "%";
  }

  // Tilt
  var tiltEl = document.getElementById("tilt-current");
  var tiltBike = document.getElementById("tilt-bike");
  var tiltSt = document.getElementById("tilt-status");
  if (tiltEl) tiltEl.textContent = tilt != null ? tilt.toFixed(1) + "°" : "--°";
  if (tiltBike && tilt != null) tiltBike.style.transform = "rotate(" + -tilt + "deg)";
  if (tiltSt) {
    let txt = "Đang chờ dữ liệu";
    if (tilt != null) {
      let abs = Math.abs(tilt);
      txt = abs < 5 ? "Xe đi thẳng" : abs < 20 ? "Nghiêng nhẹ" : "Nghiêng nhiều";
    }
    tiltSt.textContent = txt;
  }

  // Temp
  var tempEl = document.getElementById("temp-current-detail");
  var tempBg = document.getElementById("temp-badge");
  var tempTxt = document.getElementById("temp-status-text");
  if (tempEl) tempEl.textContent = temp != null ? temp : "--";
  var tCls = classifyTemp(temp);
  if (tCls && tempBg && tempTxt) {
    tempBg.textContent = tCls.badge;
    tempTxt.textContent = tCls.text;
    tempTxt.className = "temp-status-text " + tCls.className;
  }

  // Summary
  function setSum(idV, idS, val, cls) {
    var v = document.getElementById(idV); var s = document.getElementById(idS);
    if (v) v.textContent = val;
    if (s) {
      s.innerHTML = "";
      if (cls) {
        var sp = document.createElement("span");
        sp.className = "status-pill " + cls.className;
        sp.textContent = cls.text;
        s.appendChild(sp);
      } else s.textContent = "--";
    }
  }
  setSum("summary-speed-value", "summary-speed-status", speed ? speed + " km/h" : "--", classifySpeed(speed));
  setSum("summary-tilt-value", "summary-tilt-status", tilt ? tilt.toFixed(1) + "°" : "--", classifyTilt(tilt));
  setSum("summary-temp-value", "summary-temp-status", temp ? temp + " °C" : "--", classifyTemp(temp));
}

function renderHistory(filtered) {
  var data = filtered || telemetryData;
  var body = document.getElementById("history-body");
  var countEl = document.getElementById("history-count");
  if (!body) return;

  body.innerHTML = "";
  var displayData = data.slice().reverse();

  displayData.forEach((d) => {
    var tr = document.createElement("tr");
    var dt = new Date(d.timestamp);
    var timeStr = dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds() + " " + dt.getDate() + "/" + (dt.getMonth() + 1);

    var cols = [timeStr, d.speed || "", d.tilt ? d.tilt.toFixed(1) : "", d.temp || ""];
    cols.forEach(txt => {
      var td = document.createElement("td"); td.textContent = txt; tr.appendChild(td);
    });

    var tdSt = document.createElement("td");
    var st = classifyRecordOverall(d);
    if (st) {
      var sp = document.createElement("span"); sp.className = "status-pill " + st.className; sp.textContent = st.label; tdSt.appendChild(sp);
    }
    tr.appendChild(tdSt);
    body.appendChild(tr);
  });
  if (countEl) countEl.textContent = "(" + data.length + " bản ghi)";
}

function applyHistoryFilter() {
    if (!telemetryData.length) { renderHistory([]); return; }
    renderHistory(telemetryData); 
}

// ==========================================================
// 8. BIỂU ĐỒ & FIREBASE
// ==========================================================
function initCharts() {
  var opts = { responsive: true, maintainAspectRatio: false, animation: { duration: 1000 }, scales: { y: { beginAtZero: true } } };
  var ctxS = document.getElementById("speed-chart-canvas");
  if (ctxS) speedChartInstance = new Chart(ctxS, { type: 'line', data: { labels: [], datasets: [{ label: 'Vận tốc', data: [], borderColor: 'blue', fill: true }] }, options: opts });
  var ctxT = document.getElementById("temp-chart-canvas");
  if (ctxT) tempChartInstance = new Chart(ctxT, { type: 'line', data: { labels: [], datasets: [{ label: 'Nhiệt độ', data: [], borderColor: 'red', fill: true }] }, options: opts });
}

function updateCharts() {
  if (!telemetryData.length) return;
  if (!speedChartInstance || !tempChartInstance) initCharts();
  var slice = telemetryData.slice(-15);
  var labels = slice.map(d => { var dt = new Date(d.timestamp); return dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds(); });
  if (speedChartInstance) { speedChartInstance.data.labels = labels; speedChartInstance.data.datasets[0].data = slice.map(d => d.speed); speedChartInstance.update(); }
  if (tempChartInstance) { tempChartInstance.data.labels = labels; tempChartInstance.data.datasets[0].data = slice.map(d => d.temp); tempChartInstance.update(); }
}

function subscribeFirebase() {
  var ref = db.ref("telemetry").limitToLast(100);
  ref.on("value", (snapshot) => {
    var arr = [];
    snapshot.forEach((child) => {
      var val = child.val();
      if (!val) return;
      arr.push({ timestamp: val.timestamp || Date.now(), speed: Number(val.speed), tilt: Number(val.tilt), temp: Number(val.temp), lat: val.lat, lng: val.lng });
    });
    arr.sort((a, b) => a.timestamp - b.timestamp);
    telemetryData = arr;
    renderDashboard(); updateCharts(); renderHistory();
  });
}

// ==========================================================
// 9. CHATBOT DÙNG COHERE AI (REAL AI)
// ==========================================================

// 👇👇👇 DÁN KEY COHERE CỦA BẠN VÀO ĐÂY 👇👇👇
const COHERE_API_KEY = "zjA5g3ebprM9is8UbVW7EGhnq9nzhqlpu9jFHaPf"; 

const BOT_PERSONA = `Bạn là trợ lý xe máy thông minh, thân thiện và hiểu biết sâu rộng về luật giao thông Việt Nam cũng như các vấn đề liên quan đến xe máy. Bạn giúp người dùng trả lời các câu hỏi về luật giao thông, bảo dưỡng xe máy, và cung cấp lời khuyên an toàn khi lái xe. Bạn luôn giữ thái độ lịch sự, chuyên nghiệp và tận tâm hỗ trợ người dùng.`;

function setupChat() {
  var els = {
    btn: document.getElementById("chatbox-button"),
    box: document.getElementById("chatbox"),
    toggle: document.getElementById("chatbox-toggle"),
    clear: document.getElementById("chatbox-clear"),
    msgs: document.getElementById("chatbox-messages"),
    input: document.getElementById("chatbox-input"),
    send: document.getElementById("chatbox-send")
  };
  if (!els.btn || !els.box) return;

  els.btn.onclick = () => { els.box.style.display = "flex"; els.btn.style.display = "none"; };
  els.toggle.onclick = () => { els.box.style.display = "none"; els.btn.style.display = "block"; };
  if (els.clear) els.clear.onclick = () => { if (confirm("Xóa lịch sử?")) db.ref("chatMessages").remove().then(() => els.msgs.innerHTML = ""); };

  const send = () => sendChatMessage(els.input, els.msgs);
  els.send.onclick = send;
  els.input.onkeypress = (e) => { if (e.key === "Enter") { e.preventDefault(); send(); }};

  db.ref("chatMessages").limitToLast(50).on("child_added", (snap) => { var msg = snap.val(); if (msg) addMessageUI(msg, els.msgs); });
}

async function sendChatMessage(input, container) {
  var text = input.value.trim();
  if (!text) return;
  input.value = "";
  db.ref("chatMessages").push({ sender: "user", text: text, timestamp: firebase.database.ServerValue.TIMESTAMP });

  if (isSOSRequest(text)) {
      setTimeout(() => { db.ref("chatMessages").push({ sender: "bot", text: "🚨 CẢNH BÁO SOS: Bấm nút gọi cứu hộ bên dưới!", isSOS: true, timestamp: firebase.database.ServerValue.TIMESTAMP }); }, 500);
      return;
  }

  try {
      const reply = await callCohereAI(text);
      db.ref("chatMessages").push({ sender: "bot", text: reply, isSOS: false, timestamp: firebase.database.ServerValue.TIMESTAMP });
  } catch (err) {
      console.error(err);
      db.ref("chatMessages").push({ sender: "bot", text: "Lỗi kết nối AI: " + err.message, timestamp: firebase.database.ServerValue.TIMESTAMP });
  }
}

function isSOSRequest(text) {
    const t = removeVietnameseTones(text).toLowerCase();
    return t.includes("sos") || t.includes("cuu ho") || t.includes("tai nan");
}

async function callCohereAI(userMessage) {
    var latest = telemetryData.length > 0 ? telemetryData[telemetryData.length - 1] : {};

    // Prompt kết hợp Dữ liệu xe + Kiến thức từ file
    const systemInstruction = `
      ${BOT_PERSONA}
      
      === THÔNG TIN TỪ CẢM BIẾN XE ===
      - Vận tốc: ${latest.speed || 0} km/h
      - Nhiệt độ: ${latest.temp || 0} độ C
      - Góc nghiêng: ${latest.tilt ? latest.tilt.toFixed(1) : 0} độ
      
      === CƠ SỞ DỮ LIỆU KIẾN THỨC ===
      ${KNOWLEDGE_BASE}
      
      NHIỆM VỤ:
      1. Trả lời câu hỏi người dùng dựa trên Kiến thức và Thông tin cảm biến.
      2. Nếu thông số xe nguy hiểm, phải cảnh báo ngay.
      3. Ngắn gọn, súc tích.
    `;

    const url = "https://api.cohere.ai/v1/chat";
    
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${COHERE_API_KEY}`,
                "Content-Type": "application/json",
                "X-Client-Name": "MotoApp"
            },
            body: JSON.stringify({
                model: "command-r-08-2024", // ⚠️ Model mới nhất (đã fix lỗi command-r bị xóa)
                message: userMessage,
                preamble: systemInstruction,
                temperature: 0.3
            })
        });

        const data = await response.json();
        if (data.text) return data.text;
        else throw new Error(data.message || "Cohere không phản hồi");
    } catch (err) {
        throw err;
    }
}

function addMessageUI(msg, container) {
  var div = document.createElement("div");
  div.className = "chat-message " + (msg.sender === "user" ? "chat-user" : "chat-bot");
  
  var dt = new Date(msg.timestamp);
  var timeStr = dt.getHours() + ":" + (dt.getMinutes()<10?'0':'') + dt.getMinutes();
  
// 1. Tạo phần tên và giờ
  var meta = document.createElement("div");
  meta.className = "chat-meta";
  meta.textContent = (msg.sender === "user" ? "Bạn" : "Bot") + " • " + timeStr;
  div.appendChild(meta);

  // 2. Tạo phần nội dung tin nhắn (QUAN TRỌNG: white-space giúp xuống dòng)
  var txt = document.createElement("div");
  txt.style.whiteSpace = "pre-wrap";  // <--- Lệnh này giúp 1. 2. 3. xuống hàng
  txt.style.wordBreak = "break-word"; // Ngắt dòng nếu từ quá dài
  txt.textContent = msg.text;
  div.appendChild(txt);

  // --- KẾT THÚC ĐOẠN CODE MỚI ---  
  if (msg.isSOS) {
      var btn = document.createElement("button");
      btn.className = "chat-sos-btn";
      btn.innerHTML = "📞 GỌI NGAY";
      btn.onclick = () => triggerSOS();
      div.appendChild(btn);
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ==========================================================
// 10. INIT
// ==========================================================
window.addEventListener("DOMContentLoaded", function () {
  var navs = document.querySelectorAll(".nav-item");
  var views = document.querySelectorAll(".view");
  navs.forEach(btn => {
      btn.onclick = () => {
          var target = btn.dataset.view;
          views.forEach(v => v.classList.toggle("active", v.dataset.view === target));
          navs.forEach(b => b.classList.toggle("active", b === btn));
          if (target === "dashboard") renderDashboard();
          if (target === "history") renderHistory();
      };
  });

  var apply = document.getElementById("history-apply");
  if (apply) apply.onclick = applyHistoryFilter;
  var sos = document.getElementById("sos-button");
  if (sos) sos.onclick = triggerSOS;

  updateClock(); setInterval(updateClock, 1000);
  
  // BẮT ĐẦU NẠP DỮ LIỆU & CHẠY APP
  loadTrainingData(); 
  setupChat();
  subscribeFirebase();
});