import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'الرئيسية', icon: '🏠', end: true },
  { to: '/tasks', label: 'المهام', icon: '✅' },
  { to: '/workspace', label: 'مساحة العمل', icon: '🛠️' },
  { to: '/projects', label: 'المشاريع', icon: '📁' },
  { to: '/ai', label: 'المساعد الذكي', icon: '🤖' },
  { to: '/models', label: 'الموديلات', icon: '🧩' },
  { to: '/terminal', label: 'الترمينال', icon: '💻' },
  { to: '/github', label: 'GitHub', icon: '🐙' },
  { to: '/settings', label: 'الإعدادات', icon: '⚙️' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">⏱️</span>
        <span className="logo-text">Daily Control</span>
      </div>

      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="link-icon">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="text-muted">v1.0.0 — محلي</span>
      </div>
    </aside>
  );
}
