import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export interface SyncedGoogleProfile {
  uid: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'renter' | 'owner';
  emailVerified: boolean;
}

export async function syncGoogleUserProfile(
  firebaseUser: FirebaseUser
): Promise<SyncedGoogleProfile> {
  const uid = firebaseUser.uid;
  const rawEmail = firebaseUser.email?.trim() || '';
  const safeName = (firebaseUser.displayName?.trim() || rawEmail.split('@')[0] || 'Pengguna Google').slice(
    0,
    100
  );
  const safeAvatar = firebaseUser.photoURL ? firebaseUser.photoURL.slice(0, 1024) : undefined;

  if (!rawEmail || !firebaseUser.emailVerified) {
    return {
      uid,
      name: safeName,
      email: rawEmail,
      avatar: safeAvatar,
      role: 'renter',
      emailVerified: firebaseUser.emailVerified,
    };
  }

  const docPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  if (existingSnap.exists()) {
    const existingData = existingSnap.data();
    const role: 'renter' | 'owner' = existingData?.role === 'owner' ? 'owner' : 'renter';
    try {
      const updatePayload: Record<string, unknown> = {
        name: safeName,
        role,
        emailVerified: true,
        updatedAt: serverTimestamp(),
      };
      if (safeAvatar) {
        updatePayload.avatar = safeAvatar;
      }
      await updateDoc(userRef, updatePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, docPath);
    }
    return {
      uid,
      name: safeName,
      email: rawEmail,
      avatar: safeAvatar || (typeof existingData?.avatar === 'string' ? existingData.avatar : undefined),
      role,
      emailVerified: true,
    };
  }

  try {
    const createPayload: Record<string, unknown> = {
      uid,
      name: safeName,
      email: rawEmail.slice(0, 254),
      role: 'renter',
      emailVerified: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (safeAvatar) {
      createPayload.avatar = safeAvatar;
    }
    await setDoc(userRef, createPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }

  return {
    uid,
    name: safeName,
    email: rawEmail,
    avatar: safeAvatar,
    role: 'renter',
    emailVerified: true,
  };
}

export { signInWithPopup, signOut, onAuthStateChanged };
export type { FirebaseUser };
