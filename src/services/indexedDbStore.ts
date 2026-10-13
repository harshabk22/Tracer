/**
 * Tracer IndexedDB Transactional Persistence Engine
 * Database: tracer_executive_vault_v1 (Version 3)
 * Provides high-volume transactional durability beyond localStorage's 5MB ceiling.
 */

export const DB_NAME = 'tracer_executive_vault_v1';
export const DB_VERSION = 3;

export const STORES = {
  GOALS: 'goals',
  LEARNING_LOGS: 'learning_logs',
  BLOCKERS: 'blockers',
  TEAM_MEMBERS: 'team_members',
  KV_SETTINGS: 'kv_settings',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export interface KVPair {
  key: string;
  value: any;
  updatedAt: string;
}

class IndexedDbStore {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private isSupported: boolean;

  constructor() {
    this.isSupported =
      typeof window !== 'undefined' &&
      typeof window.indexedDB !== 'undefined';
  }

  public isAvailable(): boolean {
    return this.isSupported;
  }

  public async getDb(): Promise<IDBDatabase | null> {
    if (!this.isSupported) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains(STORES.GOALS)) {
            db.createObjectStore(STORES.GOALS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORES.LEARNING_LOGS)) {
            db.createObjectStore(STORES.LEARNING_LOGS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORES.BLOCKERS)) {
            db.createObjectStore(STORES.BLOCKERS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORES.TEAM_MEMBERS)) {
            db.createObjectStore(STORES.TEAM_MEMBERS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORES.KV_SETTINGS)) {
            db.createObjectStore(STORES.KV_SETTINGS, { keyPath: 'key' });
          }

          // Cleanly drop deprecated v2 object stores if upgrading
          if (db.objectStoreNames.contains('sync_queue')) {
            db.deleteObjectStore('sync_queue');
          }
          if (db.objectStoreNames.contains('archives')) {
            db.deleteObjectStore('archives');
          }
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = (e) => {
          console.warn('[IndexedDbStore] Failed to open database:', e);
          resolve(null);
        };

        request.onblocked = () => {
          console.warn('[IndexedDbStore] Database open blocked by older tab version');
        };
      } catch (err) {
        console.warn('[IndexedDbStore] IndexedDB open exception:', err);
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  public async getAll<T>(storeName: StoreName): Promise<T[]> {
    const db = await this.getDb();
    if (!db) return [];

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve((request.result as T[]) || []);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async get<T>(storeName: StoreName, key: IDBValidKey): Promise<T | null> {
    const db = await this.getDb();
    if (!db) return null;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve((request.result as T) ?? null);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async put<T>(storeName: StoreName, item: T): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(item);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async putBatch<T>(storeName: StoreName, items: T[]): Promise<void> {
    const db = await this.getDb();
    if (!db || items.length === 0) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);

        for (const item of items) {
          store.put(item);
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error('Transaction aborted'));
      } catch (err) {
        reject(err);
      }
    });
  }

  public async delete(storeName: StoreName, key: IDBValidKey): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async clear(storeName: StoreName): Promise<void> {
    const db = await this.getDb();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  public async exportVaultSnapshot(): Promise<Record<string, any>> {
    const [goals, learningLogs, blockers, teamMembers, settings] = await Promise.all([
      this.getAll(STORES.GOALS),
      this.getAll(STORES.LEARNING_LOGS),
      this.getAll(STORES.BLOCKERS),
      this.getAll(STORES.TEAM_MEMBERS),
      this.getAll(STORES.KV_SETTINGS),
    ]);

    return {
      version: DB_VERSION,
      timestamp: new Date().toISOString(),
      stores: {
        goals,
        learning_logs: learningLogs,
        blockers,
        team_members: teamMembers,
        kv_settings: settings,
      },
    };
  }

  public async importVaultSnapshot(snapshot: { stores: Record<string, any[]> }): Promise<void> {
    if (!snapshot || !snapshot.stores) return;

    if (Array.isArray(snapshot.stores.goals)) {
      await this.clear(STORES.GOALS);
      await this.putBatch(STORES.GOALS, snapshot.stores.goals);
    }
    if (Array.isArray(snapshot.stores.learning_logs)) {
      await this.clear(STORES.LEARNING_LOGS);
      await this.putBatch(STORES.LEARNING_LOGS, snapshot.stores.learning_logs);
    }
    if (Array.isArray(snapshot.stores.blockers)) {
      await this.clear(STORES.BLOCKERS);
      await this.putBatch(STORES.BLOCKERS, snapshot.stores.blockers);
    }
    if (Array.isArray(snapshot.stores.team_members)) {
      await this.clear(STORES.TEAM_MEMBERS);
      await this.putBatch(STORES.TEAM_MEMBERS, snapshot.stores.team_members);
    }
    if (Array.isArray(snapshot.stores.kv_settings)) {
      await this.clear(STORES.KV_SETTINGS);
      await this.putBatch(STORES.KV_SETTINGS, snapshot.stores.kv_settings);
    }
  }

  public async wipeDatabase(): Promise<void> {
    if (this.dbPromise) {
      const db = await this.dbPromise;
      db?.close();
      this.dbPromise = null;
    }

    if (!this.isSupported) return;

    return new Promise((resolve) => {
      const request = window.indexedDB.deleteDatabase(DB_NAME);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  }
}

export const indexedDbStore = new IndexedDbStore();
