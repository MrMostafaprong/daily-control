import { useEffect, useState } from 'react';
import api from '../api';

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [info, setInfo] = useState(null);
  const [models, setModels] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        // نجيب الثلاثة بالتوازي — لو health فشلت يبقى الباك مقفول
        const [h, i, m, d] = await Promise.allSettled([
          api.health(),
          api.info(),
          api.models.list(),
          api.files.models(),
        ]);
        if (cancelled) return;

        if (h.status === 'rejected') {
          throw new Error('الباك اند غير متصل — تأكد إنه شغال على البورت 5000');
        }
        setHealth(h.value);
        if (i.status === 'fulfilled') setInfo(i.value);
        if (m.status === 'fulfilled' || d.status === 'fulfilled') {
          setModels({ catalog: m.status === 'fulfilled' ? m.value : null, detected: d.status === 'fulfilled' ? d.value : null });
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="loading">جاري التحميل...</div>;

  if (error) {
    return (
      <div>
        <h2 className="page-title">الرئيسية</h2>
        <div className="error-box">{error}</div>
        <p className="text-muted">
          شغّل الباك اند: <code>cd backend && npm start</code>
        </p>
      </div>
    );
  }

  const envModels = models?.detected?.models?.env || [];
  const cliModels = models?.detected?.models?.cli || [];
  const localGroups = (models?.catalog?.groups || []).filter((group) => group.source === 'local');
  const localCount = localGroups.reduce((total, group) => total + (group.models?.length || 0), 0);
  const actualModelCount = models?.catalog?.total || 0;

  return (
    <div>
      <h2 className="page-title">الرئيسية</h2>

      <div className="grid grid-3">
        {/* ─── حالة الباك ─── */}
        <div className="card">
          <h3>حالة الخدمة</h3>
          <p style={{ margin: '12px 0 4px' }}>
            <span className="status-dot online" />
            شغال
          </p>
          <p className="text-muted">
            مدة التشغيل: {Math.floor(health?.uptime || 0)} ثانية
          </p>
        </div>

        {/* ─── معلومات التطبيق ─── */}
        <div className="card">
          <h3>معلومات التطبيق</h3>
          <p style={{ margin: '12px 0 4px' }}>{info?.name || 'Daily Control'}</p>
          <p className="text-muted">
            الإصدار: {info?.version || '—'} • البيئة: {info?.env || '—'}
          </p>
        </div>

        {/* ─── عدد الموديلات ─── */}
        <div className="card">
          <h3>الموديلات المكتشفة</h3>
          <p style={{ margin: '12px 0 4px', fontSize: '28px' }}>
            {actualModelCount}
          </p>
          <p className="text-muted">
            {actualModelCount} موديل فعلي • {localCount} محلي
          </p>
        </div>
      </div>

      {/* ─── تفاصيل الموديلات ─── */}
      <div className="grid grid-2" style={{ marginTop: '16px' }}>
        <div className="card">
          <h3>مفاتيح API المتاحة</h3>
          {envModels.length === 0 ? (
            <p className="text-muted" style={{ marginTop: '12px' }}>
              لا يوجد — ضيف المفاتيح في <code>.env</code> بتاع الباك اند
            </p>
          ) : (
            <ul className="model-list">
              {envModels.map((m) => (
                <li key={m.key}>
                  <span className="status-dot online" />
                  {m.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3>أدوات CLI المثبتة</h3>
          {cliModels.length === 0 ? (
            <p className="text-muted" style={{ marginTop: '12px' }}>
              لا يوجد — ممكن تثبت Claude CLI أو Ollama وغيرها
            </p>
          ) : (
            <ul className="model-list">
              {cliModels.map((m) => (
                <li key={m.name}>
                  <span className="status-dot online" />
                  {m.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h3>الموديلات المحلية على جهازك</h3>
          {localGroups.length === 0 ? (
            <p className="text-muted" style={{ marginTop: '12px' }}>
              لم يتم العثور على Ollama أو LM Studio يعملان محليًا.
            </p>
          ) : localGroups.map((group) => (
            <div key={group.providerId} style={{ marginTop: '12px' }}>
              <strong>{group.providerName}</strong>
              <ul className="model-list">
                {(group.models || []).map((model) => (
                  <li key={model.id}><span className="status-dot online" />{model.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
