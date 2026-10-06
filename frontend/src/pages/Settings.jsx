import { useEffect, useState } from 'react';
import api from '../api';
import { DEFAULT_SETTINGS as DEFAULTS, readSettings, writeSettings } from '../lib/settings';

export default function Settings() {
  const [settings, setSettings] = useState(readSettings);
  const [info, setInfo] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.themeFamily = settings.themeFamily;
    document.documentElement.dataset.themeMode = settings.themeMode;
    writeSettings(settings);
    window.dispatchEvent(new Event('daily-control-theme-change'));
  }, [settings]);

  useEffect(() => {
    Promise.allSettled([api.info(), api.health()]).then(([infoResult, healthResult]) => {
      if (infoResult.status === 'fulfilled') setInfo(infoResult.value);
      if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
      else setError('الباك اند غير متصل');
    });
  }, []);

  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));

  const refreshModels = async () => {
    setRefreshing(true);
    setMessage(null);
    try {
      await api.models.refresh();
      setMessage('تم تحديث قائمة الموديلات بنجاح.');
    } catch (err) { setError(err.message); }
    finally { setRefreshing(false); }
  };

  const reset = () => {
    setSettings({ ...DEFAULTS });
    setMessage('تمت إعادة الإعدادات الافتراضية.');
  };

  return (
    <div>
      <h2 className="page-title">الإعدادات</h2>
      {error && <div className="error-box">{error}</div>}
      {message && <div className="success-box">{message}</div>}

      <div className="grid grid-2">
        <section className="card settings-section">
          <h3>إعدادات الواجهة</h3>
          <p className="text-muted">اختار عائلة الثيم، ثم اختار النسخة الداكنة أو الفاتحة.</p>
          <div className="theme-choices">
            {[['slate', 'العادي', 'أزرق هادئ ونظيف'], ['volcanic', 'البركاني', 'حمم وجمر وبازلت'], ['grass', 'العشبي', 'مرج حي ويراعات'], ['darkness', 'الظلام', 'ضباب وكشاف ونجوم']].map(([value, label, description]) => (
              <button key={value} type="button" className={`theme-choice theme-choice-${value} ${settings.themeFamily === value ? 'active' : ''}`} onClick={() => update('themeFamily', value)}>
                <span>{label}</span><small>{description}</small>
              </button>
            ))}
          </div>
          <div className="theme-mode-choices">
            {['dark', 'light'].map((mode) => (
              <button key={mode} type="button" className={settings.themeMode === mode ? '' : 'secondary'} onClick={() => update('themeMode', mode)}>
                {mode === 'dark' ? '🌙 Dark' : '☀️ Light'}
              </button>
            ))}
          </div>
          <label className="checkbox-label"><input type="checkbox" checked={settings.refreshModels} onChange={(e) => update('refreshModels', e.target.checked)} /> تحديث الموديلات تلقائيًا</label>
        </section>

        <section className="card settings-section">
          <h3>إعدادات الأمان والتأكيد</h3>
          <label className="checkbox-label"><input type="checkbox" checked={settings.confirmTerminal} onChange={(e) => update('confirmTerminal', e.target.checked)} /> تأكيد قبل تشغيل أمر Terminal</label>
          <label className="checkbox-label"><input type="checkbox" checked={settings.confirmGithubDelete} onChange={(e) => update('confirmGithubDelete', e.target.checked)} /> تأكيد مزدوج قبل حذف GitHub</label>
        </section>

        <section className="card settings-section">
          <h3>إعدادات GitHub</h3>
          <label className="checkbox-label"><input type="checkbox" checked={settings.defaultPrivateRepo} onChange={(e) => update('defaultPrivateRepo', e.target.checked)} /> جعل الريبو الجديد Private افتراضيًا</label>
          <label>رسالة الـ Commit الافتراضية
            <input value={settings.defaultCommitMessage} onChange={(e) => update('defaultCommitMessage', e.target.value)} />
          </label>
          <p className="text-muted">التوكن لا يُحفظ في الواجهة؛ يبقى داخل الباك اند فقط.</p>
        </section>

        <section className="card settings-section">
          <h3>إعدادات الموديلات</h3>
          <p className="text-muted">يتم اكتشاف Google والمزودين المحليين من صفحة الموديلات.</p>
          <button onClick={refreshModels} disabled={refreshing}>{refreshing ? 'جاري التحديث...' : '🔄 تحديث الموديلات الآن'}</button>
        </section>
      </div>

      <section className="card" style={{ marginTop: '16px' }}>
        <h3>حالة النظام</h3>
        <table className="settings-table"><tbody>
          <tr><td>الباك اند</td><td><span className={`status-dot ${health ? 'online' : 'offline'}`} />{health ? `متصل — ${Math.floor(health.uptime || 0)} ثانية` : 'غير متصل'}</td></tr>
          <tr><td>التطبيق</td><td>{info?.name || 'Daily Control'} — v{info?.version || '—'}</td></tr>
          <tr><td>البيئة</td><td>{info?.env || '—'}</td></tr>
          <tr><td>الفرونت</td><td dir="ltr">{window.location.origin}</td></tr>
          <tr><td>الباك (عبر البروكسي)</td><td dir="ltr">{window.location.origin}/api</td></tr>
        </tbody></table>
        <button className="secondary" style={{ marginTop: '16px' }} onClick={reset}>إعادة الإعدادات الافتراضية</button>
      </section>
    </div>
  );
}
