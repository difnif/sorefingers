// ==========================================================================
// PhysicsWorld — Rapier 물리 엔진 초기화
// Part 1: gravity = 0 인 빈 월드만 생성 (실제 강체는 Part 6부터).
// 목적: WASM 로딩 검증 + 후속 Part 위한 토대.
// ==========================================================================
import { useEffect, useRef } from 'react';

export default function PhysicsWorld({ onReady }) {
  const worldRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const RAPIER = await import('@dimforge/rapier3d-compat');
        await RAPIER.init();
        if (cancelled) return;

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
      if (worldRef.current) {
        worldRef.current.free();
        worldRef.current = null;
      }
      if (typeof window !== 'undefined' && window.__sf_physics) {
        delete window.__sf_physics;
      }
    };
  }, [onReady]);

  return null;
}
