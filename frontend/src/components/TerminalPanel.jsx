export default function TerminalPanel({ history, running, allowed, onRun, onClear }) {
  return (
    <div className="terminal-panel">
      <div className="terminal-head">
        <span className="text-muted">
          مسموح: {allowed.map((c) => c).join('، ')}
        </span>
        <button className="secondary" onClick={onClear}>تفريغ</button>
      </div>

      <div className="terminal-output" dir="ltr">
        {history.length === 0 && (
          <p className="text-muted">$ جاهز — اكتب أمر وشغّله</p>
        )}
        {history.map((h, i) => (
          <div key={i} className="terminal-block">
            <div className="terminal-cmd">
              <span className={h.ok ? 'term-ok' : 'term-err'}>
                $ {h.command} {(h.args || []).join(' ')}
              </span>
              <span className="text-muted">
                {h.duration}ms {h.timedOut && '⏱️ timeout'}
              </span>
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