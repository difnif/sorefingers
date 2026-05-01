// ==========================================================================
// SimilarQuestionDialog — 유사 질문 감지 시 사용자 선택
//
// 옵션:
//   [통합] : 새 노드를 만들지 않고 기존 질문에 합류 (그래도 답변/반문은 새로 생성)
//          → 매뉴얼의 "같은 자리, 다른 입구" — 노드는 분리되지만 부모를 공유
//   [분기] : 기존 질문을 부모로, 새 질문을 자식 노드로 (parentId)
//          → 새 질문은 별도 임베딩으로 자기 자리를 가짐
//   [취소] : 그냥 닫기, 아무것도 안 함
// ==========================================================================
import { useStore } from '../store/useStore.js';

export default function SimilarQuestionDialog() {
  const dialog = useStore(s => s.similarityDialog);
  const setSimilarityDialog = useStore(s => s.setSimilarityDialog);

  if (!dialog) return null;

  const { existingNode, similarity, pendingQuestion, pendingEmbedding } = dialog;
  const simPercent = Math.round(similarity * 100);

  function close() {
    setSimilarityDialog(null);
  }

  async function handleMerge() {
    close();
    // 통합 — 기존 질문을 부모로 두고 새 질문 노드도 생성
    // (현재는 분기와 동일한 동작. 차이는 Part 3에서 face가 생기면 명확해짐)
    if (window.__sf_proceedToAsk) {
      await window.__sf_proceedToAsk(pendingQuestion, pendingEmbedding, existingNode.id);
    }
  }

  async function handleBranch() {
    close();
    if (window.__sf_proceedToAsk) {
      await window.__sf_proceedToAsk(pendingQuestion, pendingEmbedding, existingNode.id);
    }
  }

  function handleCancel() {
    close();
  }

  return (
    <div className="dialog-backdrop" onClick={handleCancel}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-label">유사한 질문이 이미 있습니다</div>
        <div className="dialog-similarity">유사도 {simPercent}%</div>

        <div className="dialog-existing">
          <div className="dialog-existing-label">기존 질문</div>
          <div className="dialog-existing-content">{existingNode.content}</div>
        </div>

        <div className="dialog-new">
          <div className="dialog-existing-label">새 질문</div>
          <div className="dialog-existing-content">{pendingQuestion}</div>
        </div>

        <div className="dialog-actions">
          <button onClick={handleMerge} title="같은 자리에서 다른 입구로 들어가기">
            통합
          </button>
          <button onClick={handleBranch} title="기존 질문에서 가지를 침">
            분기
          </button>
          <button onClick={handleCancel} className="dialog-cancel">
            취소
          </button>
        </div>

        <div className="dialog-hint">
          통합과 분기 모두 새 노드를 만듭니다. 차이는 면(Part 4)이 생기면 드러납니다.
        </div>
      </div>
    </div>
  );
}
