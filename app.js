// ========= 1. CẤU HÌNH FIREBASE =========
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

// ========= 2. STATE =========
var telemetryData = [];
// Biến lưu trữ instance của Chart.js
var speedChartInstance = null;
var tempChartInstance = null;

// ========= 3. HÀM SOS DÙNG CHUNG =========
function triggerSOS() {
  var ok = confirm(
    "XÁC NHẬN KHẨN CẤP:\n" +
      "Bạn muốn gửi yêu cầu cứu hộ và gọi điện ngay lập tức?"
  );
  if (!ok) return;

  var latest =
    telemetryData.length > 0 ? telemetryData[telemetryData.length - 1] : {};

  try {
    // Ghi log lên Firebase
    db.ref("sosRequests").push({
      timestamp: firebase.database.ServerValue.TIMESTAMP,
      note: "Yêu cầu khẩn cấp (Dashboard/Chat)",
      lat: latest.lat != null ? latest.lat : null,
      lng: latest.lng != null ? latest.lng : null,
    });
    console.log("Đã gửi tín hiệu SOS lên Firebase");
  } catch (e) {
    console.warn("Log SOS lên Firebase bị lỗi:", e);
  }

  // Thực hiện cuộc gọi
  window.location.href = "tel:0972723011";
}

// ========= 4. CLOCK REALTIME =========
function updateClock() {
  var now = new Date();
  var pad = function (n) {
    return n < 10 ? "0" + n : "" + n;
  };
  var str =
    pad(now.getDate()) +
    "/" +
    pad(now.getMonth() + 1) +
    "/" +
    now.getFullYear() +
    " " +
    pad(now.getHours()) +
    ":" +
    pad(now.getMinutes()) +
    ":" +
    pad(now.getSeconds());
  var el = document.getElementById("realtime-clock");
  if (el) el.textContent = str;
}

// ========= 5. PHÂN LOẠI =========
function classifySpeed(speed) {
  if (speed == null) return null;
  if (speed <= 60)
    return { level: "safe", text: "An toàn", className: "status-safe" };
  if (speed <= 90)
    return {
      level: "warning",
      text: "Cao (cần chú ý)",
      className: "status-warning",
    };
  return { level: "danger", text: "Quá cao", className: "status-danger" };
}

function classifyTilt(tilt) {
  if (tilt == null) return null;
  var abs = Math.abs(tilt);
  if (abs < 25)
    return {
      level: "safe",
      text: "Trong ngưỡng an toàn",
      className: "status-safe",
    };
  if (abs <= 40)
    return {
      level: "warning",
      text: "Nghiêng nhiều – rủi ro trượt",
      className: "status-warning",
    };
  return {
    level: "danger",
    text: "Nghiêng quá lớn – nguy hiểm",
    className: "status-danger",
  };
}

function classifyTemp(temp) {
  if (temp == null) return null;
  if (temp < 90)
    return {
      level: "safe",
      badge: "AN TOÀN",
      text: "Nhiệt độ trong ngưỡng an toàn.",
      className: "status-safe",
    };
  if (temp <= 110)
    return {
      level: "warning",
      badge: "CẢNH BÁO",
      text: "Nhiệt độ cao, nên giảm tải hoặc kiểm tra hệ thống làm mát.",
      className: "status-warning",
    };
  return {
    level: "danger",
    badge: "QUÁ NHIỆT",
    text: "Nguy cơ quá nhiệt – nên dừng xe và kiểm tra ngay.",
    className: "status-danger",
  };
}

// Trạng thái chung trong history
function classifyRecordOverall(d) {
  var s = classifySpeed(d.speed);
  var ti = classifyTilt(d.tilt);
  var te = classifyTemp(d.temp);

  var order = { safe: 0, warning: 1, danger: 2 };
  var best = null;

  [s, ti, te].forEach(function (c) {
    if (!c) return;
    if (!best || order[c.level] > order[best.level]) best = c;
  });

  if (!best) return null;

  if (best.level === "safe") {
    return { key: "safe", label: "An toàn", className: "status-safe" };
  } else if (best.level === "warning") {
    return { key: "warning", label: "Cảnh báo", className: "status-warning" };
  } else {
    return { key: "danger", label: "Nguy hiểm", className: "status-danger" };
  }
}

