// ==========================================================================
// QuestionInput — 질문 입력 + 라이프사이클 오케스트레이터 (Part 3)
//
// Part 3 fix: 노드 간격 늘려서 라벨 겹침 줄임
//   - 질문 → 답변: 1.6 → 4.0 (라벨이 길어질 때까지 충분한 거리)
//   - 답변 → 반문: 더 넓은 펼침 각도
// ==========================================================================
import { useState } from 'react';
import { useStore } from '../store/useStore.js';
import {
  createNode,
  createEdge,
  getQuestionNodesWithEmbedding,
  getAllNodesWithEmbedding
} from '../lib/firestore.js';
import { embedText, findMostSimilar } from '../lib/embedding.js';
import { askClaude } from '../lib/claude.js';
import { processNewNodeConnections } from '../lib/connectionSuggestions.js';

const SIMILARITY_THRESHOLD = 0.85;

// 노드 간격 조정 (라벨 겹침 방지)
const Q_TO_A_DISTANCE = 4.0;       // 질문 → 답변 가로 거리
const A_TO_C_DISTANCE = 3.6;       // 답변 → 반문 가로 거리
const COUNTER_VERTICAL_SPREAD = 1.8;  // 반문들 세로 펼침

export default function QuestionInput() {
  const activeProject = useStore(s => s.activeProject);
  const askingState = useStore(s => s.askingState);
  const setAskingState = useStore(s => s.setAskingState);
  const setSimilarityDialog = useStore(s => s.setSimilarityDialog);
  const nodes = useStore(s => s.nodes);
  const edges = useStore(s => s.edges);
  const [text, setText] = useState('');

  const busy = askingState !== 'idle';

  async function handleSubmit(e) {
    e.preventDefault();
    const question = text.trim();
    if (!question || busy) return;

    setText('');

    try {
      setAskingState('embedding');
      const embedding = await embedText(question);
      if (!embedding) {
        alert('임베딩 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
        setAskingState('idle');
        return;
      }

      setAskingState('similarity-check');
      const candidates = await getQuestionNodesWithEmbedding(activeProject.id);
      const match = findMostSimilar(embedding, candidates, SIMILARITY_THRESHOLD);

      if (match) {
        setSimilarityDialog({
          existingNode: match.node,
          similarity: match.similarity,
          pendingQuestion: question,
          pendingEmbedding: embedding
        });
        setAskingState('idle');
        return;
      }

      await proceedToAsk(question, embedding);
    } catch (err) {
      console.error('[QuestionInput] 처리 실패:', err);
      alert('처리 중 오류가 발생했습니다. 콘솔을 확인하세요.');
      setAskingState('idle');
    }
  }

  async function proceedToAsk(question, embedding, parentQuestionId = null) {
    setAskingState('asking');

    // 기존 노드들과 겹치지 않게 빈 영역 찾기
    const baseY = findEmptySlotY(nodes);
    const baseX = -2 + (Math.random() - 0.5) * 2;

    const context = pickNearbyContext(nodes, baseX, baseY, 8);
    const result = await askClaude(question, context);
    if (!result) {
      alert('Claude 호출에 실패했습니다.');
      setAskingState('idle');
      return;
    }

    setAskingState('creating');

    // 질문 노드
    const questionNodeId = await createNode(activeProject.id, {
      type: 'question',
      content: question,
      x: baseX,
      y: baseY,
      embedding,
      parentId: parentQuestionId
    });

    // 답변 — 질문 우측, 라벨 길이 고려해 충분히 떨어뜨림
    const answerEmbedding = await embedText(result.answer);
    const answerNodeId = await createNode(activeProject.id, {
      type: 'answer',
      content: result.answer,
      x: baseX + Q_TO_A_DISTANCE,
      y: baseY + jitter(0.3),
      embedding: answerEmbedding,
      parentId: questionNodeId
    });

    await createEdge(activeProject.id, {
      source: questionNodeId,
      target: answerNodeId,
      relation: 'qa'
    });

    // 반문들 — 답변 우측, 세로로 더 넓게 펼침
    const counterIds = [];
    const counterEmbeddings = [];
    const numCounters = result.counters.length;
    for (let i = 0; i < numCounters; i++) {
      const counter = result.counters[i];
      // 세로 위치를 균등 분배 (위→아래)
      const verticalRatio = numCounters === 1
        ? 0
        : (i - (numCounters - 1) / 2) / Math.max(1, numCounters - 1);
      const cx = baseX + Q_TO_A_DISTANCE + A_TO_C_DISTANCE;
      const cy = baseY + verticalRatio * COUNTER_VERTICAL_SPREAD;

      const counterEmbedding = await embedText(counter);
      const counterNodeId = await createNode(activeProject.id, {
        type: 'counter',
        content: counter,
        x: cx,
        y: cy,
        embedding: counterEmbedding,
        parentId: answerNodeId
      });
      counterIds.push(counterNodeId);
      counterEmbeddings.push(counterEmbedding);

      await createEdge(activeProject.id, {
        source: answerNodeId,
        target: counterNodeId,
        relation: 'counter'
      });
    }

    // 자동 연결 제안
    setAskingState('analyzing-connections');

    const newNodes = [
      { id: questionNodeId, embedding },
      { id: answerNodeId, embedding: answerEmbedding },
      ...counterIds.map((id, i) => ({ id, embedding: counterEmbeddings[i] }))
    ];

    const allWithEmbedding = await getAllNodesWithEmbedding(activeProject.id);
    const newIds = new Set(newNodes.map(n => n.id));
    const existingNodes = allWithEmbedding.filter(n => !newIds.has(n.id));

    let totalAuto = 0;
    let totalSuggest = 0;
    for (const newNode of newNodes) {
      if (!newNode.embedding) continue;
      const result = await processNewNodeConnections(
        activeProject.id,
        newNode,
        existingNodes,
        edges
      );
      totalAuto += result.autoConnected;
      totalSuggest += result.suggested;
    }

    if (totalAuto + totalSuggest > 0) {
      console.log(`[connections] 자동 연결 ${totalAuto}개, 제안 ${totalSuggest}개`);
    }

    setAskingState('idle');
  }

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

/**
 * 새 질문 트리가 들어갈 빈 세로 위치 찾기.
 * 기존 노드들의 y 값을 보고 최소-최대 사이 빈 공간 또는 위/아래로 확장.
 */
function findEmptySlotY(existingNodes) {
  if (existingNodes.length === 0) return 0;

  const ys = existingNodes.map(n => n.y).sort((a, b) => a - b);
  const minY = ys[0];
  const maxY = ys[ys.length - 1];

  // 위 또는 아래에 충분히 떨어뜨리기
  // 기존 노드 중심이 0 근처면 위/아래로 분산
  const above = maxY + 3.5;
  const below = minY - 3.5;

  // 절댓값 작은 쪽 (캔버스 중앙 가까운 쪽)
  return Math.abs(above) < Math.abs(below) ? above : below;
}
