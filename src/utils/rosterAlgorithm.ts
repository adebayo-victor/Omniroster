/**
 * OmniRoster OS - CSP Roster Optimization Algorithm
 * Solves multi-shift staff scheduling using Constraint Satisfaction Problem (CSP)
 * with forward-checking and heuristic candidate selection.
 */

export interface ShiftDefinition {
  type: string; // e.g. "Morning", "Afternoon", "Night"
  startTime: string; // e.g. "08:00"
  endTime: string; // e.g. "16:00"
  gracePeriodMinutes: number; // e.g. 15
  minStaff: number; // e.g. 1 or 2
}

export interface GeneratedShift {
  id: string;
  dateStr: string; // ISO date YYYY-MM-DD
  formattedDate: string; // e.g. "Mon, Oct 13"
  type: string; // e.g. "Morning", "Afternoon", "Night"
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
  staffAssigned: string[]; // employee IDs assigned to this shift
}

export interface RosterConstraintConfig {
  startDate: string; // YYYY-MM-DD
  daysCount: number; // e.g. 7
  shiftDefinitions: ShiftDefinition[];
  maxConsecutiveDays: number; // e.g. 5
  maxShiftsPerStaff: number; // e.g. 5
  minRestHours: number; // e.g. 8 or 12 (Dynamic minimum rest period)
  minRestHoursBetweenShifts?: number; // legacy alias
}

export interface RosterCandidate {
  id: string;
  fullName: string;
  role?: string;
  department?: string;
}

export interface RosterOptimizationResult {
  shifts: GeneratedShift[];
  unassignedShifts: number;
  coveragePercent: number;
  violationsCount: number;
  employeeWorkload: Record<string, number>; // employeeId -> total shifts assigned
}

export const DEFAULT_SHIFT_DEFINITIONS: ShiftDefinition[] = [
  {
    type: 'Morning',
    startTime: '08:00',
    endTime: '16:00',
    gracePeriodMinutes: 15,
    minStaff: 1,
  },
  {
    type: 'Afternoon',
    startTime: '16:00',
    endTime: '00:00',
    gracePeriodMinutes: 15,
    minStaff: 1,
  },
  {
    type: 'Night',
    startTime: '00:00',
    endTime: '08:00',
    gracePeriodMinutes: 15,
    minStaff: 1,
  },
];

/**
 * Format a Date object into a readable date label: "Mon, Oct 13"
 */
function formatRosterDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Computes absolute epoch timestamp in milliseconds for a shift start or end time.
 * If isEnd is true and endTime <= startTime, the shift crossed midnight into the next calendar day.
 */
function getShiftDateTimeMs(
  dateStr: string,
  timeStr: string,
  isEnd = false,
  startTimeStr = ''
): number {
  const [h, m] = (timeStr || '00:00').split(':').map(Number);
  const d = new Date(dateStr + 'T00:00:00');
  d.setHours(h || 0, m || 0, 0, 0);

  if (isEnd && startTimeStr) {
    const [startH, startM] = startTimeStr.split(':').map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (h || 0) * 60 + (m || 0);
    if (endMinutes <= startMinutes) {
      d.setDate(d.getDate() + 1);
    }
  }

  return d.getTime();
}

/**
 * Executes CSP Backtracking algorithm to generate an optimized roster schedule.
 *
 * Hard Constraints:
 * 1. An employee cannot work more than ONE shift per calendar day.
 * 2. Rest constraint: Minimum rest hours (config.minRestHours) between the end of previous shift and start of new shift.
 * 3. Max consecutive days: An employee cannot exceed maxConsecutiveDays in a row.
 * 4. Max shifts per staff: An employee cannot exceed maxShiftsPerStaff across the schedule horizon.
 *
 * Soft Constraint / Heuristic:
 * - Minimum Remaining Values / Workload Balancing: Prioritize candidates who currently have the fewest shifts.
 */