// ========= 6. DASHBOARD =========
function renderDashboard() {
  if (!telemetryData.length) return;

  var latest = telemetryData[telemetryData.length - 1];

  var speed = latest.speed;
  var tilt = latest.tilt;
  var temp = latest.temp;

  // ----- VẬN TỐC -----
  var speedDetailEl = document.getElementById("speed-current-detail");
  var speedBarFill = document.getElementById("speed-bar-fill");

  if (speedDetailEl) speedDetailEl.textContent = speed != null ? speed : "--";

  if (speedBarFill) {
    var percent = 0;
    if (speed != null) {
      percent = Math.max(0, Math.min(100, (speed / 120) * 100));
    }
    speedBarFill.style.width = percent + "%";
  }

  // ----- GÓC NGHIÊNG -----
  var tiltDetailEl = document.getElementById("tilt-current");
  var tiltStatusEl = document.getElementById("tilt-status");
  var tiltBikeEl = document.getElementById("tilt-bike");

  if (tiltDetailEl)
    tiltDetailEl.textContent = tilt != null ? tilt.toFixed(1) + "°" : "--°";

  if (tiltBikeEl && tilt != null) {
    tiltBikeEl.style.transform = "rotate(" + -tilt + "deg)";
  }

  if (tiltStatusEl) {
    var tiltDesc;
    if (tilt == null) {
      tiltDesc = "Đang chờ dữ liệu";
    } else {
      var abs = Math.abs(tilt);
      if (abs < 5) tiltDesc = "Xe đang đi thẳng";
      else if (abs < 20)
        tiltDesc = "Nghiêng nhẹ (" + (tilt > 0 ? "phải" : "trái") + ")";
      else tiltDesc = "Nghiêng nhiều (" + (tilt > 0 ? "phải" : "trái") + ")";
    }
    tiltStatusEl.textContent = tiltDesc;
  }

  // ----- NHIỆT ĐỘ -----
  var tempDetailEl = document.getElementById("temp-current-detail");
  var tempBadgeEl = document.getElementById("temp-badge");
  var tempStatusTextEl = document.getElementById("temp-status-text");

  if (tempDetailEl) tempDetailEl.textContent = temp != null ? temp : "--";

  var tCls = classifyTemp(temp);
  if (tCls) {
    if (tempBadgeEl) {
      tempBadgeEl.textContent = tCls.badge;
      tempBadgeEl.style.background =
        tCls.level === "safe"
          ? "#22c55e33"
          : tCls.level === "warning"
          ? "#eab30833"
          : "#ef444433";
      tempBadgeEl.style.color = "#111827";
    }
    if (tempStatusTextEl) {
      tempStatusTextEl.textContent = tCls.text;
      tempStatusTextEl.style.color =
        tCls.level === "safe"
          ? "#16a34a"
          : tCls.level === "warning"
          ? "#ca8a04"
          : "#b91c1c";
    }
  } else {
    if (tempBadgeEl) {
      tempBadgeEl.textContent = "--";
      tempBadgeEl.style.background = "#e5e7eb";
      tempBadgeEl.style.color = "#111827";
    }
    if (tempStatusTextEl) {
      tempStatusTextEl.textContent = "Chưa có dữ liệu.";
      tempStatusTextEl.style.color = "#6b7280";
    }
  }

  // ----- SUMMARY TABLE -----
  var sSpeed = classifySpeed(speed);
  var sTilt = classifyTilt(tilt);

  function setSummary(idValue, idStatus, valueText, classifier) {
    var valEl = document.getElementById(idValue);
    var stEl = document.getElementById(idStatus);
    if (valEl) valEl.textContent = valueText;
    if (stEl) {
      stEl.innerHTML = "";
      if (classifier) {
        var span = document.createElement("span");
        span.className = "status-pill " + classifier.className;
        span.textContent = classifier.text;
        stEl.appendChild(span);
      } else {
        stEl.textContent = "--";
      }
    }
  }

  setSummary(
    "summary-speed-value",
    "summary-speed-status",
    speed != null ? speed + " km/h" : "-- km/h",
    sSpeed
  );
  setSummary(
    "summary-tilt-value",
    "summary-tilt-status",
    tilt != null ? tilt.toFixed(1) + "°" : "--°",
    sTilt
  );
  setSummary(
    "summary-temp-value",
    "summary-temp-status",
    temp != null ? temp + " °C" : "-- °C",
    tCls
  );
}

// ========= 8. CHARTS (CHART.JS ANIMATION) =========

