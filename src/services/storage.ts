import { ContentItem, ContentType, SiteBranding, ZoneType } from '../types';
import defaultItemsRaw from '../data/defaultItems.json';
import {
  auth,
  db,
  OperationType,
  handleFirestoreError,
} from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const DB_NAME = 'HocLieuSo_DB';
const DB_VERSION = 1;
const STORE_NAME = 'content_items';
const SETTINGS_STORE = 'app_settings';
const ADMIN_EMAIL = 'vanloiphuhiep.09@gmail.com';
const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

function toMillis(val: any, fallback = Date.now()): number {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof val.toMillis === 'function') return val.toMillis();
  return fallback;
}

async function parseJsonSafe(res: Response): Promise<any | null> {
  const ct = res.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('application/json')) {
    return null;
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function isFirebaseAdminSignedIn(): boolean {
  const user = auth.currentUser;
  return Boolean(
    user &&
      user.emailVerified &&
      user.email &&
      user.email.trim().toLowerCase() === ADMIN_EMAIL
  );
}

function normalizeZone(rawZone: any): ZoneType | null {
  if (rawZone === 'documents') return 'simulations';
  if (rawZone === 'images') return 'apps';
  if (rawZone === 'apps' || rawZone === 'games' || rawZone === 'simulations') {
    return rawZone;
  }
  return null;
}

function normalizeType(rawType: any, zone: ZoneType): ContentType {
  if (rawType === 'app' || rawType === 'game' || rawType === 'simulation') {
    return rawType;
  }
  if (zone === 'games') return 'game';
  if (zone === 'simulations') return 'simulation';
  return 'app';
}

function normalizeItem(raw: any, fallbackOrder = 0): ContentItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  if (!id || id.length > 128 || !VALID_ID_REGEX.test(id)) return null;

  const zone = normalizeZone(raw.zone);
  if (!zone) return null;

  const title = String(raw.title || '').trim().slice(0, 300);
  if (!title) return null;

  const type = normalizeType(raw.type, zone);
  const now = Date.now();
  const order =
    typeof raw.order === 'number' && Number.isFinite(raw.order)
      ? Math.max(0, Math.min(100000, Math.floor(raw.order)))
      : fallbackOrder;

  const item: ContentItem = {
    id,
    zone,
    title,
    type,
    order,
    createdAt: toMillis(raw.createdAt, now),
    updatedAt: toMillis(raw.updatedAt, now),
  };

  if (typeof raw.description === 'string' && raw.description.length > 0) {
    item.description = raw.description.slice(0, 5000);
  }
  if (typeof raw.embedCode === 'string' && raw.embedCode.length > 0) {
    item.embedCode = raw.embedCode.slice(0, 750000);
  }
  if (typeof raw.instructions === 'string' && raw.instructions.length > 0) {
    item.instructions = raw.instructions.slice(0, 5000);
  }
  if (typeof raw.grade === 'string' && raw.grade.length > 0) {
    item.grade = raw.grade.slice(0, 40);
  }
  if (typeof raw.subject === 'string' && raw.subject.length > 0) {
    item.subject = raw.subject.slice(0, 60);
  }

  return item;
}

function normalizeItemsArray(rawList: any): ContentItem[] {
  if (!Array.isArray(rawList)) return [];
  const list: ContentItem[] = [];
  rawList.forEach((raw, idx) => {
    const item = normalizeItem(raw, idx + 1);
    if (item) list.push(item);
  });
  list.sort((a, b) => (a.order || 0) - (b.order || 0));
  return list;
}

