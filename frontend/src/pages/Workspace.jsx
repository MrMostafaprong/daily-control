import { useEffect, useState } from 'react';
import api from '../api';
import ProjectWorkspace from '../components/ProjectWorkspace';

export default function Workspace() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.projects
      .list()
      .then((d) => {
        const withPath = (d?.projects || []).filter((p) => p.path);
        setProjects(withPath);
        if (withPath.length > 0) setSelectedId(withPath[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const selected = projects.find((p) => p.id === selectedId);

  return (
    <div>
      <h2 className="page-title">مساحة العمل</h2>

      {error && <div className="error-box">{error}</div>}
      {loading && <div className="loading">جاري التحميل...</div>}

      {!loading && projects.length === 0 && (
        <div className="card empty-state">
          <p>لا يوجد مشاريع لها مسار — أضف مسار لمشروع من صفحة المشاريع أولاً</p>
        </div>
      )}

      {projects.length > 0 && (
        <>
          <div style={{ maxWidth: '400px', marginBottom: '16px' }}>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {selected && <ProjectWorkspace project={selected} />}
        </>
      )}
    </div>
  );
}