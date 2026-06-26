import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, CheckCircle2, ClipboardList, Download, Plus, Save, Trash2, UsersRound } from "lucide-react";
import { attendanceDayCount, attendanceStatusLabels } from "../../shared/attendance";
import type {
  AttendanceFamilySummary,
  AttendancePoint,
  AttendanceRecord,
  AttendanceStatus,
  CampSession,
  ItineraryPoint,
  Participant,
  Report,
  ReportStatus,
  Role,
  StaffMember,
  Team
} from "../../shared/types";
import {
  apiBase,
  deleteReport,
  deleteParticipant,
  deletePoint,
  deleteSession,
  deleteStaffMember,
  deleteTeam,
  getAttendancePoints,
  getAttendanceFamilySummaries,
  getAttendanceRecords,
  getParticipants,
  getReports,
  getStaffMembers,
  saveAttendanceRecord,
  saveCategories,
  saveParticipant,
  savePoint,
  saveRoles,
  saveSession,
  saveStaffMember,
  saveTeam,
  updateReportStatus
} from "../api";
import { RecordImages } from "../components/RecordImages";
import { Loading, Shell } from "../components/Layout";
import { statusLabels } from "../constants";
import { useBootstrap } from "../hooks/useBootstrap";
import {
  childNames,
  familyTypes,
  formatAbsentMembers,
  genders,
  hasSecondChild,
  hasSecondParent,
  hasThirdParent,
  inferFamilyType,
  includesKeyword,
  isIndependentCamp,
  listAttendanceMembers,
  parentNames,
  parentPhones,
  peopleGroups,
  roomTypes
} from "../utils/people";

type AdminView = "reports" | "people" | "attendance";
type PeopleView = "staff" | "participants";
type SessionDraft = Omit<CampSession, "id"> & { id?: string };
type TeamDraft = Omit<Team, "id"> & { id?: string };
type PointDraft = Omit<ItineraryPoint, "id"> & { id?: string };
type StaffDraft = Omit<StaffMember, "id" | "createdAt" | "updatedAt"> & { id?: string };
type ParticipantDraft = Omit<Participant, "id" | "createdAt" | "updatedAt"> & { id?: string };

const emptySession = (): SessionDraft => ({ name: "", city: "", startsOn: "", endsOn: "" });
const emptyTeam = (sessionId = ""): TeamDraft => ({ sessionId, name: "" });
const emptyPoint = (sessionId = "", teamId = ""): PointDraft => ({ sessionId, teamId, name: "", sortOrder: 0 });

const emptyStaff = (groupName = "一团"): StaffDraft => ({
  groupName,
  sequence: "",
  type: "工作人员",
  name: "",
  idCard: "",
  gender: "",
  phone: ""
});
const emptyParticipant = (groupName = "一团"): ParticipantDraft => ({
  groupName,
  sequence: "",
  familyType: "1大1小",
  parent1Name: "",
  parent1IdCard: "",
  parent1Phone: "",
  parent2Name: "",
  parent2IdCard: "",
  parent2Phone: "",
  parent3Name: "",
  parent3IdCard: "",
  parent3Phone: "",
  childName: "",
  childIdCard: "",
  childGender: "",
  childHeight: "",
  childWeight: "",
  childSize: "",
  child2Name: "",
  child2IdCard: "",
  child2Gender: "",
  child2Height: "",
  child2Weight: "",
  child2Size: "",
  roomNumber: "",
  roomType: "",
  note: ""
});

function familyTypePatch(draft: ParticipantDraft, familyType: string): ParticipantDraft {
  return {
    ...draft,
    familyType,
    ...(hasSecondParent(familyType) ? {} : { parent2Name: "", parent2IdCard: "", parent2Phone: "" }),
    ...(hasThirdParent(familyType) ? {} : { parent3Name: "", parent3IdCard: "", parent3Phone: "" }),
    ...(hasSecondChild(familyType) ? {} : {
      child2Name: "",
      child2IdCard: "",
      child2Gender: "",
      child2Height: "",
      child2Weight: "",
      child2Size: ""
    })
  };
}

function normalizeParticipantDraft(item: Participant): ParticipantDraft {
  const familyType = inferFamilyType(item);
  return familyTypePatch({ ...item, familyType }, familyType);
}

function compareSequence(a: { sequence: string }, b: { sequence: string }) {
  const sequenceA = Number(a.sequence);
  const sequenceB = Number(b.sequence);
  if (Number.isFinite(sequenceA) && Number.isFinite(sequenceB)) return sequenceA - sequenceB;
  if (Number.isFinite(sequenceA)) return -1;
  if (Number.isFinite(sequenceB)) return 1;
  return String(a.sequence).localeCompare(String(b.sequence), "zh-Hans-CN", { numeric: true });
}

const peopleCacheKey = "yanxue-admin-people-cache";
const attendanceCacheKey = "yanxue-admin-attendance-cache";

function readPeopleCache() {
  try {
    const raw = window.localStorage.getItem(peopleCacheKey);
    return raw ? JSON.parse(raw) as { staffMembers: StaffMember[]; participants: Participant[] } : null;
  } catch {
    return null;
  }
}

function writePeopleCache(staffMembers: StaffMember[], participants: Participant[]) {
  window.localStorage.setItem(peopleCacheKey, JSON.stringify({ staffMembers, participants }));
}

function readAttendanceCache() {
  try {
    const raw = window.localStorage.getItem(attendanceCacheKey);
    return raw ? JSON.parse(raw) as { points: AttendancePoint[]; participants: Participant[] } : null;
  } catch {
    return null;
  }
}

