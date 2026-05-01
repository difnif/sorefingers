// ==========================================================================
// Workspace — 활성 프로젝트의 메인 화면
// ==========================================================================
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore.js';
import { subscribeNodes, subscribeEdges } from '../lib/firestore.js';
import { installDebugInterface, uninstallDebugInterface } from '../lib/debug.js';
import Canvas3D from './Canvas3D.jsx';
import QuestionInput from './QuestionInput.jsx';
import SimilarQuestionDialog from './SimilarQuestionDialog.jsx';

export default function Workspace() {
  const activeProject = useStore(s => s.activeProject);
  const setActiveProject = useStore(s => s.setActiveProject);
  const setNodes = useStore(s => s.setNodes);
  const setEdges = useStore(s => s.setEdges);
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);
  const askingState = useStore(s => s.askingState);
  const similarityDialog = useStore(s => s.similarityDialog);
  const [physicsReady, setPhysicsReady] = useState(false);

  useEffect(() => {
    if (!activeProject) return;
    const unsubNodes = subscribeNodes(activeProject.id, setNodes);
    const unsubEdges = subscribeEdges(activeProject.id, setEdges);
    return () => {
      unsubNodes();
      unsubEdges();
    };
  }, [activeProject, setNodes, setEdges]);

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
        <div>SOREFINGERS · PART 2</div>
      </div>

      <button
        className="workspace-back"
        onClick={() => setActiveProject(null)}
      >
        ← 프로젝트 목록
      </button>

      <QuestionInput />

      <div className="workspace-status">
        nodes: {nodes.length} · edges: {edges.length} ·
        physics: {physicsReady ? 'ready' : 'loading…'} ·
        z-axis: locked
        {askingState !== 'idle' && ` · ${stateLabel(askingState)}`}
      </div>

      {similarityDialog && <SimilarQuestionDialog />}
    </div>
  );
}

function stateLabel(state) {
  switch (state) {
    case 'embedding': return '임베딩 생성 중…';
    case 'similarity-check': return '유사 질문 확인 중…';
    case 'asking': return 'Claude에게 묻는 중…';
    case 'creating': return '노드 만드는 중…';
    default: return state;
  }
}
