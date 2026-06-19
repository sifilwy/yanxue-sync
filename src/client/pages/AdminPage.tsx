import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, Download } from "lucide-react";
import type { Report, ReportStatus, Role } from "../../shared/types";
import { apiBase, getReports, updateReportStatus } from "../api";
import { RecordImages } from "../components/RecordImages";
import { Loading, Shell } from "../components/Layout";
import { statusLabels } from "../constants";
import { useBootstrap } from "../hooks/useBootstrap";

export function AdminPage() {
  const { data, error } = useBootstrap();
  const [reports, setReports] = useState<Report[]>([]);
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

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

  async function setReportStatus(id: string, nextStatus: ReportStatus) {
    await updateReportStatus(id, nextStatus);
    await loadReports();
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
                  <RecordImages imageUrls={report.imageUrls} />
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
    </Shell>
  );
}