function initCharts() {
  // Cấu hình chung cho animation
  var commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 1000,
      easing: 'easeOutQuart'
    },
    scales: {
      x: { ticks: { maxRotation: 45, minRotation: 0 } },
      y: { beginAtZero: true }
    },
    plugins: {
      legend: { display: true }
    }
  };

  // 1. Biểu đồ Vận tốc
  var ctxSpeed = document.getElementById("speed-chart-canvas");
  if (ctxSpeed) {
    speedChartInstance = new Chart(ctxSpeed, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Vận tốc (km/h)',
          data: [],
          borderColor: 'rgb(37, 99, 235)',
          backgroundColor: 'rgba(37, 99, 235, 0.2)',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.4,
          fill: true
        }]
      },
      options: commonOptions
    });
  }

  // 2. Biểu đồ Nhiệt độ
  var ctxTemp = document.getElementById("temp-chart-canvas");
  if (ctxTemp) {
    tempChartInstance = new Chart(ctxTemp, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Nhiệt độ (°C)',
          data: [],
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.4,
          fill: true
        }]
      },
      options: commonOptions
    });
  }
}

function updateCharts() {
  if (!telemetryData.length) return;
  
  // Khởi tạo nếu chưa có
  if (!speedChartInstance || !tempChartInstance) {
    initCharts();
  }

  // Lấy 20 điểm dữ liệu mới nhất
  var slice = telemetryData.slice(-20);

  var labels = slice.map(function (d) {
    var dt = new Date(d.timestamp);
    var pad = function (n) { return n < 10 ? "0" + n : "" + n; };
    return pad(dt.getHours()) + ":" + pad(dt.getMinutes()) + ":" + pad(dt.getSeconds());
  });

  var speedData = slice.map(function (d) { return d.speed; });
  var tempData = slice.map(function (d) { return d.temp; });

  // Update Speed Chart
  if (speedChartInstance) {
    speedChartInstance.data.labels = labels;
    speedChartInstance.data.datasets[0].data = speedData;
    speedChartInstance.update();
  }

  // Update Temp Chart
  if (tempChartInstance) {
    tempChartInstance.data.labels = labels;
    tempChartInstance.data.datasets[0].data = tempData;
    tempChartInstance.update();
  }
}

// ========= 9. HISTORY =========
function renderHistory(filtered) {
  var data = filtered || telemetryData;
  var body = document.getElementById("history-body");
  var countEl = document.getElementById("history-count");
  if (!body) return;

  body.innerHTML = "";
  // Đảo ngược để thấy mới nhất trước
  var displayData = data.slice().reverse();

  displayData.forEach(function (d) {
    var tr = document.createElement("tr");

    var dt = new Date(d.timestamp);
    var pad = function (n) {
      return n < 10 ? "0" + n : "" + n;
    };
    var dtStr =
      pad(dt.getDate()) +
      "/" +
      pad(dt.getMonth() + 1) +
      "/" +
      dt.getFullYear() +
      " " +
      pad(dt.getHours()) +
      ":" +
      pad(dt.getMinutes()) +
      ":" +
      pad(dt.getSeconds());

    var tdTime = document.createElement("td");
    tdTime.textContent = dtStr;
    tr.appendChild(tdTime);

    var tdSpeed = document.createElement("td");
    tdSpeed.textContent = d.speed != null ? d.speed : "";
    tr.appendChild(tdSpeed);

    var tdTilt = document.createElement("td");
    tdTilt.textContent = d.tilt != null ? d.tilt.toFixed(1) : "";
    tr.appendChild(tdTilt);

    var tdTemp = document.createElement("td");
    tdTemp.textContent = d.temp != null ? d.temp : "";
    tr.appendChild(tdTemp);

    var tdStatus = document.createElement("td");
    var st = classifyRecordOverall(d);
    if (st) {
      var span = document.createElement("span");
      span.className = "status-pill " + st.className;
      span.textContent = st.label;
      tdStatus.appendChild(span);
    }
    tr.appendChild(tdStatus);

    body.appendChild(tr);
  });

  if (countEl) {
    countEl.textContent = data.length
      ? "(" + data.length + " bản ghi)"
      : "(Không có dữ liệu trong khoảng lọc)";
  }
}

