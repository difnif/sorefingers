# sorefingers — Part 1.5 + Part 2

## Part 1.5
- 프로젝트 카드 우측 ⋯ 메뉴: **이름 수정** / **삭제**
- 삭제 시 모든 하위 컬렉션(nodes, edges 등)을 batch로 정리

## Part 2
- 질문 입력창 (캔버스 하단 중앙)
- Voyage AI 임베딩 (1024-d)
- 유사도 ≥ 0.85일 때 통합/분기/취소 다이얼로그
- Anthropic Claude Sonnet 4 호출 → 답변 1 + 반문 1~3
- 노드 type별 시각 차별화 (질문/답변/반문)
- 노드 옆 텍스트 라벨
- qa 엣지 + counter 엣지 자동 생성

## 셋업

기존 sorefingers 폴더에 v2 파일들 덮어쓴 다음:

```cmd
npm install
npm run dev
```

새 의존성: `@anthropic-ai/sdk`. 자동으로 깔림.

## ⚠ Vercel 환경변수 — 누락 없는지 확인

이전에는 비워뒀어도 Part 1이 동작했지만, **Part 2부터는 두 키가 필수**:

- `ANTHROPIC_API_KEY` — Anthropic Console에서 복사
- `VOYAGE_API_KEY` — Voyage AI Console에서 복사

Vercel → Settings → Environment Variables에서 값 채워 넣어. 비어있으면 질문이 다 실패함.

## ⚠ Vercel 자동 인덱스 (가능성 있음)

Part 2에서 새 쿼리가 추가됐어 (`nodes` 컬렉션에서 `where type == 'question'`).
첫 질문 던지면 콘솔에 인덱스 요구 에러가 뜰 수 있어. 그럼 에러 메시지의 링크 클릭해서 인덱스 만들면 끝.

## 검증 흐름

배포된 사이트에서:

1. **프로젝트 메뉴** — 카드의 ⋯ 클릭 → 이름 수정 / 삭제 동작 확인
2. **질문** — 캔버스 하단 입력창에 질문 입력 → "묻기"
3. **상태 표시** — 좌하단 status에 `embedding... → similarity-check... → asking... → creating...`
4. **노드 등장** — 캔버스에 질문(짙은 검정) → 답변(회색) → 반문 1~3개(연회색 italic)
5. **연결선** — 질문↔답변(실선), 답변↔반문(점선)
6. **유사도 검사** — 비슷한 질문을 다시 던지면 다이얼로그 떠서 통합/분기/취소

## 새 / 변경된 파일

```
api/
  ├─ embed.js                      [신규] Voyage 프록시
  └─ ask.js                        [신규] Claude 프록시

src/
  ├─ lib/
  │  ├─ embedding.js               [신규] cosine 유사도, /api/embed 호출
  │  ├─ claude.js                  [신규] /api/ask 호출
  │  └─ firestore.js               [수정] rename, deleteProject (batch),
  │                                       node CRUD 확장, edge CRUD
  ├─ store/useStore.js             [수정] edges, askingState, similarityDialog
  ├─ components/
  │  ├─ ProjectList.jsx            [수정] ⋯ 메뉴
  │  ├─ Workspace.jsx              [수정] QuestionInput, Dialog 추가
  │  ├─ Canvas3D.jsx               [수정] InkEdge 렌더
  │  ├─ InkNode.jsx                [수정] type별 차별화 + Html 라벨
  │  ├─ InkEdge.jsx                [신규] qa/counter 엣지 시각화
  │  ├─ QuestionInput.jsx          [신규] 라이프사이클 오케스트레이터
  │  └─ SimilarQuestionDialog.jsx  [신규] 통합/분기/취소
  └─ styles/index.css              [수정] 메뉴, 입력창, 다이얼로그 스타일

package.json                       [수정] @anthropic-ai/sdk 추가
README.md                          [수정] 본 문서
```

## 알려진 제약

- 새로고침 시 활성 프로젝트가 풀려서 목록으로 돌아감 — Part 3에서 router 도입할 때 같이 해결
- 노드 라벨이 캔버스 자유 회전과는 호환 안 됨 (drei `Html` 컴포넌트 특성). Part 5에서 z축 풀릴 때 텍스트 회전을 어떻게 할지 결정해야 함.
- `getQuestionNodesWithEmbedding`은 클라이언트 전체 다운로드 후 비교. 노드가 수천 개 단위로 늘면 서버사이드 vector search로 옮겨야 함 — Part 7+ 작업.
