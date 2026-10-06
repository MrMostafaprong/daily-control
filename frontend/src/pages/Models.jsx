import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import ProviderCard from '../components/ProviderCard';

export default function Models() {
  const [providers, setProviders] = useState([]);
  const [defaults, setDefaults] = useState([]);
  const [groups, setGroups] = useState([]);
  const [modelsTotal, setModelsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // فورم إضافة
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '', type: 'openai', baseUrl: '', apiKey: '', command: '', defaultModel: '',
  });
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [p, d] = await Promise.all([
        api.providers.list(),
        api.providers.defaults(),
      ]);
      setProviders(p?.providers || []);
      setDefaults(d?.defaults || []);
      // الموديلات — لو فشلت مش هنوقع الصفحة
      try {
        const m = await api.models.list();
        setGroups(m?.groups || []);
        setModelsTotal(m?.total || 0);
      } catch {
        setGroups([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pickDefault = (name) => {
    const d = defaults.find((x) => x.name === name);
    if (!d) return;
    setForm((f) => ({
      ...f,
      name: d.name,
      type: d.type,
      baseUrl: d.baseUrl || '',
      command: d.command || '',
      defaultModel: d.defaultModel || '',
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setFormError('الاسم مطلوب');
    if (form.type === 'openai' && !form.apiKey.trim())
      return setFormError('المفتاح مطلوب لنوع API');
    if (form.type === 'cli' && !form.command.trim())
      return setFormError('الأمر مطلوب لنوع CLI');

    setSaving(true);
    setFormError(null);
    try {
      await api.providers.create({
        name: form.name.trim(),
        type: form.type,
        baseUrl: form.baseUrl.trim() || undefined,
        apiKey: form.apiKey.trim() || undefined,
        command: form.command.trim() || undefined,
        defaultModel: form.defaultModel.trim() || undefined,
        enabled: true,
      });
      setForm({ name: '', type: 'openai', baseUrl: '', apiKey: '', command: '', defaultModel: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (provider) => {
    try {
      await api.providers.update(provider.id, { enabled: !provider.enabled });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemove = async (id) => {
    try {
      await api.providers.remove(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const m = await api.models.refresh();
      setGroups(m?.groups || []);
      setModelsTotal(m?.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && providers.length === 0) return <div className="loading">جاري التحميل...</div>;

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">الموديلات والمزوّدين</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="secondary" onClick={handleRefresh}>🔄 تحديث</button>
          <button onClick={() => setShowForm((s) => !s)}>
            {showForm ? 'إلغاء' : '+ مزوّد جديد'}
          </button>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {showForm && (
        <form className="card project-form" onSubmit={handleCreate}>
          <label>
            اختيار سريع من القوالب
            <select onChange={(e) => pickDefault(e.target.value)} value="">
              <option value="">— قوالب جاهزة —</option>
              {defaults.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
            </select>
          </label>
          <label>الاسم *
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label>النوع *
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="openai">API (OpenAI-compatible)</option>
              <option value="cli">CLI (Claude / Ollama...)</option>
            </select>
          </label>
          {form.type === 'openai' && (
            <>
              <label>Base URL *
                <input dir="ltr" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.openai.com/v1" />
              </label>
              <label>API Key *
                <input dir="ltr" type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="sk-..." />
              </label>
              <label>الموديل الافتراضي
                <input dir="ltr" value={form.defaultModel} onChange={(e) => setForm({ ...form, defaultModel: e.target.value })} placeholder="gpt-4o-mini" />
              </label>
            </>
          )}
          {form.type === 'cli' && (
            <>
              <label>الأمر *
                <input dir="ltr" value={form.command} onChange={(e) => setForm({ ...form, command: e.target.value })} placeholder="claude / ollama / llm" />
              </label>
              <label>الموديل الافتراضي
                <input dir="ltr" value={form.defaultModel} onChange={(e) => setForm({ ...form, defaultModel: e.target.value })} placeholder="llama2 لـ ollama" />
              </label>
            </>
          )}
          {formError && <div className="error-box">{formError}</div>}
          <button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
        </form>
      )}

      {/* ─── المزوّدين ─── */}
      <h3>المزوّدين ({providers.length})</h3>
      {providers.length === 0 ? (
        <div className="card empty-state"><p>لا يوجد مزوّدين — أضف واحد للبدء</p></div>
      ) : (
        <div className="grid grid-2">
          {providers.map((p) => (
            <ProviderCard key={p.id} provider={p} onToggle={handleToggle} onRemove={handleRemove} />
          ))}
        </div>
      )}

      {/* ─── الموديلات المكتشفة ─── */}
      <h3 style={{ marginTop: '24px' }}>الموديلات المكتشفة ({modelsTotal})</h3>
      <div className="grid grid-2">
        {groups.map((g) => (
          <div key={g.providerId} className="card">
            <strong>{g.providerName}</strong>
            <span className="badge">{g.source === 'local' ? 'محلي' : g.type}</span>
            {g.source === 'local' && <p className="text-muted" style={{ marginTop: '6px' }}>تم اكتشافه مباشرة من جهازك</p>}
            {g.error && <p className="task-error" style={{ marginTop: '8px' }}>⚠️ {g.error}</p>}
            <ul className="model-list">
              {(g.models || []).map((m) => (
                <li key={m.id}><span className="status-dot online" />{m.id}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
