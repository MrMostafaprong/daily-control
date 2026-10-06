import { useEffect, useState } from 'react';
import api from '../api';
import FileEditor from './FileEditor';
import CommandRunner from './CommandRunner';
import TreeNode, { treeNodes } from './FileTree';

const TABS = [
  { id: 'files', label: '📝 محرر الملفات' },
  { id: 'terminal', label: '💻 الترمينال' },
];

export default function ProjectWorkspace({ project }) {
  const [tab, setTab] = useState('files');

  // شجرة الملفات
  const [tree, setTree] = useState(null);
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState(null);

  // الملف المختار
  const [selectedFile, setSelectedFile] = useState(null);

  const loadTree = async () => {
    setTreeLoading(true);
    setTreeError(null);
    try {
      const d = await api.files.tree(project.id);
      setTree(d?.tree || null);
    } catch (err) {
      setTree(null);
      setTreeError(err.message);
    } finally {
      setTreeLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
    setSelectedFile(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  const nodes = treeNodes(tree);
  const hasFiles = nodes.length > 0;

  return (
    <div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <strong>{project.name}</strong>
        <p className="text-muted project-path" dir="ltr">📍 {project.path}</p>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ marginTop: '12px' }}>
        {tab === 'files' && (
          <div className="workspace-layout">
            {/* ─── شجرة الملفات ─── */}
            <div className="workspace-tree">
              <div className="workspace-tree-head">
                <strong>الملفات</strong>
                <button className="secondary" onClick={loadTree} title="تحديث">🔄</button>
              </div>

              {treeLoading && <div className="loading">جاري التحميل...</div>}
              {treeError && <div className="error-box">{treeError}</div>}

              {!treeLoading && !treeError && !hasFiles && (
                <p className="text-muted" style={{ padding: '10px', fontSize: '13px' }}>
                  المشروع فاضي أو مفيش ملفات
                </p>
              )}

              {!treeLoading && hasFiles && (
                <div className="tree-scroll">
                  {nodes.map((node, i) => (
                    <TreeNode key={node.path || `${node.name}-${i}`} node={node} depth={0} selectedPath={selectedFile} onFileOpen={setSelectedFile} />
                  ))}
                </div>
              )}
            </div>

            {/* ─── المحرر ─── */}
            <div className="workspace-editor">
              <FileEditor
                projectId={project.id}
                selectedFile={selectedFile}
                onSaved={loadTree}
              />
            </div>
          </div>
        )}

        {tab === 'terminal' && <CommandRunner projectId={project.id} />}
      </div>
    </div>
  );
}