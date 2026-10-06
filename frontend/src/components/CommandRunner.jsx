import { useEffect, useState } from 'react';
import api from '../api';
import { readSettings } from '../lib/settings';

export default function CommandRunner({ projectId }) {
  const [allowed, setAllowed] = useState([]);
  const [command, setCommand] = useState('');
  const [argsInput, setArgsInput] = useState('');
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.terminal
      .allowed()
      .then((d) => {
        setAllowed(d?.commands || []);
        if (d?.commands?.length) setCommand(d.commands[0]);
      })
      .catch((err) => setError(err.message));
  }, []);

  const handleRun = async (e) => {
    e.preventDefault();
    const preview = `${command} ${argsInput}`.trim();
    if (readSettings().confirmTerminal && !window.confirm(`تشغيل الأمر: ${preview} ؟`)) return;
    setRunning(true);
    setError(null);
    try {
      const args = argsInput.trim() ? argsInput.trim().split(/\s+/) : [];
      const data = await api.terminal.run(projectId, { command, args });
      setHistory((prev) => [...prev, data?.result].filter(Boolean));
      setArgsInput('');
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="command-runner">
      <form className="terminal-form" onSubmit={handleRun}>
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