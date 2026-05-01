import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

// StrictMode는 의도적으로 effect를 두 번 실행해서 cleanup 정확성을 검증함.
// Rapier WASM은 free() 후 즉시 같은 자리에서 새 World()를 만드는 흐름과
// 호환이 깨져서 (memory access out of bounds + WebGL Context Lost),
// Part 1에서는 비활성. Part 5+에서 cleanup 패턴 검증 후 다시 켜는 것을 검토.
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
);
