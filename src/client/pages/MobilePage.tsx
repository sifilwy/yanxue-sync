import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Send, Smartphone } from "lucide-react";
import type { AttendancePoint, AttendanceRecord, AttendanceStatus, Participant, Report, Role } from "../../shared/types";
import { createReport, getAttendancePoints, getAttendanceRecords, getParticipants, saveAttendanceRecord, uploadImages } from "../api";
import { RecordImages } from "../components/RecordImages";
import { Loading, Shell } from "../components/Layout";
import { profileStorageKey } from "../constants";
import { useBootstrap } from "../hooks/useBootstrap";
import { filesToDataUrls, type PreparedImage } from "../utils/images";
import { attendanceDayCount, attendanceStatusLabels, normalizeAttendancePoints } from "../../shared/attendance";
import { childNames, includesKeyword, parentNames, parentPhones } from "../utils/people";

type SavedProfile = {
  name?: string;
  role?: Role;
  sessionId?: string;
  teamId?: string;
};

type MobileView = "report" | "attendance";

export function MobilePage() {
  const { data, error } = useBootstrap();
  const [reporterName, setReporterName] = useState("");
  const [reporterRole, setReporterRole] = useState<Role>("teacher");
  const [profileReady, setProfileReady] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [pointId, setPointId] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [imageUrls, setImageUrls] = useState<PreparedImage[]>([]);
  const [isUrgent, setIsUrgent] = useState(false);
  const [affectsSettlement, setAffectsSettlement] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Report[]>([]);
  const [activeView, setActiveView] = useState<MobileView>("report");
  const [attendancePoints, setAttendancePoints] = useState<AttendancePoint[]>([]);
  const [attendanceDay, setAttendanceDay] = useState(1);
  const [attendancePointId, setAttendancePointId] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [attendanceGroup, setAttendanceGroup] = useState("");
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceDrafts, setAttendanceDrafts] = useState<Record<string, Pick<AttendanceRecord, "status" | "note">>>({});
  const [attendanceKeyword, setAttendanceKeyword] = useState("");
  const [attendanceMessage, setAttendanceMessage] = useState("");

  const teams = useMemo(() => data?.teams.filter((item) => item.sessionId === sessionId) ?? [], [data, sessionId]);
  const points = useMemo(
    () => data?.points.filter((item) => item.sessionId === sessionId && (!teamId || item.teamId === teamId)) ?? [],
    [data, sessionId, teamId]
  );

  const currentRoleLabel = data?.roles.find((role) => role.value === reporterRole)?.label ?? reporterRole;
  const currentSessionName = data?.sessions.find((session) => session.id === sessionId)?.name ?? "";
  const currentTeamName = data?.teams.find((team) => team.id === teamId)?.name ?? "";
  const availableGroups = useMemo(() => Array.from(new Set(participants.map((item) => item.groupName))).filter(Boolean), [participants]);
  const activeAttendanceGroup = attendanceGroup || (availableGroups.includes(currentTeamName) ? currentTeamName : availableGroups[0] ?? "一团");
  const attendanceRecordMap = useMemo(() => new Map(attendanceRecords.map((item) => [item.participantId, item])), [attendanceRecords]);
  const attendanceDayPoints = useMemo(() => attendancePoints.filter((point) => point.dayIndex === attendanceDay), [attendancePoints, attendanceDay]);
  const attendancePeople = useMemo(() => participants
    .filter((item) => item.groupName === activeAttendanceGroup)
    .filter((item) => includesKeyword([
      item.sequence,
      item.parent1Name,
      item.parent1Phone,
      item.parent2Name,
      item.parent2Phone,
      item.childName,
      item.child2Name
    ], attendanceKeyword))
    .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0)), [participants, activeAttendanceGroup, attendanceKeyword]);
  const attendanceSummary = useMemo(() => {
    const present = attendancePeople.filter((item) => (attendanceDrafts[item.id]?.status ?? attendanceRecordMap.get(item.id)?.status) === "present").length;
    const absent = attendancePeople.filter((item) => (attendanceDrafts[item.id]?.status ?? attendanceRecordMap.get(item.id)?.status) === "absent").length;
    return { present, absent, pending: attendancePeople.length - present - absent };
  }, [attendancePeople, attendanceDrafts, attendanceRecordMap]);

  useEffect(() => {
    if (!data) return;

    const defaultSessionId = data.sessions[0]?.id ?? "";
    const defaultTeamId = data.teams.find((team) => team.sessionId === defaultSessionId)?.id ?? "";

    try {
      const saved = window.localStorage.getItem(profileStorageKey);
      const profile = saved ? JSON.parse(saved) as SavedProfile : null;

      if (profile?.name && profile.role && profile.sessionId && profile.teamId) {
        setReporterName(profile.name);
        setReporterRole(profile.role);
        setSessionId(profile.sessionId);
        setTeamId(profile.teamId);
        setProfileReady(true);
        setEditingProfile(false);
        return;
      }
    } catch {
      window.localStorage.removeItem(profileStorageKey);
    }

    setSessionId(defaultSessionId);
    setTeamId(defaultTeamId);
    setEditingProfile(true);
  }, [data]);

  useEffect(() => {
    if (!data || !sessionId) return;
    const sessionTeams = data.teams.filter((item) => item.sessionId === sessionId);
    if (!teamId || !sessionTeams.some((item) => item.id === teamId)) {
      setTeamId(sessionTeams[0]?.id ?? "");
    }
  }, [data, sessionId, teamId]);

  useEffect(() => {
    if (!points.length) {
      setPointId("");
      return;
    }

    if (!pointId || !points.some((item) => item.id === pointId)) {
      setPointId(points[0].id);
    }
  }, [points, pointId]);

  useEffect(() => {
    if (!data?.categories.length) return;
    if (!category || !data.categories.includes(category)) {
      setCategory(data.categories[0]);
    }
  }, [data, category]);

  useEffect(() => {
    if (!profileReady || editingProfile) return;
    Promise.all([getAttendancePoints(), getParticipants()]).then(([pointList, participantList]) => {
      const normalizedPoints = normalizeAttendancePoints(pointList);
      setAttendancePoints(normalizedPoints);
      setParticipants(participantList);
      const groups = Array.from(new Set(participantList.map((item) => item.groupName))).filter(Boolean);
      setAttendanceGroup((current) => current || (groups.includes(currentTeamName) ? currentTeamName : groups[0] ?? ""));
      const firstPointId = attendancePointId || normalizedPoints[0]?.id || "";
      if (!attendancePointId && firstPointId) setAttendancePointId(firstPointId);
      if (normalizedPoints[0]) setAttendanceDay(normalizedPoints[0].dayIndex);
      if (firstPointId) getAttendanceRecords(firstPointId).then(setAttendanceRecords);
    });
  }, [profileReady, editingProfile]);

  useEffect(() => {
    if (!attendancePointId) return;
    getAttendanceRecords(attendancePointId).then((items) => {
      setAttendanceRecords(items);
      setAttendanceDrafts(Object.fromEntries(items.map((item) => [item.participantId, { status: item.status, note: item.note }])));
      setAttendanceMessage("");
    });
  }, [attendancePointId]);

  useEffect(() => {
    if (!attendanceDayPoints.length) return;
    if (!attendanceDayPoints.some((point) => point.id === attendancePointId)) {
      setAttendancePointId(attendanceDayPoints[0].id);
    }
  }, [attendanceDayPoints, attendancePointId]);

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const uploaded = imageUrls.length ? await uploadImages(imageUrls) : { urls: [] };
      const created = await createReport({
        reporterName,
        reporterRole,
        sessionId,
        teamId,
        pointId,
        category,
        content,
        imageUrls: uploaded.urls.map((image) => image.url),
        imageThumbUrls: uploaded.urls.map((image) => image.thumbUrl),
        isUrgent,
        affectsSettlement
      });
      setSubmitted((items) => [created, ...items]);
      setContent("");
      setImageUrls([]);
      setIsUrgent(false);
      setAffectsSettlement(false);
    } finally {
      setSubmitting(false);
    }
  }

  function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    window.localStorage.setItem(profileStorageKey, JSON.stringify({
      name: reporterName,
      role: reporterRole,
      sessionId,
      teamId
    }));
    setProfileReady(true);
    setEditingProfile(false);
  }

  function clearProfile() {
    window.localStorage.removeItem(profileStorageKey);
    setProfileReady(false);
    setEditingProfile(true);
  }

  async function handleImages(files: FileList | null) {
    const nextImages = await filesToDataUrls(files, 3 - imageUrls.length);
    setImageUrls((items) => [...items, ...nextImages].slice(0, 3));
  }

  function updateAttendanceDraft(participant: Participant, patch: Partial<Pick<AttendanceRecord, "status" | "note">>) {
    const current = attendanceRecordMap.get(participant.id);
    setAttendanceDrafts((items) => ({
      ...items,
      [participant.id]: {
        status: patch.status ?? items[participant.id]?.status ?? current?.status ?? "pending",
        note: patch.note ?? items[participant.id]?.note ?? current?.note ?? ""
      }
    }));
    setAttendanceMessage("未提交");
  }

  async function submitAttendance() {
    if (!attendancePointId) return;
    const saved = await Promise.all(attendancePeople.map((participant) => {
      const current = attendanceRecordMap.get(participant.id);
      const draft = attendanceDrafts[participant.id];
      return saveAttendanceRecord({
        pointId: attendancePointId,
        participantId: participant.id,
        status: draft?.status ?? current?.status ?? "pending",
        note: draft?.note ?? current?.note ?? ""
      });
    }));
    setAttendanceRecords(saved);
    setAttendanceDrafts(Object.fromEntries(saved.map((item) => [item.participantId, { status: item.status, note: item.note }])));
    setAttendanceMessage("已提交");
  }

  if (error) return <Shell><p>{error}</p></Shell>;
  if (!data) return <Loading />;

  return (
    <Shell narrow>
      <header className="topbar">
        <div>
          <p className="eyebrow">手机端</p>
          <h1>现场信息填报</h1>
        </div>
        <Smartphone size={26} />
      </header>

      {editingProfile || !profileReady ? (
        <form className="panel form" onSubmit={saveProfile}>
          <div>
            <h2>先填写固定信息</h2>
            <p className="muted">姓名、身份、团期和队伍会保存在这台手机里，后面提交不用重复填写。</p>
          </div>

          <label>
            姓名
            <input value={reporterName} onChange={(event) => setReporterName(event.target.value)} placeholder="例如：张老师" required />
          </label>

          <label>
            身份
            <select value={reporterRole} onChange={(event) => setReporterRole(event.target.value as Role)}>
              {data.roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
            </select>
          </label>

          <label>
            团期
            <select value={sessionId} onChange={(event) => setSessionId(event.target.value)} required>
              {data.sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
            </select>
          </label>

          <label>
            队伍
            <select value={teamId} onChange={(event) => setTeamId(event.target.value)} required>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>

          <button className="primary">
            <CheckCircle2 size={18} />
            保存并进入
          </button>
        </form>
      ) : (
        <div className="profile-bar">
          <span>{reporterName} · {currentRoleLabel} · {currentSessionName} · {currentTeamName}</span>
          <button type="button" onClick={clearProfile}>切换信息</button>
        </div>
      )}

      {profileReady && !editingProfile && (
        <nav className="mobile-tabs" aria-label="手机端功能">
          <button className={activeView === "report" ? "active" : ""} type="button" onClick={() => setActiveView("report")}>信息填报</button>
          <button className={activeView === "attendance" ? "active" : ""} type="button" onClick={() => setActiveView("attendance")}>点名系统</button>
        </nav>
      )}

      {profileReady && !editingProfile && activeView === "report" && <form className="panel form" onSubmit={submitReport}>
        <label>
          环节
          <select value={pointId} onChange={(event) => setPointId(event.target.value)}>
            {points.map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}
          </select>
        </label>

        <label>
          类型
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {data.categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>

        <label>
          内容
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="直接写现场发生了什么、怎么处理、还需要谁跟进。"
            required
          />
        </label>

        <label>
          图片
          <input type="file" accept="image/*" multiple onChange={(event) => handleImages(event.target.files)} />
        </label>

        {imageUrls.length > 0 && (
          <div className="image-grid">
            {imageUrls.map((url, index) => (
              <div className="image-preview" key={`${url.thumbUrl}-${index}`}>
                <img src={url.thumbUrl} alt={`上传图片 ${index + 1}`} />
                <button type="button" onClick={() => setImageUrls((items) => items.filter((_, itemIndex) => itemIndex !== index))}>
                  移除
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="switches">
          <label className="check"><input type="checkbox" checked={isUrgent} onChange={(event) => setIsUrgent(event.target.checked)} />紧急</label>
          <label className="check"><input type="checkbox" checked={affectsSettlement} onChange={(event) => setAffectsSettlement(event.target.checked)} />影响结算</label>
        </div>

        <button className="primary" disabled={submitting}>
          {submitting ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
          提交
        </button>
      </form>}

      {profileReady && !editingProfile && activeView === "report" && <section className="panel">
        <h2>刚提交的记录</h2>
        {submitted.length === 0 ? <p className="muted">这里会显示本次提交记录。</p> : submitted.map((item) => (
          <article className="mini-record" key={item.id}>
            <strong>{item.category}</strong>
            <span>{new Date(item.createdAt).toLocaleString()}</span>
            <p>{item.content}</p>
            <RecordImages imageUrls={item.imageUrls} thumbUrls={item.imageThumbUrls} />
          </article>
        ))}
      </section>}

      {profileReady && !editingProfile && activeView === "attendance" && (
        <section className="mobile-attendance">
          <div className="mobile-day-tabs-top" aria-label="点名天数">
            {Array.from({ length: attendanceDayCount }).map((_, index) => (
              <button className={attendanceDay === index + 1 ? "active" : ""} key={index + 1} type="button" onClick={() => setAttendanceDay(index + 1)}>
                第{index + 1}天
              </button>
            ))}
          </div>

          <div className="mobile-attendance-shell">
            <aside className="mobile-attendance-sidebar">
              <div className="mobile-side-title">流程</div>
              <div className="mobile-process-list" aria-label="当天流程">
                {attendanceDayPoints.map((point) => (
                  <button className={attendancePointId === point.id ? "active" : ""} key={point.id} type="button" onClick={() => setAttendancePointId(point.id)}>
                    <span>{point.processIndex}</span>
                    <b>{point.name}</b>
                  </button>
                ))}
              </div>
            </aside>

            <div className="mobile-attendance-content">
              <div className="panel mobile-attendance-head">
                <div>
                  <h2>第{attendanceDay}天 · {attendancePoints.find((point) => point.id === attendancePointId)?.name ?? "点名"}</h2>
                  <span>{attendanceMessage || `已到 ${attendanceSummary.present} / 未到 ${attendanceSummary.absent} / 未点 ${attendanceSummary.pending}`}</span>
                </div>
                {attendanceDayPoints.length === 0 && <p className="muted">当前天数还没有行程点。</p>}
                {availableGroups.length > 0 && (
                  <label className="mobile-attendance-group">
                    名单
                    <select value={activeAttendanceGroup} onChange={(event) => setAttendanceGroup(event.target.value)}>
                      {availableGroups.map((group) => <option key={group} value={group}>{group}</option>)}
                    </select>
                  </label>
                )}
                <input className="people-search" placeholder="搜索序号、家长、电话、孩子姓名" value={attendanceKeyword} onChange={(event) => setAttendanceKeyword(event.target.value)} />
              </div>

              <div className="mobile-attendance-list">
                {attendancePeople.length === 0 && <p className="muted">当前名单没有人员，请先在后台人员信息里录入。</p>}
                {attendancePeople.map((participant) => {
                  const record = attendanceRecordMap.get(participant.id);
                  const draft = attendanceDrafts[participant.id];
                  const status = draft?.status ?? record?.status ?? "pending";
                  const note = draft?.note ?? record?.note ?? "";
                  return (
                    <article className="mobile-attendance-card" key={participant.id}>
                      <div className="mobile-attendance-main">
                        <span className="sequence-cell">{participant.sequence || "-"}</span>
                        <div>
                          <b>{childNames(participant)}</b>
                          <small>{parentNames(participant)} · {parentPhones(participant)}</small>
                        </div>
                      </div>
                      <div className="attendance-status">
                        {(["pending", "present", "absent"] as AttendanceStatus[]).map((item) => (
                          <button className={status === item ? `active ${item}` : ""} key={item} type="button" onClick={() => updateAttendanceDraft(participant, { status: item })}>
                            {attendanceStatusLabels[item]}
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="attendance-note"
                        value={note}
                        onChange={(event) => updateAttendanceDraft(participant, { note: event.currentTarget.value })}
                        placeholder="备注"
                      />
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
          <button className="primary mobile-attendance-submit" type="button" onClick={submitAttendance}>
            <CheckCircle2 size={18} />
            提交本行程点名
          </button>
        </section>
      )}
    </Shell>
  );
}
