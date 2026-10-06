import { useMemo } from 'react';

export default function ModelSelector({ groups, value, onChange, disabled }) {
  // value = "providerId::modelId"
  const options = useMemo(() => {
    const out = [];
    for (const g of groups || []) {
      for (const m of g.models || []) {
        out.push({
          value: `${g.providerId}::${m.id}`,
          label: `${g.providerName} — ${m.id}`,
        });
      }
    }
    return out;
  }, [groups]);

  if (options.length === 0) {
    return (
      <p className="text-muted">
        لا توجد موديلات — أضف Provider من صفحة الموديلات أولاً
      </p>
    );
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      <option value="" disabled>— اختر موديل —</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}