function buildFirestoreCreatePayload(item: ContentItem): Record<string, any> {
  const payload: Record<string, any> = {
    id: item.id,
    zone: item.zone,
    title: item.title.trim().slice(0, 300),
    type: item.type,
    order: Math.max(0, Math.min(100000, Math.floor(item.order || 0))),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (item.description) payload.description = item.description.slice(0, 5000);
  if (item.embedCode) payload.embedCode = item.embedCode.slice(0, 750000);
  if (item.instructions) payload.instructions = item.instructions.slice(0, 5000);
  if (item.grade) payload.grade = item.grade.slice(0, 40);
  if (item.subject) payload.subject = item.subject.slice(0, 60);
  return payload;
}

function buildFirestoreUpdatePayload(item: ContentItem): Record<string, any> {
  const payload: Record<string, any> = {
    zone: item.zone,
    title: item.title.trim().slice(0, 300),
    type: item.type,
    order: Math.max(0, Math.min(100000, Math.floor(item.order || 0))),
    updatedAt: serverTimestamp(),
  };
  if (item.description !== undefined) {
    payload.description = item.description.slice(0, 5000);
  }
  if (item.embedCode !== undefined) {
    payload.embedCode = item.embedCode.slice(0, 750000);
  }
  if (item.instructions !== undefined) {
    payload.instructions = item.instructions.slice(0, 5000);
  }
  if (item.grade !== undefined) {
    payload.grade = item.grade.slice(0, 40);
  }
  if (item.subject !== undefined) {
    payload.subject = item.subject.slice(0, 60);
  }
  return payload;
}

class StorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private seedingPromise: Promise<void> | null = null;
  private pendingAppWrites = new Map<string, Promise<void>>();
  private appDataSnapshots = new Map<string, Record<string, string>>();

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const idb = (event.target as IDBOpenDBRequest).result;
        if (!idb.objectStoreNames.contains(STORE_NAME)) {
          const store = idb.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('zone', 'zone', { unique: false });
          store.createIndex('order', 'order', { unique: false });
        }
        if (!idb.objectStoreNames.contains(SETTINGS_STORE)) {
          idb.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  private async syncLocalCache(items: ContentItem[]): Promise<void> {
    try {
      const idb = await this.getDB();
      const transaction = idb.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
    } catch {
      try {
        localStorage.setItem('hoclieuso_items', JSON.stringify(items));
      } catch {}
    }
  }

  private async getLocalItems(): Promise<ContentItem[]> {
    try {
      const idb = await this.getDB();
      return new Promise((resolve) => {
        const transaction = idb.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
          const items = normalizeItemsArray(request.result || []);
          resolve(items);
        };
        request.onerror = () => resolve([]);
      });
    } catch {
      try {
        const raw = localStorage.getItem('hoclieuso_items');
        return raw ? normalizeItemsArray(JSON.parse(raw)) : [];
      } catch {
        return [];
      }
    }
  }

  private getBundledDefaultItems(): ContentItem[] {
    return normalizeItemsArray(defaultItemsRaw);
  }

  private async fetchServerItems(): Promise<ContentItem[] | null> {
    try {
      const res = await fetch('/api/items');
      const data = await parseJsonSafe(res);
      if (res.ok && data?.success && Array.isArray(data.items)) {
        return normalizeItemsArray(data.items);
      }
    } catch {}
    return null;
  }

  private async fetchPublicSeedItems(): Promise<ContentItem[] | null> {
    try {
      const res = await fetch('/seed-items.json', { cache: 'no-store' });
      const data = await parseJsonSafe(res);
      if (res.ok && Array.isArray(data)) {
        return normalizeItemsArray(data);
      }
    } catch {}
    return null;
  }

  private async fetchFirestoreItemsState(): Promise<{
    items: ContentItem[];
    initialized: boolean;
    reachable: boolean;
  }> {
    try {
      const catalogRef = doc(db, 'site_settings', 'catalog');
      const itemsQuery = query(
        collection(db, 'content_items'),
        where('zone', 'in', ['apps', 'games', 'simulations'])
      );
      const [catalogSnap, itemsSnap] = await Promise.all([
        getDoc(catalogRef).catch(() => null),
        getDocs(itemsQuery),
      ]);

      const items: ContentItem[] = [];
      itemsSnap.forEach((docSnap) => {
        const normalized = normalizeItem({ id: docSnap.id, ...docSnap.data() });
        if (normalized) items.push(normalized);
      });
      items.sort((a, b) => (a.order || 0) - (b.order || 0));

      const initialized = Boolean(catalogSnap?.exists() && catalogSnap.data()?.initialized === true);
      return { items, initialized, reachable: true };
    } catch (err) {
      console.warn('Firestore content_items read fallback:', err);
      return { items: [], initialized: false, reachable: false };
    }
  }

  // Ensures existing bundled/server items are persisted into Firestore once Google Admin signs in
  async ensureCatalogSeededToFirestore(overrideSeed?: ContentItem[]): Promise<void> {
    if (!isFirebaseAdminSignedIn()) return;
    if (this.seedingPromise) return this.seedingPromise;

    this.seedingPromise = (async () => {
      try {
        const catalogRef = doc(db, 'site_settings', 'catalog');
        const catalogSnap = await getDoc(catalogRef);
        if (catalogSnap.exists() && catalogSnap.data()?.initialized === true) {
          return;
        }

        const existingSnap = await getDocs(
          query(
            collection(db, 'content_items'),
            where('zone', 'in', ['apps', 'games', 'simulations'])
          )
        );
        const existingIds = new Set(existingSnap.docs.map((d) => d.id));

        let candidates = overrideSeed;
        if (!candidates || candidates.length === 0) {
          const [serverItems, publicSeed, localItems] = await Promise.all([
            this.fetchServerItems(),
            this.fetchPublicSeedItems(),
            this.getLocalItems(),
          ]);
          const base =
            (serverItems && serverItems.length > 0 && serverItems) ||
            (publicSeed && publicSeed.length > 0 && publicSeed) ||
            this.getBundledDefaultItems();
          const byId = new Map<string, ContentItem>();
          for (const it of base) byId.set(it.id, it);
          for (const it of localItems) {
            if (!byId.has(it.id)) byId.set(it.id, it);
          }
          candidates = Array.from(byId.values());
        }

        for (const item of candidates) {
          if (!existingIds.has(item.id)) {
            const ref = doc(db, 'content_items', item.id);
            await setDoc(ref, buildFirestoreCreatePayload(item));
          }
        }

        await setDoc(catalogRef, {
          initialized: true,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Auto-seed content_items to Firestore warning:', err);
      } finally {
        this.seedingPromise = null;
      }
    })();

    return this.seedingPromise;
  }

  // Loads from shared Firestore first (works on Vercel + AI Studio), falling back to Express API / bundled seed
  async getAllItems(): Promise<ContentItem[]> {
    const [fsState, serverItems] = await Promise.all([
      this.fetchFirestoreItemsState(),
      this.fetchServerItems(),
    ]);

    // Case 1: Firestore has items or catalog has been officially initialized
    if (fsState.reachable && (fsState.items.length > 0 || fsState.initialized)) {
      this.syncLocalCache(fsState.items).catch(() => {});
      return fsState.items;
    }

    // Case 2: Firestore is empty & not initialized yet -> use Express items, public seed, or bundled defaultItems
    const localItems = await this.getLocalItems();
    let seedSource =
      serverItems && serverItems.length > 0
        ? serverItems
        : await this.fetchPublicSeedItems();

    if (!seedSource || seedSource.length === 0) {
      seedSource = this.getBundledDefaultItems();
    }

    const mergedMap = new Map<string, ContentItem>();
    for (const item of seedSource) {
      mergedMap.set(item.id, item);
    }
    for (const localItem of localItems) {
      if (!mergedMap.has(localItem.id)) {
        mergedMap.set(localItem.id, localItem);
      }
    }

    const merged = Array.from(mergedMap.values()).sort(
      (a, b) => (a.order || 0) - (b.order || 0)
    );

    if (merged.length > 0) {
      this.syncLocalCache(merged).catch(() => {});
      if (isFirebaseAdminSignedIn() && fsState.reachable) {
        this.ensureCatalogSeededToFirestore(merged).catch(() => {});
      }
    }

    return merged;
  }

  // Saves permanently to Firestore (cross-device / Vercel), Express server (if available), and local IndexedDB
  async saveItem(item: ContentItem): Promise<{ cloudSynced: boolean }> {
    let cloudSynced = false;

    if (isFirebaseAdminSignedIn()) {
      const path = `content_items/${item.id}`;
      try {
        await this.ensureCatalogSeededToFirestore();
        const ref = doc(db, 'content_items', item.id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          await updateDoc(ref, buildFirestoreUpdatePayload(item));
        } else {
          await setDoc(ref, buildFirestoreCreatePayload(item));
        }
        cloudSynced = true;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    }

    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      const json = await parseJsonSafe(res);
      if (res.ok && json?.success) {
        cloudSynced = true;
      }
    } catch {}

    try {
      const idb = await this.getDB();
      const transaction = idb.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(item);
    } catch (err) {
      console.warn('Fallback save to IndexedDB failed:', err);
    }

    return { cloudSynced };
  }

  // Deletes permanently from Firestore, Express server, and local IndexedDB
  async deleteItem(id: string): Promise<{ cloudSynced: boolean }> {
    let cloudSynced = false;

    if (isFirebaseAdminSignedIn()) {
      const path = `content_items/${id}`;
      try {
        await this.ensureCatalogSeededToFirestore();
        await deleteDoc(doc(db, 'content_items', id));
        cloudSynced = true;
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    }

    try {
      const res = await fetch(`/api/items/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      const json = await parseJsonSafe(res);
      if (res.ok && json?.success) {
        cloudSynced = true;
      }
    } catch {}

    try {
      const idb = await this.getDB();
      const transaction = idb.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(id);
    } catch {}

    return { cloudSynced };
  }

  async clearAll(): Promise<void> {
    if (isFirebaseAdminSignedIn()) {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'content_items'),
            where('zone', 'in', ['apps', 'games', 'simulations'])
          )
        );
        for (const docSnap of snap.docs) {
          await deleteDoc(doc(db, 'content_items', docSnap.id));
        }
        await setDoc(doc(db, 'site_settings', 'catalog'), {
          initialized: true,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'content_items');
      }
    }

    try {
      await fetch('/api/items/clear', { method: 'POST' });
    } catch {}

    try {
      const idb = await this.getDB();
      const transaction = idb.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
    } catch {
      localStorage.removeItem('hoclieuso_items');
    }
  }

  async exportData(): Promise<string> {
    const items = await this.getAllItems();
    const branding = await this.fetchBrandingFromServer();
    return JSON.stringify(
      {
        version: 1,
        appName: 'HocLieuSo_GiaoVienSangTao',
        exportedAt: new Date().toISOString(),
        items,
        branding,
      },
      null,
      2
    );
  }

  async importData(jsonString: string): Promise<{ items: ContentItem[]; branding?: SiteBranding }> {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !Array.isArray(parsed.items)) {
      throw new Error('Định dạng tệp học liệu không hợp lệ');
    }

    const normalized = normalizeItemsArray(parsed.items);

    if (isFirebaseAdminSignedIn()) {
      try {
        const existingSnap = await getDocs(
          query(
            collection(db, 'content_items'),
            where('zone', 'in', ['apps', 'games', 'simulations'])
          )
        );
        const importedIds = new Set(normalized.map((i) => i.id));
        for (const d of existingSnap.docs) {
          if (!importedIds.has(d.id)) {
            await deleteDoc(doc(db, 'content_items', d.id));
          }
        }

        const existingIds = new Set(existingSnap.docs.map((d) => d.id));
        for (const item of normalized) {
          const ref = doc(db, 'content_items', item.id);
          if (existingIds.has(item.id)) {
            await updateDoc(ref, buildFirestoreUpdatePayload(item));
          } else {
            await setDoc(ref, buildFirestoreCreatePayload(item));
          }
        }

        await setDoc(doc(db, 'site_settings', 'catalog'), {
          initialized: true,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'content_items');
      }
    }

    try {
      await fetch('/api/items/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: normalized }),
      });
    } catch {}

    await this.syncLocalCache(normalized);

    if (parsed.branding) {
      this.saveBranding(parsed.branding);
    }
    return { items: normalized, branding: parsed.branding };
  }

  // Branding: syncs with Firestore /site_settings/branding + Express /api/branding + localStorage
  async fetchBrandingFromServer(): Promise<SiteBranding> {
    try {
      const snap = await getDoc(doc(db, 'site_settings', 'branding'));
      if (snap.exists()) {
        const d = snap.data();
        const fsBranding: SiteBranding = {};
        if (typeof d.homeAvatar === 'string' && d.homeAvatar) fsBranding.homeAvatar = d.homeAvatar;
        if (typeof d.appsAvatar === 'string' && d.appsAvatar) fsBranding.appsAvatar = d.appsAvatar;
        if (typeof d.gamesAvatar === 'string' && d.gamesAvatar) fsBranding.gamesAvatar = d.gamesAvatar;
        if (typeof d.simsAvatar === 'string' && d.simsAvatar) fsBranding.simsAvatar = d.simsAvatar;
        try {
          localStorage.setItem('hoclieuso_branding_v1', JSON.stringify(fsBranding));
        } catch {}
        return fsBranding;
      }
    } catch {}

    try {
      const res = await fetch('/api/branding');
      const data = await parseJsonSafe(res);
      if (res.ok && data?.success && data.branding) {
        try {
          localStorage.setItem('hoclieuso_branding_v1', JSON.stringify(data.branding));
        } catch {}
        if (isFirebaseAdminSignedIn() && Object.keys(data.branding).length > 0) {
          this.saveBrandingToFirestore(data.branding).catch(() => {});
        }
        return data.branding;
      }
    } catch {}

    return this.getBranding();
  }

  getBranding(): SiteBranding {
    try {
      const data = localStorage.getItem('hoclieuso_branding_v1');
      if (!data) return {};
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  private async saveBrandingToFirestore(branding: SiteBranding): Promise<void> {
    if (!isFirebaseAdminSignedIn()) return;
    const payload: Record<string, any> = {
      updatedAt: serverTimestamp(),
    };
    if (branding.homeAvatar) payload.homeAvatar = branding.homeAvatar.slice(0, 500000);
    if (branding.appsAvatar) payload.appsAvatar = branding.appsAvatar.slice(0, 500000);
    if (branding.gamesAvatar) payload.gamesAvatar = branding.gamesAvatar.slice(0, 500000);
    if (branding.simsAvatar) payload.simsAvatar = branding.simsAvatar.slice(0, 500000);

    try {
      await setDoc(doc(db, 'site_settings', 'branding'), payload);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'site_settings/branding');
    }
  }

  saveBranding(branding: SiteBranding): void {
    try {
      localStorage.setItem('hoclieuso_branding_v1', JSON.stringify(branding));
    } catch {}

    fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(branding),
    }).catch(() => {});

    this.saveBrandingToFirestore(branding).catch((err) =>
      console.warn('Firestore branding save warning:', err)
    );
  }

  public readonly clientId: string =
    'client_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

  private isTeacherFirestoreWritable(teacherId: string): boolean {
    if (!VALID_ID_REGEX.test(teacherId)) return false;
    if (teacherId === 'admin_root') {
      return isFirebaseAdminSignedIn();
    }
    return Boolean(auth.currentUser && auth.currentUser.uid === teacherId);
  }

  private getTeacherAppDocRef(teacherId: string, itemId: string) {
    if (teacherId === 'admin_root') {
      return doc(db, 'admin_app_data', itemId);
    }
    return doc(db, 'users', teacherId, 'app_data', itemId);
  }

  async getTeacherAppData(teacherId: string): Promise<Record<string, Record<string, string>>> {
    if (!teacherId) return {};
    const cacheKey = `hoclieuso_teacher_data_${teacherId}`;
    const merged: Record<string, Record<string, string>> = {};

    // Start from local cache
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          Object.assign(merged, parsed);
        }
      }
    } catch {}

    // Fetch Express server data & Cloud Firestore data in parallel
    const expressPromise = fetch(`/api/teacher-app-data/${encodeURIComponent(teacherId)}`)
      .then(async (res) => {
        const json = await parseJsonSafe(res);
        return res.ok && json?.success && json.data && typeof json.data === 'object'
          ? (json.data as Record<string, Record<string, string>>)
          : null;
      })
      .catch(() => null);

    const firestorePromise = (async (): Promise<Record<string, Record<string, string>> | null> => {
      if (!this.isTeacherFirestoreWritable(teacherId)) return null;
      try {
        const colRef =
          teacherId === 'admin_root'
            ? collection(db, 'admin_app_data')
            : collection(db, 'users', teacherId, 'app_data');
        const snap = await getDocs(colRef);
        const map: Record<string, Record<string, string>> = {};
        snap.forEach((docSnap) => {
          const entries = docSnap.data()?.entries;
          if (entries && typeof entries === 'object') {
            map[docSnap.id] = entries;
          }
        });
        return map;
      } catch (err) {
        console.warn('Firestore teacher app_data read warning:', err);
        return null;
      }
    })();

    const [expressMap, fsMap] = await Promise.all([expressPromise, firestorePromise]);

    if (expressMap) {
      for (const [k, v] of Object.entries(expressMap)) {
        merged[k] = { ...(merged[k] || {}), ...(v || {}) };
      }
    }

    if (fsMap) {
      // Cloud Firestore takes precedence for cross-browser / cross-PC sync on Vercel & web
      for (const [k, v] of Object.entries(fsMap)) {
        merged[k] = { ...(merged[k] || {}), ...(v || {}) };
      }
      // Mirror any Express-only saved work up to Firestore once
      for (const [itemId, itemEntries] of Object.entries(merged)) {
        if (itemEntries && Object.keys(itemEntries).length > 0 && !fsMap[itemId]) {
          this.appDataSnapshots.set(`${teacherId}:${itemId}`, { ...itemEntries });
          this.enqueueFirestoreAppWrite(teacherId, itemId);
        }
      }
    }

    // Update in-memory snapshots & localStorage cache
    for (const [itemId, itemEntries] of Object.entries(merged)) {
      this.appDataSnapshots.set(`${teacherId}:${itemId}`, { ...itemEntries });
    }
    try {
      localStorage.setItem(cacheKey, JSON.stringify(merged));
    } catch {}

    return merged;
  }

  private enqueueFirestoreAppWrite(teacherId: string, itemId: string): void {
    if (!this.isTeacherFirestoreWritable(teacherId) || !VALID_ID_REGEX.test(itemId)) {
      return;
    }

    const opKey = `${teacherId}:${itemId}`;
    const prevQueue = this.pendingAppWrites.get(opKey) || Promise.resolve();

    const nextWrite = prevQueue
      .catch(() => {})
      .then(async () => {
        const latestMap = this.appDataSnapshots.get(opKey) || {};
        const boundedEntries: Record<string, string> = {};
        for (const k of Object.keys(latestMap).slice(0, 500)) {
          boundedEntries[k] = String(latestMap[k] ?? '');
        }
        const docRef = this.getTeacherAppDocRef(teacherId, itemId);
        await setDoc(docRef, {
          entries: boundedEntries,
          updatedAt: serverTimestamp(),
        });
      })
      .catch((err) => {
        console.warn('Firestore teacher app_data save warning:', err);
      });

    this.pendingAppWrites.set(opKey, nextWrite);
  }

  async mutateTeacherAppData(
    teacherId: string,
    itemId: string,
    payload: {
      op: 'set' | 'remove' | 'clear' | 'replace';
      key?: string;
      value?: string;
      data?: Record<string, string>;
    }
  ): Promise<Record<string, string> | null> {
    if (!teacherId || !itemId) return null;

    const opKey = `${teacherId}:${itemId}`;
    const cacheKey = `hoclieuso_teacher_data_${teacherId}`;
    let updatedItemMap: Record<string, string> = {};

    try {
      const raw = localStorage.getItem(cacheKey);
      const cachedAll: Record<string, Record<string, string>> = raw ? JSON.parse(raw) : {};
      const baseMap = this.appDataSnapshots.get(opKey) || cachedAll[itemId] || {};
      const itemMap = { ...baseMap };

      if (payload.op === 'set' && typeof payload.key === 'string') {
        itemMap[payload.key] = String(payload.value ?? '');
      } else if (payload.op === 'remove' && typeof payload.key === 'string') {
        delete itemMap[payload.key];
      } else if (payload.op === 'clear') {
        for (const k of Object.keys(itemMap)) delete itemMap[k];
      } else if (payload.op === 'replace' && payload.data) {
        for (const k of Object.keys(itemMap)) delete itemMap[k];
        Object.assign(itemMap, payload.data);
      }

      updatedItemMap = itemMap;
      this.appDataSnapshots.set(opKey, { ...itemMap });
      cachedAll[itemId] = itemMap;
      localStorage.setItem(cacheKey, JSON.stringify(cachedAll));
    } catch {}

    this.enqueueFirestoreAppWrite(teacherId, itemId);

    try {
      const res = await fetch(
        `/api/teacher-app-data/${encodeURIComponent(teacherId)}/${encodeURIComponent(itemId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            ...payload,
            clientId: this.clientId,
          }),
        }
      );
      const json = await parseJsonSafe(res);
      if (res.ok && json?.success) {
        return json.data;
      }
    } catch {}

    return updatedItemMap;
  }

  subscribeItemsRealtime(onItems: (items: ContentItem[]) => void): () => void {
    try {
      const q = query(
        collection(db, 'content_items'),
        where('zone', 'in', ['apps', 'games', 'simulations'])
      );
      return onSnapshot(
        q,
        async (snap) => {
          const items: ContentItem[] = [];
          snap.forEach((docSnap) => {
            const normalized = normalizeItem({ id: docSnap.id, ...docSnap.data() });
            if (normalized) items.push(normalized);
          });
          items.sort((a, b) => (a.order || 0) - (b.order || 0));

          if (items.length > 0) {
            this.syncLocalCache(items).catch(() => {});
            onItems(items);
            return;
          }

          try {
            const catalogSnap = await getDoc(doc(db, 'site_settings', 'catalog'));
            if (catalogSnap.exists() && catalogSnap.data()?.initialized === true) {
              this.syncLocalCache([]).catch(() => {});
              onItems([]);
            }
          } catch {}
        },
        (err) => {
          console.warn('Firestore items snapshot warning:', err);
        }
      );
    } catch {
      return () => {};
    }
  }

  subscribeBrandingRealtime(onBranding: (branding: SiteBranding) => void): () => void {
    try {
      return onSnapshot(
        doc(db, 'site_settings', 'branding'),
        (snap) => {
          if (!snap.exists()) return;
          const d = snap.data();
          const fsBranding: SiteBranding = {};
          if (typeof d.homeAvatar === 'string' && d.homeAvatar) fsBranding.homeAvatar = d.homeAvatar;
          if (typeof d.appsAvatar === 'string' && d.appsAvatar) fsBranding.appsAvatar = d.appsAvatar;
          if (typeof d.gamesAvatar === 'string' && d.gamesAvatar) fsBranding.gamesAvatar = d.gamesAvatar;
          if (typeof d.simsAvatar === 'string' && d.simsAvatar) fsBranding.simsAvatar = d.simsAvatar;
          try {
            localStorage.setItem('hoclieuso_branding_v1', JSON.stringify(fsBranding));
          } catch {}
          onBranding(fsBranding);
        },
        (err) => {
          console.warn('Firestore branding snapshot warning:', err);
        }
      );
    } catch {
      return () => {};
    }
  }

  subscribeRealtime(onEvent: (event: any) => void): () => void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return () => {};
    }

    let errorCount = 0;
    const es = new EventSource('/api/realtime');
    es.onopen = () => {
      errorCount = 0;
    };
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        onEvent(parsed);
      } catch {}
    };
    es.onerror = () => {
      errorCount += 1;
      if (errorCount >= 2) {
        es.close();
      }
    };

    return () => {
      es.close();
    };
  }
}

export const storageService = new StorageService();
