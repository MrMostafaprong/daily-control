import { useState } from 'react';
import api from '../api';
import TreeNode, { treeNodes } from './FileTree';

export default function FileExplorer({ projectId, tree, loading, error }) {
  const [file, setFile] = useState(null);       // { path, content }
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState(null);
  const [selectedPath, setSelectedPath] = useState(null);

  const handleFileOpen = async (fullPath) => {
    setSelectedPath(fullPath);
    setFileLoading(true);
    setFileError(null);
    try {
      const data = await api.files.read(fullPath, projectId);
      setFile(data?.file || null);
      if (!data?.file) setFileError(`الملف غير موجود: ${fullPath}`);
    } catch (err) {
      setFile(null);
      setFileError(err.message);
    } finally {
      setFileLoading(false);
    }
  };

  if (loading) return <div className="loading">جاري تحميل الشجرة...</div>;
  if (error) return <div className="error-box">{error}</div>;
  if (!tree)
    return <p className="text-muted">لا توجد شجرة ملفات — اعمل فحص للمشروع أولاً</p>;

  const nodes = treeNodes(tree);

  return (
    <div className="explorer-layout">
      <div className="explorer-tree">
        {nodes.length === 0 && (
          <p className="text-muted" style={{ padding: '10px', fontSize: '13px' }}>
            مفيش ملفات
          </p>
        )}
        {nodes.map((node, i) => (
          <TreeNode
            key={node.path || `${node.name}-${i}`}
            node={node}
            parentPath=""
            depth={0}
            selectedPath={selectedPath}
            onFileOpen={handleFileOpen}
          />
        ))}
      </div>

      <div className="explorer-viewer">
        {fileLoading && <div className="loading">جاري قراءة الملف...</div>}
        {fileError && <div className="error-box">{fileError}</div>}
        {!fileLoading && !fileError && !file && (
          <p className="text-muted">اضغط على ملف لعرض محتواه</p>
        )}
        {!fileLoading && !fileError && file && (
          <>
            <div className="file-header">
              <span dir="ltr">📄 {file.path}</span>
              <span className="text-muted">{file.size} بايت</span>
            </div>
            <pre className="file-content">{file.content}</pre>
          </>
        )}
      </div>
    </div>
  );
}