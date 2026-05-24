import { GameDataRepository, GameSave } from './BaseTypes';

/**
 * FirebaseDataRepository - Cloud persistence adapter using Firebase Firestore.
 *
 * Stores each player's save as a document in the `saves` collection keyed by userId.
 * Integrates with Firebase Security Rules to restrict access per-user.
 *
 * Usage:
 *   import { initializeApp } from 'firebase/app';
 *   import { getFirestore } from 'firebase/firestore';
 *
 *   const app = initializeApp({ apiKey: '...', projectId: '...', ... });
 *   const db = getFirestore(app);
 *   const firebaseRepo = new FirebaseDataRepository(db);
 *
 * Combine with LocalDataRepository via CompositeRepository for offline-first:
 *   const repo = new CompositeRepository(localRepo, firebaseRepo);
 */

export interface FirebaseDataRepositoryConfig {
  /** An initialized Firestore instance (from `getFirestore(app)`) */
  firestore: any;
  /** Optional collection name override (default: 'saves') */
  collectionName?: string;
  /** Optional Firebase Auth instance for anonymous sign-in */
  auth?: any;
}

export class FirebaseDataRepository implements GameDataRepository {
  private firestore: any;
  private collectionName: string;
  private auth: any;

  constructor(config: FirebaseDataRepositoryConfig) {
    this.firestore = config.firestore;
    this.collectionName = config.collectionName || 'saves';
    this.auth = config.auth || null;
  }

  /** Ensures user is signed in anonymously. Returns the uid, or null if auth unavailable. */
  async ensureAnonymousAuth(): Promise<string | null> {
    if (!this.auth) return null;
    try {
      const { signInAnonymously, onAuthStateChanged } = await this.resolveAuth();
      if (!signInAnonymously) return null;

      // If already signed in, return current uid
      const currentUser = this.auth.currentUser;
      if (currentUser?.uid) return currentUser.uid;

      // Wait for sign-in to complete
      const cred = await signInAnonymously(this.auth);
      console.log(`[FirebaseDataRepository] Anonymous auth: ${cred.user?.uid}`);
      return cred.user?.uid || null;
    } catch (err) {
      console.error('[FirebaseDataRepository] Anonymous auth failed:', err);
      return null;
    }
  }

  async saveGame(save: GameSave): Promise<void> {
    try {
      const userId = (this.auth?.currentUser?.uid) || save.userId;
      const { doc, setDoc } = await this.resolveFirestoreWrite();

      const docRef = doc(this.firestore, this.collectionName, userId);
      const docData: Record<string, any> = {
        userId,
        state: save.state,
        updatedAt: save.updatedAt,
      };
      if (save.saveVersion !== undefined) {
        docData.saveVersion = save.saveVersion;
      }
      await setDoc(docRef, docData, { merge: true });

      console.log(`[FirebaseDataRepository] Game saved for user: ${userId}`);
    } catch (err) {
      console.error('[FirebaseDataRepository] saveGame failed:', err);
      // Don't throw — allow local save to succeed even if cloud fails
    }
  }

  async loadGame(userId: string): Promise<GameSave | null> {
    try {
      const uid = (this.auth?.currentUser?.uid) || userId;
      const { doc, getDoc } = await this.resolveFirestoreRead();

      const docRef = doc(this.firestore, this.collectionName, uid);
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        console.log(`[FirebaseDataRepository] No save found for user: ${uid}`);
        return null;
      }

      const data = snapshot.data() as Record<string, any>;
      const save = {
        userId: data.userId as string,
        state: data.state,
        updatedAt: data.updatedAt as number,
        saveVersion: typeof data.saveVersion === 'number' ? data.saveVersion : undefined,
      } as GameSave;

      console.log(`[FirebaseDataRepository] Progress loaded for user: ${uid}`);
      return save;
    } catch (err) {
      console.error('[FirebaseDataRepository] loadGame failed:', err);
      return null;
    }
  }

  /**
   * Dynamically imports Firebase Auth for anonymous sign-in. Gracefully degrades if not installed.
   */
  private async resolveAuth() {
    try {
      // @ts-ignore
      const authMod = await import('firebase/auth').then(m => m).catch(() => null);
      if (authMod?.signInAnonymously) {
        return { signInAnonymously: authMod.signInAnonymously, onAuthStateChanged: authMod.onAuthStateChanged };
      }
    } catch { /* firebase/auth not installed */ }
    console.warn('[FirebaseDataRepository] firebase/auth not available — anonymous auth disabled');
    return { signInAnonymously: null, onAuthStateChanged: null };
  }

  /**
   * Dynamically imports Firestore write helpers to avoid bundling when not used.
   * Uses the v9+ modular SDK: `doc`, `setDoc` from `firebase/firestore`.
   */
  // @ts-ignore: firebase/firestore is optional — gracefully degrades if not installed
  private async resolveFirestoreWrite() {
    try {
      // @ts-ignore
      const firestoreMod = await import('firebase/firestore').then(m => m).catch(() => null);
      if (firestoreMod?.doc && firestoreMod?.setDoc) {
        return { doc: firestoreMod.doc, setDoc: firestoreMod.setDoc };
      }
    } catch {
      // firebase/firestore not installed — no-op
    }
    console.warn('[FirebaseDataRepository] firebase/firestore not available — cloud save disabled');
    return {
      doc: () => ({}),
      setDoc: async () => {},
    };
  }

  // @ts-ignore: firebase/firestore is optional — gracefully degrades if not installed
  private async resolveFirestoreRead() {
    try {
      // @ts-ignore
      const firestoreMod = await import('firebase/firestore').then(m => m).catch(() => null);
      if (firestoreMod?.doc && firestoreMod?.getDoc) {
        return { doc: firestoreMod.doc, getDoc: firestoreMod.getDoc };
      }
    } catch {
      // firebase/firestore not installed — no-op
    }
    console.warn('[FirebaseDataRepository] firebase/firestore not available — cloud load disabled');
    return {
      doc: () => ({}),
      getDoc: async () => ({ exists: () => false, data: () => ({} as any) }),
    };
  }
}