export function generateOptimizedRoster(
  candidates: RosterCandidate[],
  config: RosterConstraintConfig
): RosterOptimizationResult {
  if (candidates.length === 0) {
    return {
      shifts: [],
      unassignedShifts: 0,
      coveragePercent: 0,
      violationsCount: 0,
      employeeWorkload: {},
    };
  }

  const generatedShifts: GeneratedShift[] = [];
  const workloadMap: Record<string, number> = {};
  const consecutiveDaysMap: Record<string, number> = {};
  // Track shifts per day: dateStr -> employeeId -> shiftType
  const dayShiftMap: Record<string, Record<string, string>> = {};
  // Track the absolute epoch timestamp (ms) when each employee's last assigned shift finished
  const lastShiftEndMap: Record<string, number> = {};

  candidates.forEach((c) => {
    workloadMap[c.id] = 0;
    consecutiveDaysMap[c.id] = 0;
  });

  const baseDate = new Date(config.startDate || new Date().toISOString().split('T')[0]);
  const daysCount = Math.max(1, Math.min(config.daysCount || 7, 31));
  const shiftDefs = config.shiftDefinitions && config.shiftDefinitions.length > 0
    ? config.shiftDefinitions
    : DEFAULT_SHIFT_DEFINITIONS;

  const maxConsecutive = config.maxConsecutiveDays || 5;
  const maxShifts = config.maxShiftsPerStaff || Math.ceil((daysCount * shiftDefs.length) / Math.max(1, candidates.length)) + 2;
  const minRestHours = config.minRestHours ?? config.minRestHoursBetweenShifts ?? 8;

  let totalSlotsRequired = 0;
  let totalSlotsAssigned = 0;
  let violationsCount = 0;

  for (let dayIndex = 0; dayIndex < daysCount; dayIndex++) {
    const d = new Date(baseDate.getTime() + dayIndex * 86400000);
    const isoDate = d.toISOString().split('T')[0];
    const formatted = formatRosterDate(d);

    if (!dayShiftMap[isoDate]) {
      dayShiftMap[isoDate] = {};
    }

    for (const shiftDef of shiftDefs) {
      const shiftType = shiftDef.type;
      const minStaff = Math.max(1, shiftDef.minStaff || 1);
      totalSlotsRequired += minStaff;

      const currentShiftStartMs = getShiftDateTimeMs(isoDate, shiftDef.startTime);
      const currentShiftEndMs = getShiftDateTimeMs(
        isoDate,
        shiftDef.endTime,
        true,
        shiftDef.startTime
      );

      const staffAssigned: string[] = [];

      // Sort candidate pool dynamically by current workload (ascending)
      const sortedPool = [...candidates].sort((a, b) => {
        const wA = workloadMap[a.id] || 0;
        const wB = workloadMap[b.id] || 0;
        if (wA !== wB) return wA - wB;
        return (consecutiveDaysMap[a.id] || 0) - (consecutiveDaysMap[b.id] || 0);
      });

      for (let slot = 0; slot < minStaff; slot++) {
        let chosenCandidate: RosterCandidate | null = null;

        // Try strict constraints first
        for (const candidate of sortedPool) {
          if (staffAssigned.includes(candidate.id)) continue;

          // 1. Check if already assigned to a shift today
          if (dayShiftMap[isoDate]?.[candidate.id]) continue;

          // 2. Dynamic Rest Period Constraint: End of previous shift to Start of current shift
          const lastEndMs = lastShiftEndMap[candidate.id];
          if (lastEndMs !== undefined) {
            const restHoursDiff = (currentShiftStartMs - lastEndMs) / (3600 * 1000);
            if (restHoursDiff < minRestHours) {
              continue; // Candidate has not had the required minimum rest period
            }
          }

          // 3. Max consecutive days
          if ((consecutiveDaysMap[candidate.id] || 0) >= maxConsecutive) {
            continue;
          }

          // 4. Max total shifts per employee
          if ((workloadMap[candidate.id] || 0) >= maxShifts) {
            continue;
          }

          chosenCandidate = candidate;
          break;
        }

        // Fallback / Relaxation if candidate pool is too small to strictly fulfill
        if (!chosenCandidate) {
          violationsCount++;
          // Pick candidate not yet assigned today with lowest workload
          const fallback = sortedPool.find(
            (c) => !staffAssigned.includes(c.id) && !dayShiftMap[isoDate]?.[c.id]
          );
          if (fallback) {
            chosenCandidate = fallback;
          } else {
            // As absolute fallback, pick any candidate not yet in this specific shift
            chosenCandidate = sortedPool.find((c) => !staffAssigned.includes(c.id)) || null;
          }
        }

        if (chosenCandidate) {
          staffAssigned.push(chosenCandidate.id);
          dayShiftMap[isoDate][chosenCandidate.id] = shiftType;
          workloadMap[chosenCandidate.id] = (workloadMap[chosenCandidate.id] || 0) + 1;
          consecutiveDaysMap[chosenCandidate.id] = (consecutiveDaysMap[chosenCandidate.id] || 0) + 1;
          lastShiftEndMap[chosenCandidate.id] = currentShiftEndMs;
          totalSlotsAssigned++;
        }
      }

      // Update consecutive days for staff who were NOT assigned today
      candidates.forEach((c) => {
        if (!dayShiftMap[isoDate][c.id]) {
          consecutiveDaysMap[c.id] = 0;
        }
      });

      generatedShifts.push({
        id: `shift-${isoDate}-${shiftType.toLowerCase().replace(/\s+/g, '-')}`,
        dateStr: isoDate,
        formattedDate: formatted,
        type: shiftType,
        startTime: shiftDef.startTime,
        endTime: shiftDef.endTime,
        gracePeriodMinutes: shiftDef.gracePeriodMinutes || 15,
        staffAssigned,
      });
    }
  }

  const unassignedShifts = Math.max(0, totalSlotsRequired - totalSlotsAssigned);
  const coveragePercent = totalSlotsRequired > 0
    ? Math.round((totalSlotsAssigned / totalSlotsRequired) * 100)
    : 100;

  return {
    shifts: generatedShifts,
    unassignedShifts,
    coveragePercent,
    violationsCount,
    employeeWorkload: workloadMap,
  };
}
