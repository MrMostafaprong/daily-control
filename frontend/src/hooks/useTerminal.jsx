import { useCallback, useEffect, useState } from 'react';
import api from '../api';

export default function useTerminal() {
  const [allowed, setAllowed] = useState([]);
  const [history, setHistory] = useState([]); // [{ command, args, ok, stdout, stderr, duration, timedOut }]
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api
      .terminal.allowed()
      .then((d) => setAllowed(d?.commands || []))
      .catch((err) => setError(err.message));
  }, []);

  const run = useCallback(async (projectId, { command, args = [], timeout }) => {
    if (!projectId) throw new Error('اختار مشروع أولاً — الترمينال بيشتغل جوا مجلد مشروع');
    setRunning(true);
    setError(null);
    try {
      const data = await api.terminal.run(projectId, { command, args, timeout });
      const result = data?.result;
      setHistory((prev) => [...prev, result]);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setRunning(false);
    }
  }, []);

  const clear = useCallback(() => setHistory([]), []);

  return { allowed, history, running, error, run, clear };
}