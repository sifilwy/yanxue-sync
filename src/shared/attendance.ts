import type { AttendancePoint, AttendanceStatus } from "./types";

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  pending: "未点",
  present: "已到",
  absent: "未到"
};

export const attendanceDayCount = 7;
export const attendanceProcessCount = 8;

export const defaultAttendanceProcessNames = [
  "集合出发",
  "上车点名",
  "抵达场馆",
  "上午活动",
  "午餐集合",
  "下午活动",
  "返程上车",
  "回到酒店"
];

export function buildDefaultAttendancePoints(): AttendancePoint[] {
  return Array.from({ length: attendanceDayCount }).flatMap((_, dayIndex) => (
    defaultAttendanceProcessNames.map((name, processIndex) => ({
      id: `attendance-d${dayIndex + 1}-p${processIndex + 1}`,
      name,
      dayIndex: dayIndex + 1,
      processIndex: processIndex + 1,
      sortOrder: dayIndex * attendanceProcessCount + processIndex + 1
    }))
  ));
}

export function normalizeAttendancePoints(points: AttendancePoint[]): AttendancePoint[] {
  const normalized = points.map((point, index) => {
    const sortOrder = point.sortOrder || index + 1;
    const dayIndex = point.dayIndex || Math.floor((sortOrder - 1) / attendanceProcessCount) + 1;
    const processIndex = point.processIndex || ((sortOrder - 1) % attendanceProcessCount) + 1;
    return { ...point, dayIndex, processIndex, sortOrder };
  });

  if (
    normalized.length >= attendanceDayCount * attendanceProcessCount &&
    normalized.every((point) => point.dayIndex && point.processIndex)
  ) {
    return normalized;
  }

  const baseProcesses = normalized.slice(0, attendanceProcessCount);
  if (!baseProcesses.length) return [];

  return Array.from({ length: attendanceDayCount }).flatMap((_, dayIndex) => (
    baseProcesses.map((point, processIndex) => ({
      ...point,
      id: `attendance-d${dayIndex + 1}-p${processIndex + 1}`,
      dayIndex: dayIndex + 1,
      processIndex: processIndex + 1,
      sortOrder: dayIndex * attendanceProcessCount + processIndex + 1
    }))
  ));
}
