import { AttendanceLog, AttendanceStatus, RosterFolder, RosterMember } from '../types';

export const STORAGE_KEYS = {
  ROSTERS: 'omni_rosters_v2',
  LOGS: 'omni_attendance_logs_v2',
  ADMIN_PASSWORD: 'omni_admin_password_v2',
};

export const MASTER_RECOVERY_KEY = 'VICADE-SUPER-99';
export const DEFAULT_ADMIN_PASSWORD = 'admin123';

export const DEMO_ROSTERS: RosterFolder[] = [
  {
    id: 1715000001000,
    name: '🏦 First Bank — Bulk Cash Vault',
    shiftStart: '07:30',
    shiftEnd: '16:00',
    graceMin: 5,
    customColName: 'Vault Counter No',
    members: [
      { id: 101, name: 'Sarah Jenkins', pin: '1024', customVal: 'Counter 01 - Cash In' },
      { id: 102, name: 'Marcus Vance', pin: '4821', customVal: 'Counter 02 - FX Trading' },
      { id: 103, name: 'Elena Rostova', pin: '7732', customVal: 'Counter 03 - High Value' },
      { id: 104, name: 'David Kim', pin: '3910', customVal: 'Counter 04 - Commercial Bulk' },
      { id: 105, name: 'Aisha Bello', pin: '8590', customVal: 'Vault Custodian Lead' },
    ],
  },
  {
    id: 1715000002000,
    name: '🏫 FUMMSA — Anatomy Dissection Lab',
    shiftStart: '08:00',
    shiftEnd: '16:00',
    graceMin: 15,
    customColName: 'Demonstrator Table',
    members: [
      { id: 201, name: 'Dr. Chidi Okafor', pin: '2468', customVal: 'Table A (Thorax & Lung)' },
      { id: 202, name: 'Dr. Fatima Zahra', pin: '1357', customVal: 'Table B (Neuroanatomy)' },
      { id: 203, name: 'Dr. Lucas Meyers', pin: '9876', customVal: 'Table C (Abdomen & Pelvis)' },
      { id: 204, name: 'Dr. Priyah Patel', pin: '5544', customVal: 'Table D (Musculoskeletal)' },
      { id: 205, name: 'Alex Sterling', pin: '1122', customVal: 'Prosection Station' },
    ],
  },
  {
    id: 1715000003000,
    name: '🏢 Corporate IT & Security Operations',
    shiftStart: '08:30',
    shiftEnd: '17:30',
    graceMin: 10,
    customColName: 'Station No',
    members: [
      { id: 301, name: 'Alex Mercer', pin: '4321', customVal: 'SOC Station 01 (Tier 2)' },
      { id: 302, name: 'Tariq Al-Mansoor', pin: '8899', customVal: 'SOC Station 02 (Hunt)' },
      { id: 303, name: 'Samantha Reed', pin: '6543', customVal: 'NOC Station 03 (Infra)' },
      { id: 304, name: 'Carlos Mendez', pin: '2026', customVal: 'Incident Command Desk' },
      { id: 305, name: 'Nkechi Williams', pin: '3322', customVal: 'IAM Operations Desk' },
    ],
  },
];

// Load Rosters from localStorage (starts empty if none configured)
export function loadRosters(): RosterFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ROSTERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.ROSTERS, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (err) {
    console.error('Failed to load rosters from localStorage:', err);
    return [];
  }
}

// Save Rosters to localStorage
export function saveRosters(rosters: RosterFolder[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ROSTERS, JSON.stringify(rosters));
  } catch (err) {
    console.error('Failed to save rosters to localStorage:', err);
  }
}

// Load Attendance Logs from localStorage
export function loadAttendanceLogs(): AttendanceLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load logs from localStorage:', err);
    return [];
  }
}

// Save Attendance Logs to localStorage
export function saveAttendanceLogs(logs: AttendanceLog[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
  } catch (err) {
    console.error('Failed to save logs to localStorage:', err);
  }
}

// Add a single attendance log entry
export function recordAttendanceLog(log: Omit<AttendanceLog, 'id'>): AttendanceLog {
  const currentLogs = loadAttendanceLogs();
  const newLog: AttendanceLog = {
    ...log,
    id: Date.now(),
  };
  const updated = [newLog, ...currentLogs];
  saveAttendanceLogs(updated);
  return newLog;
}

// Admin Password management
export function getAdminPassword(): string {
  try {
    const pwd = localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD);
    return pwd || DEFAULT_ADMIN_PASSWORD;
  } catch {
    return DEFAULT_ADMIN_PASSWORD;
  }
}

export function saveAdminPassword(password: string): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD, password);
  } catch (err) {
    console.error('Failed to save admin password:', err);
  }
}

// Verification Math
export function calculateAttendanceStatus(
  currentTime: Date,
  shiftStart: string,
  graceMin: number
): AttendanceStatus {
  const [startHourStr, startMinStr] = shiftStart.split(':');
  const startHour = parseInt(startHourStr, 10) || 0;
  const startMin = parseInt(startMinStr, 10) || 0;

  const shiftStartTotalMinutes = startHour * 60 + startMin;
  const currentTotalMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

  if (currentTotalMinutes < shiftStartTotalMinutes) {
    return 'EARLY';
  } else if (currentTotalMinutes <= shiftStartTotalMinutes + graceMin) {
    return 'ON_TIME';
  } else {
    return 'LATE';
  }
}

