// ==========================================================================
// Firestore 데이터 액세스 레이어
//
// 컬렉션 구조:
//   users/{userId}                   — Auth로 자동 관리
//   projects/{projectId}             — 프로젝트 메타
//     ├─ nodes/{nodeId}              — Part 2부터 사용
//     ├─ edges/{edgeId}              — Part 3부터 사용
//     ├─ faces/{faceId}              — Part 4부터 사용
//     ├─ suggestions/{suggestionId}  — Part 3부터 사용
//     ├─ burnLogs/{logId}            — Part 8부터 사용
//     └─ archived/{nodeId}           — Part 8부터 사용 (유료)
//
// Part 1에서는 projects + nodes만 활성. nodes는 디버그 노드 생성에만 사용.
// ==========================================================================
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  deleteDoc
} from 'firebase/firestore';
import { db } from './firebase.js';

// --------------------------------------------------------------------------
// 데이터 모델 — JSDoc typedef로 명세
// --------------------------------------------------------------------------

/**
 * @typedef {Object} Project
 * @property {string} id
 * @property {string} name
 * @property {string} ownerId
 * @property {Date} createdAt
 * @property {Date} updatedAt
 * @property {number} bloodVolume   - responsibrain 누적 활동량 (Part 9)
 * @property {number} surfaceAreaCap - 면적 상한 (Part 9 계산값)
 * @property {Object} burnWeights   - 소각 가중치 w1~w5 (Part 8)
 */

/**
 * @typedef {Object} Node
 * @property {string} id
 * @property {'question'|'answer'|'counter'|'note'|'debug'} type
 * @property {string} content
 * @property {number} x  - 항상 3D 좌표로 저장. Part 4까지 z=0 고정.
 * @property {number} y
 * @property {number} z
 * @property {string|null} faceId           - Part 4에서 할당
 * @property {number[]|null} embedding      - Part 2에서 채움 (1024-d)
 * @property {number} mass                  - 물리 시뮬레이션용 질량
 * @property {boolean} pinned               - 사용자 고정 여부
 * @property {string[]} linkedFacts         - Part 9 responsibrain 링크
 * @property {boolean} burnable             - Part 8 소각 후보 여부
 * @property {number} burnScore             - Part 8 점수
 * @property {boolean} isImportant          - Part 8 보호 마킹
 * @property {Date} createdAt
 * @property {Date} updatedAt
 */

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

export async function deleteProject(projectId) {
  // Part 1에서는 단순 삭제. 하위 컬렉션은 Cloud Functions로 정리할 예정 (Part 8+).
  await deleteDoc(doc(db, 'projects', projectId));
}

// --------------------------------------------------------------------------
// 노드 CRUD — Part 1은 디버그 노드 생성에만 사용
// --------------------------------------------------------------------------

export async function createNode(projectId, partial) {
  const data = {
    type: partial.type || 'debug',
    content: partial.content || '',
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    z: 0,                              // Part 4까지 z=0 고정 (스키마는 3D)
    faceId: null,
    embedding: null,
    mass: partial.mass ?? 1,
    pinned: false,
    linkedFacts: [],
    burnable: true,
    burnScore: 0,
    isImportant: false,
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

/**
 * 프로젝트의 노드 변경을 실시간 구독.
 * @param {string} projectId
 * @param {(nodes: Array) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeNodes(projectId, callback) {
  const q = query(collection(db, 'projects', projectId, 'nodes'));
  return onSnapshot(q, snapshot => {
    const nodes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(nodes);
  });
}
