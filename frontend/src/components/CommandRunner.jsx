import { useEffect, useState } from 'react';
import api from '../api';
import { formatCommand, parseCommandLine } from '../lib/commandLine';
import SudoInlinePrompt from './SudoInlinePrompt';

// الأوامر اللي تحتاج باسورد نظام التشغيل (يُطلب سطرًا داخل الترمنال ولا يُحفَظ)
const OS_PASSWORD_COMMANDS = new Set(['sudo']);

export default function CommandRunner({ projectId }) {
  const [catalog, setCatalog] = useState([]);
  const [mode, setMode] = useState('open');
  const [commandLine, setCommandLine] = useState('');
  const [history, setHistory] = useState([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [cwd, setCwd] = useState('');
  // ─── Root session (user vs root) ───
  const [rootToken, setRootToken] = useState(() => sessionStorage.getItem('dc-root-token') || '');
  const [rootEnabled, setRootEnabled] = useState(false);
  const [rootPassword, setRootPassword] = useState('');
  // سطر باسورد النظام لأوامر sudo داخل الترمنال — لحظي ولا يُحفَظ
  const [pendingSudo, setPendingSudo] = useState(null);

  const allowed = catalog.filter((c) => (typeof c === 'string' ? true : c.enabled)).map((c) => (typeof c === 'string' ? c : c.name));

  useEffect(() => {
    api.terminal
      .allowed()
      .then((d) => {
        setMode(d?.mode || 'open');
        const list = d?.catalog || d?.commands || [];
        setCatalog(list);
        const names = (Array.isArray(list) ? list : []).map((c) => (typeof c === 'string' ? c : c.name));
        if (names.length) setCommandLine(names[0]);
      })
      .catch((err) => setError(err.message));
    api.auth.rootStatus().then((d) => setRootEnabled(Boolean(d?.root?.enabled))).catch(() => {});
  }, []);

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const data = await api.auth.rootUnlock(rootPassword);
      if (data?.token) {
        setRootToken(data.token);
        sessionStorage.setItem('dc-root-token', data.token);
        setRootPassword('');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLock = async () => {
    try { await api.auth.rootLock(rootToken); } catch { /* ignore */ }
    setRootToken('');
    sessionStorage.removeItem('dc-root-token');
  };

  const doRun = async (parsed, extra = {}) => {
    setRunning(true);
    setError(null);
    try {
      const data = await api.terminal.run(projectId, { ...parsed, cwd: cwd || undefined, approved: true, ...extra }, { rootToken });
      if (data?.result?.cwd) setCwd(data.result.cwd);
      setHistory((prev) => [...prev, data?.result].filter(Boolean));
      setCommandLine('');
    } catch (err) {
      if (err.status === 403 && /الروت/.test(err.message)) {
        setError(`${err.message} — فعّل الروت بالباسورد من .env أولًا.`);
      } else setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const handleRun = async (e) => {
    e.preventDefault();
    let parsed;
    try { parsed = parseCommandLine(commandLine); } catch (err) { setError(err.message); return; }
    const preview = formatCommand(parsed.command, parsed.args);
    const needsRoot = catalog.some((c) => typeof c !== 'string' && c.name === parsed.command && c.requiresRoot);
    // sudo → سطر باسورد النظام داخل الترمنال نفسه (هو نفسه التأكيد)
    if (OS_PASSWORD_COMMANDS.has(parsed.command)) {
      setPendingSudo({ parsed, preview, needsRoot });
      return;
    }
    if (!window.confirm(
      `موافقتك مطلوبة لتشغيل الأمر التالي داخل المشروع:\n\n${preview}\n${needsRoot ? '\n⚠️ هذا الأمر يحتاج الروت.\n' : ''}\nهل تريد المتابعة؟`
    )) return;
    await doRun(parsed);
  };

  const handleSudoConfirm = async (systemPassword) => {
    const { parsed } = pendingSudo || {};
    setPendingSudo(null);
    if (!parsed) return;
    // يُرسل مرة واحدة ويُمسح فورًا — لا يُحفَظ في أي مكان
    await doRun(parsed, { sudoPassword: systemPassword });
  };

  return (
    <div className="command-runner">
      <div className="root-bar" style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
        <span className="text-muted" style={{ fontSize: '12px' }}>
          الوضع: {mode === 'whitelist' ? 'قائمة بيضاء' : 'مفتوح'} • الدور: {rootToken ? '🔑 روت' : '👤 مستخدم'}
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

      <form className="terminal-form" onSubmit={handleRun}>
        <input
          list="allowed-terminal-commands"
          dir="ltr"
          value={commandLine}
          onChange={(e) => setCommandLine(e.target.value)}
          placeholder={mode === 'whitelist' ? 'اختر من القاعدة أو اكتب أمرًا مسجلًا' : 'أي أمر مثل الترمينال العادي — sudo يحتاج روت'}
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
              <span className="text-muted">{h.duration}ms {h.timedOut && '⏱️'} {h.rootUsed && '🔑'}</span>
            </div>
            {h.stdout && <pre className="term-stdout">{h.stdout}</pre>}
            {h.stderr && <pre className="term-stderr">{h.stderr}</pre>}
          </div>
        ))}
        {pendingSudo && (
          <SudoInlinePrompt
            preview={pendingSudo.preview}
            onSubmit={handleSudoConfirm}
            onCancel={() => setPendingSudo(null)}
          />
        )}
        {running && <p className="term-running">جاري التنفيذ...</p>}
      </div>
    </div>
  );
}