function writeAttendanceCache(points: AttendancePoint[], participants: Participant[]) {
  window.localStorage.setItem(attendanceCacheKey, JSON.stringify({ points, participants }));
}

export function AdminPage() {
  const { data, error, reload } = useBootstrap();
  const [activeView, setActiveView] = useState<AdminView>("reports");

  if (error) return <Shell><p>{error}</p></Shell>;
  if (!data) return <Loading />;

  return (
    <Shell>
      <header className="topbar">
        <div>
          <p className="eyebrow">后台</p>
          <h1>{activeView === "reports" ? "信息汇总" : activeView === "people" ? "人员信息" : "点名系统"}</h1>
        </div>
        {activeView === "reports" ? <ClipboardList size={28} /> : activeView === "people" ? <UsersRound size={28} /> : <CalendarCheck2 size={28} />}
      </header>

      <nav className="admin-tabs" aria-label="后台模块">
        <button className={activeView === "reports" ? "active" : ""} onClick={() => setActiveView("reports")}>
          信息汇总
        </button>
        <button className={activeView === "people" ? "active" : ""} onClick={() => setActiveView("people")}>
          人员信息
        </button>
        <button className={activeView === "attendance" ? "active" : ""} onClick={() => setActiveView("attendance")}>
          点名系统
        </button>
      </nav>

      {activeView === "reports" ? <ReportsView data={data} reloadBootstrap={reload} /> : activeView === "people" ? <PeopleViewPanel /> : <AttendanceViewPanel />}
    </Shell>
  );
}

function ReportsView({ data, reloadBootstrap }: { data: NonNullable<ReturnType<typeof useBootstrap>["data"]>; reloadBootstrap: () => Promise<void> }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [allReports, setAllReports] = useState<Report[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(emptySession());
  const [teamDraft, setTeamDraft] = useState<TeamDraft>(emptyTeam(data.sessions[0]?.id ?? ""));
  const [pointDraft, setPointDraft] = useState<PointDraft>(emptyPoint(data.sessions[0]?.id ?? "", data.teams[0]?.id ?? ""));
  const [categoriesText, setCategoriesText] = useState(data.categories.join("\n"));
  const [roleLabels, setRoleLabels] = useState<Record<Role, string>>(
    Object.fromEntries(data.roles.map((item) => [item.value, item.label])) as Record<Role, string>
  );
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
    setCategoriesText(data.categories.join("\n"));
    setRoleLabels(Object.fromEntries(data.roles.map((item) => [item.value, item.label])) as Record<Role, string>);
    setTeamDraft(emptyTeam(data.sessions[0]?.id ?? ""));
    setPointDraft(emptyPoint(data.sessions[0]?.id ?? "", data.teams[0]?.id ?? ""));
  }, [data]);

  const teamsForConfig = useMemo(
    () => data.teams.filter((item) => item.sessionId === pointDraft.sessionId),
    [data.teams, pointDraft.sessionId]
  );

  async function refreshAfterConfig(message: string) {
    setConfigMessage(message);
    await reloadBootstrap();
    await loadReports();
  }

  async function setReportStatus(id: string, nextStatus: ReportStatus) {
    await updateReportStatus(id, nextStatus);
    await loadReports();
  }

  async function removeReport(id: string) {
    if (!window.confirm("确定删除这条记录吗？")) return;
    await deleteReport(id);
    await loadReports();
  }

  const sessionName = (id: string) => data.sessions.find((item) => item.id === id)?.name ?? "";
  const teamName = (id?: string) => data.teams.find((item) => item.id === id)?.name ?? "";
  const pointName = (id?: string) => data.points.find((item) => item.id === id)?.name ?? "";
  const roleName = (value: Role) => data.roles.find((item) => item.value === value)?.label ?? value;
  const statusCount = (value: ReportStatus) => allReports.filter((report) => report.status === value).length;
  const urgentCount = allReports.filter((report) => report.isUrgent).length;
  const settlementCount = allReports.filter((report) => report.affectsSettlement).length;

  return (
    <>
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
        <a className="secondary" href={`${apiBase}/api/admin/export-data`}>
          <Download size={18} />
          完整备份
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
        {data.categories.map((item) => (
          <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>
            {item}
            <span>{allReports.filter((report) => report.category === item).length}</span>
          </button>
        ))}
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
                    <button className="danger-action" onClick={() => removeReport(report.id)}><Trash2 size={15} />删除</button>
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
          <form className="config-card" onSubmit={async (event) => {
            event.preventDefault();
            await saveSession(sessionDraft);
            setSessionDraft(emptySession());
            await refreshAfterConfig("团期已保存");
          }}>
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

          <form className="config-card" onSubmit={async (event) => {
            event.preventDefault();
            await saveTeam(teamDraft);
            setTeamDraft(emptyTeam(teamDraft.sessionId));
            await refreshAfterConfig("队伍已保存");
          }}>
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

          <form className="config-card" onSubmit={async (event) => {
            event.preventDefault();
            await savePoint(pointDraft);
            setPointDraft(emptyPoint(pointDraft.sessionId, pointDraft.teamId));
            await refreshAfterConfig("环节已保存");
          }}>
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
            <button className="primary compact" type="button" onClick={async () => {
              const categories = categoriesText.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean);
              await saveCategories(categories);
              await refreshAfterConfig("问题分类已保存");
            }}><Save size={16} />保存分类</button>
          </div>

          <div className="config-card">
            <h3>人员身份</h3>
            {data.roles.map((item) => (
              <label key={item.value}>
                {item.value}
                <input value={roleLabels[item.value] ?? item.label} onChange={(event) => setRoleLabels({ ...roleLabels, [item.value]: event.target.value })} />
              </label>
            ))}
            <button className="primary compact" type="button" onClick={async () => {
              await saveRoles(data.roles.map((item) => ({ value: item.value, label: roleLabels[item.value] || item.label })));
              await refreshAfterConfig("人员身份已保存");
            }}><Save size={16} />保存身份</button>
          </div>
        </div>
      </section>
    </>
  );
}

