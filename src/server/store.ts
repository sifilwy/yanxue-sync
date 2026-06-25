import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { attendanceProcessCount, buildDefaultAttendancePoints, defaultAttendanceProcessNames } from "../shared/attendance";
import { hasSecondChild, hasSecondParent, hasThirdParent, inferFamilyType } from "../shared/people";
import type {
  AttendanceFamilySummary,
  AttendancePoint,
  AttendanceRecord,
  AttendanceRecordInput,
  BootstrapData,
  CampSession,
  ItineraryPoint,
  Participant,
  Report,
  ReportStatus,
  Role,
  StaffMember,
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
  staffMembers: StaffMember[];
  participants: Participant[];
  attendancePoints: AttendancePoint[];
  attendanceRecords: AttendanceRecord[];
};

const dataDir = path.resolve(process.cwd(), "data");
const dbPath = path.join(dataDir, "dev-db.json");
const uploadDir = path.join(dataDir, "uploads");
const maxInlineImageLength = 450_000;

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
    reports: [],
    staffMembers: [],
    participants: [],
    attendancePoints: seedAttendancePoints(),
    attendanceRecords: []
  };
}

function seedAttendancePoints() {
  return buildDefaultAttendancePoints();
}

function normalizeDb(db: Partial<DbShape>): DbShape {
  const attendancePoints = db.attendancePoints?.length && db.attendancePoints.length >= 56 ? db.attendancePoints : seedAttendancePoints();
  return {
    sessions: db.sessions ?? [],
    teams: db.teams ?? [],
    points: db.points ?? [],
    categories: db.categories?.length ? db.categories : defaultCategories,
    roles: db.roles?.length ? db.roles : defaultRoles,
    reports: db.reports ?? [],
    staffMembers: (db.staffMembers ?? []).map(normalizeStaffMember),
    participants: (db.participants ?? []).map(normalizeParticipant),
    attendancePoints: attendancePoints.map(normalizeAttendancePoint),
    attendanceRecords: (db.attendanceRecords ?? []).map(normalizeAttendanceRecord)
  };
}

function normalizeAttendancePoint(item: Partial<AttendancePoint>, index = 0): AttendancePoint {
  const sortOrder = item.sortOrder ?? index + 1;
  const zeroIndex = sortOrder - 1;
  const dayIndex = item.dayIndex ?? Math.floor(zeroIndex / attendanceProcessCount) + 1;
  const processIndex = item.processIndex ?? (zeroIndex % attendanceProcessCount) + 1;
  return {
    id: item.id ?? `attendance-d${dayIndex}-p${processIndex}`,
    name: item.name ?? defaultAttendanceProcessNames[processIndex - 1] ?? `流程${processIndex}`,
    dayIndex,
    processIndex,
    sortOrder
  };
}

function normalizeAttendanceRecord(item: Partial<AttendanceRecord>): AttendanceRecord {
  return {
    id: item.id ?? nanoid(),
    pointId: item.pointId ?? "",
    participantId: item.participantId ?? "",
    status: item.status ?? "pending",
    note: item.note ?? "",
    updatedAt: item.updatedAt ?? new Date().toISOString()
  };
}

function normalizeStaffMember(item: Partial<StaffMember>): StaffMember {
  const now = new Date().toISOString();
  return {
    id: item.id ?? nanoid(),
    groupName: item.groupName ?? "一团",
    sequence: item.sequence ?? "",
    type: item.type ?? "工作人员",
    name: item.name ?? "",
    idCard: item.idCard ?? "",
    gender: item.gender ?? "",
    phone: item.phone ?? "",
    createdAt: item.createdAt ?? now,
    updatedAt: item.updatedAt ?? now
  };
}

