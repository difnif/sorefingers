// ==========================================================================
// QuestionInput — 질문 입력창 + 라이프사이클 오케스트레이터
//
// 흐름:
//   1. 사용자 입력 → 임베딩 생성 (Voyage)
//   2. 기존 질문 노드들과 cosine 비교 → 0.85 이상이면 SimilarQuestionDialog
//      (사용자가 통합/분기/취소 선택)
//   3. 최종적으로 새 질문 노드 생성 → Claude 호출 → 답변 1 + 반문 1~3 노드 생성
//   4. qa 엣지 (질문 → 답변), counter 엣지 (답변 → 반문) 생성
// ==========================================================================
import { useState } from 'react';
import { useStore } from '../store/useStore.js';
import {
  createNode,
  createEdge,
  getQuestionNodesWithEmbedding
} from '../lib/firestore.js';
import { embedText, findMostSimilar } from '../lib/embedding.js';
import { askClaude } from '../lib/claude.js';

const SIMILARITY_THRESHOLD = 0.85;

export default function QuestionInput() {
  const activeProject = useStore(s => s.activeProject);
  const askingState = useStore(s => s.askingState);
  const setAskingState = useStore(s => s.setAskingState);
  const setSimilarityDialog = useStore(s => s.setSimilarityDialog);
  const nodes = useStore(s => s.nodes);
  const [text, setText] = useState('');

  const busy = askingState !== 'idle';

  async function handleSubmit(e) {
    e.preventDefault();
    const question = text.trim();
    if (!question || busy) return;

    setText('');

    try {
      // 1. 임베딩 생성
      setAskingState('embedding');
      const embedding = await embedText(question);
      if (!embedding) {
        alert('임베딩 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
        setAskingState('idle');
        return;
      }

      // 2. 유사 질문 검사
      setAskingState('similarity-check');
      const candidates = await getQuestionNodesWithEmbedding(activeProject.id);
      const match = findMostSimilar(embedding, candidates, SIMILARITY_THRESHOLD);

      if (match) {
        // 사용자에게 묻기 — 다이얼로그가 결과 처리
        setSimilarityDialog({
          existingNode: match.node,
          similarity: match.similarity,
          pendingQuestion: question,
          pendingEmbedding: embedding
        });
        setAskingState('idle');
        return;
      }

      // 3. 유사 질문 없음 → 바로 진행
      await proceedToAsk(question, embedding);
    } catch (err) {
      console.error('[QuestionInput] 처리 실패:', err);
      alert('처리 중 오류가 발생했습니다. 콘솔을 확인하세요.');
      setAskingState('idle');
    }
  }

  /**
   * 다이얼로그 외부에서도 같은 흐름을 재사용할 수 있도록 store 함수 expose는
   * 다음 리팩터에. 지금은 다이얼로그가 setSimilarityDialog로 자기를 닫고
   * 같은 함수 (proceedToAskFromDialog)를 호출하도록 별도 모듈로 빼는 방법도 있지만,
   * 지금은 컴포넌트 내부 함수로 둠.
   */
  async function proceedToAsk(question, embedding, parentQuestionId = null) {
    setAskingState('asking');

    // 입력 시점 카메라 위치 근방에 노드 배치 — 일단 화면 중앙 + 지터
    const baseX = (Math.random() - 0.5) * 4;
    const baseY = (Math.random() - 0.5) * 3;

    // Claude 호출 (컨텍스트로는 가까운 노드 몇 개)
    const context = pickNearbyContext(nodes, baseX, baseY, 8);
    const result = await askClaude(question, context);
    if (!result) {
      alert('Claude 호출에 실패했습니다.');
      setAskingState('idle');
      return;
    }

    setAskingState('creating');

    // 4. 노드 생성 — 질문 (parent가 있으면 그 자리 근처)
    const questionNodeId = await createNode(activeProject.id, {
      type: 'question',
      content: question,
      x: baseX,
      y: baseY,
      embedding,
      parentId: parentQuestionId
    });

    // 답변 — 질문 우측
    const answerNodeId = await createNode(activeProject.id, {
      type: 'answer',
      content: result.answer,
      x: baseX + 1.6,
      y: baseY + jitter(0.5),
      parentId: questionNodeId
    });

    await createEdge(activeProject.id, {
      source: questionNodeId,
      target: answerNodeId,
      relation: 'qa'
    });

    // 반문 — 답변 우측에 펼침
    for (let i = 0; i < result.counters.length; i++) {
      const counter = result.counters[i];
      const angle = (i - (result.counters.length - 1) / 2) * 0.5;
      const cx = baseX + 3.2 + Math.cos(angle) * 0.4;
      const cy = baseY + Math.sin(angle) * 1.2;

      const counterNodeId = await createNode(activeProject.id, {
        type: 'counter',
        content: counter,
        x: cx,
        y: cy,
        parentId: answerNodeId
      });

      await createEdge(activeProject.id, {
        source: answerNodeId,
        target: counterNodeId,
        relation: 'counter'
      });
    }

    setAskingState('idle');
  }

  // 다이얼로그가 호출할 수 있도록 window에 노출 (간단한 접근)
  // 더 정석은 store에 함수 자체를 넣거나 context API 쓰는 거지만, Part 2 범위에서는 이걸로 충분
  if (typeof window !== 'undefined') {
    window.__sf_proceedToAsk = proceedToAsk;
  }

  return (
    <form className="question-input" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder={busy ? '처리 중…' : '질문 하나를 던지세요.'}
        value={text}
        onChange={e => setText(e.target.value)}
        disabled={busy}
        maxLength={500}
      />
      <button type="submit" disabled={busy || !text.trim()}>
        {busy ? '…' : '묻기'}
      </button>
    </form>
  );
}

function jitter(amount) {
  return (Math.random() - 0.5) * 2 * amount;
}

/**
 * 좌표 기준 가까운 노드 N개. 단순 거리 기반.
 * Claude에게 컨텍스트로 줄 때 사용.
 */
function pickNearbyContext(nodes, x, y, limit) {
  return nodes
    .filter(n => n.type !== 'debug' && n.content)
    .map(n => ({
      ...n,
      _dist: Math.hypot(n.x - x, n.y - y)
    }))
    .sort((a, b) => a._dist - b._dist)
    .slice(0, limit)
    .map(({ _dist, ...n }) => n);
}
