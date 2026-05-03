// ==========================================================================
// 전역 상태 — Zustand (Part 3)
// ==========================================================================
import { create } from 'zustand';

export const useStore = create((set) => ({
  // ──── Auth ────────────────────────────────────────────────────
  user: null,
  authReady: false,
  setUser: (user) => set({ user, authReady: true }),

  // ──── 활성 프로젝트 ────────────────────────────────────────────
  activeProject: null,
  setActiveProject: (project) => set({
    activeProject: project,
    nodes: [],
    edges: [],
    suggestions: [],
    branchingEdge: null,
    suggestionPanelOpen: false
  }),

  // ──── Firestore 실시간 sync ───────────────────────────────────
  nodes: [],
  setNodes: (nodes) => set({ nodes }),

  edges: [],
  setEdges: (edges) => set({ edges }),

  suggestions: [],
  setSuggestions: (suggestions) => set({ suggestions }),

  // ──── 질문 처리 상태 ──────────────────────────────────────────
  askingState: 'idle',
  setAskingState: (askingState) => set({ askingState }),

  similarityDialog: null,
  setSimilarityDialog: (data) => set({ similarityDialog: data }),

  // ──── Part 3: 가지치기 ────────────────────────────────────────
  // 사용자가 엣지 클릭 시 set, 가지 입력 패널이 뜸
  branchingEdge: null,                    // { edge, sourceNode, targetNode, midPoint }
  setBranchingEdge: (data) => set({ branchingEdge: data }),

  // ──── Part 3: 제안 패널 ───────────────────────────────────────
  suggestionPanelOpen: false,
  setSuggestionPanelOpen: (open) => set({ suggestionPanelOpen: open }),

  // ──── Part 3: 모순 분석 진행 상태 ─────────────────────────────
  contradictionAnalyzing: false,
  setContradictionAnalyzing: (b) => set({ contradictionAnalyzing: b })
}));
