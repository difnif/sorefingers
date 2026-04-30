# sorefingers — Part 1

물리계 척추. 보이지 않는 단계.

빈 종이색 캔버스, Firebase 인증, Firestore 실시간 sync, R3F + Rapier 토대.
실제 사용자 기능(노드 만들기, 질문하기 등)은 Part 2부터.

## 셋업 (로컬)

```bash
npm install
cp .env.example .env       # Firebase 값은 이미 채워져 있음
npm run dev
```

브라우저에서 `http://localhost:5173` 자동으로 열림.

## Firestore 보안 규칙 — 반드시 적용

지금 Firestore는 **테스트 모드**로 약 30일 뒤 모든 요청이 자동 차단됨.
정식 규칙으로 교체:

1. Firebase Console → Firestore → **Rules** 탭
2. `firestore.rules` 파일 내용 복사해서 붙여넣기
3. **Publish**

이 규칙은 "자기 프로젝트는 자기만 읽고 쓸 수 있다" 패턴이야. 다른 사용자의 데이터에 절대 접근 불가.

## Vercel 배포

1. Vercel → Add New Project → GitHub 레포 (`difnif/sorefingers`) 연결
2. Framework Preset: **Vite** (자동감지됨)
3. Environment Variables 8개 등록:

   **Firebase (6개)**
   - `VITE_FIREBASE_API_KEY` = `AIzaSyAPBzRkKYRdljsv-bnwuiJ80y7nfSRkPDk`
   - `VITE_FIREBASE_AUTH_DOMAIN` = `sorefingers.firebaseapp.com`
   - `VITE_FIREBASE_PROJECT_ID` = `sorefingers`
   - `VITE_FIREBASE_STORAGE_BUCKET` = `sorefingers.firebasestorage.app`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID` = `9005378123`
   - `VITE_FIREBASE_APP_ID` = `1:9005378123:web:53fb4fd17b62d50643bbce`

   **서버 전용 (Part 2부터 사용, 지금 등록만)**
   - `ANTHROPIC_API_KEY` = (콘솔에서 복사)
   - `VOYAGE_API_KEY` = (콘솔에서 복사)

4. Deploy

배포 후 첫 접속 시 Firebase Console → Authentication → Settings → Authorized domains에 Vercel 도메인 추가해야 Google 로그인 동작함.

## Part 1 완료 검증 — 6가지 체크

배포된 사이트(또는 `npm run dev`) 들어가서 순서대로:

1. **인증** — 회원가입 또는 Google 로그인 → 로그인 성공
2. **프로젝트 생성** — "첫 프로젝트" 같은 이름으로 생성 → 목록에 나타남
3. **워크스페이스 진입** — 프로젝트 클릭 → 종이색 빈 캔버스 + 좌하단 status bar
4. **카메라** — 마우스 드래그로 패닝, 휠로 줌 → 부드럽게 동작. 회전은 안 됨 (잠금)
5. **물리계** — 좌하단 status bar에 `physics: ready` 표시 + 콘솔에 "Rapier WASM 로딩 완료" 로그
6. **Firestore 실시간 sync** — DevTools 콘솔에서:
   ```js
   __sf.spawn()           // 잉크 점 1개 찍힘 (Firestore에 저장되고 sync로 다시 내려와서 렌더)
   __sf.spawnMany(20)     // 20개 흩뿌림
   ```

전부 통과하면 Part 1 끝. Part 2(0차원 점 — 질문/답변/반문)로 갈 준비 완료.

## 디렉토리 구조

```
sorefingers/
├─ src/
│  ├─ App.jsx                    인증 상태로 라우팅
│  ├─ main.jsx                   React 진입점
│  ├─ components/
│  │  ├─ AuthGate.jsx            로그인/가입 화면
│  │  ├─ ProjectList.jsx         프로젝트 목록/생성
│  │  ├─ Workspace.jsx           활성 프로젝트 메인
│  │  ├─ Canvas3D.jsx            R3F 캔버스
│  │  ├─ CameraController.jsx    팬+줌, 회전 잠금
│  │  ├─ PhysicsWorld.jsx        Rapier 초기화 (gravity=0)
│  │  └─ InkNode.jsx             노드 시각화 (잉크 점)
│  ├─ lib/
│  │  ├─ firebase.js             Firebase 초기화
│  │  ├─ auth.js                 인증 헬퍼
│  │  ├─ firestore.js            데이터 액세스 + JSDoc 스키마
│  │  └─ debug.js                window.__sf 인터페이스
│  ├─ store/
│  │  └─ useStore.js             Zustand 전역 상태
│  └─ styles/
│     └─ index.css               Ink 테마
├─ firestore.rules               보안 규칙 (배포 필수)
├─ vercel.json                   SPA routing
├─ vite.config.js
└─ package.json
```

## Part 2 미리보기

다음 Part에서 추가될 것:
- 질문 입력 UI
- Voyage AI 임베딩 + 유사도 검사 (≥0.85 → 통합/분기/취소 다이얼로그)
- Anthropic API 호출 (`/api/ask` Vercel Serverless Function)
- 답변/반문 노드 자동 생성
- 노드 type별 시각 차별화 (질문/답변/반문)
