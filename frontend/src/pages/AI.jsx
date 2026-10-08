import { useEffect, useRef, useState } from 'react';
import api from '../api';
import AIChat from '../components/AIChat';
import ModelSelector from '../components/ModelSelector';

export default function AI() {
  const [modelGroups, setModelGroups] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    api.models.list()
      .then((data) => {
        const groups = data?.groups || [];
        setModelGroups(groups);
        // اختار أول موديل متاح تلقائيًا
        const first = groups.find((g) => g.models?.length);
        if (first) setSelectedModel((cur) => cur || `${first.providerId}::${first.models[0].id}`);
      })
      .catch((err) => setError(err.message));
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    api.ai.sessions.list().then(async (data) => {
      const list = data?.sessions || [];
      if (!list.length) { const created = await api.ai.sessions.create({ title: 'جلسة جديدة' }); setSessions([created.session]); setSessionId(created.session.id); return; }
      setSessions(list); const first = list[0]; setSessionId(first.id); setMessages(first.messages || []);
      if (first.providerId && first.model) setSelectedModel(`${first.providerId}::${first.model}`);
    }).catch((err) => setError(err.message));
  }, []);

  const chooseSession = (session) => { setSessionId(session.id); setMessages(session.messages || []); if (session.providerId && session.model) setSelectedModel(`${session.providerId}::${session.model}`); setError(null); };
  const newSession = async () => { try { const created = await api.ai.sessions.create({ title: 'جلسة جديدة' }); setSessions((prev) => [created.session, ...prev]); chooseSession(created.session); } catch (err) { setError(err.message); } };
  const renameSession = async (session) => { const title = window.prompt('اسم الجلسة الجديد:', session.title); if (!title || title.trim() === session.title) return; try { const updated = await api.ai.sessions.update(session.id, { title: title.trim() }); setSessions((prev) => prev.map((item) => item.id === session.id ? updated.session : item)); } catch (err) { setError(err.message); } };
  const deleteSession = async (session) => { if (!window.confirm(`حذف جلسة «${session.title}» نهائيًا؟`)) return; try { await api.ai.sessions.remove(session.id); const remaining = sessions.filter((item) => item.id !== session.id); if (!remaining.length) { await newSession(); return; } setSessions(remaining); if (session.id === sessionId) chooseSession(remaining[0]); } catch (err) { setError(err.message); } };

  const handleSend = async (content) => {
    const sep = selectedModel.indexOf('::');
    const providerId = sep === -1 ? '' : selectedModel.slice(0, sep);
    const model = sep === -1 ? '' : selectedModel.slice(sep + 2);
    if (!providerId) {
      setError('اختار موديل أولاً');
      return;
    }

    const stamp = Date.now();
    const userMessage = { id: `user-${stamp}`, role: 'user', content };
    const assistantId = `assistant-${stamp}`;
    const history = [...messages, userMessage].map(({ role, content: c }) => ({ role, content: c }));

    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: 'assistant', content: '', model: model || null, streaming: true }]);
    if (sessionId) { const draftMessages = [...messages, userMessage]; api.ai.sessions.update(sessionId, { providerId, model: model || null, messages: draftMessages }).then(({ session }) => setSessions((prev) => prev.map((item) => item.id === session.id ? session : item))).catch(() => {}); }
    setSending(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;
    const patch = (changes) => setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, ...changes } : m)));

    try {
      const full = await api.ai.stream(
        { providerId, model: model || undefined, messages: history },
        { signal: controller.signal, onChunk: (_chunk, text) => patch({ content: text }) }
      );
      const finalContent = full || 'لم يرجع الموديل ردًا.';
      patch({ content: finalContent, streaming: false });
      if (sessionId) { const savedMessages = [...history, { role: 'assistant', content: finalContent }]; api.ai.sessions.update(sessionId, { providerId, model: model || null, messages: savedMessages }).then(({ session }) => setSessions((prev) => prev.map((item) => item.id === session.id ? session : item))).catch(() => {}); }
    } catch (err) {
      if (err.name === 'AbortError') {
        patch({ streaming: false });
      } else {
        // لو البث فشل نجرب الطلب العادي مرة واحدة
        try {
          const response = await api.ai.chat({ providerId, model: model || undefined, messages: history });
          const result = response?.result || {};
          patch({ content: result.content || result.error || 'لم يرجع الموديل ردًا.', model: result.model || model || null, streaming: false });
        } catch (fallbackErr) {
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          setError(fallbackErr.message);
        }
      }
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  };

  const stop = () => abortRef.current?.abort();

  return (
    <div className="ai-page">
      <h2 className="page-title">المساعد الذكي</h2>
      <div className="ai-layout">
      <aside className="card ai-sessions">
        <div className="sessions-head"><h3>الجلسات</h3><button type="button" onClick={newSession}>＋ جديدة</button></div>
        <div className="sessions-list">{sessions.map((session) => <div key={session.id} className={`session-row ${session.id === sessionId ? 'active' : ''}`}><button type="button" className="session-select" onClick={() => chooseSession(session)}>{session.title}</button><button type="button" className="session-action" title="إعادة تسمية" onClick={() => renameSession(session)}>✎</button><button type="button" className="session-action danger-text" title="حذف" onClick={() => deleteSession(session)}>×</button></div>)}</div>
      </aside>
      <div className="card ai-main">
        {error && <div className="error-box">{error}</div>}
        <div className="chat-toolbar">
          <ModelSelector
            groups={modelGroups}
            value={selectedModel}
            onChange={setSelectedModel}
            disabled={sending}
          />
          {sending
            ? <button className="danger" onClick={stop}>⏹ إيقاف</button>
            : <button className="secondary" onClick={() => setMessages([])} disabled={messages.length === 0}>مسح العرض</button>}
        </div>
        <AIChat messages={messages} sending={sending} onSend={handleSend} />
      </div>
      </div>
    </div>
  );
}