function normalizeParticipant(item: Partial<Participant> & {
  name?: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
}): Participant {
  const now = new Date().toISOString();
  return {
    id: item.id ?? nanoid(),
    groupName: item.groupName ?? "一团",
    sequence: item.sequence ?? "",
    familyType: inferFamilyType(item),
    parent1Name: item.parent1Name ?? item.parentName ?? "",
    parent1IdCard: item.parent1IdCard ?? "",
    parent1Phone: item.parent1Phone ?? item.parentPhone ?? "",
    parent2Name: item.parent2Name ?? "",
    parent2IdCard: item.parent2IdCard ?? "",
    parent2Phone: item.parent2Phone ?? "",
    parent3Name: item.parent3Name ?? "",
    parent3IdCard: item.parent3IdCard ?? "",
    parent3Phone: item.parent3Phone ?? "",
    childName: item.childName ?? item.name ?? "",
    childIdCard: item.childIdCard ?? "",
    childGender: item.childGender ?? "",
    childHeight: item.childHeight ?? "",
    childWeight: item.childWeight ?? "",
    childSize: item.childSize ?? "",
    child2Name: item.child2Name ?? "",
    child2IdCard: item.child2IdCard ?? "",
    child2Gender: item.child2Gender ?? "",
    child2Height: item.child2Height ?? "",
    child2Weight: item.child2Weight ?? "",
    child2Size: item.child2Size ?? "",
    roomNumber: item.roomNumber ?? "",
    roomType: item.roomType ?? "",
    note: item.note ?? "",
    createdAt: item.createdAt ?? now,
    updatedAt: item.updatedAt ?? now
  };
}

async function readDb(): Promise<DbShape> {
  try {
    const raw = await readFile(dbPath, "utf8");
    const db = normalizeDb(JSON.parse(raw) as Partial<DbShape>);
    const sequenceChanged = ensureParticipantSequences(db);
    const imageChanged = await migrateEmbeddedImages(db);
    if (sequenceChanged || imageChanged) {
      await writeDb(db);
    }
    return db;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    const seeded = seedDb();
    await writeDb(seeded);
    return seeded;
  }
}

async function migrateEmbeddedImages(db: DbShape) {
  let changed = false;
  await mkdir(uploadDir, { recursive: true });

  for (const report of db.reports) {
    const nextUrls: string[] = [];
    const nextThumbUrls: string[] = [];
    for (const url of report.imageUrls ?? []) {
      if (!url.startsWith("data:image/")) {
        nextUrls.push(url);
        nextThumbUrls.push(report.imageThumbUrls?.[nextUrls.length - 1] ?? url);
        continue;
      }

      const savedUrl = await saveDataImage(url);
      if (savedUrl) {
        nextUrls.push(savedUrl);
        nextThumbUrls.push(savedUrl);
        changed = true;
      }
    }
    report.imageUrls = nextUrls;
    report.imageThumbUrls = nextThumbUrls;
  }

  return changed;
}

function ensureParticipantSequences(db: DbShape) {
  let changed = false;
  const groups = new Set(db.participants.map((item) => item.groupName || "一团"));

  for (const groupName of groups) {
    const groupParticipants = db.participants.filter((item) => (item.groupName || "一团") === groupName);
    const used = new Set(groupParticipants.map((item) => Number(item.sequence)).filter(Number.isFinite));
    let nextSequence = 1;

    for (const participant of groupParticipants.filter((item) => !item.sequence.trim())) {
      while (used.has(nextSequence)) nextSequence += 1;
      participant.sequence = String(nextSequence);
      used.add(nextSequence);
      changed = true;
    }
  }

  return changed;
}

async function saveDataImage(image: string) {
  const match = image.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);
  if (!match) return null;

  const ext = match[1].includes("png") ? "png" : match[1].includes("webp") ? "webp" : "jpg";
  const filename = `${Date.now()}-${nanoid()}.${ext}`;
  await writeFile(path.join(uploadDir, filename), Buffer.from(match[2], "base64"));
  return `/uploads/${filename}`;
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
  imageThumbUrls?: string[];
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

export async function listStaffMembers() {
  const db = await readDb();
  return db.staffMembers;
}

