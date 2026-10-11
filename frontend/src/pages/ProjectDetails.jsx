import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import FileExplorer from '../components/FileExplorer';
import GitHubStatus from '../components/GitHubStatus';
import { readSettings } from '../lib/settings';

// تحويل stack لأي شكل لنص مقروء
function formatStack(stack) {
  if (!stack) return null;
  if (typeof stack === 'string') return stack;
  const parts = [];
  for (const key of ['languages', 'frameworks', 'tools']) {
    const arr = stack[key];
    if (Array.isArray(arr) && arr.length) parts.push(...arr);
  }
  return parts.length ? parts.join(' • ') : null;
}

export default function ProjectDetails() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // رفع على GitHub
  const [ghStatus, setGhStatus] = useState(null);
  const [repoName, setRepoName] = useState('');
  const [pushing, setPushing] = useState(false);
  const [pushResult, setPushResult] = useState(null);
  const [pushError, setPushError] = useState(null);
  const [autoSync, setAutoSync] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.projects.get(id);
        if (cancelled) return;
        setProject(data?.project || null);
        // نجرب نجيب الشجرة — لو فشلت مش هنوقع الصفحة
        try {
          const t = await api.files.tree(id);
          if (!cancelled) setTree(t?.tree || null);
        } catch {
          if (!cancelled) setTree(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadGh() {
      try {
        const s = await api.github.status();
        if (!cancelled) setGhStatus(s?.status || null);
      } catch {
        if (!cancelled) setGhStatus({ connected: false });
      }
    }

    load();
    loadGh();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleScan = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.projects.scan(id);
      if (result?.scan?.project) setProject(result.scan.project);
      const t = await api.files.tree(id);
      setTree(t?.tree || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async (e) => {
    e.preventDefault();
    if (!repoName.trim()) {
      setPushError('اسم الريبو مطلوب');
      return;
    }
    setPushing(true);
    setPushError(null);
    setPushResult(null);
    try {
      const res = await api.github.push(id, {
        repoName: repoName.trim(),
        commitMessage: readSettings().defaultCommitMessage || 'تحديث من Daily Control',
        sync: autoSync,
      });
      setPushResult(res?.result || res);
    } catch (err) {
      setPushError(err.message);
    } finally {
      setPushing(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setPushError(null);
    setSyncResult(null);
    try {
      const res = await api.github.sync(id, {});
      setSyncResult(res?.result || res);
    } catch (err) {
      setPushError(err.message);
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !project) return <div className="loading">جاري التحميل...</div>;

  if (error && !project) {
    return (
      <div>
        <div className="error-box">{error}</div>
        <Link to="/projects">
          <button className="secondary">← رجوع للمشاريع</button>
        </Link>
      </div>
    );
  }

  if (!project) return null;

  const stackText = formatStack(project.stack);

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">{project.name}</h2>
        <button onClick={handleScan}>{loading ? 'جاري الفحص...' : '🔍 إعادة فحص'}</button>
      </div>

      {error && <div className="error-box">{error}</div>}

      <div className="card" style={{ marginBottom: '16px' }}>
        <p className="text-muted project-path" dir="ltr">📍 {project.path || 'لا يوجد مسار'}</p>
        {project.description && <p style={{ marginTop: '8px' }}>{project.description}</p>}
        <div className="project-stats">
          <span>🗂️ {project.fileCount ?? '—'} ملف</span>
          <span>💾 {project.totalSize ?? '—'}</span>
          {stackText && <span title={stackText}>🧩 {stackText}</span>}
          {project.lastScan && (
            <span>🕒 {new Date(project.lastScan).toLocaleString('ar')}</span>
          )}
        </div>
      </div>

      {/* ─── رفع على GitHub ─── */}
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="page-head" style={{ marginBottom: '8px' }}>
          <h3>الرفع على GitHub</h3>
          <GitHubStatus status={ghStatus} />
        </div>

        {!ghStatus?.connected ? (
          <p className="text-muted">
            اربط حساب GitHub أولاً من صفحة <Link to="/github">GitHub</Link>
          </p>
        ) : project.path ? (
          <>
          <form onSubmit={handlePush} className="push-form">
            <input
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="اسم الريبو (مثال: daily-control)"
              dir="ltr"
            />
            <button type="submit" disabled={pushing}>
              {pushing ? 'جاري الرفع...' : '⬆️ رفع / تحديث'}
            </button>
            <button type="button" className="secondary" disabled={syncing} onClick={handleSync} title="سحب آخر شغل الريموت ودمجه (pull --rebase)">
              {syncing ? 'جاري...' : '🔄 مزامنة'}
            </button>
          </form>
          <label style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '8px', fontSize: '13px' }} className="text-muted">
            <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
            مزامنة تلقائية قبل الدفع (لو الريموت متقدم يسحب ويدمج ثم يدفع)
          </label>
          {syncResult && (
            <div className="success-box" style={{ marginTop: '10px' }}>
              ✅ تمت المزامنة — متقدم {syncResult?.status?.ahead ?? '—'} / متأخر {syncResult?.status?.behind ?? '—'}
            </div>
          )}
          </>
        ) : (
          <p className="text-muted">المشروع مفيهوش مسار — ضيف المسار أولاً</p>
        )}

        {pushError && <div className="error-box" style={{ marginTop: '10px' }}>{pushError}</div>}
        {pushResult && (
          <div className="success-box" style={{ marginTop: '10px' }}>
            ✅ تم الرفع بنجاح
            {pushResult?.git?.synced && ' (بعد مزامنة تلقائية مع الريموت)'}
            {pushResult?.repo?.url && (
              <>
                {' '}—{' '}
                <a href={pushResult.repo.url} target="_blank" rel="noreferrer">
                  {pushResult.repo.fullName || pushResult.repo.name}
                </a>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── مستكشف الملفات ─── */}
      <div className="card">
        <h3>الملفات</h3>
        <div style={{ marginTop: '12px' }}>
          <FileExplorer
            projectId={id}
            tree={tree}
            loading={loading && tree === null}
            error={null}
          />
        </div>
      </div>
    </div>
  );
}