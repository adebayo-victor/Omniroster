import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { generateCSV } from './csvExport';
import {
  generateOptimizedRoster,
  type GeneratedShift,
  type RosterConstraintConfig,
  type RosterOptimizationResult,
  DEFAULT_SHIFT_DEFINITIONS,
} from './rosterAlgorithm';

export interface Employee {
  id: string;
  fullName: string;
  pin: string; // 4-digit PIN string
  faceDescriptor: number[]; // 128-D vector
  role: string; // free text string (e.g. 'Bartender', 'Security Lead', 'Teller')
  department: string;
  profilePhotoBase64?: string;
  createdAt: string;
}

export type FolderType = 'simple_shift' | 'optimized_roster';

export interface Folder {
  id: string;
  name: string; // e.g. "Morning Shift - Security", "Hospital Ward - 24/7 Roster"
  type: FolderType;
  // Simple Shift attributes
  startTime?: string; // e.g. "09:00", "22:00"
  gracePeriodMinutes?: number; // e.g. 15
  // Optimized Roster attributes
  rosterConfig?: RosterConstraintConfig;
  generatedShifts?: GeneratedShift[];
  assignedEmployeeIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  folderId: string;
  folderName: string;
  timestamp: string; // ISO 8601 string
  status: 'on_time' | 'early' | 'late' | 'duplicate';
  snapshotBase64: string;
  matchedConfidence: number;
}

export interface SettingsRecord {
  id: 'admin_pin';
  pin: string;
  isFirstLogin: boolean;
}

interface OmniRosterDB extends DBSchema {
  employees: {
    key: string;
    value: Employee;
  };
  folders: {
    key: string;
    value: Folder;
  };
  attendance: {
    key: string;
    value: AttendanceRecord;
    indexes: {
      'by-employee': string;
      'by-folder': string;
      'by-timestamp': string;
    };
  };
  settings: {
    key: string;
    value: SettingsRecord;
  };
}

const DB_NAME = 'omniroster_os_db';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<OmniRosterDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<OmniRosterDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OmniRosterDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('employees', { keyPath: 'id' });
          db.createObjectStore('folders', { keyPath: 'id' });
          const attendanceStore = db.createObjectStore('attendance', { keyPath: 'id' });
          attendanceStore.createIndex('by-employee', 'employeeId');
          attendanceStore.createIndex('by-folder', 'folderId');
          attendanceStore.createIndex('by-timestamp', 'timestamp');
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Seed initial standalone data if database is empty
 */