function applyHistoryFilter() {
  if (!telemetryData.length) {
    renderHistory([]);
    return;
  }

  var typeSel = document.getElementById("history-type");
  var fromInput = document.getElementById("history-from");
  var toInput = document.getElementById("history-to");

  var type = typeSel ? typeSel.value : "all";
  var fromVal =
    fromInput && fromInput.value ? new Date(fromInput.value).getTime() : null;
  var toVal =
    toInput && toInput.value ? new Date(toInput.value).getTime() : null;

  var filtered = telemetryData.filter(function (d) {
    var okTime = true;
    if (fromVal != null && d.timestamp < fromVal) okTime = false;
    if (toVal != null && d.timestamp > toVal) okTime = false;

    var okStatus = true;
    if (type !== "all") {
      var st = classifyRecordOverall(d);
      okStatus = st && st.key === type;
    }

    return okTime && okStatus;
  });

  renderHistory(filtered);
}

// ========= 10. SUBSCRIBE FIREBASE =========
function subscribeFirebase() {
  var ref = db.ref("telemetry").limitToLast(200);

  ref.on("value", function (snapshot) {
    var arr = [];
    snapshot.forEach(function (child) {
      var val = child.val();
      if (!val) return;

      var ts =
        val.timestamp != null
          ? Number(val.timestamp)
          : Date.parse(val.time || val.timeString || new Date().toISOString());

      arr.push({
        timestamp: ts || Date.now(),
        speed: val.speed != null ? Number(val.speed) : null,
        tilt: val.tilt != null ? Number(val.tilt) : null,
        temp: val.temp != null ? Number(val.temp) : null,
        lat: val.lat != null ? Number(val.lat) : null,
        lng: val.lng != null ? Number(val.lng) : null,
      });
    });

    arr.sort(function (a, b) {
      return a.timestamp - b.timestamp;
    });

    telemetryData = arr;

    renderDashboard();
    updateCharts(); // Gọi hàm cập nhật Chart.js
    renderHistory();
  });
}

// ========= 11. CHAT BOX & AUTO REPLY =========
function removeVietnameseTones(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function setupChat() {
  var chatBtn = document.getElementById("chatbox-button");
  var chatBox = document.getElementById("chatbox");
  var chatToggle = document.getElementById("chatbox-toggle");
  var chatClear = document.getElementById("chatbox-clear");
  var chatMessages = document.getElementById("chatbox-messages");
  var chatInput = document.getElementById("chatbox-input");
  var chatSend = document.getElementById("chatbox-send");

  if (!chatBtn || !chatBox || !chatMessages || !chatInput || !chatSend) return;

  chatBtn.addEventListener("click", function () {
    chatBox.style.display = "flex";
    chatBtn.style.display = "none";
  });

  chatToggle.addEventListener("click", function () {
    chatBox.style.display = "none";
    chatBtn.style.display = "block";
  });

  if (chatClear) {
    chatClear.addEventListener("click", function () {
      if (!confirm("Xóa toàn bộ lịch sử trò chuyện?")) return;
      db.ref("chatMessages")
        .remove()
        .then(function () {
          chatMessages.innerHTML = "";
        })
        .catch(function (err) {
          console.error("Lỗi xóa lịch sử chat:", err);
        });
    });
  }

  chatSend.addEventListener("click", function () {
    sendChatMessage(chatInput, chatMessages);
  });

  chatInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      sendChatMessage(chatInput, chatMessages);
    }
  });

  var chatRef = db.ref("chatMessages").limitToLast(50);
  chatRef.on("child_added", function (snapshot) {
    var msg = snapshot.val();
    if (!msg) return;
    addChatMessageToUI(msg, chatMessages);
  });
}

function sendChatMessage(inputEl, chatMessages) {
  var text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = "";

  db.ref("chatMessages").push({
    sender: "user",
    text: text,
    timestamp: firebase.database.ServerValue.TIMESTAMP,
  });

  setTimeout(function () {
    var replyData = buildAutoReply(text);
    db.ref("chatMessages").push({
      sender: "bot",
      text: replyData.text,
      isSOS: replyData.isSOS || false,
      timestamp: firebase.database.ServerValue.TIMESTAMP,
    });
  }, 600);
}

