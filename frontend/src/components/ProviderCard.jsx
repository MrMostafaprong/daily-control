import { useState } from 'react';

export default function ProviderCard({ provider, onToggle, onRemove }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    await onRemove(provider.id);
  };

  return (
    <div className={`card provider-card ${provider.enabled ? '' : 'disabled'}`}>
      <div className="provider-head">
        <div>
          <strong>{provider.name}</strong>
          <span className="badge">{provider.type === 'openai' ? 'API' : 'CLI'}</span>
        </div>
        <span className={`status-dot ${provider.enabled ? 'online' : 'offline'}`} />
      </div>

      <p className="text-muted" dir="ltr">
        {provider.type === 'openai' ? provider.baseUrl : `$ ${provider.command}`}
      </p>

      <div className="provider-meta">
        <span>{provider.hasKey ? '🔑 مفتاح محفوظ' : '⚠️ بدون مفتاح'}</span>
        <span>🧩 {provider.defaultModel || `${provider.models?.length || 0} موديل`}</span>
      </div>

      <div className="project-actions">
        {provider.managed && <span className="text-muted">إعداد تلقائي من ملف البيئة</span>}
        {!provider.managed && <>
        <button
          className="secondary"
          onClick={() => onToggle(provider)}
        >
          {provider.enabled ? 'تعطيل' : 'تفعيل'}
        </button>
        <button className={confirmDelete ? 'danger' : 'secondary'} onClick={handleDelete}>
          {confirmDelete ? 'متأكد؟' : '🗑️ حذف'}
        </button>
        </>}
      </div>
    </div>
  );
}
