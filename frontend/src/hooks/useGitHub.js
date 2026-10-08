import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { readSettings } from '../lib/settings';

export default function useGitHub() {
  const [status, setStatus] = useState(null); // { connected, login, ... }
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await api.github.status();
      setStatus(s?.status || null);
      if (s?.status?.connected) {
        const r = await api.github.repos();
        setRepos(r?.repos || []);
      } else {
        setRepos([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const connect = useCallback(async (token) => {
    setBusy(true);
    setError(null);
    try {
      const data = await api.github.connect(token);
      await load();
      return data?.account || null;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [load]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await api.github.disconnect();
      setStatus({ connected: false });
      setRepos([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const createRepo = useCallback(async (data) => {
    const res = await api.github.createRepo(data);
    await load();
    return res?.repo || null;
  }, [load]);

  const deleteRepo = useCallback(async (repo) => {
    const expected = repo.fullName || repo.name;
    const confirmation = window.prompt(`لحذف الريبو نهائيًا اكتب اسمه بالضبط:\n${expected}`);
    if (confirmation !== expected) return false;
    if (readSettings().confirmGithubDelete && !window.confirm('الحذف نهائي من GitHub. هل تريد المتابعة؟')) return false;
    setBusy(true); setError(null);
    try { const owner = repo.fullName?.split('/')[0] || status?.login; await api.github.deleteRepo(owner, repo.name); await load(); return true; }
    catch (err) { setError(err.message); throw err; }
    finally { setBusy(false); }
  }, [load, status]);

  return { status, repos, loading, error, busy, reload: load, connect, disconnect, createRepo, deleteRepo };
}
