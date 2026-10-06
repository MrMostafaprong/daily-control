import { useEffect, useState } from 'react';
import api from '../api';

export default function FileEditor({ projectId, selectedFile, onSaved }) {
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [currentPath, setCurrentPath] = useState(null); // الملف المفتوح حالياً
  const [manualPath, setManualPath] = useState('');     // خانة الفتح اليدوي
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok'|'error', text }

  const dirty = currentPath && content !== original;

  // لما يتختار ملف من الشجرة نفتحه
  useEffect(() => {
    if (selectedFile) openFile(selectedFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

  const openFile = async (path) => {
    if (!path || !path.trim()) return;
    if (dirty && !window.confirm('فيه تعديلات غير محفوظة. تتجاهلها وتفتح ملف تاني؟')) return;
    setLoading(true);
    setMessage(null);
    try {
      const data = await api.files.read(path.trim(), projectId);
      const c = data?.file?.content ?? '';
      setContent(c);
      setOriginal(c);
      setCurrentPath(path.trim());
      if (!data?.file) {
        setMessage({ type: 'error', text: `الملف غير موجود: ${path}` });
      }
    } catch (err) {
      // فشل الفتح: منغير المحرر ونسيب رسالة واضحة — والمسار في الخانة عشان تصلحه
      setContent('');
      setOriginal('');
      setCurrentPath(null);
      setManualPath(path.trim());
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleManualOpen = (e) => {
    e.preventDefault();
    openFile(manualPath);
  };

  const saveFile = async () => {
    if (!currentPath) return;
    setSaving(true);
    setMessage(null);
    try {
      await api.files.write(currentPath, content, projectId);
      setOriginal(content);
      setMessage({ type: 'ok', text: '✅ تم الحفظ' });
      onSaved?.(currentPath);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="file-editor">
      {/* ─── فتح ملف بالمسار — متاحة دايماً ─── */}
      <form className="file-editor-bar" onSubmit={handleManualOpen}>
        <input
          dir="ltr"
          value={manualPath}
          onChange={(e) => setManualPath(e.target.value)}
          placeholder="مسار أي ملف داخل المشروع — مثال: src/components/Header.jsx"
        />
        <button type="submit" disabled={loading || !manualPath.trim()}>
          {loading ? '...' : 'فتح'}
        </button>
        {dirty && (
          <button type="button" onClick={saveFile} disabled={saving}>
            {saving ? 'جاري الحفظ...' : '💾 حفظ'}
          </button>
        )}
      </form>

      {currentPath && !dirty && !message && (
        <span className="text-muted saved-hint">
          📄 مفتوح: <code dir="ltr">{currentPath}</code> — محفوظ
        </span>
      )}

      {message && (
        <div className={message.type === 'ok' ? 'success-box' : 'error-box'}>
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="loading">جاري قراءة الملف...</div>
      ) : currentPath ? (
        <textarea
          className="editor-area"
          dir="ltr"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
        />
      ) : (
        !message && (
          <div className="file-editor-empty">
            <p className="text-muted">
              📄 اكتب مسار أي ملف فوق واضغط فتح — أو اختار من الشجرة
            </p>
          </div>
        )
      )}
    </div>
  );
}