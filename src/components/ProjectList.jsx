// ==========================================================================
// ProjectList — 프로젝트 선택 / 생성
// ==========================================================================
import { useEffect, useState } from 'react';
import { listProjects, createProject } from '../lib/firestore.js';
import { signOut } from '../lib/auth.js';
import { useStore } from '../store/useStore.js';

export default function ProjectList() {
  const user = useStore(s => s.user);
  const setActiveProject = useStore(s => s.setActiveProject);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

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

  function open(project) {
    setActiveProject(project);
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
            <span className="project-name">{p.name}</span>
            <span className="project-meta">{formatDate(p.updatedAt)}</span>
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
