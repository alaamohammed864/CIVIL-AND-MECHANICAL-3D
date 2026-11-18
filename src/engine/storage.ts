import { BIMProject, VersionSnapshot } from '../types/bim';

const DB_NAME = '4m_engineering_cloud_db';
const DB_VERSION = 1;
const STORE_PROJECTS = 'projects';
const STORE_VERSIONS = 'versions';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_VERSIONS)) {
        db.createObjectStore(STORE_VERSIONS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProjectOffline(project: BIMProject): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readwrite');
      tx.objectStore(STORE_PROJECTS).put({ ...project, updatedAt: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    localStorage.setItem('4m_active_project_id', project.id);
  } catch {
    localStorage.setItem(`4m_proj_${project.id}`, JSON.stringify(project));
    localStorage.setItem('4m_active_project_id', project.id);
  }
}

export async function loadAllProjectsOffline(): Promise<BIMProject[]> {
  try {
    const db = await openDB();
    return await new Promise<BIMProject[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PROJECTS, 'readonly');
      const req = tx.objectStore(STORE_PROJECTS).getAll();
      req.onsuccess = () => resolve((req.result as BIMProject[]) || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    const list: BIMProject[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('4m_proj_')) {
        try {
          list.push(JSON.parse(localStorage.getItem(key) || ''));
        } catch {
          // skip corrupt local entry
        }
      }
    }
    return list;
  }
}

export async function saveVersionSnapshot(snapshot: VersionSnapshot): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_VERSIONS, 'readwrite');
      tx.objectStore(STORE_VERSIONS).put(snapshot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // fallback silently to memory if quota blocked
  }
}

export async function loadVersionSnapshots(): Promise<VersionSnapshot[]> {
  try {
    const db = await openDB();
    return await new Promise<VersionSnapshot[]>((resolve, reject) => {
      const tx = db.transaction(STORE_VERSIONS, 'readonly');
      const req = tx.objectStore(STORE_VERSIONS).getAll();
      req.onsuccess = () => {
        const items = (req.result as VersionSnapshot[]) || [];
        items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function syncProjectToCloud(project: BIMProject): Promise<{ synced: boolean; error?: string }> {
  if (!navigator.onLine) {
    return { synced: false, error: 'Offline — queued locally in IndexedDB' };
  }
  try {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project),
    });
    if (!res.ok) {
      return { synced: false, error: `Server responded ${res.status}` };
    }
    return { synced: true };
  } catch (err) {
    return { synced: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}
