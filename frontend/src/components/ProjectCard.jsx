import { useState } from 'react';
import { Link } from 'react-router-dom';

// تحويل stack لأي شكل لنص مقروء
// الباك بيرجعه { languages: [], frameworks: [], tools: [] }
function formatStack(stack) {
  if (!stack) return null;
  if (typeof stack === 'string') return stack;
  const parts = [];
  for (const key of ['languages', 'frameworks', 'tools']) {
    const arr = stack[key];
    if (Array.isArray(arr) && arr.length) parts.push(...arr);
  }
  return parts.length ? parts.join(' • ') : null;
}

export default function ProjectCard({ project, onScan, onRemove }) {
  const [scanning, setScanning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    try {
      await onScan(project.id);
    } finally {
      setScanning(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      // لو ما ضغطش تاني خلال 3 ثواني نلغي التأكيد
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await onRemove(project.id);
  };

  const stackText = formatStack(project.stack);

  return (
    <div className="card project-card">
      <div className="project-card-head">
        <Link to={`/projects/${project.id}`} className="project-name">
          {project.name}
        </Link>
        {project.lastScan && (
          <span className="text-muted">
            آخر فحص: {new Date(project.lastScan).toLocaleDateString('ar')}
          </span>
        )}
      </div>

      {project.description && (
        <p className="text-muted" style={{ margin: '8px 0' }}>
          {project.description}
        </p>
      )}

      <p className="text-muted project-path" title={project.path || ''}>
        📍 {project.path || 'لا يوجد مسار'}
      </p>

      <div className="project-stats">
        <span>🗂️ {project.fileCount ?? '—'} ملف</span>
        <span>💾 {project.totalSize ?? '—'}</span>
        {stackText && <span title={stackText}>🧩 {stackText}</span>}
      </div>

      <div className="project-actions">
        <button onClick={handleScan} disabled={scanning}>
          {scanning ? 'جاري الفحص...' : '🔍 فحص'}
        </button>
        <Link to={`/projects/${project.id}`}>
          <button className="secondary">فتح</button>
        </Link>
        <button
          className={confirmDelete ? 'danger' : 'secondary'}
          onClick={handleDelete}
        >
          {confirmDelete ? 'متأكد؟ اضغط للتأكيد' : '🗑️ حذف'}
        </button>
      </div>
    </div>
  );
}