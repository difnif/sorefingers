// ==========================================================================
// PhysicsWorld — Rapier 물리 엔진 초기화
// Part 1: gravity = 0 인 빈 월드만 생성 (실제 강체는 Part 6부터).
//
// React StrictMode 안전장치:
//   - dev/preview에서 effect가 mount → unmount → remount 시퀀스로 두 번
//     실행되면서 world.free()가 같은 WASM 인스턴스를 이중 해제 →
//     "memory access out of bounds" + WebGL Context Lost 발생.
//   - generation 토큰으로 이전 마운트의 cleanup이 새 마운트를 건드리지
//     못하게 격리.
// ==========================================================================
import { useEffect, useRef } from 'react';

let initGeneration = 0;

export default function PhysicsWorld({ onReady }) {
  const worldRef = useRef(null);

  useEffect(() => {
    const generation = ++initGeneration;
    let cancelled = false;

    async function init() {
      try {
        const RAPIER = await import('@dimforge/rapier3d-compat');
        await RAPIER.init();

        // 마운트 사이에 새 generation이 생겼다면 이번 init은 무효
        if (cancelled || generation !== initGeneration) return;

        const gravity = { x: 0, y: 0, z: 0 };
        const world = new RAPIER.World(gravity);
        worldRef.current = world;

        // 디버그용 전역 노출
        if (typeof window !== 'undefined') {
          window.__sf_physics = { RAPIER, world };
        }

        if (onReady) onReady();
        console.log('[physics] Rapier WASM 로딩 완료, world 초기화됨 (gravity=0)');
      } catch (err) {
        console.error('[physics] Rapier 초기화 실패:', err);
      }
    }

    init();

    return () => {
      cancelled = true;
      const world = worldRef.current;
      worldRef.current = null;
      if (world) {
        try {
          world.free();
        } catch (err) {
          // 이미 해제됐거나 부분 초기화 상태면 무시
        }
      }
      if (typeof window !== 'undefined' && window.__sf_physics) {
        delete window.__sf_physics;
      }
    };
  }, [onReady]);

  return null;
}
