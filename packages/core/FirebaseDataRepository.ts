import { GameDataRepository, GameSave } from './BaseTypes';

/**
 * FirebaseDataRepository - Cloud persistence adapter using Firebase Firestore.
 *
 * Stores each player's save as a document in the `saves` collection keyed by userId.
 * Supports Google Sign-In — only authenticated users get cloud saves.
 *
 * Usage:
 *   import { initializeApp } from 'firebase/app';
 *   import { getFirestore } from 'firebase/firestore';
 *   import { getAuth } from 'firebase/auth';
 *
 *   const app = initializeApp({ apiKey: '...', projectId: '...', ... });
 *   const db = getFirestore(app);
 *   const auth = getAuth(app);
 *   const firebaseRepo = new FirebaseDataRepository({ firestore: db, auth });
 */

export interface FirebaseDataRepositoryConfig {
  firestore: any;
  collectionName?: string;
  auth?: any;
}

export class FirebaseDataRepository implements GameDataRepository {
  private firestore: any;
  private collectionName: string;
  private auth: any;
  private authStateListeners: Array<(user: any) => void> = [];

  constructor(config: FirebaseDataRepositoryConfig) {
    this.firestore = config.firestore;
    this.collectionName = config.collectionName || 'saves';
    this.auth = config.auth || null;
  }

  get currentUser(): any {
    return this.auth?.currentUser ?? null;
  }

  /** Sign in with Google (web: popup, returns user or null) */
  async signInWithGoogle(): Promise<any> {
    if (!this.auth) return null;
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(this.auth, provider);
      return result.user;
    } catch (err) {
      console.error('[FirebaseDataRepository] Google sign-in failed:', err);
      return null;
    }
  }

  /** Sign in with a Google ID token (for mobile native Google Sign-In) */
  async signInWithGoogleCredential(idToken: string): Promise<any> {
    if (!this.auth) return null;
    try {
      const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
      const credential = GoogleAuthProvider.credential(idToken);
      const result = await signInWithCredential(this.auth, credential);
      return result.user;
    } catch (err) {
      console.error('[FirebaseDataRepository] Google credential sign-in failed:', err);
      return null;
    }
  }

  async signOut(): Promise<void> {
    if (!this.auth) return;
    try {
      const { signOut } = await import('firebase/auth');
      await signOut(this.auth);
    } catch (err) {
      console.error('[FirebaseDataRepository] Sign out failed:', err);
    }
  }

  /** Listen to auth state changes. Returns an unsubscribe function. */
  onAuthStateChange(callback: (user: any) => void): () => void {
    if (!this.auth) return () => {};
    let unsubscribe: (() => void) | null = null;
    import('firebase/auth').then(({ onAuthStateChanged }) => {
      unsubscribe = onAuthStateChanged(this.auth, callback);
    }).catch(() => {});
    return () => { if (unsubscribe) unsubscribe(); };
  }

  async saveGame(save: GameSave): Promise<void> {
    if (!this.auth?.currentUser) return;
    try {
      const userId = this.auth.currentUser.uid;
      const { doc, setDoc } = await this.resolveFirestoreWrite();
      const docRef = doc(this.firestore, this.collectionName, userId);
      const docData: Record<string, any> = {
        userId,
        state: save.state,
        updatedAt: save.updatedAt,
      };
      if (save.saveVersion !== undefined) docData.saveVersion = save.saveVersion;
      await setDoc(docRef, docData, { merge: true });
      console.log(`[FirebaseDataRepository] Game saved for user: ${userId}`);
    } catch (err) {
      console.error('[FirebaseDataRepository] saveGame failed:', err);
    }
  }

  async loadGame(userId: string): Promise<GameSave | null> {
    if (!this.auth?.currentUser) return null;
    try {
      const uid = this.auth.currentUser.uid;
      const { doc, getDoc } = await this.resolveFirestoreRead();
      const docRef = doc(this.firestore, this.collectionName, uid);
      const snapshot = await getDoc(docRef);
      if (!snapshot.exists()) return null;
      const data = snapshot.data() as Record<string, any>;
      console.log(`[FirebaseDataRepository] Progress loaded for user: ${uid}`);
      return {
        userId: data.userId as string,
        state: data.state,
        updatedAt: data.updatedAt as number,
        saveVersion: typeof data.saveVersion === 'number' ? data.saveVersion : undefined,
      } as GameSave;
    } catch (err) {
      console.error('[FirebaseDataRepository] loadGame failed:', err);
      return null;
    }
  }

  private async resolveFirestoreWrite(): Promise<{ doc: any; setDoc: any }> {
    try {
      const m = await import('firebase/firestore').catch(() => null);
      if (m?.doc && m?.setDoc) return { doc: m.doc, setDoc: m.setDoc };
    } catch { /* no-op */ }
    return { doc: () => null as any, setDoc: async () => {} };
  }

  private async resolveFirestoreRead(): Promise<{ doc: any; getDoc: any }> {
    try {
      const m = await import('firebase/firestore').catch(() => null);
      if (m?.doc && m?.getDoc) return { doc: m.doc, getDoc: m.getDoc };
    } catch { /* no-op */ }
    return { doc: () => null as any, getDoc: async () => ({ exists: () => false, data: () => ({} as any) }) };
  }
}
