// ==========================================================================
// Workspace — Part 3
// 제안 패널, 가지치기 다이얼로그, 만료 정리 추가
// ==========================================================================
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore.js';
import {
  subscribeNodes,
  subscribeEdges,
  subscribeSuggestions,
  cleanupExpiredSuggestions
} from '../lib/firestore.js';
import { installDebugInterface, uninstallDebugInterface } from '../lib/debug.js';
import Canvas3D from './Canvas3D.jsx';
import QuestionInput from './QuestionInput.jsx';
import SimilarQuestionDialog from './SimilarQuestionDialog.jsx';
import BranchInputDialog from './BranchInputDialog.jsx';
import SuggestionPanel from './SuggestionPanel.jsx';

export default function Workspace() {
  const activeProject = useStore(s => s.activeProject);
  const setActiveProject = useStore(s => s.setActiveProject);
  const setNodes = useStore(s => s.setNodes);
  const setEdges = useStore(s => s.setEdges);
  const setSuggestions = useStore(s => s.setSuggestions);
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);
  const suggestions = useStore(s => s.suggestions);
  const askingState = useStore(s => s.askingState);
  const similarityDialog = useStore(s => s.similarityDialog);
  const branchingEdge = useStore(s => s.branchingEdge);
  const [physicsReady, setPhysicsReady] = useState(false);

  useEffect(() => {
    if (!activeProject) return;
    const unsubNodes = subscribeNodes(activeProject.id, setNodes);
    const unsubEdges = subscribeEdges(activeProject.id, setEdges);
    const unsubSugs = subscribeSuggestions(activeProject.id, setSuggestions);
    return () => {
      unsubNodes();
      unsubEdges();
      unsubSugs();
    };
  }, [activeProject, setNodes, setEdges, setSuggestions]);

  // 진입 시 만료 제안 조용히 정리 (Part 3)
  useEffect(() => {
    if (!activeProject) return;
    cleanupExpiredSuggestions(activeProject.id).catch(err => {
      console.error('[suggestions] 만료 정리 실패:', err);
    });
  }, [activeProject]);

  useEffect(() => {
    if (!activeProject) return;
    installDebugInterface(activeProject.id);
    return () => uninstallDebugInterface();
  }, [activeProject]);

  if (!activeProject) return null;

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending').length;

  return (
    <div className="workspace">
      <div className="workspace-canvas">
        <Canvas3D onPhysicsReady={() => setPhysicsReady(true)} />
      </div>

      <div className="workspace-overlay">
        <div className="project-title">{activeProject.name}</div>
        <div>SOREFINGERS · PART 3</div>
      </div>

      <button
        className="workspace-back"
        onClick={() => setActiveProject(null)}
      >
        ← 프로젝트 목록
      </button>

      <QuestionInput />
      <SuggestionPanel />

      <div className="workspace-status">
        nodes: {nodes.length} · edges: {edges.length} ·
        제안: {pendingSuggestions} ·
        physics: {physicsReady ? 'ready' : 'loading…'} ·
        z-axis: locked
        {askingState !== 'idle' && ` · ${stateLabel(askingState)}`}
      </div>

      {similarityDialog && <SimilarQuestionDialog />}
      {branchingEdge && <BranchInputDialog />}
    </div>
  );
}

function stateLabel(state) {
  switch (state) {
    case 'embedding': return '임베딩 생성 중…';
    case 'similarity-check': return '유사 질문 확인 중…';
    case 'asking': return 'Claude에게 묻는 중…';
    case 'creating': return '노드 만드는 중…';
    case 'analyzing-connections': return '연결 분석 중…';
    default: return state;
  }
}
