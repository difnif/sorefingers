// ==========================================================================
// CameraController — 카메라 제스처 통제
// Part 1-4: 팬 + 줌만, 회전 잠금
// Part 5+: 잠금 해제 (이 파일에서 ROTATION_LOCKED 플래그만 풀면 됨)
//
// drei의 OrbitControls를 쓰지 않는 이유: orthographic + 회전 잠금 + z-축 평면
// 한정 팬을 같이 풀려면 orbit보다 직접 구현이 더 간결함.
// ==========================================================================
import { useThree, useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

const ROTATION_LOCKED = true;   // Part 5에서 false로

const ZOOM_MIN = 10;
const ZOOM_MAX = 200;
const ZOOM_SPEED = 0.001;

export default function CameraController() {
  const { camera, gl } = useThree();
  const dragState = useRef({ active: false, lastX: 0, lastY: 0 });

  useEffect(() => {
    const dom = gl.domElement;

    function onPointerDown(e) {
      if (e.button !== 0) return;        // 좌클릭만
      dragState.current.active = true;
      dragState.current.lastX = e.clientX;
      dragState.current.lastY = e.clientY;
      dom.style.cursor = 'grabbing';
      dom.setPointerCapture(e.pointerId);
    }

    function onPointerMove(e) {
      if (!dragState.current.active) return;
      const dx = e.clientX - dragState.current.lastX;
      const dy = e.clientY - dragState.current.lastY;
      dragState.current.lastX = e.clientX;
      dragState.current.lastY = e.clientY;

      // orthographic 카메라에서 픽셀 → 월드 단위 환산
      const worldPerPixel = 1 / camera.zoom;
      camera.position.x -= dx * worldPerPixel;
      camera.position.y += dy * worldPerPixel;
    }

    function onPointerUp(e) {
      dragState.current.active = false;
      dom.style.cursor = 'grab';
      try { dom.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    function onWheel(e) {
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * ZOOM_SPEED);
      const next = camera.zoom * factor;
      camera.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
      camera.updateProjectionMatrix();
    }

    dom.style.cursor = 'grab';
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointercancel', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointercancel', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      dom.style.cursor = '';
    };
  }, [camera, gl]);

  // 회전 잠금 — 매 프레임 카메라가 z축 정면을 보도록 강제
  useFrame(() => {
    if (ROTATION_LOCKED) {
      camera.lookAt(camera.position.x, camera.position.y, 0);
      camera.up.set(0, 1, 0);
    }
  });

  return null;
}
