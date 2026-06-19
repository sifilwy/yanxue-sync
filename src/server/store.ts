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

type RoleOption = BootstrapData["roles"][number];

type DbShape = {
  sessions: CampSession[];
  teams: Team[];
  points: ItineraryPoint[];
  categories: string[];
  roles: RoleOption[];
  reports: Report[];
};

const dataDir = path.resolve(process.cwd(), "data");
const dbPath = path.join(dataDir, "dev-db.json");

const defaultRoles: RoleOption[] = [
  { value: "coach", label: "教练" },
  { value: "teacher", label: "老师" },
  { value: "guide", label: "导游" },
  { value: "supervisor", label: "督导" }
];

const defaultCategories = ["人员", "餐饮", "景点", "交通", "酒店", "家长反馈", "学生情况", "老师情况", "其他"];

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
    categories: defaultCategories,
    roles: defaultRoles,
    reports: []
  };
}

function normalizeDb(db: Partial<DbShape>): DbShape {
  return {
    sessions: db.sessions ?? [],
    teams: db.teams ?? [],
    points: db.points ?? [],
    categories: db.categories?.length ? db.categories : defaultCategories,
    roles: db.roles?.length ? db.roles : defaultRoles,
    reports: db.reports ?? []
  };
}

async function readDb(): Promise<DbShape> {
  try {
    const raw = await readFile(dbPath, "utf8");
    const db = normalizeDb(JSON.parse(raw) as Partial<DbShape>);
    return db;
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
    categories: db.categories,
    roles: db.roles
  };
}

export async function saveSession(input: Omit<CampSession, "id"> & { id?: string }) {
  const db = await readDb();
  const session: CampSession = { id: input.id || nanoid(), ...input };
  const index = db.sessions.findIndex((item) => item.id === session.id);
  if (index >= 0) db.sessions[index] = session;
  else db.sessions.push(session);
  await writeDb(db);
  return session;
}

export async function deleteSession(id: string) {
  const db = await readDb();
  db.sessions = db.sessions.filter((item) => item.id !== id);
  db.teams = db.teams.filter((item) => item.sessionId !== id);
  db.points = db.points.filter((item) => item.sessionId !== id);
  await writeDb(db);
}

export async function saveTeam(input: Omit<Team, "id"> & { id?: string }) {
  const db = await readDb();
  const team: Team = { id: input.id || nanoid(), ...input };
  const index = db.teams.findIndex((item) => item.id === team.id);
  if (index >= 0) db.teams[index] = team;
  else db.teams.push(team);
  await writeDb(db);
  return team;
}

export async function deleteTeam(id: string) {
  const db = await readDb();
  db.teams = db.teams.filter((item) => item.id !== id);
  db.points = db.points.filter((item) => item.teamId !== id);
  await writeDb(db);
}

export async function savePoint(input: Omit<ItineraryPoint, "id"> & { id?: string }) {
  const db = await readDb();
  const point: ItineraryPoint = { id: input.id || nanoid(), ...input };
  const index = db.points.findIndex((item) => item.id === point.id);
  if (index >= 0) db.points[index] = point;
  else db.points.push(point);
  await writeDb(db);
  return point;
}

export async function deletePoint(id: string) {
  const db = await readDb();
  db.points = db.points.filter((item) => item.id !== id);
  await writeDb(db);
}

export async function saveCategories(categories: string[]) {
  const db = await readDb();
  db.categories = categories.map((item) => item.trim()).filter(Boolean);
  await writeDb(db);
  return db.categories;
}

export async function saveRoles(roles: RoleOption[]) {
  const db = await readDb();
  db.roles = roles;
  await writeDb(db);
  return db.roles;
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
  return defaultRoles.find((item) => item.value === role)?.label ?? role;
}
