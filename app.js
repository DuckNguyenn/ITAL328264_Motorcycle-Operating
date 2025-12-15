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
// 2. BIẾN TOÀN CỤC
// ==========================================================
var telemetryData = [];
var speedChartInstance = null;
var tempChartInstance = null;
var KNOWLEDGE_BASE = "Đang tải dữ liệu...";

// ==========================================================
// 3. LOGIC XỬ LÝ CHUNG
// ==========================================================
async function loadTrainingData() {
  try {
    const response = await fetch('Train/Train.txt');
    if (response.ok) {
      KNOWLEDGE_BASE = await response.text();
      console.log("✅ Đã nạp dữ liệu AI");
    } else {
      KNOWLEDGE_BASE = "Không có dữ liệu luật. Trả lời dựa trên kiến thức chung.";
    }
  } catch (e) { console.error("Lỗi đọc file:", e); }
}

function triggerSOS() {
  if (!confirm("XÁC NHẬN KHẨN CẤP: Gọi cứu hộ?")) return;
  var latest = telemetryData.slice(-1)[0] || {};
  db.ref("sosRequests").push({
    timestamp: firebase.database.ServerValue.TIMESTAMP,
    note: "Yêu cầu khẩn cấp",
    lat: latest.lat || null,
    lng: latest.lng || null,
  });
  window.location.href = "tel:0972723011";
}

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
// 4. PHÂN LOẠI TRẠNG THÁI (CÓ BADGE)
// ==========================================================
function classifySpeed(speed) {
  if (speed == null) return null;
  if (speed <= 60) return { level: "safe", badge: "AN TOÀN", text: "Tốc độ ổn định", className: "status-safe" };
  if (speed <= 90) return { level: "warning", badge: "CAO", text: "Chú ý giảm tốc", className: "status-warning" };
  return { level: "danger", badge: "NGUY HIỂM", text: "Quá tốc độ cho phép!", className: "status-danger" };
}

function classifyTilt(tilt) {
  if (tilt == null) return null;
  var abs = Math.abs(tilt);
  if (abs < 25) return { level: "safe", badge: "CÂN BẰNG", text: "Xe di chuyển tốt", className: "status-safe" };
  if (abs <= 40) return { level: "warning", badge: "NGHIÊNG", text: "Cẩn thận trơn trượt", className: "status-warning" };
  return { level: "danger", badge: "NGÃ XE", text: "Góc nghiêng quá lớn!", className: "status-danger" };
}

function classifyTemp(temp) {
  if (temp == null) return null;
  if (temp < 90) return { level: "safe", badge: "MÁT MÁY", text: "Nhiệt độ ổn định", className: "status-safe" };
  if (temp <= 110) return { level: "warning", badge: "NÓNG", text: "Cần kiểm tra tản nhiệt", className: "status-warning" };
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
  return best ? { key: best.level, label: best.badge, className: best.className } : null;
}

