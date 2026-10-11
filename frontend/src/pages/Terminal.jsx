import { useEffect, useState } from 'react';
import api from '../api';
import useTerminal from '../hooks/useTerminal';
import TerminalPanel from '../components/TerminalPanel';
import SudoInlinePrompt from '../components/SudoInlinePrompt';
import { formatCommand, parseCommandLine } from '../lib/commandLine';

const OS_PASSWORD_COMMANDS = new Set(['sudo']);

export default function Terminal() {
  const { allowed, history, running, error, run, clear } = useTerminal();
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [commandLine, setCommandLine] = useState('npm');
  const [runError, setRunError] = useState(null);
  // ─── Root session (user vs root) — مشتركة مع باقي الصفحات عبر sessionStorage ───
  const [rootToken, setRootToken] = useState(() => sessionStorage.getItem('dc-root-token') || '');
  const [rootEnabled, setRootEnabled] = useState(false);
  const [rootPassword, setRootPassword] = useState('');
  const [pendingSudo, setPendingSudo] = useState(null);

  useEffect(() => {
    api.projects
      .list()
      .then((d) => {
        const withPath = (d?.projects || []).filter((p) => p.path);
        setProjects(withPath);
        if (withPath.length > 0) setProjectId(withPath[0].id);
      })
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    api.auth.rootStatus().then((d) => setRootEnabled(Boolean(d?.root?.enabled))).catch(() => {});
  }, []);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setRunError(null);
    try {
      const data = await api.auth.rootUnlock(rootPassword);
      if (data?.token) {
        setRootToken(data.token);
        sessionStorage.setItem('dc-root-token', data.token);
        setRootPassword('');
      }
    } catch (err) {
      setRunError(err.message);
    }
  };

  const handleLock = async () => {
    try { await api.auth.rootLock(rootToken); } catch { /* ignore */ }
    setRootToken('');
    sessionStorage.removeItem('dc-root-token');
  };

  const handleRun = async (e) => {
    e.preventDefault();
    setRunError(null);
    let parsed;
    try { parsed = parseCommandLine(commandLine); } catch (err) { setRunError(err.message); return; }
    // sudo → سطر باسورد النظام داخل الترمنال نفسه (هو نفسه التأكيد)
    if (OS_PASSWORD_COMMANDS.has(parsed.command)) {
      setPendingSudo({ parsed, preview: formatCommand(parsed.command, parsed.args) });
      return;
    }
    const preview = formatCommand(parsed.command, parsed.args);
    if (!window.confirm(`موافقتك مطلوبة لتشغيل الأمر التالي داخل المشروع:\n\n${preview}\n\nهل تريد المتابعة؟`)) return;
    try {
      await run(projectId, { ...parsed, approved: true });
      setCommandLine('');
    } catch (err) {
      setRunError(err.message);
    }
  };

  const handleSudoConfirm = async (systemPassword) => {
    const { parsed } = pendingSudo || {};
    setPendingSudo(null);
    if (!parsed) return;
    try {
      await run(projectId, { ...parsed, approved: true, sudoPassword: systemPassword });
      setCommandLine('');
    } catch (err) {
      setRunError(err.message);
    }
  };

  return (
    <div>
      <h2 className="page-title">الترمينال</h2>

      {error && <div className="error-box">{error}</div>}

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
          <span className="text-muted" style={{ fontSize: '12px' }}>
            الدور: {rootToken ? '🔑 روت' : '👤 مستخدم'}
          </span>
          {!rootToken ? (
            <form onSubmit={handleUnlock} style={{ display: 'flex', gap: '6px' }}>
              <input
                type="password"
                value={rootPassword}
                onChange={(e) => setRootPassword(e.target.value)}
                placeholder={rootEnabled ? 'باسورد الروت للتفعيل' : 'الروت غير مفعّل (ضع ROOT_PASSWORD في .env)'}
                aria-label="باسورد الروت"
                style={{ width: '200px' }}
              />
              <button type="submit">تفعيل الروت</button>
            </form>
          ) : (
            <button type="button" onClick={handleLock}>قفل الروت</button>
          )}
        </div>
        <h3>تشغيل أمر</h3>
        {projects.length === 0 ? (
          <p className="text-muted" style={{ marginTop: '8px' }}>
            الترمينال بيشتغل جوا مجلد مشروع — أضف مشروع له مسار أولاً
          </p>
        ) : (
          <form className="terminal-form" onSubmit={handleRun}>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              list="allowed-terminal-commands-page"
              dir="ltr"
              value={commandLine}
              onChange={(e) => setCommandLine(e.target.value)}
              placeholder="cd src أو fastfetch أو npm run dev"
            />
            <datalist id="allowed-terminal-commands-page">
              {allowed.map((c) => <option key={c} value={c} />)}
            </datalist>
            <button type="submit" disabled={running}>
              {running ? 'جاري...' : 'تشغيل'}
            </button>
          </form>
        )}
        {runError && <div className="error-box" style={{ marginTop: '10px' }}>{runError}</div>}
      </div>

      {pendingSudo && (
        <div className="terminal-output" dir="ltr" style={{ marginBottom: '16px' }}>
          <SudoInlinePrompt
            preview={pendingSudo.preview}
            onSubmit={handleSudoConfirm}
            onCancel={() => setPendingSudo(null)}
          />
        </div>
      )}

      <TerminalPanel
        history={history}
        running={running}
        allowed={allowed}
        onRun={run}
        onClear={clear}
      />
    </div>
  );
}
