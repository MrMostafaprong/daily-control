import { useEffect, useState } from 'react';
import api from '../api';
import useTerminal from '../hooks/useTerminal';
import TerminalPanel from '../components/TerminalPanel';
import { formatCommand, parseCommandLine } from '../lib/commandLine';

export default function Terminal() {
  const { allowed, history, running, error, run, clear } = useTerminal();
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [commandLine, setCommandLine] = useState('npm');
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
    let parsed;
    try { parsed = parseCommandLine(commandLine); } catch (err) { setRunError(err.message); return; }
    const preview = formatCommand(parsed.command, parsed.args);
    if (!window.confirm(`موافقتك مطلوبة لتشغيل الأمر التالي داخل المشروع:\n\n${preview}\n\nهل تريد المتابعة؟`)) return;
    try {
      await run(projectId, { ...parsed, approved: true });
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
