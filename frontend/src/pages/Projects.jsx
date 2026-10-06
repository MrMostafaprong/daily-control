import { useEffect, useState } from 'react';
import { api } from '../api';
import useProjects from '../hooks/useProjects';
import ProjectList from '../components/ProjectList';

export default function Projects() {
  const { projects, loading, error, reload, create, update, remove, scan } = useProjects();
  const [formError, setFormError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', path: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [found, setFound] = useState([]);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!showForm) return;
    api.projects.discover().then((r) => setFound(r.projects || [])).catch(() => setManual(true));
  }, [showForm]);

  const pick = (value) => {
    if (value === '__manual') { setManual(true); setForm({ ...form, path: '' }); return; }
    const p = found.find((x) => x.path === value);
    setForm({ ...form, path: value, name: form.name || (p ? p.name : '') });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('اسم المشروع مطلوب');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await create({
        name: form.name.trim(),
        path: form.path.trim() || undefined,
        description: form.description.trim() || undefined,
      });
      setForm({ name: '', path: '', description: '' });
      setShowForm(false);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">المشاريع</h2>
        <button onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'إلغاء' : '+ مشروع جديد'}
        </button>
      </div>

      {showForm && (
        <form className="card project-form" onSubmit={handleCreate}>
          <label>
            الاسم *
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="اسم المشروع"
            />
          </label>
          <label>
            المسار على الجهاز
            {manual ? (
              <input
                value={form.path}
                onChange={(e) => setForm({ ...form, path: e.target.value })}
                placeholder="C:\projects\my-app أو /home/user/my-app"
                dir="ltr"
              />
            ) : (
              <select value={form.path} onChange={(e) => pick(e.target.value)} dir="ltr">
                <option value="">— اختر مشروعًا من جهازك ({found.length}) —</option>
                {found.map((p) => (
                  <option key={p.path} value={p.path} disabled={p.added}>
                    {p.name} — {p.path}{p.added ? ' (مضاف)' : ''}
                  </option>
                ))}
                <option value="__manual">مسار آخر يدويًا…</option>
              </select>
            )}
          </label>
          <label>
            الوصف
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="وصف مختصر (اختياري)"
            />
          </label>
          {formError && <div className="error-box">{formError}</div>}
          <button type="submit" disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ المشروع'}
          </button>
        </form>
      )}

      <ProjectList
        projects={projects}
        loading={loading}
        error={error}
        onRetry={reload}
        onScan={scan}
        onRemove={remove}
      />
    </div>
  );
}