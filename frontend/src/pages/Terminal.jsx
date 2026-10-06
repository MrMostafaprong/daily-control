import { useEffect, useState } from 'react';
import api from '../api';
import useTerminal from '../hooks/useTerminal';
import { readSettings } from '../lib/settings';
import TerminalPanel from '../components/TerminalPanel';

export default function Terminal() {
  const { allowed, history, running, error, run, clear } = useTerminal();
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [command, setCommand] = useState('npm');
  const [argsInput, setArgsInput] = useState('');
  const [runError, setRunError] = useState(null);

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

  const handleRun = async (e) => {
    e.preventDefault();
    setRunError(null);
    const preview = `${command} ${argsInput}`.trim();
    if (readSettings().confirmTerminal && !window.confirm(`تشغيل الأمر: ${preview} ؟`)) return;
    try {
      // نقسم الـ args بالمسافات — بسيط وكافي حالياً
      const args = argsInput.trim() ? argsInput.trim().split(/\s+/) : [];
      await run(projectId, { command, args });
      setArgsInput('');
    } catch (err) {
      setRunError(err.message);
    }
  };

  return (
    <div>
      <h2 className="page-title">الترمينال</h2>

      {error && <div className="error-box">{error}</div>}

      <div className="card" style={{ marginBottom: '16px' }}>
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
            <select value={command} onChange={(e) => setCommand(e.target.value)}>
              {allowed.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              dir="ltr"
              value={argsInput}
              onChange={(e) => setArgsInput(e.target.value)}
              placeholder="install  أو  run dev"
            />
            <button type="submit" disabled={running}>
              {running ? 'جاري...' : 'تشغيل'}
            </button>
          </form>
        )}
        {runError && <div className="error-box" style={{ marginTop: '10px' }}>{runError}</div>}
      </div>

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