// ==========================================================================
// ProjectList — 프로젝트 선택 / 생성 / 이름 수정 / 삭제
// ==========================================================================
import { useEffect, useState, useRef } from 'react';
import {
  listProjects,
  createProject,
  renameProject,
  deleteProject
} from '../lib/firestore.js';
import { signOut } from '../lib/auth.js';
import { useStore } from '../store/useStore.js';

export default function ProjectList() {
  const user = useStore(s => s.user);
  const setActiveProject = useStore(s => s.setActiveProject);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  // 인라인 이름 수정 상태
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');

  // 메뉴 열린 프로젝트
  const [menuOpenId, setMenuOpenId] = useState(null);

  async function refresh() {
    setLoading(true);
    try {
      const list = await listProjects(user.uid);
      setProjects(list);
    } catch (err) {
      console.error('[projects] 목록 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.uid]);

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!menuOpenId) return;
    function onClick() { setMenuOpenId(null); }
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [menuOpenId]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const id = await createProject(user.uid, newName);
      setNewName('');
      const list = await listProjects(user.uid);
      setProjects(list);
      const created = list.find(p => p.id === id);
      if (created) setActiveProject(created);
    } catch (err) {
      console.error('[projects] 생성 실패:', err);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(project, e) {
    e.stopPropagation();
    setEditingId(project.id);
    setEditingName(project.name);
    setMenuOpenId(null);
  }

  async function commitEdit(projectId) {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    try {
      await renameProject(projectId, trimmed);
      setProjects(ps => ps.map(p => p.id === projectId ? { ...p, name: trimmed } : p));
    } catch (err) {
      console.error('[projects] 이름 수정 실패:', err);
    } finally {
      setEditingId(null);
    }
  }

  async function handleDelete(project, e) {
    e.stopPropagation();
    setMenuOpenId(null);
    const confirmed = window.confirm(
      `"${project.name}" 프로젝트를 정말 삭제하시겠습니까?\n\n` +
      `이 안의 모든 노드와 연결이 함께 삭제되며, 되돌릴 수 없습니다.`
    );
    if (!confirmed) return;

    try {
      await deleteProject(project.id);
      setProjects(ps => ps.filter(p => p.id !== project.id));
    } catch (err) {
      console.error('[projects] 삭제 실패:', err);
      alert('삭제 중 오류가 발생했습니다. 콘솔을 확인하세요.');
    }
  }

  function open(project) {
    if (editingId === project.id) return;
    setActiveProject(project);
  }

  function toggleMenu(projectId, e) {
    e.stopPropagation();
    setMenuOpenId(menuOpenId === projectId ? null : projectId);
  }

  return (
    <div className="project-list">
      <div className="project-list-header">
        <h2>프로젝트</h2>
        <span className="user-info">
          {user.displayName || user.email}
          <button onClick={signOut}>로그아웃</button>
        </span>
      </div>

      <div className="project-list-items">
        {loading && <div className="project-empty">불러오는 중…</div>}
        {!loading && projects.length === 0 && (
          <div className="project-empty">
            아직 프로젝트가 없습니다. 아래에서 첫 프로젝트를 만들어보세요.
          </div>
        )}
        {!loading && projects.map(p => (
          <div key={p.id} className="project-row" onClick={() => open(p)}>
            {editingId === p.id ? (
              <input
                className="project-name-edit"
                type="text"
                value={editingName}
                onChange={e => setEditingName(e.target.value)}
                onBlur={() => commitEdit(p.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit(p.id);
                  if (e.key === 'Escape') setEditingId(null);
                }}
                onClick={e => e.stopPropagation()}
                autoFocus
                maxLength={60}
              />
            ) : (
              <span className="project-name">{p.name}</span>
            )}

            <span className="project-row-right">
              <span className="project-meta">{formatDate(p.updatedAt)}</span>
              <button
                className="project-menu-trigger"
                onClick={e => toggleMenu(p.id, e)}
                title="메뉴"
              >⋯</button>

              {menuOpenId === p.id && (
                <span className="project-menu" onClick={e => e.stopPropagation()}>
                  <button onClick={e => startEdit(p, e)}>이름 수정</button>
                  <button
                    onClick={e => handleDelete(p, e)}
                    className="menu-danger"
                  >삭제</button>
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <form className="project-create" onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="새 프로젝트 이름"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          maxLength={60}
        />
        <button type="submit" disabled={busy || !newName.trim()}>
          만들기
        </button>
      </form>
    </div>
  );
}

function formatDate(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}
