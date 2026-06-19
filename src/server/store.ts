import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import type {
  BootstrapData,
  CampSession,
  ItineraryPoint,
  Report,
  ReportStatus,
  Role,
  Team
} from "../shared/types";

type DbShape = {
  sessions: CampSession[];
  teams: Team[];
  points: ItineraryPoint[];
  reports: Report[];
};

const dataDir = path.resolve(process.cwd(), "data");
const dbPath = path.join(dataDir, "dev-db.json");

const roles: BootstrapData["roles"] = [
  { value: "coach", label: "教练" },
  { value: "teacher", label: "老师" },
  { value: "guide", label: "导游" },
  { value: "supervisor", label: "督导" }
];

const categories = ["人员", "餐饮", "景点", "交通", "酒店", "家长反馈", "学生情况", "老师情况", "其他"];

function seedDb(): DbShape {
  const sessionId = nanoid();
  const teamA = nanoid();
  const teamB = nanoid();

  return {
    sessions: [
      {
        id: sessionId,
        name: "西安第一期",
        city: "西安",
        startsOn: "2026-07-01",
        endsOn: "2026-07-07"
      }
    ],
    teams: [
      { id: teamA, sessionId, name: "红队" },
      { id: teamB, sessionId, name: "黄队" }
    ],
    points: [
      { id: nanoid(), sessionId, teamId: teamA, name: "出发", sortOrder: 1 },
      { id: nanoid(), sessionId, teamId: teamA, name: "景点", sortOrder: 2 },
      { id: nanoid(), sessionId, teamId: teamA, name: "午餐", sortOrder: 3 },
      { id: nanoid(), sessionId, teamId: teamB, name: "出发", sortOrder: 1 },
      { id: nanoid(), sessionId, teamId: teamB, name: "景点", sortOrder: 2 },
      { id: nanoid(), sessionId, teamId: teamB, name: "午餐", sortOrder: 3 }
    ],
    reports: []
  };
}

async function readDb(): Promise<DbShape> {
  try {
    const raw = await readFile(dbPath, "utf8");
    return JSON.parse(raw) as DbShape;
  } catch {
    const seeded = seedDb();
    await writeDb(seeded);
    return seeded;
  }
}

async function writeDb(db: DbShape) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
}

export async function getBootstrap(): Promise<BootstrapData> {
  const db = await readDb();
  return {
    sessions: db.sessions,
    teams: db.teams,
    points: db.points,
    categories,
    roles
  };
}

export async function createReport(input: {
  reporterName: string;
  reporterRole: Role;
  sessionId: string;
  teamId?: string;
  pointId?: string;
  category: string;
  content: string;
  isUrgent: boolean;
  affectsSettlement: boolean;
  imageUrls: string[];
}) {
  const db = await readDb();
  const now = new Date().toISOString();
  const report: Report = {
    id: nanoid(),
    status: "open",
    createdAt: now,
    updatedAt: now,
    ...input
  };

  db.reports.unshift(report);
  await writeDb(db);
  return report;
}

export async function listReports(filters: {
  sessionId?: string;
  role?: Role;
  category?: string;
  status?: ReportStatus;
}) {
  const db = await readDb();
  return db.reports.filter((report) => {
    if (filters.sessionId && report.sessionId !== filters.sessionId) return false;
    if (filters.role && report.reporterRole !== filters.role) return false;
    if (filters.category && report.category !== filters.category) return false;
    if (filters.status && report.status !== filters.status) return false;
    return true;
  });
}

export async function updateReportStatus(id: string, status: ReportStatus) {
  const db = await readDb();
  const report = db.reports.find((item) => item.id === id);
  if (!report) return null;

  report.status = status;
  report.updatedAt = new Date().toISOString();
  await writeDb(db);
  return report;
}

export async function getLookupMaps() {
  const db = await readDb();
  return {
    sessions: new Map(db.sessions.map((item) => [item.id, item])),
    teams: new Map(db.teams.map((item) => [item.id, item])),
    points: new Map(db.points.map((item) => [item.id, item]))
  };
}

export function roleLabel(role: Role) {
  return roles.find((item) => item.value === role)?.label ?? role;
}