export async function seedInitialDataIfNeeded(): Promise<void> {
  const db = await getDB();

  // 1. Settings / Admin PIN
  const existingSettings = await db.get('settings', 'admin_pin');
  if (!existingSettings) {
    await db.put('settings', {
      id: 'admin_pin',
      pin: '0000',
      isFirstLogin: true,
    });
  }

  // 2. Initial Sample Employees
  const existingEmployees = await db.getAll('employees');
  if (existingEmployees.length === 0) {
    const dummyDescriptor = (seed: number) => {
      const arr = new Array(128);
      for (let i = 0; i < 128; i++) {
        arr[i] = Math.sin(seed * 100 + i) * 0.15;
      }
      return arr;
    };

    const seedEmployees: Employee[] = [
      {
        id: 'emp-101',
        fullName: 'Alexander Wright',
        pin: '1234',
        faceDescriptor: dummyDescriptor(1),
        role: 'Security Supervisor',
        department: 'Physical Security',
        profilePhotoBase64: '',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'emp-102',
        fullName: 'Elena Rostova',
        pin: '4321',
        faceDescriptor: dummyDescriptor(2),
        role: 'Head Bartender',
        department: 'Hospitality & Bar',
        profilePhotoBase64: '',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'emp-103',
        fullName: 'Marcus Vance',
        pin: '2468',
        faceDescriptor: dummyDescriptor(3),
        role: 'Operations Lead',
        department: 'Operations',
        profilePhotoBase64: '',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'emp-104',
        fullName: 'Sarah Jenkins',
        pin: '1357',
        faceDescriptor: dummyDescriptor(4),
        role: 'Floor Associate',
        department: 'Retail Floor',
        profilePhotoBase64: '',
        createdAt: new Date().toISOString(),
      },
    ];

    const tx = db.transaction('employees', 'readwrite');
    for (const emp of seedEmployees) {
      await tx.store.put(emp);
    }
    await tx.done;
  }

  // 3. Initial Sample Folders: Dual Modes (Simple Shift + Optimized Roster)
  const existingFolders = await db.getAll('folders');
  if (existingFolders.length === 0) {
    const now = new Date().toISOString();
    const todayStr = new Date().toISOString().split('T')[0];

    // Pre-generate CSP schedule for seed roster
    const seedCandidates = [
      { id: 'emp-101', fullName: 'Alexander Wright' },
      { id: 'emp-102', fullName: 'Elena Rostova' },
      { id: 'emp-103', fullName: 'Marcus Vance' },
      { id: 'emp-104', fullName: 'Sarah Jenkins' },
    ];

    const rosterResult = generateOptimizedRoster(seedCandidates, {
      startDate: todayStr,
      daysCount: 7,
      shiftDefinitions: DEFAULT_SHIFT_DEFINITIONS,
      maxConsecutiveDays: 5,
      maxShiftsPerStaff: 5,
    });

    const seedFolders: Folder[] = [
      {
        id: 'folder-morning-security',
        name: 'Morning Shift - Security',
        type: 'simple_shift',
        startTime: '08:00',
        gracePeriodMinutes: 15,
        assignedEmployeeIds: ['emp-101', 'emp-103'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'folder-night-bar',
        name: 'Night Shift - Bar',
        type: 'simple_shift',
        startTime: '18:00',
        gracePeriodMinutes: 15,
        assignedEmployeeIds: ['emp-102'],
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'folder-csp-operations',
        name: '24/7 Operations - CSP Roster',
        type: 'optimized_roster',
        startTime: '08:00',
        gracePeriodMinutes: 15,
        rosterConfig: {
          startDate: todayStr,
          daysCount: 7,
          shiftDefinitions: DEFAULT_SHIFT_DEFINITIONS,
          maxConsecutiveDays: 5,
          maxShiftsPerStaff: 5,
          minRestHoursBetweenShifts: 8,
        },
        generatedShifts: rosterResult.shifts,
        assignedEmployeeIds: ['emp-101', 'emp-102', 'emp-103', 'emp-104'],
        createdAt: now,
        updatedAt: now,
      },
    ];

    const tx = db.transaction('folders', 'readwrite');
    for (const f of seedFolders) {
      await tx.store.put(f);
    }
    await tx.done;
  }

  // 4. Initial Sample Attendance
  const existingAttendance = await db.getAll('attendance');
  if (existingAttendance.length === 0) {
    const todayStr = new Date().toISOString().split('T')[0];
    const seedAttendance: AttendanceRecord[] = [
      {
        id: 'att-01',
        employeeId: 'emp-101',
        employeeName: 'Alexander Wright',
        folderId: 'folder-morning-security',
        folderName: 'Morning Shift - Security',
        timestamp: `${todayStr}T07:55:00.000Z`,
        status: 'on_time',
        snapshotBase64: '',
        matchedConfidence: 98,
      },
      {
        id: 'att-02',
        employeeId: 'emp-103',
        employeeName: 'Marcus Vance',
        folderId: 'folder-csp-operations',
        folderName: '24/7 Operations - CSP Roster',
        timestamp: `${todayStr}T08:12:00.000Z`,
        status: 'late',
        snapshotBase64: '',
        matchedConfidence: 95,
      },
    ];

    const tx = db.transaction('attendance', 'readwrite');
    for (const a of seedAttendance) {
      await tx.store.put(a);
    }
    await tx.done;
  }
}

/**
 * Calculate Punch Status using Folder's startTime and gracePeriodMinutes:
 * currentTime <= startTime + gracePeriod -> "on_time"
 * currentTime > startTime + gracePeriod -> "late"
 * currentTime < startTime - gracePeriod -> "early"
 */
export function calculatePunchStatus(
  startTimeStr: string,
  gracePeriodMinutes: number,
  nowDate: Date = new Date()
): 'on_time' | 'early' | 'late' {
  const [startHour, startMin] = (startTimeStr || '09:00').split(':').map(Number);
  const startMinutes = (startHour || 0) * 60 + (startMin || 0);

  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const grace = Number(gracePeriodMinutes) || 15;

  const earlyBoundary = startMinutes - grace;
  const lateBoundary = startMinutes + grace;

  if (currentMinutes < earlyBoundary) {
    return 'early';
  } else if (currentMinutes > lateBoundary) {
    return 'late';
  } else {
    return 'on_time';
  }
}

/**
 * Universal Synthetic Service Worker Loopback API Handler
 * Intercepts /api/* requests and resolves them with synthetic Response objects.
 */
export async function handleLoopbackApi(request: Request): Promise<Response> {
  await seedInitialDataIfNeeded();
  const db = await getDB();

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();

  const jsonHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };

  try {
    // -------------------------------------------------------------
    // 1. Settings & Admin Authentication
    // -------------------------------------------------------------
    if (path === '/api/auth/admin' && method === 'POST') {
      const body = (await request.json()) as { pin: string };
      const settings = (await db.get('settings', 'admin_pin')) || {
        id: 'admin_pin',
        pin: '0000',
        isFirstLogin: true,
      };

      if (body.pin === settings.pin) {
        return new Response(
          JSON.stringify({
            success: true,
            isFirstLogin: settings.isFirstLogin,
            message: 'Authenticated successfully',
          }),
          { status: 200, headers: jsonHeaders }
        );
      } else {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid Admin PIN. Default is 0000.' }),
          { status: 401, headers: jsonHeaders }
        );
      }
    }

    if (
      (path === '/api/settings/pin' || path === '/api/settings/admin-pin') &&
      (method === 'POST' || method === 'PUT')
    ) {
      const body = (await request.json()) as { pin?: string; newPin?: string; currentPin?: string };
      const targetPin = body.pin || body.newPin;

      if (!targetPin || targetPin.length !== 4 || !/^\d{4}$/.test(targetPin)) {
        return new Response(
          JSON.stringify({ error: 'PIN must be exactly 4 numeric digits' }),
          { status: 400, headers: jsonHeaders }
        );
      }

      const settings = (await db.get('settings', 'admin_pin')) || {
        id: 'admin_pin',
        pin: '0000',
        isFirstLogin: true,
      };

      if (body.currentPin && body.currentPin !== settings.pin) {
        return new Response(
          JSON.stringify({ error: 'Current PIN does not match' }),
          { status: 403, headers: jsonHeaders }
        );
      }

      await db.put('settings', {
        id: 'admin_pin',
        pin: targetPin,
        isFirstLogin: false,
      });

      return new Response(
        JSON.stringify({ success: true, message: 'Admin Master PIN updated successfully' }),
        { status: 200, headers: jsonHeaders }
      );
    }

    if ((path === '/api/settings' || path === '/api/settings/status') && method === 'GET') {
      const settings = (await db.get('settings', 'admin_pin')) || {
        id: 'admin_pin',
        pin: '0000',
        isFirstLogin: true,
      };
      return new Response(
        JSON.stringify({
          isFirstLogin: settings.isFirstLogin,
          isConfigured: true,
          pinConfigured: settings.pin !== '0000',
        }),
        { status: 200, headers: jsonHeaders }
      );
    }

    // -------------------------------------------------------------
    // 2. Employee CRUD API
    // -------------------------------------------------------------
    if (path === '/api/employees' && method === 'GET') {
      const employees = await db.getAll('employees');
      return new Response(JSON.stringify({ employees }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (path === '/api/employees' && method === 'POST') {
      const body = (await request.json()) as Partial<Employee>;
      if (!body.fullName || !body.pin || !body.faceDescriptor) {
        return new Response(
          JSON.stringify({
            error: 'Missing required employee fields: fullName, pin (4-digit), faceDescriptor',
          }),
          { status: 400, headers: jsonHeaders }
        );
      }

      const newEmployee: Employee = {
        id: body.id || `emp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        fullName: body.fullName.trim(),
        pin: String(body.pin).trim(),
        faceDescriptor: body.faceDescriptor,
        role: (body.role || 'Staff').trim(),
        department: (body.department || 'General').trim(),
        profilePhotoBase64: body.profilePhotoBase64 || '',
        createdAt: new Date().toISOString(),
      };

      await db.put('employees', newEmployee);
      return new Response(JSON.stringify({ success: true, employee: newEmployee }), {
        status: 201,
        headers: jsonHeaders,
      });
    }

    if (path.startsWith('/api/employees/') && method === 'PUT') {
      const id = path.replace('/api/employees/', '').trim();
      const existing = await db.get('employees', id);
      if (!existing) {
        return new Response(
          JSON.stringify({ error: 'Employee not found' }),
          { status: 404, headers: jsonHeaders }
        );
      }

      const updates = (await request.json()) as Partial<Employee>;
      const updated: Employee = {
        ...existing,
        fullName: updates.fullName !== undefined ? updates.fullName.trim() : existing.fullName,
        pin: updates.pin !== undefined ? String(updates.pin).trim() : existing.pin,
        faceDescriptor: updates.faceDescriptor !== undefined ? updates.faceDescriptor : existing.faceDescriptor,
        role: updates.role !== undefined ? updates.role.trim() : existing.role,
        department: updates.department !== undefined ? updates.department.trim() : existing.department,
        profilePhotoBase64: updates.profilePhotoBase64 !== undefined ? updates.profilePhotoBase64 : existing.profilePhotoBase64,
      };

      await db.put('employees', updated);
      return new Response(JSON.stringify({ success: true, employee: updated }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (path.startsWith('/api/employees/') && method === 'DELETE') {
      const id = path.replace('/api/employees/', '').trim();
      await db.delete('employees', id);
      return new Response(JSON.stringify({ success: true, deletedId: id }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    // -------------------------------------------------------------
    // 3. Folders API (Simple Shift & Optimized Roster)
    // -------------------------------------------------------------
    if (path === '/api/folders' && method === 'GET') {
      const folders = await db.getAll('folders');
      return new Response(JSON.stringify({ folders }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (path === '/api/folders' && method === 'POST') {
      const body = (await request.json()) as Partial<Folder>;
      if (!body.name) {
        return new Response(
          JSON.stringify({ error: 'Folder name is required' }),
          { status: 400, headers: jsonHeaders }
        );
      }

      const folderType: FolderType = body.type || 'simple_shift';
      const now = new Date().toISOString();

      const newFolder: Folder = {
        id: body.id || `folder-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: body.name.trim(),
        type: folderType,
        startTime: body.startTime || '09:00',
        gracePeriodMinutes: body.gracePeriodMinutes !== undefined ? Number(body.gracePeriodMinutes) : 15,
        rosterConfig: body.rosterConfig,
        generatedShifts: body.generatedShifts || [],
        assignedEmployeeIds: Array.isArray(body.assignedEmployeeIds) ? body.assignedEmployeeIds : [],
        createdAt: now,
        updatedAt: now,
      };

      await db.put('folders', newFolder);
      return new Response(JSON.stringify({ success: true, folder: newFolder }), {
        status: 201,
        headers: jsonHeaders,
      });
    }

    if (path.startsWith('/api/folders/') && method === 'PUT') {
      const id = path.replace('/api/folders/', '').trim();
      const existing = await db.get('folders', id);
      if (!existing) {
        return new Response(
          JSON.stringify({ error: 'Folder not found' }),
          { status: 404, headers: jsonHeaders }
        );
      }

      const updates = (await request.json()) as Partial<Folder>;
      const updated: Folder = {
        ...existing,
        name: updates.name !== undefined ? updates.name.trim() : existing.name,
        type: updates.type !== undefined ? updates.type : (existing.type || 'simple_shift'),
        startTime: updates.startTime !== undefined ? updates.startTime : (existing.startTime || '09:00'),
        gracePeriodMinutes: updates.gracePeriodMinutes !== undefined ? Number(updates.gracePeriodMinutes) : (existing.gracePeriodMinutes || 15),
        rosterConfig: updates.rosterConfig !== undefined ? updates.rosterConfig : existing.rosterConfig,
        generatedShifts: updates.generatedShifts !== undefined ? updates.generatedShifts : existing.generatedShifts,
        assignedEmployeeIds: updates.assignedEmployeeIds !== undefined ? updates.assignedEmployeeIds : existing.assignedEmployeeIds,
        updatedAt: new Date().toISOString(),
      };

      await db.put('folders', updated);
      return new Response(JSON.stringify({ success: true, folder: updated }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (path.startsWith('/api/folders/') && method === 'DELETE') {
      const id = path.replace('/api/folders/', '').trim();
      await db.delete('folders', id);
      return new Response(JSON.stringify({ success: true, deletedId: id }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    // CSP Roster Optimization Endpoint
    if (path === '/api/roster/optimize' && method === 'POST') {
      const body = (await request.json()) as {
        employeeIds?: string[];
        config: RosterConstraintConfig;
      };

      const allEmployees = await db.getAll('employees');
      const candidatePool = body.employeeIds && body.employeeIds.length > 0
        ? allEmployees.filter((e) => body.employeeIds!.includes(e.id))
        : allEmployees;

      const result: RosterOptimizationResult = generateOptimizedRoster(candidatePool, body.config);
      return new Response(JSON.stringify({ success: true, result }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    // -------------------------------------------------------------
    // 4. Attendance API
    // POST /api/attendance/punch (Duplicate check + status calculation)
    // GET /api/attendance (search, dateFrom, dateTo, status)
    // GET /api/attendance/export (Custom column RFC-4180 CSV)
    // -------------------------------------------------------------
    if (path === '/api/attendance/punch' && method === 'POST') {
      const body = (await request.json()) as {
        employeeId: string;
        employeeName?: string;
        folderId: string;
        snapshotBase64?: string;
        matchedConfidence?: number;
        allowDuplicate?: boolean;
      };

      if (!body.employeeId || !body.folderId) {
        return new Response(
          JSON.stringify({ error: 'employeeId and folderId are required' }),
          { status: 400, headers: jsonHeaders }
        );
      }

      const folder = await db.get('folders', body.folderId);
      if (!folder) {
        return new Response(
          JSON.stringify({ error: 'Folder not found' }),
          { status: 404, headers: jsonHeaders }
        );
      }

      const employee = await db.get('employees', body.employeeId);
      const employeeName = employee?.fullName || body.employeeName || 'Unknown Employee';

      const now = new Date();
      const todayDateStr = now.toISOString().split('T')[0];

      // Duplicate Check-In Detection:
      const allAttendance = await db.getAll('attendance');
      const existingPunchToday = allAttendance.find(
        (a) =>
          a.employeeId === body.employeeId &&
          a.folderId === body.folderId &&
          a.timestamp.startsWith(todayDateStr)
      );

      if (existingPunchToday && !body.allowDuplicate) {
        return new Response(
          JSON.stringify({
            duplicate: true,
            message: `You have already checked in for ${folder.name} today at ${new Date(
              existingPunchToday.timestamp
            ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
            existingPunch: existingPunchToday,
          }),
          { status: 409, headers: jsonHeaders }
        );
      }

      // Calculate status based on folder type:
      let calculatedStatus: 'on_time' | 'early' | 'late' | 'duplicate' = 'on_time';
      if (existingPunchToday) {
        calculatedStatus = 'duplicate';
      } else if (folder.type === 'optimized_roster' && folder.generatedShifts && folder.generatedShifts.length > 0) {
        const todayAssignedShift = folder.generatedShifts.find(
          (s) => s.dateStr === todayDateStr && s.staffAssigned?.includes(body.employeeId)
        );

        if (todayAssignedShift) {
          calculatedStatus = calculatePunchStatus(
            todayAssignedShift.startTime,
            todayAssignedShift.gracePeriodMinutes || 15,
            now
          );
        } else {
          const todayShifts = folder.generatedShifts.filter((s) => s.dateStr === todayDateStr);
          if (todayShifts.length > 0) {
            calculatedStatus = calculatePunchStatus(
              todayShifts[0].startTime,
              todayShifts[0].gracePeriodMinutes || 15,
              now
            );
          } else {
            calculatedStatus = calculatePunchStatus(
              folder.startTime || '09:00',
              folder.gracePeriodMinutes || 15,
              now
            );
          }
        }
      } else {
        // Simple Shift logic
        calculatedStatus = calculatePunchStatus(
          folder.startTime || '09:00',
          folder.gracePeriodMinutes || 15,
          now
        );
      }

      const record: AttendanceRecord = {
        id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        employeeId: body.employeeId,
        employeeName,
        folderId: folder.id,
        folderName: folder.name,
        timestamp: now.toISOString(),
        status: calculatedStatus,
        snapshotBase64: body.snapshotBase64 || '',
        matchedConfidence: body.matchedConfidence || 95,
      };

      await db.put('attendance', record);
      return new Response(JSON.stringify({ success: true, record }), {
        status: 201,
        headers: jsonHeaders,
      });
    }

    if (path === '/api/attendance' && method === 'GET') {
      const searchParam = url.searchParams.get('search')?.toLowerCase() || '';
      const dateFrom = url.searchParams.get('dateFrom') || '';
      const dateTo = url.searchParams.get('dateTo') || '';
      const statusParam = url.searchParams.get('status')?.toLowerCase() || 'all';

      let records = await db.getAll('attendance');

      records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (searchParam) {
        records = records.filter(
          (r) =>
            r.employeeName.toLowerCase().includes(searchParam) ||
            r.folderName.toLowerCase().includes(searchParam) ||
            r.employeeId.toLowerCase().includes(searchParam)
        );
      }

      if (dateFrom) {
        records = records.filter((r) => r.timestamp.slice(0, 10) >= dateFrom);
      }

      if (dateTo) {
        records = records.filter((r) => r.timestamp.slice(0, 10) <= dateTo);
      }

      if (statusParam && statusParam !== 'all') {
        records = records.filter((r) => r.status.toLowerCase() === statusParam);
      }

      return new Response(JSON.stringify({ attendance: records }), {
        status: 200,
        headers: jsonHeaders,
      });
    }

    if (path === '/api/attendance/export' && method === 'GET') {
      const searchParam = url.searchParams.get('search')?.toLowerCase() || '';
      const dateFrom = url.searchParams.get('dateFrom') || '';
      const dateTo = url.searchParams.get('dateTo') || '';
      const statusParam = url.searchParams.get('status')?.toLowerCase() || 'all';

      const colsParam = url.searchParams.get('columns') || 'name,folder,datetime,status';
      const colList = colsParam.split(',').map((c) => c.trim().toLowerCase());

      let records = await db.getAll('attendance');
      records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      if (searchParam) {
        records = records.filter(
          (r) =>
            r.employeeName.toLowerCase().includes(searchParam) ||
            r.folderName.toLowerCase().includes(searchParam)
        );
      }

      if (dateFrom) {
        records = records.filter((r) => r.timestamp.slice(0, 10) >= dateFrom);
      }

      if (dateTo) {
        records = records.filter((r) => r.timestamp.slice(0, 10) <= dateTo);
      }

      if (statusParam && statusParam !== 'all') {
        records = records.filter((r) => r.status.toLowerCase() === statusParam);
      }

      const headers: string[] = [];
      if (colList.includes('id')) headers.push('Record ID');
      if (colList.includes('name')) headers.push('Employee Name');
      if (colList.includes('employeeid')) headers.push('Employee ID');
      if (colList.includes('folder')) headers.push('Shift Folder');
      if (colList.includes('datetime')) headers.push('Date & Time');
      if (colList.includes('status')) headers.push('Status');
      if (colList.includes('confidence')) headers.push('Biometric Confidence');

      const rows = records.map((r) => {
        const row: (string | number)[] = [];
        if (colList.includes('id')) row.push(r.id);
        if (colList.includes('name')) row.push(r.employeeName);
        if (colList.includes('employeeid')) row.push(r.employeeId);
        if (colList.includes('folder')) row.push(r.folderName);
        if (colList.includes('datetime')) row.push(new Date(r.timestamp).toLocaleString());
        if (colList.includes('status')) row.push(r.status.toUpperCase());
        if (colList.includes('confidence')) row.push(`${r.matchedConfidence}%`);
        return row;
      });

      const csvString = generateCSV(headers, rows);
      return new Response(csvString, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="attendance-export-${Date.now()}.csv"`,
        },
      });
    }

    // -------------------------------------------------------------
    // Fallback 404 for unknown /api/*
    // -------------------------------------------------------------
    return new Response(
      JSON.stringify({ error: `Not found: ${method} ${path}` }),
      { status: 404, headers: jsonHeaders }
    );
  } catch (err: any) {
    console.error('[SW Loopback Gateway] Error processing request:', err);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error', details: err?.message || String(err) }),
      { status: 500, headers: jsonHeaders }
    );
  }
}
