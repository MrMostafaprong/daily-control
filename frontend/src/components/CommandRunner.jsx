import { useEffect, useState } from 'react';
import api from '../api';
import { readSettings } from '../lib/settings';
import { formatCommand, parseCommandLine } from '../lib/commandLine';

export default function CommandRunner({ projectId }) {
  const [allowed, setAllowed] = useState([]);
  const [commandLine, setCommandLine] = useState('');
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [cwd, setCwd] = useState('');

  useEffect(() => {
    api.terminal
      .allowed()
      .then((d) => {
        setAllowed(d?.commands || []);
        if (d?.commands?.length) setCommandLine(d.commands[0]);
      })
      .catch((err) => setError(err.message));
  }, []);

  const handleRun = async (e) => {
    e.preventDefault();
    let parsed;
    try { parsed = parseCommandLine(commandLine); } catch (err) { setError(err.message); return; }
    const preview = formatCommand(parsed.command, parsed.args);
    if (!window.confirm(`موافقتك مطلوبة لتشغيل الأمر التالي داخل المشروع:\n\n${preview}\n\nهل تريد المتابعة؟`)) return;
    setRunning(true);
    setError(null);
    try {
      const data = await api.terminal.run(projectId, { ...parsed, cwd: cwd || undefined, approved: true });
      if (data?.result?.cwd) setCwd(data.result.cwd);
      setHistory((prev) => [...prev, data?.result].filter(Boolean));
      setCommandLine('');
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="command-runner">
      <form className="terminal-form" onSubmit={handleRun}>
        <input
          list="allowed-terminal-commands"
          dir="ltr"
          value={commandLine}
          onChange={(e) => setCommandLine(e.target.value)}
          placeholder="fastfetch أو npm run dev"
          aria-label="الأمر المراد تشغيله"
        />
        <datalist id="allowed-terminal-commands">
          {allowed.map((c) => <option key={c} value={c} />)}
        </datalist>
        <button type="submit" disabled={running}>
          {running ? 'جاري...' : 'تشغيل'}
        </button>
      </form>

      {error && <div className="error-box" style={{ marginTop: '10px' }}>{error}</div>}

      <div className="terminal-output" dir="ltr">
        {history.length === 0 && !running && (
          <p className="text-muted">$ جاهز</p>
        )}
        {history.map((h, i) => (
          <div key={i} className="terminal-block">
            <div className="terminal-cmd">
              <span className={h.ok ? 'term-ok' : 'term-err'}>
                $ {h.command} {(h.args || []).join(' ')}
              </span>
              <span className="text-muted">{h.duration}ms {h.timedOut && '⏱️'}</span>
            </div>
            {h.stdout && <pre className="term-stdout">{h.stdout}</pre>}
            {h.stderr && <pre className="term-stderr">{h.stderr}</pre>}
          </div>
        ))}
        {running && <p className="term-running">جاري التنفيذ...</p>}
      </div>
    </div>
  );
}
