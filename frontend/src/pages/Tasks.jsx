import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import ModelSelector from '../components/ModelSelector';

const STATUS_LABELS = {
  pending: 'معلقة', in_progress: 'جارية', done: 'منتهية', cancelled: 'ملغاة',
};
const PRIORITY_COLORS = { high: 'var(--danger)', medium: 'var(--warning)', low: 'var(--text-muted)' };

function DailyPlan({ plan }) {
  return (
    <div className="daily-plan" dir="rtl">
      <p><strong>الملخص:</strong> {plan.summary}</p>
      <p><strong>التركيز:</strong> {plan.focus}</p>
      <h4 style={{ marginTop: '16px' }}>الجدول المقترح</h4>
      {plan.schedule?.length ? plan.schedule.map((item) => (
        <div className="plan-row" key={`${item.taskId || item.title}-${item.order}`}>
          <span className="plan-order">{item.order}</span>
          <div>
            <strong>{item.title}</strong>
            <span className="text-muted"> — {item.start || 'بدون وقت'}{item.end ? ` إلى ${item.end}` : ''}</span>
            {item.reason && <p className="text-muted">{item.reason}</p>}
          </div>
        </div>
      )) : <p className="text-muted">لا توجد مهام مجدولة.</p>}
      {plan.later?.length > 0 && (
        <>
          <h4 style={{ marginTop: '16px' }}>لاحقًا</h4>
          <ul>{plan.later.map((item) => <li key={`${item.taskId || item.title}-${item.order}`}>{item.title} — {item.reason}</li>)}</ul>
        </>
      )}
      {plan.tips?.length > 0 && (
        <>
          <h4 style={{ marginTop: '16px' }}>نصائح اليوم</h4>
          <ul>{plan.tips.map((tip, index) => <li key={`${tip}-${index}`}>{tip}</li>)}</ul>
        </>
      )}
    </div>
  );
}

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // فلتر
  const [statusFilter, setStatusFilter] = useState('');

  // فورم إضافة
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '', projectId: '', estimatedMinutes: '' });
  const [formError, setFormError] = useState(null);

  // AI
  const [modelGroups, setModelGroups] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [aiBusy, setAiBusy] = useState(null); // 'plan' | 'priorities' | taskId
  const [aiResult, setAiResult] = useState(null); // { title, content }
  const [aiError, setAiError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, s] = await Promise.all([
        api.tasks.list(statusFilter ? { status: statusFilter } : {}),
        api.tasks.stats(),
      ]);
      setTasks(t?.tasks || []);
      setStats(s?.stats || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.projects.list().then((d) => setProjects(d?.projects || [])).catch(() => {});
    api.models.list().then((d) => setModelGroups(d?.groups || [])).catch(() => {});
  }, []);

  const getModel = () => {
    const [providerId, model] = selectedModel.split('::');
    if (!providerId) throw new Error('اختار موديل أولاً من الأعلى');
    return { providerId, model: model || undefined };
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return setFormError('العنوان مطلوب');
    setFormError(null);
    try {
      await api.tasks.create({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        projectId: form.projectId || undefined,
        estimatedMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : undefined,
      });
      setForm({ title: '', description: '', priority: 'medium', dueDate: '', projectId: '', estimatedMinutes: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleComplete = async (id) => {
    try {
      await api.tasks.complete(id);
      await load();
    } catch (err) { setError(err.message); }
  };

  const handleRemove = async (id) => {
    try {
      await api.tasks.remove(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      await load();
    } catch (err) { setError(err.message); }
  };

  const handleDailyPlan = async () => {
    setAiBusy('plan');
    setAiError(null);
    setAiResult(null);
    try {
      const { providerId, model } = getModel();
      const r = await api.planner.daily({ providerId, model });
      setAiResult({ title: `📋 خطة يوم ${r.date} (${r.taskCount} مهمة)`, plan: r.plan });
    } catch (err) { setAiError(err.message); }
    finally { setAiBusy(null); }
  };

  const handlePriorities = async () => {
    setAiBusy('priorities');
    setAiError(null);
    setAiResult(null);
    try {
      const { providerId, model } = getModel();
      const r = await api.planner.priorities({ providerId, model });
      setAiResult({ title: '🎯 اقتراحات الأولويات', content: r.suggestions });
    } catch (err) { setAiError(err.message); }
    finally { setAiBusy(null); }
  };

  const handleBreakdown = async (taskId) => {
    setAiBusy(taskId);
    setAiError(null);
    setAiResult(null);
    try {
      const { providerId, model } = getModel();
      const r = await api.planner.breakdown(taskId, { providerId, model });
      setAiResult({ title: `🔨 تفصيل: ${r.title}`, content: r.breakdown });
    } catch (err) { setAiError(err.message); }
    finally { setAiBusy(null); }
  };

  return (
    <div>
      <h2 className="page-title">المهام</h2>

      {error && <div className="error-box">{error}</div>}

      {/* ─── إحصائيات ─── */}
      {stats && (
        <div className="grid grid-stats" style={{ marginBottom: '16px' }}>
          <div className="card stat-card"><strong>{stats.total}</strong><span className="text-muted">الكل</span></div>
          <div className="card stat-card"><strong>{stats.pending}</strong><span className="text-muted">معلقة</span></div>
          <div className="card stat-card"><strong>{stats.inProgress}</strong><span className="text-muted">جارية</span></div>
          <div className="card stat-card"><strong style={{ color: 'var(--success)' }}>{stats.done}</strong><span className="text-muted">منتهية</span></div>
          <div className="card stat-card"><strong style={{ color: 'var(--danger)' }}>{stats.overdue}</strong><span className="text-muted">متأخرة</span></div>
        </div>
      )}

      {/* ─── أدوات AI ─── */}
      <div className="card ai-tools" style={{ marginBottom: '16px' }}>
        <ModelSelector groups={modelGroups} value={selectedModel} onChange={setSelectedModel} />
        <button onClick={handleDailyPlan} disabled={!!aiBusy}>
          {aiBusy === 'plan' ? 'جاري التخطيط...' : '📋 خطة اليوم'}
        </button>
        <button onClick={handlePriorities} disabled={!!aiBusy}>
          {aiBusy === 'priorities' ? 'جاري التحليل...' : '🎯 اقترح أولويات'}
        </button>
        <button className="secondary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'إلغاء' : '+ مهمة جديدة'}
        </button>
      </div>

      {aiError && <div className="error-box">{aiError}</div>}
      {aiResult && (
        <div className="card ai-result" style={{ marginBottom: '16px' }}>
          <strong>{aiResult.title}</strong>
            {aiResult.plan ? <DailyPlan plan={aiResult.plan} /> : (
              <pre className="task-content" style={{ whiteSpace: 'pre-wrap' }}>{aiResult.content}</pre>
            )}
        </div>
      )}

      {/* ─── فورم إضافة ─── */}
      {showForm && (
        <form className="card project-form" onSubmit={handleCreate}>
          <label>العنوان *
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>الوصف
            <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{ flex: 1 }}>الأولوية
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                <option value="high">عالية</option>
                <option value="medium">متوسطة</option>
                <option value="low">منخفضة</option>
              </select>
            </label>
            <label style={{ flex: 1 }}>تاريخ الاستحقاق
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{ flex: 1 }}>مشروع مرتبط
              <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">— بدون —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label style={{ flex: 1 }}>الوقت المتوقع (دقائق)
              <input type="number" min="1" value={form.estimatedMinutes} onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })} />
            </label>
          </div>
          {formError && <div className="error-box">{formError}</div>}
          <button type="submit">حفظ المهمة</button>
        </form>
      )}

      {/* ─── فلتر ─── */}
      <div className="tasks-filter">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* ─── القايمة ─── */}
      {loading ? (
        <div className="loading">جاري التحميل...</div>
      ) : tasks.length === 0 ? (
        <div className="card empty-state"><p>لا توجد مهام</p></div>
      ) : (
        <div className="task-list">
          {tasks.map((t) => (
            <div key={t.id} className={`card task-item-row ${t.status === 'done' ? 'task-done' : ''}`}>
              <div className="task-main">
                <strong>{t.title}</strong>
                {t.description && <p className="text-muted">{t.description}</p>}
                <div className="project-stats">
                  <span style={{ color: PRIORITY_COLORS[t.priority] }}>● {t.priority}</span>
                  <span>{STATUS_LABELS[t.status]}</span>
                  {t.dueDate && <span>📅 {t.dueDate}</span>}
                  {t.estimatedMinutes && <span>⏱️ {t.estimatedMinutes} د</span>}
                  {t.projectId && <span>📁 {projects.find((p) => p.id === t.projectId)?.name || t.projectId.slice(0, 6)}</span>}
                </div>
              </div>
              <div className="project-actions">
                {t.status !== 'done' && (
                  <>
                    <button onClick={() => handleBreakdown(t.id)} disabled={!!aiBusy}>
                      {aiBusy === t.id ? '...' : '🔨 تفصيل'}
                    </button>
                    <button onClick={() => handleComplete(t.id)}>✅</button>
                  </>
                )}
                <button className="secondary" onClick={() => handleRemove(t.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
