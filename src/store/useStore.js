// ==========================================================================
// 전역 상태 — Zustand
// Part 2 범위: 인증 + 활성 프로젝트 + 노드/엣지 실시간 sync + 질문 처리 상태
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
    edges: []
  }),

  // ──── Firestore 실시간 sync ───────────────────────────────────
  nodes: [],
  setNodes: (nodes) => set({ nodes }),

  edges: [],
  setEdges: (edges) => set({ edges }),

  // ──── 질문 처리 상태 ──────────────────────────────────────────
  // 'idle' | 'embedding' | 'similarity-check' | 'asking' | 'creating'
  askingState: 'idle',
  setAskingState: (askingState) => set({ askingState }),

  // 유사 질문 감지 시 다이얼로그 데이터
  similarityDialog: null,                  // { existingNode, similarity, pendingQuestion, pendingEmbedding }
  setSimilarityDialog: (data) => set({ similarityDialog: data })
}));
