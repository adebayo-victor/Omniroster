export type AttendanceStatus = 'EARLY' | 'ON_TIME' | 'LATE';

export interface RosterMember {
  id: number;
  name: string;
  pin: string; // 4-digit string
  customVal: string;
  profilePhotoBase64?: string; // ~150x150 compressed data URL
}

export interface RosterFolder {
  id: number; // Timestamp
  name: string;
  shiftStart: string; // "HH:MM" e.g. "07:30"
  shiftEnd: string; // "HH:MM" e.g. "16:00"
  graceMin: number; // e.g. 0, 5, 10, 15, 30, 45, 60
  customColName: string; // e.g. "Vault Counter No" or "Lab Table"
  members: RosterMember[];
}

export interface AttendanceLog {
  id: number;
  rosterId: number;
  rosterName: string;
  memberId: number;
  name: string;
  customVal: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM:SS AM/PM"
  status: AttendanceStatus;
  verifiedMethod: string; // "Local Device PIN"
  liveSnapshotBase64?: string; // Captured webcam proof
  registeredPhotoBase64?: string; // Snapshot of official profile photo at verification
  shiftWindow?: string; // e.g. "08:00 AM - 04:00 PM"
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}
