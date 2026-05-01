// ==========================================================================
// 디버그 인터페이스
// 개발 중 콘솔에서 노드를 임의로 생성/조회할 수 있도록 window.__sf 노출.
// Part 1 검증용 — Part 2부터는 실제 UI로 대체됨.
// ==========================================================================
import { createNode, deleteNode, subscribeNodes } from './firestore.js';

let activeProjectId = null;

export function installDebugInterface(projectId) {
  activeProjectId = projectId;

  // 콘솔에서 사용할 수 있도록 전역에 노출
  window.__sf = {
    /**
     * 디버그 노드 하나 생성. 좌표 미지정 시 랜덤.
     * 사용 예:
     *   __sf.spawn()
     *   __sf.spawn({ x: 5, y: 0, content: 'test' })
     */
    async spawn(options = {}) {
      if (!activeProjectId) {
        console.warn('[__sf] 활성화된 프로젝트가 없습니다.');
        return null;
      }
      const x = options.x ?? (Math.random() - 0.5) * 20;
      const y = options.y ?? (Math.random() - 0.5) * 14;
      const id = await createNode(activeProjectId, {
        type: 'debug',
        content: options.content || `debug ${Date.now()}`,
        x,
        y,
        mass: options.mass
      });
      console.log(`[__sf] 노드 생성: ${id} at (${x.toFixed(2)}, ${y.toFixed(2)}, 0)`);
      return id;
    },

    /**
     * 노드 N개 한꺼번에 뿌리기.
     */
    async spawnMany(count = 5) {
      const ids = [];
      for (let i = 0; i < count; i++) {
        const id = await this.spawn();
        ids.push(id);
      }
      return ids;
    },

    /**
     * 특정 노드 삭제.
     */
    async remove(nodeId) {
      if (!activeProjectId) return;
      await deleteNode(activeProjectId, nodeId);
      console.log(`[__sf] 노드 삭제: ${nodeId}`);
    },

    /**
     * 현재 프로젝트 ID 확인.
     */
    project() {
      return activeProjectId;
    }
  };

  console.log(
    '%c[sorefingers debug]',
    'color: #A03C2E; font-weight: bold;',
    `프로젝트 ${projectId} 활성화. window.__sf 사용 가능.`
  );
  console.log('  __sf.spawn()       — 노드 1개 생성');
  console.log('  __sf.spawnMany(N)  — 노드 N개 생성');
  console.log('  __sf.remove(id)    — 노드 삭제');
}

export function uninstallDebugInterface() {
  activeProjectId = null;
  if (typeof window !== 'undefined' && window.__sf) {
    delete window.__sf;
  }
}
