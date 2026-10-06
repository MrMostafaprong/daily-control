import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import GitHub from './pages/GitHub';
import AI from './pages/AI';
import Models from './pages/Models';
import Terminal from './pages/Terminal';
import Workspace from './pages/Workspace';
import Tasks from './pages/Tasks';

export default function App() {
  return (
    <ErrorBoundary>
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetails />} />
        <Route path="github" element={<GitHub />} />
        <Route path="ai" element={<AI />} />
        <Route path="models" element={<Models />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="workspace" element={<Workspace />} />
        <Route path="terminal" element={<Terminal />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </ErrorBoundary>
  );
}