function PeopleViewPanel() {
  const [activePeopleView, setActivePeopleView] = useState<PeopleView>("staff");
  const [activeGroup, setActiveGroup] = useState(peopleGroups[0]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [staffDraft, setStaffDraft] = useState<StaffDraft>(emptyStaff(peopleGroups[0]));
  const [participantDraft, setParticipantDraft] = useState<ParticipantDraft>(emptyParticipant(peopleGroups[0]));
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState("");

  async function loadPeople() {
    const cached = readPeopleCache();
    if (cached) {
      setStaffMembers(cached.staffMembers);
      setParticipants(cached.participants);
    }
    const [staff, studentList] = await Promise.all([getStaffMembers(), getParticipants()]);
    setStaffMembers(staff);
    setParticipants(studentList);
    writePeopleCache(staff, studentList);
  }

  useEffect(() => {
    loadPeople();
  }, []);

  useEffect(() => {
    setStaffDraft((draft) => ({ ...draft, groupName: activeGroup }));
    setParticipantDraft((draft) => ({ ...draft, groupName: activeGroup }));
  }, [activeGroup]);

  const filteredStaff = staffMembers.filter((item) => item.groupName === activeGroup && includesKeyword([
    item.sequence,
    item.type,
    item.name,
    item.idCard,
    item.gender,
    item.phone
  ], keyword)).sort(compareSequence);
  const filteredParticipants = participants.filter((item) => item.groupName === activeGroup && includesKeyword([
    item.sequence,
    item.familyType,
    item.parent1Name,
    item.parent1IdCard,
    item.parent1Phone,
    item.parent2Name,
    item.parent2IdCard,
    item.parent2Phone,
    item.parent3Name,
    item.parent3IdCard,
    item.parent3Phone,
    item.childName,
    item.childIdCard,
    item.childGender,
    item.childHeight,
    item.childWeight,
    item.childSize,
    item.child2Name,
    item.child2IdCard,
    item.child2Gender,
    item.child2Height,
    item.child2Weight,
    item.child2Size,
    item.roomNumber,
    item.roomType,
    item.note
  ], keyword)).sort(compareSequence);
  const groupFamilyCount = participants.filter((item) => item.groupName === activeGroup && item.sequence).length;
  const groupStaffCount = staffMembers.filter((item) => item.groupName === activeGroup).length;
  const showSecondParent = hasSecondParent(participantDraft.familyType);
  const showThirdParent = hasThirdParent(participantDraft.familyType);
  const showSecondChild = hasSecondChild(participantDraft.familyType);
  const isEditingStaff = Boolean(staffDraft.id);
  const isEditingParticipant = Boolean(participantDraft.id);

  function editStaff(item: StaffMember) {
    setActivePeopleView("staff");
    setActiveGroup(item.groupName);
    setStaffDraft({ ...item });
    setMessage(`正在编辑${item.name}`);
  }

  function editParticipant(item: Participant) {
    setActivePeopleView("participants");
    setActiveGroup(item.groupName);
    setParticipantDraft(normalizeParticipantDraft(item));
    setMessage(`正在编辑${item.sequence}号家庭`);
  }

  function clearPeopleDraft() {
    setStaffDraft(emptyStaff(activeGroup));
    setParticipantDraft(emptyParticipant(activeGroup));
    setMessage("");
  }

  return (
    <>
      <section className="group-tabs" aria-label="团分组">
        {peopleGroups.map((group) => (
          <button className={activeGroup === group ? "active" : ""} key={group} onClick={() => setActiveGroup(group)}>
            <strong>{group}</strong>
            <span>{participants.filter((item) => item.groupName === group && item.sequence).length} 户</span>
          </button>
        ))}
      </section>

      <nav className="sub-tabs" aria-label="人员类型">
        <button className={activePeopleView === "staff" ? "active" : ""} onClick={() => setActivePeopleView("staff")}>
          工作人员
        </button>
        <button className={activePeopleView === "participants" ? "active" : ""} onClick={() => setActivePeopleView("participants")}>
          参加团员
        </button>
      </nav>

      <section className="people-layout">
        <form className="panel people-form" onSubmit={async (event) => {
          event.preventDefault();
          if (activePeopleView === "staff") {
            await saveStaffMember(staffDraft);
            setStaffDraft(emptyStaff(activeGroup));
            setMessage(isEditingStaff ? `${activeGroup}工作人员已更新` : `${activeGroup}工作人员已保存`);
          } else {
            const familyType = inferFamilyType(participantDraft);
            await saveParticipant(familyTypePatch({ ...participantDraft, familyType }, familyType));
            setParticipantDraft(emptyParticipant(activeGroup));
            setMessage(isEditingParticipant ? `${activeGroup}家庭信息已更新` : `${activeGroup}家庭信息已保存`);
          }
          await loadPeople();
        }}>
          <div className="section-head">
            <h2>{activePeopleView === "staff" ? `${isEditingStaff ? "编辑" : "新增"}${activeGroup}工作人员` : `${isEditingParticipant ? "编辑" : "新增"}${activeGroup}家庭`}</h2>
            <span>{message}</span>
          </div>

          {activePeopleView === "staff" ? (
            <>
              <div className="inline-fields">
                <label>
                  序号
                  <input value={staffDraft.sequence} onChange={(event) => setStaffDraft({ ...staffDraft, sequence: event.target.value })} />
                </label>
                <label>
                  类型
                  <input value={staffDraft.type} onChange={(event) => setStaffDraft({ ...staffDraft, type: event.target.value })} />
                </label>
              </div>
              <label>
                姓名
                <input value={staffDraft.name} onChange={(event) => setStaffDraft({ ...staffDraft, name: event.target.value })} required />
              </label>
              <label>
                身份证号
                <input value={staffDraft.idCard} onChange={(event) => setStaffDraft({ ...staffDraft, idCard: event.target.value })} />
              </label>
              <div className="inline-fields">
                <label>
                  性别
                  <select value={staffDraft.gender} onChange={(event) => setStaffDraft({ ...staffDraft, gender: event.target.value })}>
                    <option value="">未填</option>
                    {genders.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label>
                  手机号
                  <input value={staffDraft.phone} onChange={(event) => setStaffDraft({ ...staffDraft, phone: event.target.value })} />
                </label>
              </div>
            </>
          ) : (
            <>
              <div className="inline-fields">
                <label>
                  家庭序号
                  <input value={participantDraft.sequence} onChange={(event) => setParticipantDraft({ ...participantDraft, sequence: event.target.value })} required />
                </label>
                <label>
                  类型
                  <select value={participantDraft.familyType} onChange={(event) => setParticipantDraft(familyTypePatch(participantDraft, event.target.value))}>
                    {familyTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              <div className={showSecondParent || showThirdParent ? "split-form-block" : "form-block"}>
                <div className="split-form-section">
                  <b>{showSecondParent || showThirdParent ? "家长 1" : "家长"}{isIndependentCamp(participantDraft.familyType) ? " · 独" : ""}</b>
                  <label>
                    姓名
                    <input value={participantDraft.parent1Name} onChange={(event) => setParticipantDraft({ ...participantDraft, parent1Name: event.target.value })} />
                  </label>
                  <label>
                    身份证号
                    <input value={participantDraft.parent1IdCard} onChange={(event) => setParticipantDraft({ ...participantDraft, parent1IdCard: event.target.value })} />
                  </label>
                  <label>
                    手机号
                    <input value={participantDraft.parent1Phone} onChange={(event) => setParticipantDraft({ ...participantDraft, parent1Phone: event.target.value })} />
                  </label>
                </div>
                {showSecondParent && (
                  <div className="split-form-section">
                    <b>家长 2</b>
                    <label>
                      姓名
                      <input value={participantDraft.parent2Name} onChange={(event) => setParticipantDraft({ ...participantDraft, parent2Name: event.target.value })} />
                    </label>
                    <label>
                      身份证号
                      <input value={participantDraft.parent2IdCard} onChange={(event) => setParticipantDraft({ ...participantDraft, parent2IdCard: event.target.value })} />
                    </label>
                    <label>
                      手机号
                      <input value={participantDraft.parent2Phone} onChange={(event) => setParticipantDraft({ ...participantDraft, parent2Phone: event.target.value })} />
                    </label>
                  </div>
                )}
                {showThirdParent && (
                  <div className="split-form-section">
                    <b>家长 3</b>
                    <label>
                      姓名
                      <input value={participantDraft.parent3Name} onChange={(event) => setParticipantDraft({ ...participantDraft, parent3Name: event.target.value })} />
                    </label>
                    <label>
                      身份证号
                      <input value={participantDraft.parent3IdCard} onChange={(event) => setParticipantDraft({ ...participantDraft, parent3IdCard: event.target.value })} />
                    </label>
                    <label>
                      手机号
                      <input value={participantDraft.parent3Phone} onChange={(event) => setParticipantDraft({ ...participantDraft, parent3Phone: event.target.value })} />
                    </label>
                  </div>
                )}
              </div>
              <div className={showSecondChild ? "split-form-block" : "form-block"}>
                <div className="split-form-section">
                  <b>{showSecondChild ? "孩子 1" : "孩子"}</b>
                  <label>
                    姓名
                    <input value={participantDraft.childName} onChange={(event) => setParticipantDraft({ ...participantDraft, childName: event.target.value })} required />
                  </label>
                  <label>
                    身份证号
                    <input value={participantDraft.childIdCard} onChange={(event) => setParticipantDraft({ ...participantDraft, childIdCard: event.target.value })} />
                  </label>
                  <div className="inline-fields">
                    <label>
                      性别
                      <select value={participantDraft.childGender} onChange={(event) => setParticipantDraft({ ...participantDraft, childGender: event.target.value })}>
                        <option value="">未填</option>
                        {genders.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <label>
                      尺码
                      <input value={participantDraft.childSize} onChange={(event) => setParticipantDraft({ ...participantDraft, childSize: event.target.value })} />
                    </label>
                  </div>
                  <div className="inline-fields">
                    <label>
                      身高
                      <input value={participantDraft.childHeight} onChange={(event) => setParticipantDraft({ ...participantDraft, childHeight: event.target.value })} />
                    </label>
                    <label>
                      体重
                      <input value={participantDraft.childWeight} onChange={(event) => setParticipantDraft({ ...participantDraft, childWeight: event.target.value })} />
                    </label>
                  </div>
                </div>
                {showSecondChild && (
                  <div className="split-form-section">
                    <b>孩子 2</b>
                    <label>
                      姓名
                      <input value={participantDraft.child2Name} onChange={(event) => setParticipantDraft({ ...participantDraft, child2Name: event.target.value })} />
                    </label>
                    <label>
                      身份证号
                      <input value={participantDraft.child2IdCard} onChange={(event) => setParticipantDraft({ ...participantDraft, child2IdCard: event.target.value })} />
                    </label>
                    <div className="inline-fields">
                      <label>
                        性别
                        <select value={participantDraft.child2Gender} onChange={(event) => setParticipantDraft({ ...participantDraft, child2Gender: event.target.value })}>
                          <option value="">未填</option>
                          {genders.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                      <label>
                        尺码
                        <input value={participantDraft.child2Size} onChange={(event) => setParticipantDraft({ ...participantDraft, child2Size: event.target.value })} />
                      </label>
                    </div>
                    <div className="inline-fields">
                      <label>
                        身高
                        <input value={participantDraft.child2Height} onChange={(event) => setParticipantDraft({ ...participantDraft, child2Height: event.target.value })} />
                      </label>
                      <label>
                        体重
                        <input value={participantDraft.child2Weight} onChange={(event) => setParticipantDraft({ ...participantDraft, child2Weight: event.target.value })} />
                      </label>
                    </div>
                  </div>
                )}
              </div>
              <div className="inline-fields">
                <label>
                  房号
                  <input value={participantDraft.roomNumber} onChange={(event) => setParticipantDraft({ ...participantDraft, roomNumber: event.target.value })} />
                </label>
                <label>
                  房型
                  <select value={participantDraft.roomType} onChange={(event) => setParticipantDraft({ ...participantDraft, roomType: event.target.value })}>
                    <option value="">未填</option>
                    {roomTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              <label>
                备注
                <textarea value={participantDraft.note} onChange={(event) => setParticipantDraft({ ...participantDraft, note: event.target.value })} />
              </label>
            </>
          )}

          <div className="form-actions">
            <button className="primary"><Plus size={17} />{activePeopleView === "staff" ? (isEditingStaff ? "更新工作人员" : "保存工作人员") : (isEditingParticipant ? "更新家庭" : "保存家庭")}</button>
            {(isEditingStaff || isEditingParticipant) && <button className="ghost-button" type="button" onClick={clearPeopleDraft}>取消编辑</button>}
          </div>
        </form>

        <section className="panel people-list-panel">
          <div className="section-head">
            <h2>{activePeopleView === "staff" ? `${activeGroup}工作人员` : `${activeGroup}家庭名单`}</h2>
            <span>{activePeopleView === "staff" ? `${groupStaffCount} 人` : `${groupFamilyCount} 户`}</span>
          </div>
          <input className="people-search" placeholder="搜索序号、姓名、电话、身份证、房号或备注" value={keyword} onChange={(event) => setKeyword(event.target.value)} />

          {activePeopleView === "staff" ? (
            <div className="people-table staff-roster-table">
              <div className="people-row head"><span>序号</span><span>类型</span><span>姓名</span><span>身份证号</span><span>性别</span><span>手机号</span><span>操作</span></div>
              {filteredStaff.map((item) => (
                <div className="people-row" key={item.id}>
                  <span>{item.sequence || "-"}</span>
                  <span>{item.type || "-"}</span>
                  <span>{item.name}</span>
                  <span>{item.idCard || "-"}</span>
                  <span>{item.gender || "-"}</span>
                  <span>{item.phone || "-"}</span>
                  <div className="row-actions">
                    <button type="button" onClick={() => editStaff(item)}>编辑</button>
                    <button type="button" onClick={async () => { await deleteStaffMember(item.id); if (staffDraft.id === item.id) clearPeopleDraft(); await loadPeople(); }}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="participant-table-wrap">
              <table className="participant-roster-table">
                <colgroup>
                  <col className="col-sequence" />
                  <col className="col-type" />
                  <col className="col-name" />
                  <col className="col-id-card" />
                  <col className="col-phone" />
                  <col className="col-name" />
                  <col className="col-id-card" />
                  <col className="col-gender" />
                  <col className="col-metric" />
                  <col className="col-metric" />
                  <col className="col-metric" />
                  <col className="col-room" />
                  <col className="col-room" />
                  <col className="col-note" />
                  <col className="col-action" />
                </colgroup>
                <thead>
                  <tr>
                    <th>序号</th><th>类型</th><th>家长姓名</th><th>家长身份证</th><th>家长手机号</th><th>孩子姓名</th><th>孩子身份证</th><th>性别</th><th>身高</th><th>体重</th><th>尺码</th><th>房号</th><th>房型</th><th>备注</th><th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParticipants.map((item) => (
                    <tr key={item.id}>
                      <td><span className="sequence-cell">{item.sequence || "-"}</span></td>
                      <td>{isIndependentCamp(item.familyType) ? <span className="tag warn">独</span> : item.familyType}</td>
                      <td>
                        <div className="multi-line-cell"><b>{item.parent1Name || "-"}</b>{hasSecondParent(item.familyType) && <b>{item.parent2Name || "-"}</b>}{hasThirdParent(item.familyType) && <b>{item.parent3Name || "-"}</b>}</div>
                      </td>
                      <td>
                        <div className="multi-line-cell id-cell"><span>{item.parent1IdCard || "-"}</span>{hasSecondParent(item.familyType) && <span>{item.parent2IdCard || "-"}</span>}{hasThirdParent(item.familyType) && <span>{item.parent3IdCard || "-"}</span>}</div>
                      </td>
                      <td>
                        <div className="multi-line-cell phone-cell"><span>{item.parent1Phone || "-"}</span>{hasSecondParent(item.familyType) && <span>{item.parent2Phone || "-"}</span>}{hasThirdParent(item.familyType) && <span>{item.parent3Phone || "-"}</span>}</div>
                      </td>
                      <td>
                        <div className="multi-line-cell"><b>{item.childName || "-"}</b>{hasSecondChild(item.familyType) && <b>{item.child2Name || "-"}</b>}</div>
                      </td>
                      <td>
                        <div className="multi-line-cell id-cell"><span>{item.childIdCard || "-"}</span>{hasSecondChild(item.familyType) && <span>{item.child2IdCard || "-"}</span>}</div>
                      </td>
                      <td>
                        <div className="multi-line-cell metric-cell"><b>{item.childGender || "-"}</b>{hasSecondChild(item.familyType) && <b>{item.child2Gender || "-"}</b>}</div>
                      </td>
                      <td><div className="multi-line-cell metric-cell"><b>{item.childHeight || "-"}</b>{hasSecondChild(item.familyType) && <b>{item.child2Height || "-"}</b>}</div></td>
                      <td><div className="multi-line-cell metric-cell"><b>{item.childWeight || "-"}</b>{hasSecondChild(item.familyType) && <b>{item.child2Weight || "-"}</b>}</div></td>
                      <td><div className="multi-line-cell metric-cell"><b>{item.childSize || "-"}</b>{hasSecondChild(item.familyType) && <b>{item.child2Size || "-"}</b>}</div></td>
                      <td>{item.roomNumber || "-"}</td>
                      <td>{item.roomType || "-"}</td>
                      <td><div className="note-cell" title={item.note}>{item.note || "-"}</div></td>
                      <td>
                        <div className="row-actions">
                          <button type="button" onClick={() => editParticipant(item)}>编辑</button>
                          <button type="button" onClick={async () => { await deleteParticipant(item.id); if (participantDraft.id === item.id) clearPeopleDraft(); await loadPeople(); }}>删除</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </>
  );
}

function AttendanceViewPanel() {
  const [points, setPoints] = useState<AttendancePoint[]>([]);
  const [activeDay, setActiveDay] = useState(1);
  const [activePointId, setActivePointId] = useState("");
  const [activeGroup, setActiveGroup] = useState(peopleGroups[0]);
  const [activeMode, setActiveMode] = useState<"point" | "family">("point");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summaries, setSummaries] = useState<AttendanceFamilySummary[]>([]);
  const [expandedFamilyId, setExpandedFamilyId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState("");

  async function loadAttendance() {
    const cached = readAttendanceCache();
    if (cached) {
      setPoints(cached.points);
      setParticipants(cached.participants);
      const cachedPointId = activePointId || cached.points[0]?.id || "";
      if (!activePointId && cachedPointId) setActivePointId(cachedPointId);
      if (cached.points[0]) setActiveDay(cached.points[0].dayIndex);
    }
    const [pointList, participantList, summaryList] = await Promise.all([
      getAttendancePoints(),
      getParticipants(),
      getAttendanceFamilySummaries(activeGroup)
    ]);
    setPoints(pointList);
    setParticipants(participantList);
    setSummaries(summaryList);
    writeAttendanceCache(pointList, participantList);
    const pointId = activePointId || pointList[0]?.id || "";
    if (!activePointId && pointId) setActivePointId(pointId);
    if (pointList[0]) setActiveDay(pointList[0].dayIndex);
    setRecords(pointId ? await getAttendanceRecords(pointId) : []);
  }

  useEffect(() => {
    loadAttendance();
  }, []);

  useEffect(() => {
    if (!activePointId) return;
    getAttendanceRecords(activePointId).then(setRecords);
  }, [activePointId]);

  useEffect(() => {
    getAttendanceFamilySummaries(activeGroup).then(setSummaries);
  }, [activeGroup]);

  const filteredParticipants = participants
    .filter((item) => item.groupName === activeGroup)
    .filter((item) => includesKeyword([
      item.sequence,
      item.parent1Name,
      item.parent1Phone,
      item.parent2Name,
      item.parent2Phone,
      item.parent3Name,
      item.parent3Phone,
      item.childName,
      item.child2Name,
      item.note
    ], keyword))
    .sort(compareSequence);

  const recordMap = new Map(records.map((item) => [item.participantId, item]));
  const dayPoints = useMemo(() => points.filter((point) => point.dayIndex === activeDay), [points, activeDay]);
  const groupedPoints = useMemo(() => Array.from({ length: attendanceDayCount }).map((_, index) => (
    points.filter((point) => point.dayIndex === index + 1).sort((a, b) => a.processIndex - b.processIndex)
  )), [points]);
  const presentCount = filteredParticipants.filter((item) => recordMap.get(item.id)?.status === "present").length;
  const absentCount = filteredParticipants.filter((item) => recordMap.get(item.id)?.status === "absent").length;
  const pendingCount = filteredParticipants.length - presentCount - absentCount;
  const absentParticipants = filteredParticipants.filter((item) => recordMap.get(item.id)?.status === "absent");
  const expectedMemberCount = filteredParticipants.reduce((sum, item) => sum + listAttendanceMembers(item).length, 0);
  const absentMemberCount = absentParticipants.reduce((sum, item) => sum + (recordMap.get(item.id)?.absentMemberIds?.length ?? 0), 0);
  const filteredSummaries = summaries.filter((summary) => includesKeyword([
    summary.participant.sequence,
    parentNames(summary.participant),
    parentPhones(summary.participant),
    childNames(summary.participant),
    summary.participant.note,
    ...summary.records.map((record) => record.note)
  ], keyword)).sort((a, b) => compareSequence(a.participant, b.participant));
  const abnormalSummaries = filteredSummaries.filter((summary) => summary.absentCount > 0);

  useEffect(() => {
    if (!dayPoints.length) return;
    if (!dayPoints.some((point) => point.id === activePointId)) {
      setActivePointId(dayPoints[0].id);
    }
  }, [dayPoints, activePointId]);

  async function updateAttendance(participant: Participant, patch: Partial<Pick<AttendanceRecord, "status" | "note" | "absentMemberIds">>) {
    if (!activePointId) return;
    const current = recordMap.get(participant.id);
    const next = await saveAttendanceRecord({
      pointId: activePointId,
      participantId: participant.id,
      status: patch.status ?? current?.status ?? "pending",
      absentMemberIds: patch.absentMemberIds ?? current?.absentMemberIds ?? [],
      note: patch.note ?? current?.note ?? ""
    });
    setRecords((items) => {
      const index = items.findIndex((item) => item.id === next.id || (item.pointId === next.pointId && item.participantId === next.participantId));
      if (index >= 0) return items.map((item, itemIndex) => itemIndex === index ? next : item);
      return [...items, next];
    });
    setSummaries(await getAttendanceFamilySummaries(activeGroup));
    setMessage("已保存");
  }

  function attendancePointLabel(pointId: string) {
    const point = points.find((item) => item.id === pointId);
    return point ? `第${point.dayIndex}天 · ${point.name}` : "未知行程";
  }

  function getFamilyAbsentDetails(summary: AttendanceFamilySummary) {
    return summary.records
      .filter((record) => record.status === "absent")
      .map((record) => ({
        record,
        pointLabel: attendancePointLabel(record.pointId),
        members: formatAbsentMembers(summary.participant, record.absentMemberIds ?? [])
      }));
  }

  return (
    <>
      <section className="group-tabs" aria-label="点名团分组">
        {peopleGroups.map((group) => (
          <button className={activeGroup === group ? "active" : ""} key={group} onClick={() => setActiveGroup(group)}>
            <strong>{group}</strong>
            <span>{participants.filter((item) => item.groupName === group).length} 户</span>
          </button>
        ))}
      </section>

      <section className="view-switch" aria-label="点名视图">
        <button className={activeMode === "point" ? "active" : ""} type="button" onClick={() => setActiveMode("point")}>当前行程</button>
        <button className={activeMode === "family" ? "active" : ""} type="button" onClick={() => setActiveMode("family")}>家庭总览</button>
      </section>

      <section className={activeMode === "family" ? "attendance-layout family-mode" : "attendance-layout"}>
        {activeMode === "point" && (
          <aside className="panel attendance-points">
            <div className="section-head">
              <h2>行程点名</h2>
              <span>7 天 × 8 流程</span>
            </div>
            <div className="attendance-day-list">
              {Array.from({ length: attendanceDayCount }).map((_, index) => (
                <button className={activeDay === index + 1 ? "active" : ""} key={index + 1} type="button" onClick={() => setActiveDay(index + 1)}>
                  第{index + 1}天
                </button>
              ))}
            </div>
            <div className="attendance-point-list">
              {dayPoints.map((point) => (
                <button className={activePointId === point.id ? "active" : ""} key={point.id} onClick={() => setActivePointId(point.id)}>
                  <span>{point.processIndex}</span>
                  <b>{point.name}</b>
                </button>
              ))}
            </div>
          </aside>
        )}

        <section className="panel attendance-panel">
          <div className="section-head">
            <h2>{activeMode === "point" ? `第${activeDay}天 · ${points.find((item) => item.id === activePointId)?.name ?? "点名"}` : `${activeGroup} · 家庭全程点名`}</h2>
            <span>{activeMode === "point" ? (message || `应到 ${expectedMemberCount} 人 / 未到 ${absentMemberCount} 人 / 异常 ${absentCount} 户 / 未点 ${pendingCount} 户`) : `${filteredSummaries.length} 户 · 异常 ${filteredSummaries.filter((item) => item.absentCount > 0).length} 户`}</span>
          </div>
          <input className="people-search" placeholder="搜索序号、家长、电话或孩子姓名" value={keyword} onChange={(event) => setKeyword(event.target.value)} />

          {activeMode === "point" ? (
            <>
              <div className="attendance-dashboard">
                <div className="attendance-metric">
                  <span>应到人员</span>
                  <strong>{expectedMemberCount}</strong>
                  <small>{filteredParticipants.length} 户家庭</small>
                </div>
                <div className="attendance-metric danger">
                  <span>未到人员</span>
                  <strong>{absentMemberCount}</strong>
                  <small>{absentCount} 户异常</small>
                </div>
                <div className="attendance-metric">
                  <span>未点家庭</span>
                  <strong>{pendingCount}</strong>
                  <small>{presentCount} 户已到</small>
                </div>
              </div>

              <div className="absence-board">
                <div className="absence-board-head">
                  <div>
                    <b>当前行程异常</b>
                    <span>{absentParticipants.length ? `${absentParticipants.length} 户需要确认` : "暂无未到"}</span>
                  </div>
                </div>
                {absentParticipants.length === 0 ? (
                  <div className="empty-state">当前行程没有未到人员。</div>
                ) : (
                  <div className="absence-card-grid">
                    {absentParticipants.map((item) => {
                      const record = recordMap.get(item.id);
                      const detail = formatAbsentMembers(item, record?.absentMemberIds ?? []);
                      return (
                        <article className="absence-card" key={item.id}>
                          <div className="absence-card-top">
                            <span className="sequence-cell">{item.sequence || "-"}</span>
                            <div>
                              <b>{childNames(item)}</b>
                              <small>{item.familyType}</small>
                            </div>
                          </div>
                          <div className="absence-members">
                            {(detail || "未指定具体成员").split("、").map((member) => <span key={member}>{member}</span>)}
                          </div>
                          <dl>
                            <div><dt>家长</dt><dd>{parentNames(item)}</dd></div>
                            <div><dt>电话</dt><dd>{parentPhones(item)}</dd></div>
                            <div><dt>备注</dt><dd>{record?.note || "-"}</dd></div>
                          </dl>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="attendance-table-wrap">
                <table className="attendance-table">
                  <colgroup>
                    <col className="att-sequence" />
                    <col className="att-parent" />
                    <col className="att-phone" />
                    <col className="att-child" />
                    <col className="att-status" />
                    <col className="att-note" />
                  </colgroup>
                  <thead>
                    <tr><th>序号</th><th>家长</th><th>号码</th><th>孩子姓名</th><th>点名</th><th>备注</th></tr>
                  </thead>
                  <tbody>
                    {filteredParticipants.map((participant) => {
                      const record = recordMap.get(participant.id);
                      const status = record?.status ?? "pending";
                      const absentMemberText = status === "absent" ? formatAbsentMembers(participant, record?.absentMemberIds ?? []) : "";
                      return (
                        <tr key={participant.id}>
                          <td><span className="sequence-cell">{participant.sequence || "-"}</span></td>
                          <td>{parentNames(participant)}</td>
                          <td>{parentPhones(participant)}</td>
                          <td>{childNames(participant)}</td>
                          <td>
                            <div className="attendance-status">
                              {(["pending", "present", "absent"] as AttendanceStatus[]).map((item) => (
                                <button className={status === item ? `active ${item}` : ""} key={item} type="button" onClick={() => updateAttendance(participant, { status: item })}>
                                  {attendanceStatusLabels[item]}
                                </button>
                              ))}
                            </div>
                            {absentMemberText && (
                              <div className="attendance-member-readout">
                                {absentMemberText}
                              </div>
                            )}
                          </td>
                          <td>
                            <textarea
                              className="attendance-note"
                              defaultValue={record?.note ?? ""}
                              onBlur={(event) => updateAttendance(participant, { note: event.currentTarget.value })}
                              placeholder="现场备注"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
            <div className="family-overview-board">
              <div className="absence-board-head">
                <div>
                  <b>全程异常家庭</b>
                  <span>{abnormalSummaries.length ? `${abnormalSummaries.length} 户出现未到记录` : "暂无异常家庭"}</span>
                </div>
              </div>
              {abnormalSummaries.length === 0 ? (
                <div className="empty-state">当前团还没有未到记录。</div>
              ) : (
                <div className="family-exception-grid">
                  {abnormalSummaries.map((summary) => {
                    const absentDetails = getFamilyAbsentDetails(summary);
                    return (
                      <article className="family-exception-card" key={summary.participant.id}>
                        <div className="absence-card-top">
                          <span className="sequence-cell">{summary.participant.sequence || "-"}</span>
                          <div>
                            <b>{childNames(summary.participant)}</b>
                            <small>{summary.participant.familyType} · 未到 {summary.absentCount} 次</small>
                          </div>
                        </div>
                        <div className="family-exception-events">
                          {absentDetails.slice(0, 4).map((detail) => (
                            <span key={detail.record.id}>
                              <b>{detail.pointLabel}</b>
                              {detail.members || "未指定具体成员"}
                            </span>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="family-summary-list">
              {filteredSummaries.length === 0 && <p className="muted">当前团还没有家庭名单，请先在人员信息中录入。</p>}
              {filteredSummaries.map((summary) => {
                const isExpanded = expandedFamilyId === summary.participant.id;
                const absentDetails = getFamilyAbsentDetails(summary);
                return (
                  <article className="family-summary-card" key={summary.participant.id}>
                    <button className="family-summary-head" type="button" onClick={() => setExpandedFamilyId(isExpanded ? "" : summary.participant.id)}>
                      <span className="sequence-cell">{summary.participant.sequence || "-"}</span>
                      <strong>{childNames(summary.participant)}</strong>
                      <small>{parentNames(summary.participant)} · {parentPhones(summary.participant)}</small>
                      <b className={summary.absentCount > 0 ? "danger" : ""}>已到 {summary.presentCount} / 未到 {summary.absentCount} / 未点 {summary.pendingCount}</b>
                    </button>
                    {absentDetails.length > 0 && (
                      <div className="family-alert-strip">
                        {absentDetails.slice(0, 3).map((detail) => (
                          <span key={detail.record.id}>
                            <b>{detail.pointLabel}</b>
                            {detail.members || "未指定具体成员"}
                          </span>
                        ))}
                        {absentDetails.length > 3 && <em>另有 {absentDetails.length - 3} 条异常</em>}
                      </div>
                    )}
                    <div className="family-attendance-grid">
                      {groupedPoints.map((dayPointList, index) => (
                        <div className="family-attendance-day" key={index + 1}>
                          <span>第{index + 1}天</span>
                          <div>
                            {dayPointList.map((point) => {
                              const record = summary.records.find((item) => item.pointId === point.id);
                              const status = record?.status ?? "pending";
                              return (
                                <i className={`status-dot ${status}`} key={point.id} title={`${point.name}：${attendanceStatusLabels[status]}`}>
                                  {point.processIndex}
                                </i>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {isExpanded && (
                      <div className="family-detail">
                        {points.map((point) => {
                          const record = summary.records.find((item) => item.pointId === point.id);
                          const status = record?.status ?? "pending";
                          return (
                            <div className="family-detail-row" key={point.id}>
                              <span>第{point.dayIndex}天 · {point.name}</span>
                              <b className={status}>{attendanceStatusLabels[status]}</b>
                              <p>
                                {status === "absent" && record?.absentMemberIds?.length ? (
                                  <strong>{formatAbsentMembers(summary.participant, record.absentMemberIds)}</strong>
                                ) : null}
                                {record?.note || "-"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            </>
          )}
        </section>
      </section>
    </>
  );
}
