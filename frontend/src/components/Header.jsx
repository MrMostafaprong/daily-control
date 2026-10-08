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
  const [stopping, setStopping] = useState(false);

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

  const handleShutdown = async () => {
    if (!window.confirm('سيتم إيقاف الـ frontend والـ backend وتحرير موارد الجهاز. هل تريد المتابعة؟')) return;
    setStopping(true);
    try {
      await api.shutdown();
      setBackendOnline(false);
    } catch (err) {
      setStopping(false);
      window.alert(`تعذر إيقاف البرنامج: ${err.message}`);
    }
  };

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
          {stopping
            ? 'جاري إيقاف البرنامج...'
            : backendOnline === null
            ? 'جاري الفحص...'
            : backendOnline
              ? 'الباك اند شغال'
            : 'الباك اند غير متصل'}
        </span>
        <button className="shutdown-button" type="button" onClick={handleShutdown} disabled={stopping} title="إيقاف البرنامج بالكامل">
          {stopping ? '⏳' : '⏻'} إيقاف البرنامج
        </button>
      </div>
    </header>
  );
}
