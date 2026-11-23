import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const OperationType = Object.freeze({
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write'
});

export function handleFirestoreError(error, operationType, path) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
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

// ---------- Defensive Validation & Sanitization Helpers (synced with firebase-blueprint.json) ----------
const clamp = (val, min, max, fallback) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const cleanText = (val, maxLen, fallback = '') => {
  const s = String(val ?? '').trim();
  if (!s) return fallback;
  return s.slice(0, maxLen);
};

// ---------- Authentication Actions ----------
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  await ensureUserProfile(cred.user);
  return cred.user;
}

export async function signUpWithEmail({ displayName, wardName, email, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const safeName = cleanText(displayName, 80, 'Ward Nurse');
  await updateProfile(cred.user, { displayName: safeName });
  try {
    await sendEmailVerification(cred.user);
  } catch (e) {
    console.warn('Could not send verification email automatically:', e);
  }
  if (cred.user.emailVerified) {
    await ensureUserProfile(cred.user, { displayName: safeName, wardName });
  }
  return { user: cred.user, wardName: cleanText(wardName, 60, 'Ward A') };
}

export async function signInWithEmail({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  if (cred.user.emailVerified) {
    await ensureUserProfile(cred.user);
  }
  return cred.user;
}

export async function resendVerificationEmail() {
  if (!auth.currentUser) throw new Error('No user signed in.');
  await sendEmailVerification(auth.currentUser);
}

export async function reloadCurrentUser() {
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  if (auth.currentUser.emailVerified) {
    await ensureUserProfile(auth.currentUser);
  }
  return auth.currentUser;
}

export async function signOutUser() {
  await signOut(auth);
}

export function subscribeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// ---------- User Profile ----------
export async function ensureUserProfile(user, extra = {}) {
  if (!user || !user.emailVerified) return null;
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    const payload = {
      uid: user.uid,
      displayName: cleanText(extra.displayName || user.displayName || user.email?.split('@')[0], 80, 'Ward Nurse'),
      email: cleanText(user.email, 160, 'nurse@hospital.local'),
      wardName: cleanText(extra.wardName, 60, 'Ward A'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(ref, payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getUserProfile(uid) {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

// ---------- Patient Profiles CRUD & Live Subscription ----------
export function subscribePatients(uid, onData, onError) {
  const path = 'patients';
  const q = query(collection(db, path), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
        return String(a.bedNumber || '').localeCompare(String(b.bedNumber || ''), undefined, { numeric: true });
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) onError(wrapped);
      }
    }
  );
}

export async function createPatient(data) {
  if (!auth.currentUser) throw new Error('You must sign in first.');
  const path = 'patients';
  const payload = {
    ownerId: auth.currentUser.uid,
    babyName: cleanText(data.babyName, 80, 'Newborn'),
    bedNumber: cleanText(data.bedNumber, 24, 'Bed 1'),
    ageDays: Math.round(clamp(data.ageDays, 0, 365, 1)),
    weightKg: Number(clamp(data.weightKg, 0.4, 12, 3.2).toFixed(2)),
    feedingIntervalHours: Number(clamp(data.feedingIntervalHours, 1, 8, 2.5).toFixed(1)),
    diaperIntervalHours: Number(clamp(data.diaperIntervalHours, 1, 12, 3.0).toFixed(1)),
    medicalNotes: cleanText(data.medicalNotes, 500, ''),
    status: 'active',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  try {
    const ref = await addDoc(collection(db, path), payload);
    return ref.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePatient(patientId, existingStatus, data) {
  if (!auth.currentUser) throw new Error('You must sign in first.');
  const path = `patients/${patientId}`;
  const ref = doc(db, 'patients', patientId);
  const payload =
    existingStatus === 'discharged'
      ? {
          status: 'active',
          bedNumber: cleanText(data.bedNumber, 24, 'Bed 1'),
          updatedAt: serverTimestamp()
        }
      : {
          babyName: cleanText(data.babyName, 80, 'Newborn'),
          bedNumber: cleanText(data.bedNumber, 24, 'Bed 1'),
          ageDays: Math.round(clamp(data.ageDays, 0, 365, 1)),
          weightKg: Number(clamp(data.weightKg, 0.4, 12, 3.2).toFixed(2)),
          feedingIntervalHours: Number(clamp(data.feedingIntervalHours, 1, 8, 2.5).toFixed(1)),
          diaperIntervalHours: Number(clamp(data.diaperIntervalHours, 1, 12, 3.0).toFixed(1)),
          medicalNotes: cleanText(data.medicalNotes, 500, ''),
          status: data.status === 'discharged' ? 'discharged' : 'active',
          updatedAt: serverTimestamp()
        };
  try {
    await updateDoc(ref, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePatient(patientId) {
  if (!auth.currentUser) throw new Error('You must sign in first.');
  const path = `patients/${patientId}`;
  try {
    await deleteDoc(doc(db, 'patients', patientId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
