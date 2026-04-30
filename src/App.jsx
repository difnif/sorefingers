// ==========================================================================
// App — 인증 상태에 따라 라우팅
// ==========================================================================
import { useEffect } from 'react';
import { watchAuth } from './lib/auth.js';
import { useStore } from './store/useStore.js';
import AuthGate from './components/AuthGate.jsx';
import ProjectList from './components/ProjectList.jsx';
import Workspace from './components/Workspace.jsx';

export default function App() {
  const user = useStore(s => s.user);
  const authReady = useStore(s => s.authReady);
  const activeProject = useStore(s => s.activeProject);
  const setUser = useStore(s => s.setUser);

  useEffect(() => {
    const unsubscribe = watchAuth(user => {
      setUser(user);
    });
    return unsubscribe;
  }, [setUser]);

  if (!authReady) {
    return <div className="center-fill">불러오는 중…</div>;
  }

  if (!user) {
    return <AuthGate />;
  }

  if (!activeProject) {
    return <ProjectList />;
  }

  return <Workspace />;
}