function buildAutoReply(userText) {
  var t = removeVietnameseTones(userText).toLowerCase();
  var latest =
    telemetryData.length > 0 ? telemetryData[telemetryData.length - 1] : {};

  var speed = latest.speed != null ? latest.speed : null;
  var temp = latest.temp != null ? latest.temp : null;
  var tilt = latest.tilt != null ? latest.tilt.toFixed(1) : null;
  var lat = latest.lat != null ? latest.lat.toFixed(6) : null;
  var lng = latest.lng != null ? latest.lng.toFixed(6) : null;

  if (
    t.includes("sos") ||
    t.includes("cuu ho") ||
    t.includes("tai nan") ||
    t.includes("cap cuu")
  ) {
    return {
      text: "Tôi đã nhận được tín hiệu khẩn cấp. Hãy nhấn nút bên dưới để gọi cứu hộ ngay lập tức!",
      isSOS: true,
    };
  }

  if (t.includes("van toc") || t.includes("toc do") || t.includes("speed")) {
    if (speed == null)
      return { text: "Hiện chưa có dữ liệu vận tốc từ xe.", isSOS: false };
    return {
      text: "Vận tốc hiện tại của xe khoảng " + speed + " km/h.",
      isSOS: false,
    };
  }

  if (
    t.includes("nhiet do") ||
    t.includes("dong co") ||
    t.includes("temperature")
  ) {
    if (temp == null)
      return { text: "Hiện chưa có dữ liệu nhiệt độ động cơ.", isSOS: false };
    return {
      text: "Nhiệt độ động cơ: " + temp + " °C.",
      isSOS: false,
    };
  }

  if (t.includes("goc nghieng") || t.includes("nghieng")) {
    if (tilt == null)
      return { text: "Hiện chưa có dữ liệu góc nghiêng.", isSOS: false };
    return { text: "Góc nghiêng hiện tại khoảng " + tilt + "°.", isSOS: false };
  }

  if (
    t.includes("vi tri") ||
    t.includes("toa do") ||
    t.includes("ban do") ||
    t.includes("location")
  ) {
    if (!lat || !lng)
      return { text: "Hiện chưa nhận được toạ độ GPS từ xe.", isSOS: false };
    return {
      text: "Vị trí hiện tại: " + lat + ", " + lng,
      isSOS: false,
    };
  }

  return {
    text: "Tôi đã nhận được tin nhắn. Bạn có thể hỏi về: Vận tốc, Nhiệt độ, Góc nghiêng, Vị trí hoặc SOS.",
    isSOS: false,
  };
}

function addChatMessageToUI(msg, container) {
  var div = document.createElement("div");
  var isUser = msg.sender === "user";

  div.className = "chat-message " + (isUser ? "chat-user" : "chat-bot");

  var time = "";
  if (msg.timestamp) {
    var dt = new Date(msg.timestamp);
    var h = dt.getHours().toString().padStart(2, "0");
    var m = dt.getMinutes().toString().padStart(2, "0");
    time = h + ":" + m;
  }

  if (time) {
    var meta = document.createElement("span");
    meta.className = "chat-meta";
    meta.textContent = (isUser ? "Bạn • " : "Bot • ") + time;
    div.appendChild(meta);
  }

  var textNode = document.createElement("span");
  textNode.textContent = msg.text;
  div.appendChild(textNode);

  if (msg.isSOS === true) {
    var btn = document.createElement("button");
    btn.className = "chat-sos-btn";
    btn.innerHTML = "🚨 GỌI NGAY (0972723011)";
    btn.onclick = function () {
      triggerSOS();
    };
    div.appendChild(btn);
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// ========= 12. INIT =========
window.addEventListener("DOMContentLoaded", function () {
  // Nav
  var navItems = document.querySelectorAll(".nav-item");
  var views = document.querySelectorAll(".view");

  navItems.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.dataset.view;
      views.forEach(function (v) {
        v.classList.toggle("active", v.dataset.view === target);
      });
      navItems.forEach(function (b) {
        b.classList.toggle("active", b === btn);
      });

      if (target === "dashboard") {
        renderDashboard();
      } else if (target === "history") {
        renderHistory();
      }
    });
  });

  updateClock();
  setInterval(updateClock, 1000);

  var applyBtn = document.getElementById("history-apply");
  var resetBtn = document.getElementById("history-reset");
  if (applyBtn) applyBtn.addEventListener("click", applyHistoryFilter);
  if (resetBtn)
    resetBtn.addEventListener("click", function () {
      var fromInput = document.getElementById("history-from");
      var toInput = document.getElementById("history-to");
      var typeSel = document.getElementById("history-type");
      if (fromInput) fromInput.value = "";
      if (toInput) toInput.value = "";
      if (typeSel) typeSel.value = "all";
      renderHistory();
    });

  var sosBtn = document.getElementById("sos-button");
  if (sosBtn) {
    sosBtn.addEventListener("click", triggerSOS);
  }

  setupChat();
  subscribeFirebase();
});