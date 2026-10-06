import { useEffect, useRef, useState } from 'react';

export default function AIChat({ messages, sending, onSend, placeholder }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  // autoscroll لآخر رسالة
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setInput('');
    onSend(content);
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.length === 0 && !sending && (
          <p className="text-muted chat-empty">ابدأ المحادثة بكتابة رسالة 👇</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            <div className={`chat-bubble ${m.streaming ? 'streaming' : ''}`}>
              {m.content || (m.streaming ? '…' : '')}
              {m.streaming && m.content && <span className="cursor">▍</span>}
            </div>
            {m.model && m.role === 'assistant' && (
              <span className="text-muted chat-model">{m.model}</span>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder || 'اكتب رسالتك...'}
          disabled={sending}
        />
        <button type="submit" disabled={sending || !input.trim()}>
          {sending ? '...' : 'إرسال'}
        </button>
      </form>
    </div>
  );
}