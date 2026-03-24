import { useState, useEffect, createContext, useContext } from 'react';
import { auth, db } from '../lib/firebase';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext(null);

const defaultStats = {
  totalGames: 0,
  wins: 0,
  losses: 0,
  coins: 0,
  currentStreak: 0,
  bestStreak: 0,
  winRate: 0,
};

const toFriendlyAuthError = (error) => {
  const code = error?.code || '';
  const map = {
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/invalid-email': 'Email format is invalid.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Invalid email or password.',
    'auth/email-already-in-use': 'Email is already registered.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'permission-denied': 'Database permission denied. Check Firestore rules.',
  };
  return map[code] || error?.message || 'Authentication failed.';
};

const buildDefaultProfile = (u) => ({
  username: u.displayName || (u.email ? u.email.split('@')[0] : 'Player'),
  email: u.email || '',
  role: 'user',
  telegramVerified: false,
  createdAt: serverTimestamp(),
  stats: defaultStats,
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setLoading(true);
      setUser(u);

      if (!u) {
        setUserData(null);
        setLoading(false);
        return;
      }

      try {
        const userRef = doc(db, 'users', u.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          const profile = buildDefaultProfile(u);
          await setDoc(userRef, profile, { merge: true });
          setUserData({ ...profile, createdAt: new Date().toISOString() });
        } else {
          const profile = snap.data();
          if (!profile.stats) {
            const merged = { ...profile, stats: defaultStats };
            await setDoc(userRef, { stats: defaultStats }, { merge: true });
            setUserData(merged);
          } else {
            setUserData(profile);
          }
        }
      } catch (err) {
        console.error('Auth profile sync error:', err);
        setUserData(null);
      }

      setLoading(false);
    });
  }, []);

  const login = async (email, password) => {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw new Error(toFriendlyAuthError(error));
    }
  };

  const signup = async (email, password, username) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: username });
      await setDoc(doc(db, 'users', cred.user.uid), {
        username,
        email,
        role: 'user',
        telegramVerified: false,
        createdAt: serverTimestamp(),
        stats: defaultStats,
      }, { merge: true });
      return cred;
    } catch (error) {
      throw new Error(toFriendlyAuthError(error));
    }
  };

  const logout = () => signOut(auth);

  const refreshUserData = async () => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      setUserData(snap.exists() ? snap.data() : null);
    } catch (err) {
      console.error('Refresh user data failed:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, login, signup, logout, refreshUserData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
