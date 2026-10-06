import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ThemeEffects from './ThemeEffects';

export default function Layout() {
  return (
    <>
      <ThemeEffects />
      <div className="app-layout">
      <Sidebar />
      <div className="main-wrapper">
        <Header />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
      </div>
    </>
  );
}
