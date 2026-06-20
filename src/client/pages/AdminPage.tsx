import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Download, Plus, Save, Trash2 } from "lucide-react";
import type { BootstrapData, CampSession, ItineraryPoint, Report, ReportStatus, Role, Team } from "../../shared/types";
import {
  apiBase,
  deletePoint,
  deleteSession,
  deleteTeam,
  getReports,
  saveCategories,
  savePoint,
  saveRoles,
  saveSession,
  saveTeam,
  updateReportStatus
} from "../api";
import { RecordImages } from "../components/RecordImages";
import { Loading, Shell } from "../components/Layout";
import { statusLabels } from "../constants";
import { useBootstrap } from "../hooks/useBootstrap";

type SessionDraft = Omit<CampSession, "id"> & { id?: string };
type TeamDraft = Omit<Team, "id"> & { id?: string };
type PointDraft = Omit<ItineraryPoint, "id"> & { id?: string };

const emptySession = (): SessionDraft => ({ name: "", city: "", startsOn: "", endsOn: "" });
const emptyTeam = (sessionId = ""): TeamDraft => ({ sessionId, name: "" });
const emptyPoint = (sessionId = "", teamId = ""): PointDraft => ({ sessionId, teamId, name: "", sortOrder: 0 });

export function AdminPage() {
  const { data, error, reload } = useBootstrap();
  const [reports, setReports] = useState<Report[]>([]);
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(emptySession());
  const [teamDraft, setTeamDraft] = useState<TeamDraft>(emptyTeam());
  const [pointDraft, setPointDraft] = useState<PointDraft>(emptyPoint());
  const [categoriesText, setCategoriesText] = useState("");
  const [roleLabels, setRoleLabels] = useState<Record<Role, string>>({
    coach: "教练",
    teacher: "老师",
    guide: "导游",
    supervisor: "督导"
  });
  const [configMessage, setConfigMessage] = useState("");

  async function loadReports() {
    setLoading(true);
    const [filteredReports, summaryReports] = await Promise.all([
      getReports({ sessionId, role, status, category }),
      getReports({ sessionId })
    ]);
    setReports(filteredReports);
    setAllReports(summaryReports);
    setLoading(false);
  }

  useEffect(() => {
    loadReports().catch(() => setLoading(false));
  }, [sessionId, role, status, category]);

  useEffect(() => {
    if (!data) return;
    setCategoriesText(data.categories.join("\n"));
    setRoleLabels(Object.fromEntries(data.roles.map((item) => [item.value, item.label])) as Record<Role, string>);
    setTeamDraft(emptyTeam(data.sessions[0]?.id ?? ""));
    setPointDraft(emptyPoint(data.sessions[0]?.id ?? "", data.teams[0]?.id ?? ""));
  }, [data]);

  const teamsForConfig = useMemo(
    () => data?.teams.filter((item) => item.sessionId === pointDraft.sessionId) ?? [],
    [data, pointDraft.sessionId]
  );

  async function refreshAfterConfig(message: string) {
    setConfigMessage(message);
    await reload();
    await loadReports();
  }

  async function setReportStatus(id: string, nextStatus: ReportStatus) {
    await updateReportStatus(id, nextStatus);
    await loadReports();
  }

  async function submitSession(event: React.FormEvent) {
    event.preventDefault();
    await saveSession(sessionDraft);
    setSessionDraft(emptySession());
    await refreshAfterConfig("团期已保存");
  }

  async function submitTeam(event: React.FormEvent) {
    event.preventDefault();
    await saveTeam(teamDraft);
    setTeamDraft(emptyTeam(teamDraft.sessionId));
    await refreshAfterConfig("队伍已保存");
  }

  async function submitPoint(event: React.FormEvent) {
    event.preventDefault();
    await savePoint(pointDraft);
    setPointDraft(emptyPoint(pointDraft.sessionId, pointDraft.teamId));
    await refreshAfterConfig("环节已保存");
  }

  async function submitCategories() {
    const categories = categoriesText.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
    await saveCategories(categories);
    await refreshAfterConfig("问题分类已保存");
  }

  async function submitRoles() {
    const roles = data!.roles.map((item) => ({ value: item.value, label: roleLabels[item.value] || item.label }));
    await saveRoles(roles);
    await refreshAfterConfig("人员身份已保存");
  }

  const sessionName = (id: string) => data?.sessions.find((item) => item.id === id)?.name ?? "";
  const teamName = (id?: string) => data?.teams.find((item) => item.id === id)?.name ?? "";
  const pointName = (id?: string) => data?.points.find((item) => item.id === id)?.name ?? "";
  const roleName = (value: Role) => data?.roles.find((item) => item.value === value)?.label ?? value;
  const statusCount = (value: ReportStatus) => allReports.filter((report) => report.status === value).length;
  const urgentCount = allReports.filter((report) => report.isUrgent).length;
  const settlementCount = allReports.filter((report) => report.affectsSettlement).length;

  if (error) return <Shell><p>{error}</p></Shell>;
  if (!data) return <Loading />;

  return (
    <Shell>
      <header className="topbar">
        <div>
          <p className="eyebrow">后台</p>
          <h1>信息汇总</h1>
        </div>
        <ClipboardList size={28} />
      </header>

      <section className="toolbar">
        <select value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
          <option value="">全部团期</option>
          {data.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
        </select>
        <select value={role} onChange={(event) => setRole(event.target.value)}>
          <option value="">全部身份</option>
          {data.roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">全部类型</option>
          {data.categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">全部状态</option>
          <option value="open">未处理</option>
          <option value="processing">处理中</option>
          <option value="done">已处理</option>
        </select>
        <a className="secondary" href={`${apiBase}/api/reports/export`}>
          <Download size={18} />
          导出
        </a>
      </section>

      <section className="summary-grid">
        <button className={status === "" ? "summary-card active" : "summary-card"} onClick={() => setStatus("")}>
          <span>全部记录</span>
          <strong>{allReports.length}</strong>
        </button>
        <button className={status === "open" ? "summary-card active" : "summary-card"} onClick={() => setStatus("open")}>
          <span>未处理</span>
          <strong>{statusCount("open")}</strong>
        </button>
        <button className={status === "processing" ? "summary-card active" : "summary-card"} onClick={() => setStatus("processing")}>
          <span>处理中</span>
          <strong>{statusCount("processing")}</strong>
        </button>
        <button className={status === "done" ? "summary-card active" : "summary-card"} onClick={() => setStatus("done")}>
          <span>已处理</span>
          <strong>{statusCount("done")}</strong>
        </button>
        <div className="summary-card readonly">
          <span>紧急</span>
          <strong>{urgentCount}</strong>
        </div>
        <div className="summary-card readonly">
          <span>影响结算</span>
          <strong>{settlementCount}</strong>
        </div>
      </section>

      <section className="category-tabs">
        <button className={category === "" ? "active" : ""} onClick={() => setCategory("")}>全部</button>
        {data.categories.map((item) => {
          const count = allReports.filter((report) => report.category === item).length;
          return (
            <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>
              {item}
              <span>{count}</span>
            </button>
          );
        })}
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>记录列表</h2>
          <span>{reports.length} 条</span>
        </div>
        {loading ? <p className="muted">加载中...</p> : reports.length === 0 ? <p className="muted">暂无记录。</p> : (
          <div className="report-list">
            {reports.map((report) => (
              <article className="report-card" key={report.id}>
                <div className="report-card-main">
                  <div className="report-meta">
                    <b>{report.category}</b>
                    <span>{sessionName(report.sessionId)}</span>
                    <span>{teamName(report.teamId) || "未分队"}</span>
                    <span>{pointName(report.pointId) || "未选环节"}</span>
                  </div>
                  <p>{report.content}</p>
                  <RecordImages imageUrls={report.imageUrls} thumbUrls={report.imageThumbUrls} />
                  <div className="report-foot">
                    <span>{roleName(report.reporterRole)} · {report.reporterName}</span>
                    <span>{new Date(report.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="report-side">
                  <div>
                    <b className={`status-pill ${report.status}`}>{statusLabels[report.status]}</b>
                    {report.isUrgent && <b className="tag danger">紧急</b>}
                    {report.affectsSettlement && <b className="tag warn">影响结算</b>}
                  </div>
                  <div className="actions">
                    <button onClick={() => setReportStatus(report.id, "processing")}>处理中</button>
                    <button onClick={() => setReportStatus(report.id, "done")}><CheckCircle2 size={15} />完成</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel config-panel">
        <div className="section-head">
          <h2>基础数据管理</h2>
          <span>{configMessage || "修改后手机端会自动使用新数据"}</span>
        </div>

        <div className="config-grid">
          <form className="config-card" onSubmit={submitSession}>
            <h3>团期</h3>
            <input placeholder="团期名称" value={sessionDraft.name} onChange={(event) => setSessionDraft({ ...sessionDraft, name: event.target.value })} required />
            <input placeholder="城市" value={sessionDraft.city} onChange={(event) => setSessionDraft({ ...sessionDraft, city: event.target.value })} />
            <div className="inline-fields">
              <input type="date" value={sessionDraft.startsOn} onChange={(event) => setSessionDraft({ ...sessionDraft, startsOn: event.target.value })} />
              <input type="date" value={sessionDraft.endsOn} onChange={(event) => setSessionDraft({ ...sessionDraft, endsOn: event.target.value })} />
            </div>
            <button className="primary compact"><Plus size={16} />保存团期</button>
            <div className="config-list">
              {data.sessions.map((item) => (
                <div className="config-row" key={item.id}>
                  <span>{item.name}</span>
                  <button type="button" onClick={async () => { await deleteSession(item.id); await refreshAfterConfig("团期已删除"); }}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </form>

          <form className="config-card" onSubmit={submitTeam}>
            <h3>队伍</h3>
            <select value={teamDraft.sessionId} onChange={(event) => setTeamDraft({ ...teamDraft, sessionId: event.target.value })} required>
              {data.sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input placeholder="队伍名称" value={teamDraft.name} onChange={(event) => setTeamDraft({ ...teamDraft, name: event.target.value })} required />
            <button className="primary compact"><Plus size={16} />保存队伍</button>
            <div className="config-list">
              {data.teams.map((item) => (
                <div className="config-row" key={item.id}>
                  <span>{sessionName(item.sessionId)} · {item.name}</span>
                  <button type="button" onClick={async () => { await deleteTeam(item.id); await refreshAfterConfig("队伍已删除"); }}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </form>

          <form className="config-card" onSubmit={submitPoint}>
            <h3>研学环节</h3>
            <select value={pointDraft.sessionId} onChange={(event) => setPointDraft({ ...pointDraft, sessionId: event.target.value, teamId: "" })} required>
              {data.sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select value={pointDraft.teamId} onChange={(event) => setPointDraft({ ...pointDraft, teamId: event.target.value })}>
              <option value="">不限定队伍</option>
              {teamsForConfig.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <div className="inline-fields">
              <input placeholder="环节名称" value={pointDraft.name} onChange={(event) => setPointDraft({ ...pointDraft, name: event.target.value })} required />
              <input type="number" min="0" placeholder="排序" value={pointDraft.sortOrder} onChange={(event) => setPointDraft({ ...pointDraft, sortOrder: Number(event.target.value) })} />
            </div>
            <button className="primary compact"><Plus size={16} />保存环节</button>
            <div className="config-list">
              {data.points.map((item) => (
                <div className="config-row" key={item.id}>
                  <span>{sessionName(item.sessionId)} · {teamName(item.teamId) || "通用"} · {item.name}</span>
                  <button type="button" onClick={async () => { await deletePoint(item.id); await refreshAfterConfig("环节已删除"); }}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </form>

          <div className="config-card">
            <h3>问题分类</h3>
            <textarea value={categoriesText} onChange={(event) => setCategoriesText(event.target.value)} />
            <button className="primary compact" type="button" onClick={submitCategories}><Save size={16} />保存分类</button>
          </div>

          <div className="config-card">
            <h3>人员身份</h3>
            {data.roles.map((item) => (
              <label key={item.value}>
                {item.value}
                <input value={roleLabels[item.value] ?? item.label} onChange={(event) => setRoleLabels({ ...roleLabels, [item.value]: event.target.value })} />
              </label>
            ))}
            <button className="primary compact" type="button" onClick={submitRoles}><Save size={16} />保存身份</button>
          </div>
        </div>
      </section>
    </Shell>
  );
}
