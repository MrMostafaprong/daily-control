import { useCallback, useEffect, useState } from 'react';
import api from '../api';

export default function useTerminal() {
  const [allowed, setAllowed] = useState([]);
  const [history, setHistory] = useState([]); // [{ command, args, ok, stdout, stderr, duration, timedOut }]
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [cwdByProject, setCwdByProject] = useState({});

  useEffect(() => {
    api
      .terminal.allowed()
      .then((d) => setAllowed(d?.commands || d?.catalog?.map((c) => (typeof c === 'string' ? c : c.name)) || []))
      .catch((err) => setError(err.message));
  }, []);

  const run = useCallback(async (projectId, { command, args = [], timeout, approved = false, sudoPassword }) => {
    if (!projectId) throw new Error('اختار مشروع أولاً — الترمينال بيشتغل جوا مجلد مشروع');
    setRunning(true);
    setError(null);
    try {
      const rootToken = sessionStorage.getItem('dc-root-token') || undefined;
      const data = await api.terminal.run(projectId, { command, args, timeout, cwd: cwdByProject[projectId], approved, ...(sudoPassword ? { sudoPassword } : {}) }, { rootToken });
      const result = data?.result;
      if (result?.cwd) setCwdByProject((prev) => ({ ...prev, [projectId]: result.cwd }));
      setHistory((prev) => [...prev, result]);
      return result;
    } catch (err) {
      const msg = err.status === 403 && /الروت/.test(err.message)
        ? `${err.message} — فعّل الروت بالباسورد من الشريط فوق أولًا.`
        : err.message;
      setError(msg);
      throw new Error(msg);
    } finally {
      setRunning(false);
    }
  }, [cwdByProject]);

  const clear = useCallback(() => setHistory([]), []);

  return { allowed, history, running, error, run, clear };
}
