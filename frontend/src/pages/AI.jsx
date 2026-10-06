import { useEffect, useRef, useState } from 'react';
import api from '../api';
import AIChat from '../components/AIChat';
import ModelSelector from '../components/ModelSelector';

export default function AI() {
  const [modelGroups, setModelGroups] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [messages, setMessages] = useState([]);
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
      patch({ content: full || 'لم يرجع الموديل ردًا.', streaming: false });
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
            : <button className="secondary" onClick={() => setMessages([])} disabled={messages.length === 0}>مسح المحادثة</button>}
        </div>
        <AIChat messages={messages} sending={sending} onSend={handleSend} />
      </div>
    </div>
  );
}
