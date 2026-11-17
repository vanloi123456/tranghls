import { ContentItem, SiteBranding } from '../types';

const DB_NAME = 'HocLieuSo_DB';
const DB_VERSION = 1;
const STORE_NAME = 'content_items';
const SETTINGS_STORE = 'app_settings';

class StorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB is not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('zone', 'zone', { unique: false });
          store.createIndex('order', 'order', { unique: false });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
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

  // Helper to sync items to local IndexedDB cache
  private async syncLocalCache(items: ContentItem[]): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
    } catch (err) {
      // Local cache fallback
      try {
        localStorage.setItem('hoclieuso_items', JSON.stringify(items));
      } catch {}
    }
  }

  // Load from local IndexedDB if offline or server fails
  private async getLocalItems(): Promise<ContentItem[]> {
    try {
      const db = await this.getDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
          const items: ContentItem[] = request.result || [];
          items.sort((a, b) => (a.order || 0) - (b.order || 0));
          resolve(items);
        };
        request.onerror = () => resolve([]);
      });
    } catch {
      try {
        const raw = localStorage.getItem('hoclieuso_items');
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
  }

  // Strictly loads from permanent server storage first so data is shared across all computers and browsers
  async getAllItems(): Promise<ContentItem[]> {
    try {
      const res = await fetch('/api/items');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          const items: ContentItem[] = data.items;
          items.sort((a, b) => (a.order || 0) - (b.order || 0));
          // Keep local IndexedDB in sync for instant performance
          this.syncLocalCache(items).catch(() => {});
          return items;
        }
      }
    } catch (err) {
      console.warn('Cannot reach server /api/items, falling back to local cache:', err);
    }
    return this.getLocalItems();
  }

  // Saves permanently to the server file data/items.json
  async saveItem(item: ContentItem): Promise<void> {
    // 1. Save to server
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (!res.ok) {
        console.warn('Server failed to save item, status:', res.status);
      }
    } catch (err) {
      console.error('Network error saving item to server:', err);
    }

    // 2. Also save to local IndexedDB
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(item);
    } catch (err) {
      console.warn('Fallback save to localStorage:', err);
    }
  }

  // Deletes permanently from server data/items.json
  async deleteItem(id: string): Promise<void> {
    // 1. Delete on server
    try {
      const res = await fetch(`/api/items/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        console.warn('Server failed to delete item, status:', res.status);
      }
    } catch (err) {
      console.error('Network error deleting item on server:', err);
    }

    // 2. Also delete from local IndexedDB
    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(id);
    } catch (err) {
      console.warn('Fallback delete from localStorage:', err);
    }
  }

  async clearAll(): Promise<void> {
    try {
      await fetch('/api/items/clear', { method: 'POST' });
    } catch (err) {
      console.error('Failed to clear on server:', err);
    }

    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
    } catch {
      localStorage.removeItem('hoclieuso_items');
    }
  }

  async exportData(): Promise<string> {
    const items = await this.getAllItems();
    const branding = await this.fetchBrandingFromServer();
    return JSON.stringify({
      version: 1,
      appName: 'HocLieuSo_GiaoVienSangTao',
      exportedAt: new Date().toISOString(),
      items,
      branding,
    }, null, 2);
  }

  async importData(jsonString: string): Promise<{ items: ContentItem[]; branding?: SiteBranding }> {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !Array.isArray(parsed.items)) {
      throw new Error('Định dạng tệp học liệu không hợp lệ');
    }

    // 1. Save all to server batch
    try {
      await fetch('/api/items/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: parsed.items }),
      });
    } catch (err) {
      console.error('Failed to batch save to server:', err);
    }

    // 2. Sync local IndexedDB
    await this.syncLocalCache(parsed.items);

    if (parsed.branding) {
      this.saveBranding(parsed.branding);
    }
    return { items: parsed.items, branding: parsed.branding };
  }

  // Branding: syncs with server /api/branding
  async fetchBrandingFromServer(): Promise<SiteBranding> {
    try {
      const res = await fetch('/api/branding');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.branding) {
          localStorage.setItem('hoclieuso_branding_v1', JSON.stringify(data.branding));
          return data.branding;
        }
      }
    } catch (err) {
      console.warn('Failed to fetch branding from server:', err);
    }
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

  saveBranding(branding: SiteBranding): void {
    localStorage.setItem('hoclieuso_branding_v1', JSON.stringify(branding));
    fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(branding),
    }).catch((err) => console.error('Failed to save branding to server:', err));
  }

  public readonly clientId: string =
    'client_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);

  async getTeacherAppData(teacherId: string): Promise<Record<string, Record<string, string>>> {
    if (!teacherId) return {};
    const cacheKey = `hoclieuso_teacher_data_${teacherId}`;
    try {
      const res = await fetch(`/api/teacher-app-data/${encodeURIComponent(teacherId)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data && typeof json.data === 'object') {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(json.data));
          } catch {}
          return json.data;
        }
      }
    } catch (err) {
      console.warn('Cannot reach server /api/teacher-app-data, falling back to cache:', err);
    }

    try {
      const cached = localStorage.getItem(cacheKey);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
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

    // Update local cache immediately for instant offline-safe state
    const cacheKey = `hoclieuso_teacher_data_${teacherId}`;
    try {
      const raw = localStorage.getItem(cacheKey);
      const cachedAll: Record<string, Record<string, string>> = raw ? JSON.parse(raw) : {};
      const itemMap = { ...(cachedAll[itemId] || {}) };
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
      cachedAll[itemId] = itemMap;
      localStorage.setItem(cacheKey, JSON.stringify(cachedAll));
    } catch {}

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
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          return json.data;
        }
      }
    } catch (err) {
      console.error('Failed to sync teacher app data to server:', err);
    }
    return null;
  }

  subscribeRealtime(onEvent: (event: any) => void): () => void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return () => {};
    }

    const es = new EventSource('/api/realtime');
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        onEvent(parsed);
      } catch {}
    };
    es.onerror = () => {
      // Browser EventSource automatically reconnects
    };

    return () => {
      es.close();
    };
  }
}

export const storageService = new StorageService();

