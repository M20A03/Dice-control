import { useState } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, query, where, getDocs, deleteDoc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const DICE_FACES = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

// Extract Telegram group ID from URL
const extractTelegramId = (urlOrId) => {
  // If it looks like a URL
  if (urlOrId.includes('t.me') || urlOrId.includes('telegram')) {
    // URL format: https://t.me/groupname or https://t.me/+xxx or https://t.me/-xxx
    const match = urlOrId.match(/t\.me\/([a-zA-Z0-9_\-+]+)/);
    if (match) return match[1];
  }
  // If it's already an ID, return as-is
  return urlOrId.trim();
};

export default function AdminPage() {
  const { user, userData, logout } = useAuth();
  const navigate = useNavigate();
  const [telegramUrlOrId, setTelegramUrlOrId] = useState('');
  const [singleOutcome, setSingleOutcome] = useState(3); // Single outcome for next roll only
  const [forceRollId, setForceRollId] = useState(''); // For force roll feature
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Update specific outcome in queue
  const updateSingleOutcome = (newValue) => {
    setSingleOutcome(newValue);
  };

  // Set the single outcome to Firebase
  const setOutcome_Firebase = async () => {
    if (!telegramUrlOrId.trim()) return toast.error('Enter Telegram Group URL or User ID');
    
    const telegramId = extractTelegramId(telegramUrlOrId);
    if (!telegramId) return toast.error('Invalid Telegram URL or ID');
    
    setLoading(true);
    try {
      // Find user by telegramId
      const q = query(collection(db, 'users'), where('telegramId', '==', String(telegramId)));
      const snapshot = await getDocs(q);
      
      let uid;
      if (!snapshot.empty) {
        uid = snapshot.docs[0].id;
      } else {
        // Create new user doc with this ID
        uid = String(telegramId);
      }

      const userRef = doc(db, 'users', uid);
      // Store single outcome (next roll will use this, then it resets to 0)
      const outcomeValue = Number(singleOutcome);
      
      await setDoc(userRef, { 
        nextOutcome: outcomeValue,
        telegramId: String(telegramId),
        lastSetAt: new Date(),
      }, { merge: true });
      
      console.log(`✅ AdminPage: Saved to Firebase`);
      console.log(`   Document ID: ${uid}`);
      console.log(`   Telegram ID: ${telegramId}`);
      console.log(`   Next Outcome: ${outcomeValue} ${DICE_FACES[outcomeValue]}`);
      
      // Verify the write immediately
      const verifyRef = doc(db, 'users', uid);
      const verifySnap = await getDoc(verifyRef);
      if (verifySnap.exists()) {
        console.log(`✅ VERIFIED in Firebase: nextOutcome = ${verifySnap.data().nextOutcome}`);
        toast.success(`✅ Set to ${DICE_FACES[outcomeValue]} (Doc: ${uid.substring(0, 8)}...)`);
      } else {
        console.error(`❌ Document not found after write!`);
        toast.error(`❌ Write failed - document not found`);
      }
      setTelegramUrlOrId('');
      setSingleOutcome(3);
    } catch (err) {
      console.error('❌ Outcome setting error:', err);
      console.error('   Error code:', err.code);
      console.error('   Error message:', err.message);
      toast.error(`❌ Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Verify the saved outcome from Firebase
  const verifySavedOutcome = async () => {
    if (!telegramUrlOrId.trim()) return toast.error('Enter Telegram Group URL or User ID');
    
    const telegramId = extractTelegramId(telegramUrlOrId);
    if (!telegramId) return toast.error('Invalid Telegram URL or ID');
    
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('telegramId', '==', String(telegramId)));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        const savedOutcome = userData.nextOutcome || 0;
        const docId = snapshot.docs[0].id;
        console.log(`📋 FIREBASE VERIFICATION for ${telegramId}:`, userData);
        console.log(`   - Document ID: ${docId}`);
        console.log(`   - Stored Outcome: ${savedOutcome} ${DICE_FACES[savedOutcome] || ''}`);
        console.log(`   - Full user data:`, userData);
        toast.success(`✅ Found! Next outcome: ${DICE_FACES[savedOutcome] || '?'} (${savedOutcome})`);
      } else {
        console.log(`❌ NO USER FOUND for telegramId=${telegramId}`);
        toast.error(`❌ User not found! No data saved for Telegram ID: ${telegramId}`);
      }
    } catch (err) {
      console.error('Verify error:', err);
      toast.error('Failed to verify outcome');
    } finally {
      setLoading(false);
    }
  };

  // Clear and reset user data - dangerous operation
  const resetUserData = async () => {
    if (!telegramUrlOrId.trim()) return toast.error('Enter Telegram ID to reset');
    
    const telegramId = extractTelegramId(telegramUrlOrId);
    setLoading(true);
    try {
      // Find user by telegramId
      const q = query(collection(db, 'users'), where('telegramId', '==', String(telegramId)));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const uid = snapshot.docs[0].id;
        console.log(`🗑️  RESETTING user ${uid}`);
        
        // Delete the entire document
        await deleteDoc(doc(db, 'users', uid));
        toast.success(`✅ User ${telegramId} completely reset!`);
        console.log(`✅ User deleted`);
      } else {
        // Try by document ID
        const docRef = doc(db, 'users', String(telegramId));
        await deleteDoc(docRef);
        toast.success(`✅ User ${telegramId} completely reset!`);
        console.log(`✅ User deleted by ID`);
      }
    } catch (err) {
      console.error('Reset error:', err);
      toast.error('Failed to reset user');
    } finally {
      setLoading(false);
    }
  };

  // Force roll for a user
  const forceRollUser = async () => {
    if (!forceRollId.trim()) return toast.error('Enter Telegram User ID');
    
    const telegramId = extractTelegramId(forceRollId);
    if (!telegramId) return toast.error('Invalid Telegram URL or ID');
    
    setLoading(true);
    try {
      // Find user by telegramId
      const q = query(collection(db, 'users'), where('telegramId', '==', String(telegramId)));
      const snapshot = await getDocs(q);
      
      let uid;
      if (!snapshot.empty) {
        uid = snapshot.docs[0].id;
      } else {
        uid = String(telegramId);
      }

      const userRef = doc(db, 'users', uid);
      // Set forceRoll flag
      await setDoc(userRef, { 
        forceRoll: true,
        telegramId: String(telegramId),
      }, { merge: true });
      
      toast.success(`✅ Force roll triggered for Telegram ID ${telegramId}\n⏳ Bot will roll in 1-2 seconds...`);
      console.log(`✅ AdminPage: forceRoll=true for uid=${uid}, telegramId=${telegramId}`);
      setForceRollId('');
    } catch (err) {
      console.error('Force roll error:', err);
      toast.error(err.message || 'Failed to trigger force roll');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="card" style={{ maxWidth: 600, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎲</div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Dice Control Queue</h1>
          <p style={{ color: 'var(--muted)' }}>Set the next 5 dice outcomes for Telegram group rolls</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Telegram URL/ID Input */}
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.6rem', fontWeight: 600 }}>
              TELEGRAM GROUP URL OR USER ID
            </label>
            <input 
              className="input" 
              type="text"
              placeholder="e.g. https://t.me/groupname or 609161014" 
              value={telegramUrlOrId} 
              onChange={e => setTelegramUrlOrId(e.target.value)}
              style={{ fontFamily: 'monospace' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
              Paste Telegram group URL or enter User ID
            </p>
          </div>

          {/* Single Outcome Selection */}
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.8rem', fontWeight: 600 }}>
              NEXT ROLL OUTCOME (One time only)
            </label>
            <div style={{ 
              display: 'flex', 
              gap: '0.8rem', 
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.2)',
              padding: '1.5rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              flexWrap: 'wrap'
            }}>
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => updateSingleOutcome(n)}
                  style={{
                    padding: '1rem',
                    fontSize: '1.8rem',
                    borderRadius: '8px',
                    border: singleOutcome === n ? '3px solid #4ADE80' : '2px solid rgba(255,255,255,0.2)',
                    background: singleOutcome === n ? 'rgba(74,222,128,0.2)' : 'rgba(74,222,128,0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: 'bold'
                  }}
                >
                  {DICE_FACES[n]}
                </button>
              ))}
            </div>
            
            {/* Outcome preview */}
            <div style={{ 
              background: 'rgba(100,200,255,0.1)',
              border: '1px solid rgba(100,200,255,0.3)',
              borderRadius: '6px',
              padding: '1rem',
              textAlign: 'center',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#fff'
            }}>
              Selected: {DICE_FACES[singleOutcome]}
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <button 
              className="btn btn-primary btn-lg" 
              onClick={setOutcome_Firebase}
              disabled={loading}
              style={{ flex: 1, marginTop: '1rem' }}
            >
              {loading ? '⏳ Setting...' : `✅ Set Outcome`}
            </button>
            <button 
              className="btn btn-secondary btn-lg" 
              onClick={verifySavedOutcome}
              disabled={loading}
              style={{ flex: 1, marginTop: '1rem', background: 'rgba(100,200,255,0.2)', border: '1px solid rgba(100,200,255,0.5)' }}
            >
              {loading ? '⏳ Checking...' : `🔍 Verify`}
            </button>
            <button 
              className="btn btn-secondary btn-lg" 
              onClick={resetUserData}
              disabled={loading}
              style={{ flex: 1, marginTop: '1rem', background: 'rgba(255,100,100,0.2)', border: '1px solid rgba(255,100,100,0.5)' }}
            >
              {loading ? '⏳ Resetting...' : `🗑️ Reset User`}
            </button>
          </div>

          {/* Info Box */}
          <div style={{ 
            background: 'rgba(74,222,128,0.08)', 
            border: '1px solid rgba(74,222,128,0.2)', 
            borderRadius: '10px', 
            padding: '1rem', 
            fontSize: '0.85rem', 
            color: 'var(--muted)',
            lineHeight: '1.6'
          }}>
            <strong style={{ color: 'var(--success)' }}>ℹ️ How it works:</strong><br/>
            1. Paste Telegram group URL or enter User ID<br/>
            2. Select the outcome for the NEXT roll only<br/>
            3. Click "Set Outcome"<br/>
            4. User rolls one time with that outcome<br/>
            5. After that roll, outcome resets (no more control)
          </div>

          {/* FORCE ROLL SECTION */}
          <div style={{ 
            borderTop: '2px solid rgba(255,100,100,0.3)',
            paddingTop: '1.5rem',
            marginTop: '1.5rem'
          }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: '#fff' }}>🚀 Force Roll User</h2>
            
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.6rem', fontWeight: 600 }}>
                TELEGRAM USER ID
              </label>
              <input 
                className="input" 
                type="text"
                placeholder="e.g. 609161014 or https://t.me/groupname" 
                value={forceRollId} 
                onChange={e => setForceRollId(e.target.value)}
                style={{ fontFamily: 'monospace', marginBottom: '0.8rem' }}
              />
            </div>

            <button 
              className="btn btn-primary btn-lg" 
              onClick={forceRollUser}
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? '⏳ Triggering...' : '🚀 Force Roll Now'}
            </button>

            <p style={{ fontSize: '0.75rem', color: 'rgba(255,100,100,0.7)', marginTop: '0.6rem', textAlign: 'center' }}>
              Bot will automatically roll dice for this user in 1-2 seconds
            </p>
          </div>

          {/* Logout */}
          <button 
            className="btn btn-secondary"
            onClick={handleLogout}
            style={{ marginTop: '1rem' }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