export async function saveStaffMember(input: {
  id?: string;
  groupName: string;
  sequence: string;
  type: string;
  name: string;
  idCard: string;
  gender: string;
  phone: string;
}) {
  const db = await readDb();
  const now = new Date().toISOString();
  const existing = input.id ? db.staffMembers.find((item) => item.id === input.id) : null;
  const staff: StaffMember = {
    id: input.id || nanoid(),
    groupName: input.groupName,
    sequence: input.sequence,
    type: input.type,
    name: input.name,
    idCard: input.idCard,
    gender: input.gender,
    phone: input.phone,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  const index = db.staffMembers.findIndex((item) => item.id === staff.id);
  if (index >= 0) db.staffMembers[index] = staff;
  else db.staffMembers.unshift(staff);
  await writeDb(db);
  return staff;
}

export async function deleteStaffMember(id: string) {
  const db = await readDb();
  db.staffMembers = db.staffMembers.filter((item) => item.id !== id);
  await writeDb(db);
}

export async function listParticipants() {
  const db = await readDb();
  return sortParticipants(db.participants);
}

export async function saveParticipant(input: {
  id?: string;
  groupName: string;
  sequence: string;
  familyType: string;
  parent1Name: string;
  parent1IdCard: string;
  parent1Phone: string;
  parent2Name: string;
  parent2IdCard: string;
  parent2Phone: string;
  parent3Name: string;
  parent3IdCard: string;
  parent3Phone: string;
  childName: string;
  childIdCard: string;
  childGender: string;
  childHeight: string;
  childWeight: string;
  childSize: string;
  child2Name: string;
  child2IdCard: string;
  child2Gender: string;
  child2Height: string;
  child2Weight: string;
  child2Size: string;
  roomNumber: string;
  roomType: string;
  note: string;
}) {
  const db = await readDb();
  const now = new Date().toISOString();
  const existing = input.id ? db.participants.find((item) => item.id === input.id) : null;
  const familyType = inferFamilyType(input);
  const keepSecondParent = hasSecondParent(familyType);
  const keepThirdParent = hasThirdParent(familyType);
  const keepSecondChild = hasSecondChild(familyType);
  const participant: Participant = {
    id: input.id || nanoid(),
    groupName: input.groupName,
    sequence: input.sequence,
    familyType,
    parent1Name: input.parent1Name,
    parent1IdCard: input.parent1IdCard,
    parent1Phone: input.parent1Phone,
    parent2Name: keepSecondParent ? input.parent2Name : "",
    parent2IdCard: keepSecondParent ? input.parent2IdCard : "",
    parent2Phone: keepSecondParent ? input.parent2Phone : "",
    parent3Name: keepThirdParent ? input.parent3Name : "",
    parent3IdCard: keepThirdParent ? input.parent3IdCard : "",
    parent3Phone: keepThirdParent ? input.parent3Phone : "",
    childName: input.childName,
    childIdCard: input.childIdCard,
    childGender: input.childGender,
    childHeight: input.childHeight,
    childWeight: input.childWeight,
    childSize: input.childSize,
    child2Name: keepSecondChild ? input.child2Name : "",
    child2IdCard: keepSecondChild ? input.child2IdCard : "",
    child2Gender: keepSecondChild ? input.child2Gender : "",
    child2Height: keepSecondChild ? input.child2Height : "",
    child2Weight: keepSecondChild ? input.child2Weight : "",
    child2Size: keepSecondChild ? input.child2Size : "",
    roomNumber: input.roomNumber,
    roomType: input.roomType,
    note: input.note,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  const index = db.participants.findIndex((item) => item.id === participant.id);
  if (index >= 0) db.participants[index] = participant;
  else db.participants.push(participant);
  await writeDb(db);
  return participant;
}

export async function deleteParticipant(id: string) {
  const db = await readDb();
  db.participants = db.participants.filter((item) => item.id !== id);
  db.attendanceRecords = db.attendanceRecords.filter((item) => item.participantId !== id);
  await writeDb(db);
}

export async function listAttendancePoints() {
  const db = await readDb();
  return db.attendancePoints.sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function listAttendanceRecords(pointId?: string) {
  const db = await readDb();
  return pointId ? db.attendanceRecords.filter((item) => item.pointId === pointId) : db.attendanceRecords;
}

export async function listAttendanceFamilySummaries(groupName?: string): Promise<AttendanceFamilySummary[]> {
  const db = await readDb();
  const participants = db.participants
    .filter((item) => !groupName || item.groupName === groupName)
    .sort(compareSequence);
  const pointOrderMap = new Map(db.attendancePoints.map((point) => [point.id, point.sortOrder]));
  const recordsByParticipant = new Map<string, AttendanceRecord[]>();

  for (const record of db.attendanceRecords) {
    if (!pointOrderMap.has(record.pointId)) continue;
    const records = recordsByParticipant.get(record.participantId) ?? [];
    records.push(record);
    recordsByParticipant.set(record.participantId, records);
  }

  return participants.map((participant) => {
    const records = (recordsByParticipant.get(participant.id) ?? [])
      .sort((a, b) => (pointOrderMap.get(a.pointId) ?? 0) - (pointOrderMap.get(b.pointId) ?? 0));
    const presentCount = records.filter((record) => record.status === "present").length;
    const absentCount = records.filter((record) => record.status === "absent").length;
    const pendingCount = db.attendancePoints.length - presentCount - absentCount;
    const lastUpdatedAt = records.reduce((latest, record) => (
      record.updatedAt > latest ? record.updatedAt : latest
    ), "");

    return {
      participant,
      records,
      presentCount,
      absentCount,
      pendingCount,
      lastUpdatedAt
    };
  });
}

export async function getFullDataExport() {
  return readDb();
}

export async function saveAttendanceRecord(input: AttendanceRecordInput) {
  const db = await readDb();
  const now = new Date().toISOString();
  const existing = db.attendanceRecords.find((item) => item.pointId === input.pointId && item.participantId === input.participantId);
  const record: AttendanceRecord = {
    id: existing?.id ?? nanoid(),
    pointId: input.pointId,
    participantId: input.participantId,
    status: input.status,
    note: input.note,
    updatedAt: now
  };

  if (existing) {
    Object.assign(existing, record);
  } else {
    db.attendanceRecords.push(record);
  }

  await writeDb(db);
  return record;
}

export async function listReports(filters: {
  sessionId?: string;
  role?: Role;
  category?: string;
  status?: ReportStatus;
}, options: { compactImages?: boolean } = { compactImages: true }) {
  const db = await readDb();
  const reports = db.reports.filter((report) => {
    if (filters.sessionId && report.sessionId !== filters.sessionId) return false;
    if (filters.role && report.reporterRole !== filters.role) return false;
    if (filters.category && report.category !== filters.category) return false;
    if (filters.status && report.status !== filters.status) return false;
    return true;
  });

  return options.compactImages === false ? reports : reports.map(compactReportForList);
}

function compactReportForList(report: Report): Report {
  return {
    ...report,
    imageUrls: report.imageUrls.filter((url) => url.length <= maxInlineImageLength),
    imageThumbUrls: report.imageThumbUrls?.filter((url) => url.length <= maxInlineImageLength)
  };
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

export async function deleteReport(id: string) {
  const db = await readDb();
  db.reports = db.reports.filter((item) => item.id !== id);
  await writeDb(db);
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

function sortParticipants(participants: Participant[]) {
  return [...participants].sort((a, b) => (
    a.groupName.localeCompare(b.groupName, "zh-Hans-CN") || compareSequence(a, b)
  ));
}

function compareSequence(a: { sequence: string }, b: { sequence: string }) {
  const sequenceA = Number(a.sequence);
  const sequenceB = Number(b.sequence);
  if (Number.isFinite(sequenceA) && Number.isFinite(sequenceB)) return sequenceA - sequenceB;
  if (Number.isFinite(sequenceA)) return -1;
  if (Number.isFinite(sequenceB)) return 1;
  return String(a.sequence).localeCompare(String(b.sequence), "zh-Hans-CN", { numeric: true });
}
