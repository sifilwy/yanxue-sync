import cors from "cors";
import express from "express";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  createReport,
  deleteReport,
  deletePoint,
  deleteSession,
  deleteTeam,
  getBootstrap,
  getFullDataExport,
  getLookupMaps,
  listAttendanceFamilySummaries,
  listParticipants,
  listReports,
  listStaffMembers,
  roleLabel,
  saveCategories,
  saveParticipant,
  savePoint,
  saveRoles,
  saveSession,
  saveStaffMember,
  saveTeam,
  deleteParticipant,
  deleteStaffMember,
  listAttendancePoints,
  listAttendanceRecords,
  saveAttendanceRecord,
  updateReportStatus
} from "./store";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../../dist");
const dataPath = path.resolve(process.cwd(), "data");
const uploadPath = path.join(dataPath, "uploads");
const thumbPath = path.join(dataPath, "thumbs");

app.use(cors());
app.use(express.json({ limit: "8mb" }));
app.use("/uploads", express.static(uploadPath));
app.use("/thumbs", express.static(thumbPath));

const roleSchema = z.enum(["coach", "teacher", "guide", "supervisor"]);
const statusSchema = z.enum(["open", "processing", "done"]);
const attendanceStatusSchema = z.enum(["pending", "present", "absent"]);

const createReportSchema = z.object({
  reporterName: z.string().min(1),
  reporterRole: roleSchema,
  sessionId: z.string().min(1),
  teamId: z.string().optional(),
  pointId: z.string().optional(),
  category: z.string().min(1),
  content: z.string().min(1),
  isUrgent: z.boolean().default(false),
  affectsSettlement: z.boolean().default(false),
  imageUrls: z.array(z.string()).max(3).default([]),
  imageThumbUrls: z.array(z.string()).max(3).default([])
});

const sessionSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  city: z.string().default(""),
  startsOn: z.string().default(""),
  endsOn: z.string().default("")
});

const teamSchema = z.object({
  id: z.string().optional(),
  sessionId: z.string().min(1),
  name: z.string().min(1)
});

const pointSchema = z.object({
  id: z.string().optional(),
  sessionId: z.string().min(1),
  teamId: z.string().optional(),
  name: z.string().min(1),
  sortOrder: z.number().int().min(0).default(0)
});

const categoriesSchema = z.object({
  categories: z.array(z.string().min(1)).min(1)
});

const rolesSchema = z.object({
  roles: z.array(z.object({ value: roleSchema, label: z.string().min(1) })).length(4)
});

const uploadSchema = z.object({
  images: z.array(z.string().startsWith("data:image/")).max(3),
  thumbs: z.array(z.string().startsWith("data:image/")).max(3)
});

const staffSchema = z.object({
  id: z.string().optional(),
  groupName: z.string().min(1).default("一团"),
  sequence: z.string().default(""),
  type: z.string().default("工作人员"),
  name: z.string().min(1),
  idCard: z.string().default(""),
  gender: z.string().default(""),
  phone: z.string().default("")
});

const participantSchema = z.object({
  id: z.string().optional(),
  groupName: z.string().min(1).default("一团"),
  sequence: z.string().default(""),
  familyType: z.string().min(1).default("1大1小"),
  parent1Name: z.string().default(""),
  parent1IdCard: z.string().default(""),
  parent1Phone: z.string().default(""),
  parent2Name: z.string().default(""),
  parent2IdCard: z.string().default(""),
  parent2Phone: z.string().default(""),
  parent3Name: z.string().default(""),
  parent3IdCard: z.string().default(""),
  parent3Phone: z.string().default(""),
  childName: z.string().min(1),
  childIdCard: z.string().default(""),
  childGender: z.string().default(""),
  childHeight: z.string().default(""),
  childWeight: z.string().default(""),
  childSize: z.string().default(""),
  child2Name: z.string().default(""),
  child2IdCard: z.string().default(""),
  child2Gender: z.string().default(""),
  child2Height: z.string().default(""),
  child2Weight: z.string().default(""),
  child2Size: z.string().default(""),
  roomNumber: z.string().default(""),
  roomType: z.string().default(""),
  note: z.string().default("")
});

