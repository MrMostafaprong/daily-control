import ProjectCard from './ProjectCard';

export default function ProjectList({ projects, loading, error, onScan, onRemove, onRetry }) {
  if (loading) return <div className="loading">جاري تحميل المشاريع...</div>;

  if (error) {
    return (
      <div>
        <div className="error-box">{error}</div>
        <button className="secondary" onClick={onRetry}>إعادة المحاولة</button>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="card empty-state">
        <p>📁 لا توجد مشاريع بعد</p>
        <p className="text-muted">أضف أول مشروع من الفورم فوق</p>
      </div>
    );
  }

  return (
    <div className="grid grid-2">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} onScan={onScan} onRemove={onRemove} />
      ))}
    </div>
  );
}