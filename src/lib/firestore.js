// ==========================================================================
// Firestore 데이터 액세스 레이어
//
// 컬렉션 구조:
//   projects/{projectId}             — 프로젝트 메타
//     ├─ nodes/{nodeId}              — Part 2부터 활성
//     ├─ edges/{edgeId}              — Part 2부터 활성 (qa, counter만 우선)
//     ├─ faces/{faceId}              — Part 4부터
//     ├─ suggestions/{id}            — Part 3부터
//     ├─ burnLogs/{id}               — Part 8부터
//     └─ archived/{id}               — Part 8부터 (유료)
// ==========================================================================
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase.js';

const DEFAULT_BURN_WEIGHTS = { w1: 0.7, w2: 0.5, w3: 0.6, w4: 0.3, w5: 1.0 };

// --------------------------------------------------------------------------
// 프로젝트 CRUD
// --------------------------------------------------------------------------

export async function listProjects(userId) {
  const q = query(
    collection(db, 'projects'),
    where('ownerId', '==', userId),
    orderBy('updatedAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createProject(userId, name) {
  const docRef = await addDoc(collection(db, 'projects'), {
    name: name.trim() || '제목 없는 프로젝트',
    ownerId: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    bloodVolume: 0,
    surfaceAreaCap: 100,
    burnWeights: DEFAULT_BURN_WEIGHTS
  });
  return docRef.id;
}

export async function getProject(projectId) {
  const docSnap = await getDoc(doc(db, 'projects', projectId));
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() };
}

export async function renameProject(projectId, name) {
  await updateDoc(doc(db, 'projects', projectId), {
    name: name.trim() || '제목 없는 프로젝트',
    updatedAt: serverTimestamp()
  });
}

/**
 * 프로젝트 + 모든 하위 컬렉션 삭제.
 * Firestore는 부모 문서 삭제가 자식을 자동으로 지우지 않으므로
 * 클라이언트에서 batch로 직접 정리한다.
 */
export async function deleteProject(projectId) {
  const subcollections = ['nodes', 'edges', 'faces', 'suggestions', 'burnLogs', 'archived'];

  for (const sub of subcollections) {
    const snapshot = await getDocs(collection(db, 'projects', projectId, sub));
    if (snapshot.empty) continue;

    // Firestore batch 한도: 500 ops
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }

  await deleteDoc(doc(db, 'projects', projectId));
}

// --------------------------------------------------------------------------
// 노드 CRUD
// --------------------------------------------------------------------------

/**
 * 노드 생성. content는 사용자 메시지(질문) 또는 AI 응답(답변/반문).
 * 좌표는 항상 3D로 저장 (Part 4까지 z=0 강제).
 */
export async function createNode(projectId, partial) {
  const data = {
    type: partial.type || 'debug',                      // 'question' | 'answer' | 'counter' | 'note' | 'debug'
    content: partial.content || '',
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    z: 0,                                                // Part 4까지 잠금
    faceId: null,
    embedding: partial.embedding || null,                // 1024-d float array
    mass: partial.mass ?? 1,
    pinned: false,
    linkedFacts: [],
    burnable: true,
    burnScore: 0,
    isImportant: false,
    parentId: partial.parentId || null,                  // 답변/반문은 질문 노드를 가리킴
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const ref = await addDoc(
    collection(db, 'projects', projectId, 'nodes'),
    data
  );
  return ref.id;
}

export async function deleteNode(projectId, nodeId) {
  await deleteDoc(doc(db, 'projects', projectId, 'nodes', nodeId));
}

export async function updateNode(projectId, nodeId, updates) {
  await updateDoc(
    doc(db, 'projects', projectId, 'nodes', nodeId),
    { ...updates, updatedAt: serverTimestamp() }
  );
}

export function subscribeNodes(projectId, callback) {
  const q = query(collection(db, 'projects', projectId, 'nodes'));
  return onSnapshot(q, snapshot => {
    const nodes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(nodes);
  });
}

/**
 * 임베딩 가진 질문 노드 전부 가져오기 (유사도 검사용).
 * Part 2에서 새 질문을 받을 때 기존 질문들과 비교하기 위해 사용.
 * (스케일 커지면 서버사이드 vector search로 옮겨야 함 — Part 7+)
 */
export async function getQuestionNodesWithEmbedding(projectId) {
  const q = query(
    collection(db, 'projects', projectId, 'nodes'),
    where('type', '==', 'question')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(n => Array.isArray(n.embedding) && n.embedding.length > 0);
}

// --------------------------------------------------------------------------
// 엣지 CRUD
// --------------------------------------------------------------------------

/**
 * @param {string} relation - 'qa' | 'counter' | 'similarity' | 'contradiction' | 'user'
 */
export async function createEdge(projectId, partial) {
  const data = {
    source: partial.source,
    target: partial.target,
    relation: partial.relation,                          // 5종 중 1
    weight: partial.weight ?? 1.0,
    controlPoints: partial.controlPoints || [],         // Part 3 가지치기용
    status: partial.status || 'active',                 // active | suggested | rejected | hidden
    suggestionConfidence: partial.suggestionConfidence ?? null,
    userOpinion: '',
    createdAt: serverTimestamp()
  };
  const ref = await addDoc(
    collection(db, 'projects', projectId, 'edges'),
    data
  );
  return ref.id;
}

export function subscribeEdges(projectId, callback) {
  const q = query(collection(db, 'projects', projectId, 'edges'));
  return onSnapshot(q, snapshot => {
    const edges = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(edges);
  });
}
