import { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { readSettings } from '../lib/settings';

function joinPath(parent, name) {
  return parent ? `${parent}/${name}` : name;
}

function defaultCommitMessage() {
  return readSettings().defaultCommitMessage || 'تعديل من Daily Control';
}

export default function GitHubRepoWorkspace({ owner, repo, onBack, onDeleted }) {
  const [currentPath, setCurrentPath] = useState('');
  const [entries, setEntries] = useState([]);
  const [file, setFile] = useState(null);
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [commitMessage, setCommitMessage] = useState(defaultCommitMessage);
  const [newPath, setNewPath] = useState('');
  const [commentTitle, setCommentTitle] = useState('ملاحظة من Daily Control');
  const [commentBody, setCommentBody] = useState('');
  const [issueNumber, setIssueNumber] = useState('');
  const [issueComment, setIssueComment] = useState('');

  const loadDirectory = useCallback(async (path = '') => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.github.contents(owner, repo.name, path, repo.defaultBranch);
      setEntries(Array.isArray(data?.contents) ? data.contents : []);
      setCurrentPath(path);
      setFile(null);
      setContent('');
      setOriginal('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [owner, repo]);

  useEffect(() => { loadDirectory(''); }, [loadDirectory]);

  const openEntry = async (entry) => {
    if (entry.type === 'dir') return loadDirectory(entry.path);
    setLoading(true);
    setError(null);
    try {
      const data = await api.github.contents(owner, repo.name, entry.path, repo.defaultBranch);
      const loaded = data?.contents;
      setFile(loaded);
      setContent(loaded?.content || '');
      setOriginal(loaded?.content || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveFile = async () => {
    if (!file || content === original) return;
    setSaving(true);
    setError(null);
    try {
      await api.github.writeFile(owner, repo.name, {
        path: file.path,
        content,
        sha: file.sha,
        branch: repo.defaultBranch,
        message: commitMessage,
      });
      setOriginal(content);
      await loadDirectory(currentPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const createFile = async (event) => {
    event.preventDefault();
    if (!newPath.trim()) return;
    try {
      await api.github.writeFile(owner, repo.name, {
        path: joinPath(currentPath, newPath.trim()),
        content: '',
        branch: repo.defaultBranch,
        message: `إنشاء ${newPath.trim()}`,
      });
      setNewPath('');
      await loadDirectory(currentPath);
    } catch (err) { setError(err.message); }
  };

  const deleteFile = async () => {
    if (!file || !window.confirm(`حذف الملف ${file.path} من GitHub؟`)) return;
    if (readSettings().confirmGithubDelete && !window.confirm('تأكيد أخير: الحذف هيتسجل كـ commit. متأكد؟')) return;
    try {
      await api.github.deleteFile(owner, repo.name, {
        path: file.path,
        sha: file.sha,
        branch: repo.defaultBranch,
        message: `حذف ${file.path}`,
      });
      await loadDirectory(currentPath);
    } catch (err) { setError(err.message); }
  };

  const createIssue = async (event) => {
    event.preventDefault();
    if (!commentBody.trim()) return;
    try {
      const result = await api.github.createIssue(owner, repo.name, { title: commentTitle, body: commentBody });
      setIssueNumber(result?.result?.number ? String(result.result.number) : '');
      setCommentBody('');
    } catch (err) { setError(err.message); }
  };

  const addIssueComment = async (event) => {
    event.preventDefault();
    if (!issueNumber || !issueComment.trim()) return;
    try {
      await api.github.commentIssue(owner, repo.name, issueNumber, issueComment);
      setIssueComment('');
    } catch (err) { setError(err.message); }
  };

  const deleteRepo = async () => {
    const confirmation = window.prompt(`اكتب اسم الريبو للتأكيد: ${repo.name}`);
    if (confirmation !== repo.name) return;
    if (readSettings().confirmGithubDelete && !window.confirm('حذف الريبو نهائي ولا رجعة فيه. تكمل؟')) return;
    try {
      await api.github.deleteRepo(owner, repo.name);
      onDeleted?.();
    } catch (err) { setError(err.message); }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <button className="secondary" onClick={onBack}>← رجوع للريبو</button>
          <h2 className="page-title" style={{ display: 'inline-block', marginInlineStart: '12px' }} dir="ltr">{repo.fullName}</h2>
        </div>
        <button className="danger" onClick={deleteRepo}>حذف الريبو بالكامل</button>
      </div>
      {error && <div className="error-box">{error}</div>}

      <div className="card github-toolbar">
        <strong dir="ltr">/{currentPath}</strong>
        {currentPath && <button className="secondary" onClick={() => loadDirectory(currentPath.split('/').slice(0, -1).join('/'))}>مجلد أعلى</button>}
        <button className="secondary" onClick={() => loadDirectory(currentPath)}>تحديث</button>
      </div>

      <div className="github-workspace">
        <div className="card github-files">
          <h3>الملفات والمجلدات</h3>
          {loading && <div className="loading">جاري التحميل...</div>}
          {!loading && entries.map((entry) => (
            <button key={entry.path} className="github-entry" onClick={() => openEntry(entry)}>
              <span>{entry.type === 'dir' ? '📁' : '📄'}</span>
              <span dir="ltr">{entry.name}</span>
            </button>
          ))}
          {!loading && entries.length === 0 && <p className="text-muted">المجلد فارغ</p>}
          <form className="github-new-file" onSubmit={createFile}>
            <input dir="ltr" value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="ملف جديد أو مجلد/ملف" />
            <button type="submit">إنشاء</button>
          </form>
        </div>

        <div className="card github-editor">
          {file ? (
            <>
              <div className="file-header"><span dir="ltr">{file.path}</span><button className="danger" onClick={deleteFile}>حذف الملف</button></div>
              <textarea className="editor-area" dir="ltr" value={content} onChange={(e) => setContent(e.target.value)} />
              <input value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder="رسالة التعديل" />
              <button onClick={saveFile} disabled={saving || content === original}>{saving ? 'جاري الحفظ...' : 'حفظ كـ Commit'}</button>
            </>
          ) : <p className="text-muted">اضغط على ملف أو مجلد لفتحه.</p>}
        </div>
      </div>

      <div className="grid grid-2" style={{ marginTop: '16px' }}>
        <form className="card" onSubmit={createIssue}>
          <h3>إضافة ملاحظة / Comment</h3>
          <input value={commentTitle} onChange={(e) => setCommentTitle(e.target.value)} placeholder="عنوان الملاحظة" />
          <textarea rows={4} value={commentBody} onChange={(e) => setCommentBody(e.target.value)} placeholder="اكتب التعليق..." />
          <button type="submit">نشر كملاحظة GitHub</button>
        </form>
        <form className="card" onSubmit={addIssueComment}>
          <h3>تعليق على Issue موجود</h3>
          <input dir="ltr" value={issueNumber} onChange={(e) => setIssueNumber(e.target.value)} placeholder="رقم الـ Issue" />
          <textarea rows={4} value={issueComment} onChange={(e) => setIssueComment(e.target.value)} placeholder="اكتب التعليق..." />
          <button type="submit">إضافة التعليق</button>
        </form>
      </div>
    </div>
  );
}
