import { Link } from 'react-router-dom';

export default function GitHubStatus({ status }) {
  if (!status) {
    return <span className="text-muted">جاري الفحص...</span>;
  }

  if (!status.connected) {
    return (
      <Link to="/github" className="gh-status disconnected">
        <span className="status-dot offline" />
        GitHub غير متصل — اضغط للربط
      </Link>
    );
  }

  return (
    <Link to="/github" className="gh-status connected">
      <img
        src={status.avatarUrl}
        alt={status.login}
        className="gh-avatar"
        onError={(e) => (e.target.style.display = 'none')}
      />
      <span className="status-dot online" />
      {status.login}
    </Link>
  );
}