const attendanceRecordSchema = z.object({
  pointId: z.string().min(1),
  participantId: z.string().min(1),
  status: attendanceStatusSchema,
  absentMemberIds: z.array(z.string()).default([]),
  note: z.string().default("")
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "yanxue-sync-api" });
});

app.get("/api/bootstrap", async (_req, res) => {
  res.json(await getBootstrap());
});

app.post("/api/uploads", async (req, res) => {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "图片内容不完整", issues: parsed.error.issues });
    return;
  }

  await mkdir(uploadPath, { recursive: true });
  await mkdir(thumbPath, { recursive: true });
  const urls = await Promise.all(parsed.data.images.map(async (image, index) => {
    const match = image.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);
    if (!match) throw new Error("Unsupported image format");
    const thumb = parsed.data.thumbs[index] ?? image;
    const thumbMatch = thumb.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);
    if (!thumbMatch) throw new Error("Unsupported thumbnail format");

    const ext = match[1].includes("png") ? "png" : match[1].includes("webp") ? "webp" : "jpg";
    const thumbExt = thumbMatch[1].includes("png") ? "png" : thumbMatch[1].includes("webp") ? "webp" : "jpg";
    const id = `${Date.now()}-${nanoid()}`;
    const filename = `${id}.${ext}`;
    const thumbFilename = `${id}-thumb.${thumbExt}`;
    const buffer = Buffer.from(match[2], "base64");
    const thumbBuffer = Buffer.from(thumbMatch[2], "base64");
    await writeFile(path.join(uploadPath, filename), buffer);
    await writeFile(path.join(thumbPath, thumbFilename), thumbBuffer);
    return { url: `/uploads/${filename}`, thumbUrl: `/thumbs/${thumbFilename}` };
  }));

  res.status(201).json({ urls });
});

app.get("/api/people/staff", async (_req, res) => {
  res.json(await listStaffMembers());
});

app.post("/api/people/staff", async (req, res) => {
  const parsed = staffSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "工作人员信息不完整", issues: parsed.error.issues });
    return;
  }
  res.json(await saveStaffMember(parsed.data));
});

app.delete("/api/people/staff/:id", async (req, res) => {
  await deleteStaffMember(req.params.id);
  res.json({ ok: true });
});

app.get("/api/people/participants", async (_req, res) => {
  res.json(await listParticipants());
});

app.post("/api/people/participants", async (req, res) => {
  const parsed = participantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "参加团员信息不完整", issues: parsed.error.issues });
    return;
  }
  res.json(await saveParticipant(parsed.data));
});

app.delete("/api/people/participants/:id", async (req, res) => {
  await deleteParticipant(req.params.id);
  res.json({ ok: true });
});

app.get("/api/attendance/points", async (_req, res) => {
  res.json(await listAttendancePoints());
});

app.get("/api/attendance/records", async (req, res) => {
  const pointId = typeof req.query.pointId === "string" ? req.query.pointId : undefined;
  res.json(await listAttendanceRecords(pointId));
});

app.get("/api/attendance/family-summaries", async (req, res) => {
  const groupName = typeof req.query.groupName === "string" ? req.query.groupName : undefined;
  res.json(await listAttendanceFamilySummaries(groupName));
});

app.post("/api/attendance/records", async (req, res) => {
  const parsed = attendanceRecordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "点名信息不完整", issues: parsed.error.issues });
    return;
  }
  res.json(await saveAttendanceRecord(parsed.data));
});

app.post("/api/config/sessions", async (req, res) => {
  const parsed = sessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "团期信息不完整", issues: parsed.error.issues });
    return;
  }
  res.json(await saveSession(parsed.data));
});

