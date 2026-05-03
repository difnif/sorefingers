// ==========================================================================
// SuggestionPanel — 펜딩 제안 큐
//
// 화면 우측에 슬라이드 패널.
// 각 제안: 두 노드 + 신뢰도 + reasoning + [수용][거부][숨김] + 의견 입력
// ==========================================================================
import { useState } from 'react';
import { useStore } from '../store/useStore.js';
import {
  acceptSuggestion,
  rejectSuggestion,
  hideSuggestion,
  saveOpinionOnSuggestion
} from '../lib/firestore.js';
import { findContradictions } from '../lib/claude.js';
import { createSuggestion } from '../lib/firestore.js';

export default function SuggestionPanel() {
  const open = useStore(s => s.suggestionPanelOpen);
  const setOpen = useStore(s => s.setSuggestionPanelOpen);
  const suggestions = useStore(s => s.suggestions);
  const nodes = useStore(s => s.nodes);
  const activeProject = useStore(s => s.activeProject);
  const contradictionAnalyzing = useStore(s => s.contradictionAnalyzing);
  const setContradictionAnalyzing = useStore(s => s.setContradictionAnalyzing);

  const nodeIndex = new Map(nodes.map(n => [n.id, n]));

  // 펜딩만 우선, 의견 적은 건 아래
  const pending = suggestions.filter(s => s.status === 'pending');
  const opinionSaved = suggestions.filter(s => s.status === 'opinion_saved');

  async function handleFindContradictions() {
    // 모든 활성 노드(content 있는)를 Claude에게 보내 모순 찾기
    const candidates = nodes.filter(n => n.content && n.type !== 'debug');
    if (candidates.length < 2) {
      alert('비교할 노드가 부족합니다. 노드를 더 만들어보세요.');
      return;
    }

    setContradictionAnalyzing(true);
    try {
      const found = await findContradictions(candidates);
      if (!found) {
        alert('모순 분석 실패. 콘솔 확인.');
        return;
      }
      if (found.length === 0) {
        alert('명백한 모순을 찾지 못했습니다.');
        return;
      }

      let created = 0;
      for (const c of found) {
        // 두 노드가 실제로 존재하는지 확인
        if (!nodeIndex.has(c.sourceId) || !nodeIndex.has(c.targetId)) continue;
        const id = await createSuggestion(activeProject.id, {
          type: 'contradiction',
          source: c.sourceId,
          target: c.targetId,
          confidence: 1.0,
          reasoning: c.reasoning || ''
        });
        if (id) created++;
      }

      alert(`${created}개의 모순 후보를 제안 큐에 추가했습니다.`);
    } catch (err) {
      console.error('[contradiction] 분석 실패:', err);
      alert('분석 중 오류. 콘솔 확인.');
    } finally {
      setContradictionAnalyzing(false);
    }
  }

  return (
    <>
      {/* 토글 버튼 */}
      <button
        className={'suggestion-toggle' + (pending.length > 0 ? ' has-pending' : '')}
        onClick={() => setOpen(!open)}
      >
        제안 {pending.length > 0 && <span className="badge">{pending.length}</span>}
      </button>

      {/* 패널 */}
      {open && (
        <div className="suggestion-panel">
          <div className="suggestion-panel-header">
            <span>제안 큐</span>
            <button className="suggestion-close" onClick={() => setOpen(false)}>×</button>
          </div>

          <div className="suggestion-actions-bar">
            <button
              onClick={handleFindContradictions}
              disabled={contradictionAnalyzing}
              title="현재 노드들에서 모순 찾기 (Claude API 비용 발생)"
            >
              {contradictionAnalyzing ? '분석 중…' : '모순 찾기 ($)'}
            </button>
          </div>

          <div className="suggestion-list">
            {pending.length === 0 && opinionSaved.length === 0 && (
              <div className="suggestion-empty">제안이 없습니다.</div>
            )}

            {pending.map(s => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                source={nodeIndex.get(s.source)}
                target={nodeIndex.get(s.target)}
                projectId={activeProject.id}
              />
            ))}

            {opinionSaved.length > 0 && (
              <div className="suggestion-section-divider">의견 저장됨</div>
            )}
            {opinionSaved.map(s => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                source={nodeIndex.get(s.source)}
                target={nodeIndex.get(s.target)}
                projectId={activeProject.id}
                readOnly
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SuggestionCard({ suggestion, source, target, projectId, readOnly = false }) {
  const [opinionInput, setOpinionInput] = useState(suggestion.userOpinion || '');
  const [showOpinionInput, setShowOpinionInput] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!source || !target) return null;

  const typeLabel = suggestion.type === 'similarity' ? '유사' : '모순';
  const typeColor = suggestion.type === 'contradiction' ? 'vermilion' : 'ink';
  const confPercent = suggestion.confidence != null
    ? `${Math.round(suggestion.confidence * 100)}%`
    : '';

  async function doAccept() {
    if (busy) return;
    setBusy(true);
    try {
      await acceptSuggestion(projectId, suggestion);
    } catch (err) {
      console.error('[suggestion] accept 실패:', err);
    } finally {
      setBusy(false);
    }
  }

  async function doReject() {
    if (busy) return;
    setBusy(true);
    try {
      await rejectSuggestion(projectId, suggestion.id);
    } catch (err) {
      console.error('[suggestion] reject 실패:', err);
    } finally {
      setBusy(false);
    }
  }

  async function doHide() {
    if (busy) return;
    setBusy(true);
    try {
      await hideSuggestion(projectId, suggestion.id);
    } catch (err) {
      console.error('[suggestion] hide 실패:', err);
    } finally {
      setBusy(false);
    }
  }

  async function doSaveOpinion() {
    if (busy) return;
    if (!opinionInput.trim()) {
      setShowOpinionInput(false);
      return;
    }
    setBusy(true);
    try {
      await saveOpinionOnSuggestion(projectId, suggestion.id, opinionInput.trim());
      setShowOpinionInput(false);
    } catch (err) {
      console.error('[suggestion] save opinion 실패:', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="suggestion-card">
      <div className="suggestion-meta">
        <span className={'suggestion-type ' + typeColor}>{typeLabel}</span>
        {confPercent && <span className="suggestion-conf">{confPercent}</span>}
      </div>

      <div className="suggestion-node">
        <div className="suggestion-node-type">{source.type}</div>
        <div className="suggestion-node-content">{truncate(source.content, 80)}</div>
      </div>

      <div className="suggestion-link">↕</div>

      <div className="suggestion-node">
        <div className="suggestion-node-type">{target.type}</div>
        <div className="suggestion-node-content">{truncate(target.content, 80)}</div>
      </div>

      {suggestion.reasoning && (
        <div className="suggestion-reasoning">{suggestion.reasoning}</div>
      )}

      {suggestion.userOpinion && (
        <div className="suggestion-opinion-saved">
          <div className="suggestion-opinion-label">내 의견</div>
          <div>{suggestion.userOpinion}</div>
        </div>
      )}

      {!readOnly && (
        <>
          {!showOpinionInput && (
            <div className="suggestion-buttons">
              <button onClick={doAccept} disabled={busy}>수용</button>
              <button onClick={doReject} disabled={busy}>거부</button>
              <button onClick={doHide} disabled={busy}>숨김</button>
              <button
                onClick={() => setShowOpinionInput(true)}
                className="suggestion-opinion-trigger"
                disabled={busy}
              >의견</button>
            </div>
          )}
          {showOpinionInput && (
            <div className="suggestion-opinion-input">
              <textarea
                placeholder="이 제안에 대한 의견 (남겨두면 영구 보존)"
                value={opinionInput}
                onChange={e => setOpinionInput(e.target.value)}
                rows={2}
                autoFocus
              />
              <div className="suggestion-buttons">
                <button onClick={doSaveOpinion} disabled={busy || !opinionInput.trim()}>저장</button>
                <button
                  onClick={() => { setShowOpinionInput(false); setOpinionInput(''); }}
                  className="dialog-cancel"
                  disabled={busy}
                >취소</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function truncate(s, max) {
  if (!s) return '';
  if (s.length <= max) return s;
  return s.slice(0, max) + '…';
}
