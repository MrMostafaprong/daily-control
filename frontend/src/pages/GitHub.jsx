import { useState } from 'react';
import useGitHub from '../hooks/useGitHub';
import GitHubStatus from '../components/GitHubStatus';
import GitHubRepoWorkspace from '../components/GitHubRepoWorkspace';
import { readSettings } from '../lib/settings';

function defaultGithubSettings() {
  return readSettings();
}

export default function GitHub() {
  const { status, repos, loading, error, busy, reload, connect, disconnect, createRepo } = useGitHub();
  const [token, setToken] = useState('');
  const [connectError, setConnectError] = useState(null);
  const [showRepoForm, setShowRepoForm] = useState(false);
  const [repoForm, setRepoForm] = useState(() => {
    const settings = defaultGithubSettings();
    return { name: '', description: '', isPrivate: settings.defaultPrivateRepo !== false };
  });
  const [repoError, setRepoError] = useState(null);
  const [selectedRepo, setSelectedRepo] = useState(null);

  const handleConnect = async (e) => {
    e.preventDefault();
    if (!token.trim()) {
      setConnectError('الـ token مطلوب');
      return;
    }
    setConnectError(null);
    try {
      await connect(token.trim());
      setToken('');
    } catch (err) {
      setConnectError(err.message);
    }
  };

  const handleCreateRepo = async (e) => {
    e.preventDefault();
    if (!repoForm.name.trim()) {
      setRepoError('اسم الريبو مطلوب');
      return;
    }
    setRepoError(null);
    try {
      await createRepo({
        name: repoForm.name.trim(),
        description: repoForm.description.trim() || undefined,
        isPrivate: repoForm.isPrivate,
      });
      setRepoForm({ name: '', description: '', isPrivate: defaultGithubSettings().defaultPrivateRepo !== false });
      setShowRepoForm(false);
    } catch (err) {
      setRepoError(err.message);
    }
  };

  if (loading) return <div className="loading">جاري التحميل...</div>;

  if (selectedRepo && status?.connected) {
    const owner = selectedRepo.fullName?.split('/')[0] || status.login;
    return (
      <GitHubRepoWorkspace
        owner={owner}
        repo={selectedRepo}
        onBack={() => setSelectedRepo(null)}
        onDeleted={async () => { setSelectedRepo(null); await reload(); }}
      />
    );
  }

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">GitHub</h2>
        <GitHubStatus status={status} />
      </div>

      {error && <div className="error-box">{error}</div>}

      {/* ─── غير متصل: فورم الربط ─── */}
      {!status?.connected && (
        <form className="card connect-form" onSubmit={handleConnect}>
          <h3>ربط حساب GitHub</h3>
          <p className="text-muted" style={{ margin: '8px 0 12px' }}>
            اعمل Personal Access Token من{' '}
            <a
              href="https://github.com/settings/tokens"
              target="_blank"
              rel="noreferrer"
            >
              GitHub Settings → Tokens
            </a>{' '}
            (صلاحيات: repo)
          </p>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_..."
            dir="ltr"
          />
          {connectError && <div className="error-box">{connectError}</div>}
          <button type="submit" disabled={busy}>
            {busy ? 'جاري الربط...' : 'ربط الحساب'}
          </button>
        </form>
      )}

      {/* ─── متصل: الريبو ─── */}
      {status?.connected && (
        <>
          <div className="page-head">
            <button className="secondary" onClick={disconnect} disabled={busy}>
              فصل الحساب
            </button>
            <button onClick={() => setShowRepoForm((s) => !s)}>
              {showRepoForm ? 'إلغاء' : '+ ريبو جديد'}
            </button>
          </div>

          {showRepoForm && (
            <form className="card project-form" onSubmit={handleCreateRepo}>
              <label>
                اسم الريبو *
                <input
                  value={repoForm.name}
                  onChange={(e) => setRepoForm({ ...repoForm, name: e.target.value })}
                  placeholder="my-repo"
                  dir="ltr"
                />
              </label>
              <label>
                الوصف
                <input
                  value={repoForm.description}
                  onChange={(e) => setRepoForm({ ...repoForm, description: e.target.value })}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={repoForm.isPrivate}
                  onChange={(e) => setRepoForm({ ...repoForm, isPrivate: e.target.checked })}
                />
                ريبو خاص (private)
              </label>
              {repoError && <div className="error-box">{repoError}</div>}
              <button type="submit">إنشاء</button>
            </form>
          )}

          {repos.length === 0 ? (
            <div className="card empty-state">
              <p>لا توجد ريبو — أنشئ واحد</p>
            </div>
          ) : (
            <div className="grid grid-2">
              {repos.map((repo) => (
                <div
                  key={repo.id}
                  className="card repo-card"
                >
                  <div className="repo-head">
                    <a href={repo.url} target="_blank" rel="noreferrer" dir="ltr">
                      {repo.fullName || repo.name}
                    </a>
                    {repo.private && <span className="badge">private</span>}
                  </div>
                  {repo.defaultBranch && (
                    <p className="text-muted">🌿 {repo.defaultBranch}</p>
                  )}
                  {repo.updatedAt && (
                    <p className="text-muted">
                      آخر تحديث: {new Date(repo.updatedAt).toLocaleDateString('ar')}
                    </p>
                  )}
                  {repo.description && <p className="text-muted">{repo.description}</p>}
                  <div className="project-actions" style={{ marginTop: '12px' }}>
                    <button onClick={() => setSelectedRepo(repo)}>📂 فتح الملفات</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
