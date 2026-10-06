import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';

const titles = {
  '/': 'الرئيسية',
  '/projects': 'المشاريع',
  '/github': 'GitHub',
  '/settings': 'الإعدادات',
  '/ai': 'المساعد الذكي',
  '/models': 'الموديلات',
  '/terminal': 'الترمينال',
  '/tasks': 'المهام',
  '/workspace': 'مساحة العمل',
};

export default function Header() {
  const location = useLocation();
  const [backendOnline, setBackendOnline] = useState(null); // null = بيتفحص

  // فحص الباك اند + إعادة فحص كل تغيير صفحة
  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then(() => !cancelled && setBackendOnline(true))
      .catch(() => !cancelled && setBackendOnline(false));
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const title =
    titles[location.pathname] ||
    (location.pathname.startsWith('/projects/') ? 'تفاصيل المشروع' : '');

  return (
    <header className="header">
      <h1 className="header-title">{title}</h1>
      <div className="header-status">
        <span
          className={`status-dot ${
            backendOnline ? 'online' : backendOnline === false ? 'offline' : ''
          }`}
        />
        <span className="text-muted">
          {backendOnline === null
            ? 'جاري الفحص...'
            : backendOnline
              ? 'الباك اند شغال'
              : 'الباك اند غير متصل'}
        </span>
      </div>
    </header>
  );
}
