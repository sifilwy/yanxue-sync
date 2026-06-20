import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Send, Smartphone } from "lucide-react";
import type { Report, Role } from "../../shared/types";
import { createReport, uploadImages } from "../api";
import { RecordImages } from "../components/RecordImages";
import { Loading, Shell } from "../components/Layout";
import { profileStorageKey } from "../constants";
import { useBootstrap } from "../hooks/useBootstrap";
import { filesToDataUrls, type PreparedImage } from "../utils/images";

type SavedProfile = {
  name?: string;
  role?: Role;
  sessionId?: string;
  teamId?: string;
};

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

  const teams = useMemo(() => data?.teams.filter((item) => item.sessionId === sessionId) ?? [], [data, sessionId]);
  const points = useMemo(
    () => data?.points.filter((item) => item.sessionId === sessionId && (!teamId || item.teamId === teamId)) ?? [],
    [data, sessionId, teamId]
  );

  const currentRoleLabel = data?.roles.find((role) => role.value === reporterRole)?.label ?? reporterRole;
  const currentSessionName = data?.sessions.find((session) => session.id === sessionId)?.name ?? "";
  const currentTeamName = data?.teams.find((team) => team.id === teamId)?.name ?? "";

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

      {profileReady && !editingProfile && <form className="panel form" onSubmit={submitReport}>
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

      {profileReady && !editingProfile && <section className="panel">
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
    </Shell>
  );
}
