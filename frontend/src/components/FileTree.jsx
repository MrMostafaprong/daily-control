import { useState } from 'react';

// تحويل node من الباك اند لشكل موحّد
export function parseNode(node, parentPath = '') {
  const name = node.name || node.label || '?';
  const isDir =
    node.type === 'dir' ||
    node.type === 'directory' ||
    node.isDir === true ||
    node.directory === true ||
    Array.isArray(node.children);
  const path = node.path || node.relativePath || (parentPath ? `${parentPath}/${name}` : name);
  const children = node.children || node.items || [];
  return { name, isDir, children, path };
}

export function treeNodes(tree) {
  if (!tree) return [];
  return Array.isArray(tree) ? tree : tree.children || tree.items || [];
}

function fileIcon(name) {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  if (['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx'].includes(ext)) return '🟨';
  if (['css', 'scss'].includes(ext)) return '🎨';
  if (['json'].includes(ext)) return '🧾';
  if (['md', 'txt'].includes(ext)) return '📝';
  if (['html'].includes(ext)) return '🌐';
  if (['png', 'jpg', 'jpeg', 'svg', 'gif', 'webp'].includes(ext)) return '🖼️';
  return '📄';
}

// مكوّن واحد معرّف برا أي مكوّن تاني — عشان حالة الفتح/الإغلاق ما تتصفّرش مع كل render
export default function TreeNode({ node, parentPath = '', depth = 0, selectedPath, onFileOpen }) {
  const { name, isDir, children, path } = parseNode(node, parentPath);
  const [open, setOpen] = useState(depth === 0);
  const indent = { paddingInlineStart: `${8 + depth * 14}px` };

  if (isDir) {
    return (
      <div>
        <div
          className="tree-node tree-dir"
          style={indent}
          onClick={() => setOpen((o) => !o)}
          role="button"
          aria-expanded={open}
        >
          <span>{open ? '📂' : '📁'}</span>
          <span>{name}</span>
          {children.length > 0 && <span className="text-muted">({children.length})</span>}
        </div>
        {open && children.map((child, i) => (
          <TreeNode
            key={child.path || `${path}/${child.name}/${i}`}
            node={child}
            parentPath={path}
            depth={depth + 1}
            selectedPath={selectedPath}
            onFileOpen={onFileOpen}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`tree-node tree-file ${selectedPath === path ? 'selected' : ''}`}
      style={indent}
      onClick={() => onFileOpen(path)}
      role="button"
    >
      <span>{fileIcon(name)}</span>
      <span>{name}</span>
    </div>
  );
}
