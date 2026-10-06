import { useCallback, useEffect, useState } from 'react';
import api from '../api';

export default function useProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.projects.list();
      setProjects(data?.projects || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async (data) => {
    await api.projects.create(data);
    await load();
  }, [load]);

  const update = useCallback(async (id, data) => {
    await api.projects.update(id, data);
    await load();
  }, [load]);

  const remove = useCallback(async (id) => {
    await api.projects.remove(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const scan = useCallback(async (id) => {
    const result = await api.projects.scan(id);
    // السكان بيرجع المشروع محدث — نحدّثه في القايمة
    if (result?.scan?.project) {
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? result.scan.project : p))
      );
    } else {
      await load();
    }
    return result;
  }, [load]);

  return { projects, loading, error, reload: load, create, update, remove, scan };
}