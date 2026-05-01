// ==========================================================================
// Workspace — 활성 프로젝트의 메인 화면
// 3D 캔버스 + 오버레이 UI + Firestore 실시간 sync
// ==========================================================================
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { subscribeNodes } from '../lib/firestore.js';
import { installDebugInterface, uninstallDebugInterface } from '../lib/debug.js';
import Canvas3D from './Canvas3D.jsx';

export default function Workspace() {
  const activeProject = useStore(s => s.activeProject);
  const setActiveProject = useStore(s => s.setActiveProject);
  const setNodes = useStore(s => s.setNodes);
  const nodes = useStore(s => s.nodes);
  const [physicsReady, setPhysicsReady] = useState(false);

  // Firestore 노드 실시간 구독
  useEffect(() => {
    if (!activeProject) return;
    const unsubscribe = subscribeNodes(activeProject.id, setNodes);
    return unsubscribe;
  }, [activeProject, setNodes]);

  // 디버그 인터페이스 활성화 — window.__sf
  useEffect(() => {
    if (!activeProject) return;
    installDebugInterface(activeProject.id);
    return () => uninstallDebugInterface();
  }, [activeProject]);

  if (!activeProject) return null;

  return (
    <div className="workspace">
      <div className="workspace-canvas">
        <Canvas3D onPhysicsReady={() => setPhysicsReady(true)} />
      </div>

      <div className="workspace-overlay">
        <div className="project-title">{activeProject.name}</div>
        <div>SOREFINGERS · PART 1</div>
      </div>

      <button
        className="workspace-back"
        onClick={() => setActiveProject(null)}
      >
        ← 프로젝트 목록
      </button>

      <div className="workspace-status">
        nodes: {nodes.length} · physics: {physicsReady ? 'ready' : 'loading...'} · z-axis: locked
      </div>
    </div>
  );
}
