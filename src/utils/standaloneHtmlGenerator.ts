/**
 * Generates an entirely self-contained single-file HTML5+CSS3+Vanilla JS Kiosk
 * Can be saved and run on any browser or kiosk PC completely offline with zero build tools.
 */

export function downloadStandaloneHtmlFile(): void {
  const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>OmniRoster — Universal Offline Duty Roster & PIN Attendance Kiosk</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    :root {
      --font-sans: 'Plus Jakarta Sans', system-ui, sans-serif;
      --font-mono: 'Space Grotesk', monospace;
      --bg: #030712;
      --surface: rgba(15, 23, 42, 0.7);
      --border: rgba(255, 255, 255, 0.08);
      --emerald: #10b981;
      --amber: #f59e0b;
      --rose: #f43f5e;
      --blue: #38bdf8;
    }
    body {
      font-family: var(--font-sans);
      background-color: var(--bg);
      background-image: radial-gradient(circle at 10% 20%, rgba(16, 185, 129, 0.08) 0%, transparent 40%),
                        radial-gradient(circle at 90% 80%, rgba(14, 165, 233, 0.08) 0%, transparent 40%);
      color: #f8fafc;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      background: rgba(15, 23, 42, 0.8);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(16px);
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
    }
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.06);
      color: #f8fafc;
      transition: all 0.2s;
    }
    .btn:hover { background: rgba(255, 255, 255, 0.12); }
    .btn-emerald { background: #059669; border-color: #10b981; color: white; }
    .btn-emerald:hover { background: #10b981; }
    .container { max-width: 1200px; width: 100%; margin: 0 auto; padding: 1.5rem; flex: 1; }
    .roster-tabs { display: flex; gap: 0.75rem; overflow-x: auto; padding-bottom: 0.75rem; margin-bottom: 1.5rem; }
    .roster-tab {
      padding: 0.85rem 1.25rem;
      border-radius: 0.75rem;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid var(--border);
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .roster-tab.active {
      background: rgba(6, 78, 59, 0.4);
      border-color: var(--emerald);
      box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
    }
    .staff-card {
      background: rgba(15, 23, 42, 0.65);
      border: 1px solid var(--border);
      border-radius: 0.85rem;
      padding: 1.25rem;
      cursor: pointer;
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 1rem;
    }
    .staff-card:hover {
      transform: translateY(-3px);
      border-color: rgba(255, 255, 255, 0.2);
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
    }
    .status-pill {
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.4rem 0.75rem;
      border-radius: 9999px;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      width: fit-content;
    }
    .status-pending { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
    .status-ontime { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .status-late { background: rgba(244, 63, 94, 0.2); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.4); }
    .status-early { background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); }
    
    /* Keypad Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.8);
      backdrop-filter: blur(8px); display: none; align-items: center;
      justify-content: center; z-index: 999; padding: 1rem;
    }
    .modal-box {
      background: #0f172a; border: 1px solid rgba(255,255,255,0.15);
      border-radius: 1.25rem; max-width: 400px; width: 100%; padding: 1.75rem;
      text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.8);
    }
    .dots { display: flex; justify-content: center; gap: 0.75rem; margin: 1.5rem 0; }
    .dot { width: 16px; height: 16px; border-radius: 50%; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3); transition: all 0.2s; }
    .dot.filled { background: var(--emerald); box-shadow: 0 0 12px var(--emerald); }
    .keypad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
    .key-btn {
      padding: 1.1rem 0; font-size: 1.4rem; font-weight: 700;
      font-family: var(--font-mono); border-radius: 0.75rem;
      background: rgba(255,255,255,0.06); border: 1px solid var(--border);
      color: white; cursor: pointer; transition: background 0.15s;
    }
    .key-btn:active { background: rgba(255,255,255,0.2); }
    .key-util { font-size: 0.95rem; font-weight: 600; font-family: var(--font-sans); }
    .clock-display { font-family: var(--font-mono); font-size: 1.4rem; font-weight: 700; letter-spacing: 0.05em; color: #38bdf8; }
  </style>
</head>
<body>
  <header class="topbar">
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <span style="font-size: 1.5rem;">⚡</span>
      <div>
        <h1 style="font-size: 1.1rem; font-weight: 800; letter-spacing: -0.02em;">OmniRoster</h1>
        <div style="font-size: 0.75rem; color: #94a3b8;">Offline Duty & PIN Kiosk</div>
      </div>
      <div class="badge" style="color: #34d399; border-color: rgba(16, 185, 129, 0.3);">
        <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981;"></span>
        OFFLINE READY
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 1rem;">
      <div style="text-align: right;">
        <div class="clock-display" id="kiosk-clock">00:00:00 AM</div>
        <div id="kiosk-date" style="font-size: 0.75rem; color: #94a3b8;">Loading date...</div>
      </div>
      <button class="btn btn-emerald" onclick="alert('Open the full application in browser to manage Admin portal and export logs.')">Admin Portal</button>
    </div>
  </header>

  <main class="container">
    <div class="roster-tabs" id="rosterTabs"></div>
    <div id="rosterMeta" style="margin-bottom: 1.25rem; font-size: 0.875rem; color: #94a3b8;"></div>
    <div class="cards-grid" id="dutyGrid"></div>
  </main>

  <div class="modal-overlay" id="pinModal">
    <div class="modal-box">
      <h3 id="pinStaffName" style="font-size: 1.25rem; font-weight: 700;">Employee Verification</h3>
      <p id="pinShiftInfo" style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.25rem;">Shift: 08:00 - 16:00</p>
      <div class="dots">
        <div class="dot" id="dot0"></div>
        <div class="dot" id="dot1"></div>
        <div class="dot" id="dot2"></div>
        <div class="dot" id="dot3"></div>
      </div>
      <div class="keypad">
        <button class="key-btn" onclick="pressKey('1')">1</button>
        <button class="key-btn" onclick="pressKey('2')">2</button>
        <button class="key-btn" onclick="pressKey('3')">3</button>
        <button class="key-btn" onclick="pressKey('4')">4</button>
        <button class="key-btn" onclick="pressKey('5')">5</button>
        <button class="key-btn" onclick="pressKey('6')">6</button>
        <button class="key-btn" onclick="pressKey('7')">7</button>
        <button class="key-btn" onclick="pressKey('8')">8</button>
        <button class="key-btn" onclick="pressKey('9')">9</button>
        <button class="key-btn key-util" onclick="clearPin()">CLEAR</button>
        <button class="key-btn" onclick="pressKey('0')">0</button>
        <button class="key-btn key-util" onclick="closePinModal()" style="color:#f87171;">CANCEL</button>
      </div>
    </div>
  </div>

  <script>
    // Offline Storage & Kiosk Logic
    const STORAGE_KEY_ROSTERS = 'omni_rosters_v2';
    const STORAGE_KEY_LOGS = 'omni_attendance_logs_v2';

    let rosters = JSON.parse(localStorage.getItem(STORAGE_KEY_ROSTERS) || '[]');
    let activeRosterIdx = 0;
    let selectedMember = null;
    let enteredPin = "";

    function updateClock() {
      const now = new Date();
      let h = now.getHours();
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      document.getElementById('kiosk-clock').textContent = String(h).padStart(2,'0') + ':' + m + ':' + s + ' ' + ampm;
      document.getElementById('kiosk-date').textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
    setInterval(updateClock, 1000);
    updateClock();

    function renderTabs() {
      const tabsEl = document.getElementById('rosterTabs');
      tabsEl.innerHTML = '';
      rosters.forEach((r, idx) => {
        const tab = document.createElement('button');
        tab.className = 'roster-tab ' + (idx === activeRosterIdx ? 'active' : '');
        tab.textContent = r.name;
        tab.onclick = () => { activeRosterIdx = idx; renderRoster(); };
        tabsEl.appendChild(tab);
      });
    }

    function renderRoster() {
      renderTabs();
      const roster = rosters[activeRosterIdx];
      const gridEl = document.getElementById('dutyGrid');
      const metaEl = document.getElementById('rosterMeta');
      if (!roster) {
        metaEl.textContent = 'Offline Kiosk Terminal';
        gridEl.innerHTML = '<div style="text-align:center; padding:3rem 1rem; border:1px solid var(--border); border-radius:1rem; max-width:550px; margin:2rem auto;"><div style="font-size:2.5rem; margin-bottom:0.75rem;">📁</div><h3 style="font-size:1.25rem; font-weight:700; color:#fff;">No Active Rosters Found</h3><p style="font-size:0.875rem; color:#94a3b8; margin-top:0.5rem; line-height:1.5;">Tap "Admin Control Center" in the full application to create your first department schedule or optionally load sample rosters.</p></div>';
        return;
      }
      metaEl.textContent = 'Shift: ' + roster.shiftStart + ' - ' + roster.shiftEnd + ' | Grace: ' + roster.graceMin + 'm | ' + (roster.members ? roster.members.length : 0) + ' Staff';
      gridEl.innerHTML = '';

      if (!roster.members || roster.members.length === 0) {
        gridEl.innerHTML = '<div style="text-align:center; padding:3rem 1rem; border:1px solid var(--border); border-radius:1rem; grid-column: 1 / -1; width:100%;"><h4 style="font-size:1.05rem; font-weight:700; color:#e2e8f0;">No staff scheduled in this folder.</h4><p style="font-size:0.85rem; color:#94a3b8; margin-top:0.35rem;">Admin can add members via the Admin Center.</p></div>';
        return;
      }

      const logs = JSON.parse(localStorage.getItem(STORAGE_KEY_LOGS) || '[]');
      const todayIso = new Date().toISOString().split('T')[0];

      roster.members.forEach(member => {
        const log = logs.find(l => l.rosterId === roster.id && l.memberId === member.id && l.date === todayIso);
        const card = document.createElement('div');
        card.className = 'staff-card';
        card.onclick = () => openPinModal(member, roster, log);

        let statusHtml = '<div class="status-pill status-pending">⏳ Tap to Check In</div>';
        if (log) {
          if (log.status === 'ON_TIME') statusHtml = '<div class="status-pill status-ontime">🟢 ON TIME (' + log.time.slice(0, 5) + ')</div>';
          else if (log.status === 'EARLY') statusHtml = '<div class="status-pill status-early">🔵 EARLY (' + log.time.slice(0, 5) + ')</div>';
          else statusHtml = '<div class="status-pill status-late">🟡 LATE (' + log.time.slice(0, 5) + ')</div>';
        }

        card.innerHTML = '<div><div style="font-weight:700; font-size:1.1rem;">' + member.name + '</div><div style="font-size:0.8rem; color:#94a3b8; margin-top:0.25rem;">' + (roster.customColName ? roster.customColName + ': ' : '') + (member.customVal || 'Assigned') + '</div></div>' + statusHtml;
        gridEl.appendChild(card);
      });
    }

    function openPinModal(member, roster, log) {
      if (log) {
        alert(member.name + ' has already verified attendance for today (' + log.status + ' at ' + log.time + ').');
        return;
      }
      selectedMember = member;
      enteredPin = "";
      updateDots();
      document.getElementById('pinStaffName').textContent = member.name;
      document.getElementById('pinShiftInfo').textContent = 'Shift: ' + roster.shiftStart + ' - ' + roster.shiftEnd + ' (Grace: ' + roster.graceMin + 'm)';
      document.getElementById('pinModal').style.display = 'flex';
    }

    function closePinModal() {
      document.getElementById('pinModal').style.display = 'none';
      selectedMember = null;
      enteredPin = "";
    }

    function pressKey(num) {
      if (enteredPin.length < 4) {
        enteredPin += num;
        updateDots();
        if (enteredPin.length === 4) {
          setTimeout(verifyPin, 100);
        }
      }
    }

    function clearPin() {
      enteredPin = "";
      updateDots();
    }

    function updateDots() {
      for (let i = 0; i < 4; i++) {
        const dot = document.getElementById('dot' + i);
        if (i < enteredPin.length) dot.classList.add('filled');
        else dot.classList.remove('filled');
      }
    }

    function verifyPin() {
      if (!selectedMember) return;
      if (enteredPin !== selectedMember.pin) {
        alert('Incorrect PIN! Please try again.');
        clearPin();
        return;
      }
      // Calculate status
      const roster = rosters[activeRosterIdx];
      const now = new Date();
      const [sh, sm] = roster.shiftStart.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const curMin = now.getHours() * 60 + now.getMinutes();

      let status = 'ON_TIME';
      if (curMin < startMin) status = 'EARLY';
      else if (curMin > startMin + roster.graceMin) status = 'LATE';

      let h = now.getHours();
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      const timeStr = String(h).padStart(2,'0') + ':' + m + ':' + s + ' ' + ampm;

      const newLog = {
        id: Date.now(),
        rosterId: roster.id,
        rosterName: roster.name,
        memberId: selectedMember.id,
        name: selectedMember.name,
        customVal: selectedMember.customVal,
        date: now.toISOString().split('T')[0],
        time: timeStr,
        status: status,
        verifiedMethod: 'Local Device PIN'
      };

      const logs = JSON.parse(localStorage.getItem(STORAGE_KEY_LOGS) || '[]');
      logs.unshift(newLog);
      localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logs));

      closePinModal();
      renderRoster();
      alert('Verified successfully! Status: ' + status);
    }

    if (rosters.length > 0) renderRoster();
  </script>
</body>
</html>`;

  const blob = new Blob([standaloneHtml], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'OmniRoster_Universal_Offline_Kiosk.html');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
