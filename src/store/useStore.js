// ==========================================================================
// 전역 상태 — Zustand
// Part 1 범위:
//   - 인증 상태 (user, loading)
//   - 활성 프로젝트
//   - 현재 노드 리스트 (실시간 sync)
// ==========================================================================
import { create } from 'zustand';

export const useStore = create((set) => ({
  // ──── Auth ────────────────────────────────────────────────────
  user: null,
  authReady: false,
  setUser: (user) => set({ user, authReady: true }),

  // ──── 활성 프로젝트 ────────────────────────────────────────────
  activeProject: null,
  setActiveProject: (project) => set({ activeProject: project, nodes: [] }),

  // ──── 노드 (실시간 sync) ───────────────────────────────────────
  nodes: [],
  setNodes: (nodes) => set({ nodes })
}));
