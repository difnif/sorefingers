// ==========================================================================
// Firestore 데이터 액세스 레이어 — Part 3
//
// 새로 활성화: suggestions 컬렉션, edges의 가지치기 필드
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
  Timestamp,
  onSnapshot,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase.js';

const DEFAULT_BURN_WEIGHTS = { w1: 0.7, w2: 0.5, w3: 0.6, w4: 0.3, w5: 1.0 };

// 제안 만료 기간
const SUGGESTION_TTL_DAYS = 7;

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

export async function deleteProject(projectId) {
  const subcollections = ['nodes', 'edges', 'faces', 'suggestions', 'burnLogs', 'archived'];

  for (const sub of subcollections) {
    const snapshot = await getDocs(collection(db, 'projects', projectId, sub));
    if (snapshot.empty) continue;

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

export async function createNode(projectId, partial) {
  const data = {
    type: partial.type || 'debug',
    content: partial.content || '',
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    z: 0,
    faceId: null,
    embedding: partial.embedding || null,
    mass: partial.mass ?? 1,
    pinned: false,
    linkedFacts: [],
    burnable: true,
    burnScore: 0,
    isImportant: false,
    parentId: partial.parentId || null,
    branchedFromEdgeId: partial.branchedFromEdgeId || null,
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

/**
 * 모든 노드(임베딩 있는 것만). 자동 연결 제안 산출에 사용.
 */
export async function getAllNodesWithEmbedding(projectId) {
  const snapshot = await getDocs(
    collection(db, 'projects', projectId, 'nodes')
  );
  return snapshot.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(n => Array.isArray(n.embedding) && n.embedding.length > 0);
}

// --------------------------------------------------------------------------
// 엣지 CRUD
// --------------------------------------------------------------------------

/**
 * @param {string} relation - 'qa' | 'counter' | 'similarity' | 'contradiction' | 'user' | 'branch'
 */
export async function createEdge(projectId, partial) {
  const data = {
    source: partial.source,
    target: partial.target,
    relation: partial.relation,
    weight: partial.weight ?? 1.0,
    status: partial.status || 'active',
    suggestionConfidence: partial.suggestionConfidence ?? null,
    userOpinion: '',

    // 가지치기 관련 (Part 3 신규)
    parentEdgeId: partial.parentEdgeId || null,
    branchPoint: partial.branchPoint || null,         // {x, y, z} - 부모 엣지 중점
    branchAffinity: partial.branchAffinity || null,   // {sourceAffinity, targetAffinity}

    createdAt: serverTimestamp()
  };
  const ref = await addDoc(
    collection(db, 'projects', projectId, 'edges'),
    data
  );
  return ref.id;
}

export async function deleteEdge(projectId, edgeId) {
  await deleteDoc(doc(db, 'projects', projectId, 'edges', edgeId));
}

export function subscribeEdges(projectId, callback) {
  const q = query(collection(db, 'projects', projectId, 'edges'));
  return onSnapshot(q, snapshot => {
    const edges = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(edges);
  });
}

// --------------------------------------------------------------------------
// 제안 (suggestions) CRUD — Part 3 신규
// --------------------------------------------------------------------------

/**
 * @param {object} partial
 * @param {string} partial.type - 'similarity' | 'contradiction'
 * @param {string} partial.source - 노드 ID
 * @param {string} partial.target - 노드 ID
 * @param {number} partial.confidence - 0~1
 * @param {string} partial.reasoning - Claude가 만든 이유 (contradiction만)
 */
export async function createSuggestion(projectId, partial) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SUGGESTION_TTL_DAYS * 24 * 60 * 60 * 1000);

  // 중복 방지: 같은 source-target-type 조합이 pending 상태로 이미 있으면 스킵
  const existing = await getDocs(query(
    collection(db, 'projects', projectId, 'suggestions'),
    where('source', '==', partial.source),
    where('target', '==', partial.target),
    where('type', '==', partial.type)
  ));
  if (!existing.empty) {
    return null;  // 이미 있음
  }

  const data = {
    type: partial.type,
    source: partial.source,
    target: partial.target,
    confidence: partial.confidence ?? null,
    reasoning: partial.reasoning || '',
    proposedAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
    userResponded: false,
    userOpinion: '',
    status: 'pending'             // 'pending' | 'accepted' | 'rejected' | 'hidden' | 'opinion_saved'
  };
  const ref = await addDoc(
    collection(db, 'projects', projectId, 'suggestions'),
    data
  );
  return ref.id;
}

export function subscribeSuggestions(projectId, callback) {
  const q = query(
    collection(db, 'projects', projectId, 'suggestions'),
    where('status', 'in', ['pending', 'opinion_saved'])
  );
  return onSnapshot(q, snapshot => {
    const suggestions = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(suggestions);
  });
}

/**
 * 제안 수용 → 엣지 생성 + 제안 상태 업데이트
 */
export async function acceptSuggestion(projectId, suggestion) {
  // 엣지 생성
  await createEdge(projectId, {
    source: suggestion.source,
    target: suggestion.target,
    relation: suggestion.type,                     // 'similarity' or 'contradiction'
    suggestionConfidence: suggestion.confidence,
    status: 'active'
  });

  // 제안 상태 업데이트
  await updateDoc(
    doc(db, 'projects', projectId, 'suggestions', suggestion.id),
    {
      status: 'accepted',
      userResponded: true
    }
  );
}

export async function rejectSuggestion(projectId, suggestionId) {
  await updateDoc(
    doc(db, 'projects', projectId, 'suggestions', suggestionId),
    {
      status: 'rejected',
      userResponded: true
    }
  );
}

export async function hideSuggestion(projectId, suggestionId) {
  await updateDoc(
    doc(db, 'projects', projectId, 'suggestions', suggestionId),
    {
      status: 'hidden',
      userResponded: true
    }
  );
}

export async function saveOpinionOnSuggestion(projectId, suggestionId, opinion) {
  await updateDoc(
    doc(db, 'projects', projectId, 'suggestions', suggestionId),
    {
      userOpinion: opinion,
      userResponded: true,
      // 의견을 적은 제안은 영구 보존 (매뉴얼: opinion saved 패널)
      status: 'opinion_saved'
    }
  );
}

/**
 * 만료된 제안 조용히 정리. 워크스페이스 진입 시 호출.
 * pending 상태이면서 expiresAt 지난 것만 삭제.
 * (의견 적은 제안은 status가 'opinion_saved'라 영구 보존됨)
 */
export async function cleanupExpiredSuggestions(projectId) {
  const now = new Date();
  const q = query(
    collection(db, 'projects', projectId, 'suggestions'),
    where('status', '==', 'pending')
  );
  const snapshot = await getDocs(q);

  const expired = snapshot.docs.filter(d => {
    const exp = d.data().expiresAt;
    if (!exp) return false;
    const expDate = exp.toDate ? exp.toDate() : new Date(exp);
    return expDate < now;
  });

  if (expired.length === 0) return 0;

  for (let i = 0; i < expired.length; i += 400) {
    const batch = writeBatch(db);
    expired.slice(i, i + 400).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  console.log(`[suggestions] ${expired.length}개 만료된 제안 정리됨`);
  return expired.length;
}
