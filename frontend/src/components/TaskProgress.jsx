export default function TaskProgress({ tasks, running, mode }) {
  if (running) {
    return (
      <div className="task-progress">
        {tasks.map((t, i) => (
          <div key={i} className="task-item running">
            ⏳ {t.label || t.providerId}
          </div>
        ))}
      </div>
    );
  }

  if (!tasks?.length) return null;

  return (
    <div className="task-progress">
      {tasks.map((t, i) => (
        <div key={i} className={`task-item ${t.ok ? 'ok' : 'failed'}`}>
          <div className="task-head">
            {t.ok ? '✅' : '❌'} {t.label || t.providerId}
            {t.model && <span className="text-muted"> ({t.model})</span>}
          </div>
          {t.ok ? (
            <pre className="task-content">{t.result?.content}</pre>
          ) : (
            <p className="task-error">{t.error}</p>
          )}
        </div>
      ))}
    </div>
  );
}