// Date & Time formatting helpers
export function formatDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatTime12h(date: Date): string {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 is 12
  const hoursFormatted = String(hours).padStart(2, '0');
  return `${hoursFormatted}:${minutes}:${seconds} ${ampm}`;
}

export function formatShiftDisplay(timeStr: string): string {
  if (!timeStr) return '';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10) || 0;
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

// Parse Bulk Text: "Name / 4-Digit PIN / Custom Detail" or comma/pipe separated
export function parseBulkTextMembers(text: string): Omit<RosterMember, 'id'>[] {
  const lines = text.split('\n');
  const results: Omit<RosterMember, 'id'>[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect delimiter: slash (/), pipe (|), or comma (,)
    let parts: string[] = [];
    if (line.includes('/')) {
      parts = line.split('/').map((s) => s.trim());
    } else if (line.includes('|')) {
      parts = line.split('|').map((s) => s.trim());
    } else if (line.includes(',')) {
      parts = line.split(',').map((s) => s.trim());
    } else if (line.includes('\t')) {
      parts = line.split('\t').map((s) => s.trim());
    } else {
      // whitespace fallback
      const words = line.split(/\s+/);
      if (words.length >= 2) {
        parts = [words.slice(0, -1).join(' '), words[words.length - 1]];
      }
    }

    if (parts.length >= 2) {
      const name = parts[0];
      // Clean pin to digits
      const pinRaw = parts[1].replace(/\D/g, '').slice(0, 4);
      const customVal = parts[2] || '';

      if (name && pinRaw.length >= 4) {
        results.push({
          name,
          pin: pinRaw,
          customVal,
        });
      }
    }
  }

  return results;
}

// Parse CSV text for member import
export function parseCsvMembers(csvText: string): Omit<RosterMember, 'id'>[] {
  const lines = csvText.split(/\r?\n/);
  const results: Omit<RosterMember, 'id'>[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle header row
    if (i === 0 && (line.toLowerCase().includes('name') || line.toLowerCase().includes('pin'))) {
      continue;
    }

    // Parse CSV line handling potential quotes
    const cells: string[] = [];
    let cur = '';
    let inQuote = false;

    for (let c = 0; c < line.length; c++) {
      const char = line[c];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ',' && !inQuote) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    cells.push(cur.trim());

    if (cells.length >= 2) {
      const name = cells[0].replace(/^["']|["']$/g, '');
      const pin = cells[1].replace(/\D/g, '').slice(0, 4);
      const customVal = cells[2] ? cells[2].replace(/^["']|["']$/g, '') : '';

      if (name && pin.length >= 4) {
        results.push({ name, pin, customVal });
      }
    }
  }

  return results;
}

// Resize and compress an image file to ~150x150 JPEG (~6-10KB base64)
export function compressImageFile(file: File, maxDim = 150, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;

          // Scale maintaining aspect ratio, or crop to square
          const size = Math.min(w, h);
          const startX = (w - size) / 2;
          const startY = (h - size) / 2;

          canvas.width = maxDim;
          canvas.height = maxDim;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(img.src);
            return;
          }

          // High quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, startX, startY, size, size, 0, 0, maxDim, maxDim);

          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Capture current video frame from webcam as lightweight base64 (~160x120 JPEG)
export function captureVideoFrameAsThumbnail(
  videoEl: HTMLVideoElement,
  targetWidth = 160,
  targetHeight = 120,
  quality = 0.7
): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    // Cover crop calculation
    const vWidth = videoEl.videoWidth || targetWidth;
    const vHeight = videoEl.videoHeight || targetHeight;
    const vRatio = vWidth / vHeight;
    const targetRatio = targetWidth / targetHeight;

    let sWidth = vWidth;
    let sHeight = vHeight;
    let sx = 0;
    let sy = 0;

    if (vRatio > targetRatio) {
      sWidth = vHeight * targetRatio;
      sx = (vWidth - sWidth) / 2;
    } else {
      sHeight = vWidth / targetRatio;
      sy = (vHeight - sHeight) / 2;
    }

    ctx.drawImage(videoEl, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
    return canvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    console.warn('Failed to capture video snapshot:', err);
    return '';
  }
}

// RFC 4180 compliant CSV Export
export function exportAttendanceLogsToCsv(logs: AttendanceLog[]): void {
  const headers = [
    'Log ID',
    'Roster Name',
    'Staff Name',
    'Custom Property',
    'Scheduled Shift',
    'Date (YYYY-MM-DD)',
    'Verified Time',
    'Attendance Status',
    'Verification Method',
    'Photo Proof Captured',
  ];

  const escapeCsvCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = logs.map((log) => [
    escapeCsvCell(log.id),
    escapeCsvCell(log.rosterName),
    escapeCsvCell(log.name),
    escapeCsvCell(log.customVal || 'N/A'),
    escapeCsvCell(log.shiftWindow || 'Standard Shift'),
    escapeCsvCell(log.date),
    escapeCsvCell(log.time),
    escapeCsvCell(log.status),
    escapeCsvCell(log.verifiedMethod),
    escapeCsvCell(log.liveSnapshotBase64 ? 'YES' : 'NO'),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.join(',')),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const nowStr = formatDateIso(new Date());
  link.setAttribute('href', url);
  link.setAttribute('download', `OmniRoster_Attendance_Logs_${nowStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