app.delete("/api/config/sessions/:id", async (req, res) => {
  await deleteSession(req.params.id);
  res.json({ ok: true });
});

app.post("/api/config/teams", async (req, res) => {
  const parsed = teamSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "队伍信息不完整", issues: parsed.error.issues });
    return;
  }
  res.json(await saveTeam(parsed.data));
});

app.delete("/api/config/teams/:id", async (req, res) => {
  await deleteTeam(req.params.id);
  res.json({ ok: true });
});

app.post("/api/config/points", async (req, res) => {
  const parsed = pointSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "环节信息不完整", issues: parsed.error.issues });
    return;
  }
  res.json(await savePoint(parsed.data));
});

app.delete("/api/config/points/:id", async (req, res) => {
  await deletePoint(req.params.id);
  res.json({ ok: true });
});

app.put("/api/config/categories", async (req, res) => {
  const parsed = categoriesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "分类信息不完整", issues: parsed.error.issues });
    return;
  }
  res.json(await saveCategories(parsed.data.categories));
});

app.put("/api/config/roles", async (req, res) => {
  const parsed = rolesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "身份信息不完整", issues: parsed.error.issues });
    return;
  }
  res.json(await saveRoles(parsed.data.roles));
});

app.get("/api/reports", async (req, res) => {
  const filters = {
    sessionId: typeof req.query.sessionId === "string" ? req.query.sessionId : undefined,
    role: roleSchema.safeParse(req.query.role).success ? roleSchema.parse(req.query.role) : undefined,
    category: typeof req.query.category === "string" ? req.query.category : undefined,
    status: statusSchema.safeParse(req.query.status).success ? statusSchema.parse(req.query.status) : undefined
  };

  res.json(await listReports(filters));
});

app.post("/api/reports", async (req, res) => {
  const parsed = createReportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "提交内容不完整", issues: parsed.error.issues });
    return;
  }

  res.status(201).json(await createReport(parsed.data));
});

app.patch("/api/reports/:id/status", async (req, res) => {
  const parsed = z.object({ status: statusSchema }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "状态不正确" });
    return;
  }

  const updated = await updateReportStatus(req.params.id, parsed.data.status);
  if (!updated) {
    res.status(404).json({ message: "记录不存在" });
    return;
  }

  res.json(updated);
});

app.delete("/api/reports/:id", async (req, res) => {
  await deleteReport(req.params.id);
  res.json({ ok: true });
});

app.get("/api/reports/export", async (_req, res) => {
  const [reports, lookups] = await Promise.all([listReports({}, { compactImages: false }), getLookupMaps()]);
  const rows = [
    ["提交时间", "团期", "队伍", "环节", "身份", "提交人", "类型", "状态", "紧急", "影响结算", "内容", "图片"],
    ...reports.map((report) => [
      report.createdAt,
      lookups.sessions.get(report.sessionId)?.name ?? "",
      report.teamId ? lookups.teams.get(report.teamId)?.name ?? "" : "",
      report.pointId ? lookups.points.get(report.pointId)?.name ?? "" : "",
      roleLabel(report.reporterRole),
      report.reporterName,
      report.category,
      report.status,
      report.isUrgent ? "是" : "否",
      report.affectsSettlement ? "是" : "否",
      report.content.replace(/\r?\n/g, " "),
      report.imageUrls?.length ? `${report.imageUrls.length}张` : ""
    ])
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

  res.header("Content-Type", "text/csv; charset=utf-8");
  res.attachment("yanxue-reports.csv");
  res.send(`\uFEFF${csv}`);
});

app.get("/api/admin/export-data", async (_req, res) => {
  res.attachment(`yanxue-full-data-${new Date().toISOString().slice(0, 10)}.json`);
  res.json(await getFullDataExport());
});

app.use(express.static(distPath));

app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`API ready on http://localhost:${port}`);
});
