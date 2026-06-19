import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  createReport,
  getBootstrap,
  getLookupMaps,
  listReports,
  roleLabel,
  updateReportStatus
} from "./store";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../../dist");

app.use(cors());
app.use(express.json({ limit: "8mb" }));

const roleSchema = z.enum(["coach", "teacher", "guide", "supervisor"]);
const statusSchema = z.enum(["open", "processing", "done"]);

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
  imageUrls: z.array(z.string()).max(3).default([])
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "yanxue-sync-api" });
});

app.get("/api/bootstrap", async (_req, res) => {
  res.json(await getBootstrap());
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

app.get("/api/reports/export", async (_req, res) => {
  const [reports, lookups] = await Promise.all([listReports({}), getLookupMaps()]);
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

app.use(express.static(distPath));

app.get("/{*splat}", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`API ready on http://localhost:${port}`);
});