// ==========================================================
// 5. RENDER DASHBOARD
// ==========================================================
function renderDashboard() {
  if (!telemetryData.length) return;
  var latest = telemetryData[telemetryData.length - 1];
  var speed = latest.speed; var tilt = latest.tilt; var temp = latest.temp;

  // --- VẬN TỐC ---
  document.getElementById("speed-current-detail").textContent = speed != null ? speed : "--";
  var pct = speed != null ? Math.max(0, Math.min(100, (speed / 160) * 100)) : 0;
  var speedBar = document.getElementById("speed-bar-fill");
  if(speedBar) speedBar.style.width = pct + "%";
  
  var sCls = classifySpeed(speed);
  var sBadge = document.getElementById("speed-badge");
  var sText = document.getElementById("speed-status-text");
  if (sCls && sBadge && sText) {
      sBadge.textContent = sCls.badge;
      sBadge.className = "card-badge " + sCls.className;
      sText.textContent = sCls.text;
  }

  // --- GÓC NGHIÊNG ---
  document.getElementById("tilt-current").textContent = tilt != null ? tilt.toFixed(1) + "°" : "--°";
  var tiltBike = document.getElementById("tilt-bike");
  if (tiltBike && tilt != null) tiltBike.style.transform = "rotate(" + -tilt + "deg)";
  
  var tiCls = classifyTilt(tilt);
  var tiBadge = document.getElementById("tilt-badge");
  var tiText = document.getElementById("tilt-status-text");
  if (tiCls && tiBadge && tiText) {
      tiBadge.textContent = tiCls.badge;
      tiBadge.className = "card-badge " + tiCls.className;
      tiText.textContent = tiCls.text;
  }

  // --- NHIỆT ĐỘ ---
  document.getElementById("temp-current-detail").textContent = temp != null ? temp : "--";
  var teCls = classifyTemp(temp);
  var teBadge = document.getElementById("temp-badge");
  var teText = document.getElementById("temp-status-text");
  if (teCls && teBadge && teText) {
      teBadge.textContent = teCls.badge;
      teBadge.className = "card-badge " + teCls.className;
      teText.textContent = teCls.text;
  }

  // --- SUMMARY ---
  function setSum(idV, idS, val, cls) {
    var v = document.getElementById(idV); var s = document.getElementById(idS);
    if (v) v.textContent = val;
    if (s) {
      s.innerHTML = "";
      if (cls) {
        var sp = document.createElement("span");
        sp.className = "status-pill " + cls.className;
        sp.textContent = cls.badge;
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

    [timeStr, d.speed || "", d.tilt ? d.tilt.toFixed(1) : "", d.temp || ""].forEach(txt => {
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

// -----------------------------------------------------
// LỌC DỮ LIỆU
// -----------------------------------------------------
function applyHistoryFilter() {
    var startVal = document.getElementById("filter-start").value;
    var endVal = document.getElementById("filter-end").value;
    var statusVal = document.getElementById("filter-status").value;
    var startDate = startVal ? new Date(startVal).getTime() : 0;
    var endDate = endVal ? new Date(endVal).getTime() : Date.now(); 
  
    var filtered = telemetryData.filter((d) => {
      if (d.timestamp < startDate || d.timestamp > endDate) return false; 
      if (statusVal !== "all") {
        var statusObj = classifyRecordOverall(d);
        if (!statusObj || statusObj.key !== statusVal) return false;
      }
      return true;
    });
  
    if (filtered.length === 0) alert("Không tìm thấy dữ liệu phù hợp!");
    renderHistory(filtered);
}

function resetHistoryFilter() {
    document.getElementById("filter-start").value = "";
    document.getElementById("filter-end").value = "";
    document.getElementById("filter-status").value = "all";
    renderHistory(telemetryData);
}

// ==========================================================
// 6. BIỂU ĐỒ (TRỤC Y CỐ ĐỊNH)
// ==========================================================
function initCharts() {
  var commonPlugins = {
    tooltip: {
      enabled: true, backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleFont: { size: 14, weight: 'bold' }, bodyFont: { size: 14 },
      callbacks: {
        label: function(context) {
          let label = context.dataset.label || '';
          if (label) label += ': ';
          if (context.parsed.y !== null) label += context.parsed.y + (label.includes("Nhiệt độ") ? ' °C' : ' km/h');
          return label;
        }
      }
    }
  };

  var speedOpts = { 
    responsive: true, maintainAspectRatio: false, animation: false, 
    interaction: { mode: 'index', intersect: false }, plugins: commonPlugins,
    scales: { y: { beginAtZero: true, min: 0, max: 160, ticks: { stepSize: 20 } } } 
  };

  var tempOpts = { 
    responsive: true, maintainAspectRatio: false, animation: false, 
    interaction: { mode: 'index', intersect: false }, plugins: commonPlugins,
    scales: { y: { beginAtZero: true, min: 0, max: 150, ticks: { stepSize: 30 } } } 
  };
  
  var ctxS = document.getElementById("speed-chart-canvas");
  if (ctxS) speedChartInstance = new Chart(ctxS, { 
      type: 'line', data: { labels: [], datasets: [{ label: 'Vận tốc', data: [], borderColor: 'blue', backgroundColor: 'rgba(0, 0, 255, 0.1)', fill: true, pointRadius: 4, pointHoverRadius: 6 }] }, options: speedOpts 
  });
  
  var ctxT = document.getElementById("temp-chart-canvas");
  if (ctxT) tempChartInstance = new Chart(ctxT, { 
      type: 'line', data: { labels: [], datasets: [{ label: 'Nhiệt độ', data: [], borderColor: 'red', backgroundColor: 'rgba(255, 0, 0, 0.1)', fill: true, pointRadius: 4, pointHoverRadius: 6 }] }, options: tempOpts 
  });
}

function updateCharts() {
  if (!telemetryData.length) return;
  if (!speedChartInstance || !tempChartInstance) initCharts();
  var slice = telemetryData.slice(-15);
  var labels = slice.map(d => { var dt = new Date(d.timestamp); return dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds(); });
  if (speedChartInstance) { speedChartInstance.data.labels = labels; speedChartInstance.data.datasets[0].data = slice.map(d => d.speed); speedChartInstance.update(); }
  if (tempChartInstance) { tempChartInstance.data.labels = labels; tempChartInstance.data.datasets[0].data = slice.map(d => d.temp); tempChartInstance.update(); }
}

// ==========================================================
// 7. CHATBOT & MQTT
// ==========================================================
const COHERE_API_KEY = "zjA5g3ebprM9is8UbVW7EGhnq9nzhqlpu9jFHaPf";
const BOT_PERSONA = `Bạn là trợ lý xe máy thông minh...`;

function setupChat() {
  var els = { btn: document.getElementById("chatbox-button"), box: document.getElementById("chatbox"), toggle: document.getElementById("chatbox-toggle"), clear: document.getElementById("chatbox-clear"), msgs: document.getElementById("chatbox-messages"), input: document.getElementById("chatbox-input"), send: document.getElementById("chatbox-send") };
  if (!els.btn || !els.box) return;

  els.btn.onclick = () => { els.box.style.display = "flex"; els.btn.style.display = "none"; };
  els.toggle.onclick = () => { els.box.style.display = "none"; els.btn.style.display = "block"; };
  if (els.clear) els.clear.onclick = () => { if (confirm("Xóa lịch sử?")) db.ref("chatMessages").remove().then(() => els.msgs.innerHTML = ""); };
  const send = () => sendChatMessage(els.input, els.msgs);
  els.send.onclick = send;
  els.input.onkeypress = (e) => { if (e.key === "Enter") { e.preventDefault(); send(); } };
  db.ref("chatMessages").limitToLast(50).on("child_added", (snap) => { var msg = snap.val(); if (msg) addMessageUI(msg, els.msgs); });
}

async function sendChatMessage(input, container) {
  var text = input.value.trim();
  if (!text) return;
  input.value = "";
  db.ref("chatMessages").push({ sender: "user", text: text, timestamp: firebase.database.ServerValue.TIMESTAMP });
  if (removeVietnameseTones(text).toLowerCase().includes("sos")) {
    setTimeout(() => { db.ref("chatMessages").push({ sender: "bot", text: "🚨 CẢNH BÁO SOS: Bấm nút gọi cứu hộ bên dưới!", isSOS: true, timestamp: firebase.database.ServerValue.TIMESTAMP }); }, 500); return;
  }
  try {
    const reply = await callCohereAI(text);
    db.ref("chatMessages").push({ sender: "bot", text: reply, isSOS: false, timestamp: firebase.database.ServerValue.TIMESTAMP });
  } catch (err) { db.ref("chatMessages").push({ sender: "bot", text: "Lỗi AI: " + err.message, timestamp: firebase.database.ServerValue.TIMESTAMP }); }
}

async function callCohereAI(userMessage) {
  var latest = telemetryData.slice(-1)[0] || {};
  const systemInstruction = `${BOT_PERSONA}\nXE: Speed ${latest.speed}km/h, Temp ${latest.temp}C, Tilt ${latest.tilt || 0}.\nKIẾN THỨC: ${KNOWLEDGE_BASE}`;
  try {
    const response = await fetch("https://api.cohere.ai/v1/chat", {
      method: "POST", headers: { "Authorization": `Bearer ${COHERE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "command-r-08-2024", message: userMessage, preamble: systemInstruction, temperature: 0.3 })
    });
    const data = await response.json();
    return data.text || "Lỗi phản hồi AI";
  } catch (err) { throw err; }
}

function addMessageUI(msg, container) {
  var div = document.createElement("div"); div.className = "chat-message " + (msg.sender === "user" ? "chat-user" : "chat-bot");
  var dt = new Date(msg.timestamp);
  div.innerHTML = `<div class="chat-meta">${msg.sender === "user" ? "Bạn" : "Bot"} • ${dt.getHours()}:${dt.getMinutes()}</div><div>${msg.text}</div>`;
  if (msg.isSOS) { var btn = document.createElement("button"); btn.className = "chat-sos-btn"; btn.innerHTML = "📞 GỌI NGAY"; btn.onclick = () => triggerSOS(); div.appendChild(btn); }
  container.appendChild(div); container.scrollTop = container.scrollHeight;
}

// MQTT SETUP
const MQTT_HOST = "2694844bdff04a26b4afe749bb37db5a.s1.eu.hivemq.cloud";
const MQTT_PORT = 8884; 
const MQTT_USERNAME = "DucTTIoT";  
const MQTT_PASSWORD = "123456789aA"; 
const MQTT_TOPIC = "motor/phuong/telemetry";
const MQTT_CLIENT_ID = "web_client_" + new Date().getTime();
var mqttClient = new Paho.MQTT.Client(MQTT_HOST, MQTT_PORT, MQTT_CLIENT_ID);

function initMQTT() {
  console.log("🚀 MQTT Connecting...");
  mqttClient.onConnectionLost = (obj) => { if(obj.errorCode !== 0) setTimeout(initMQTT, 5000); };
  
  // XỬ LÝ KHI NHẬN TIN NHẮN MQTT
  mqttClient.onMessageArrived = (msg) => {
    try {
        var data = JSON.parse(msg.payloadString);
        var record = { timestamp: Date.now(), speed: Number(data.speed), tilt: Number(data.tilt), temp: Number(data.temp), lat: data.lat, lng: data.lng };
        
        // --- ĐÂY LÀ ĐOẠN LƯU VÀO FIREBASE ---
        // Giúp bạn lưu lại lịch sử lâu dài, không bị mất khi load lại trang
        db.ref("telemetry_log").push(record);
        // ------------------------------------

        telemetryData.push(record);
        if (telemetryData.length > 500) telemetryData.shift();
        localStorage.setItem("telemetry_backup", JSON.stringify(telemetryData));
        
        if (document.querySelector('.view.active').dataset.view === 'dashboard') { renderDashboard(); updateCharts(); }
        else if (!document.getElementById("filter-start").value) { renderHistory(); }
    } catch (e) { console.error("MQTT Parse Error", e); }
  };

  mqttClient.connect({ onSuccess: () => { console.log("✅ MQTT Connected"); mqttClient.subscribe(MQTT_TOPIC); }, onFailure: (e) => { console.log("❌ MQTT Fail", e); setTimeout(initMQTT, 5000); }, useSSL: true, userName: MQTT_USERNAME, password: MQTT_PASSWORD });
}

// INIT
window.addEventListener("DOMContentLoaded", function () {
  var navs = document.querySelectorAll(".nav-item"); var views = document.querySelectorAll(".view");
  navs.forEach(btn => btn.onclick = () => {
    var target = btn.dataset.view;
    views.forEach(v => v.classList.toggle("active", v.dataset.view === target));
    navs.forEach(b => b.classList.toggle("active", b === btn));
    if (target === "dashboard") { renderDashboard(); updateCharts(); } else renderHistory();
  });

  var applyBtn = document.getElementById("history-apply"); if (applyBtn) applyBtn.onclick = applyHistoryFilter;
  var resetBtn = document.getElementById("history-reset"); if (resetBtn) resetBtn.onclick = resetHistoryFilter;
  var sos = document.getElementById("sos-button"); if (sos) sos.onclick = triggerSOS;

  updateClock(); setInterval(updateClock, 1000);
  loadTrainingData(); setupChat();

  var savedData = localStorage.getItem("telemetry_backup");
  if (savedData) { try { telemetryData = JSON.parse(savedData); renderDashboard(); updateCharts(); renderHistory(); } catch(e) {} }
  initMQTT();
});