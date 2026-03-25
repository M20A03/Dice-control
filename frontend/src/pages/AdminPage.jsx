import { useState } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
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
  const [outcomeQueue, setOutcomeQueue] = useState([3, 4, 5, 2, 1]); // Default queue of 5
  const [currentSelection, setCurrentSelection] = useState(0); // Which outcome in queue is being edited
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
  const updateQueueItem = (index, newValue) => {
    const newQueue = [...outcomeQueue];
    newQueue[index] = newValue;
    setOutcomeQueue(newQueue);
  };

  // Set the outcome queue to Firebase
  const setOutcomeQueue_Firebase = async () => {
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
      // Store queue of outcomes (all as numbers)
      const queueAsNumbers = outcomeQueue.map(o => Number(o));
      
      await setDoc(userRef, { 
        outcomeQueue: queueAsNumbers,
        telegramId: String(telegramId),
      }, { merge: true });
      
      toast.success(`✅ Queue set for Telegram ID ${telegramId}: ${queueAsNumbers.map(n => DICE_FACES[n]).join(' → ')}`);
      console.log(`✅ AdminPage: Set outcomeQueue=${JSON.stringify(queueAsNumbers)} for uid=${uid}`);
      setTelegramUrlOrId('');
      setOutcomeQueue([3, 4, 5, 2, 1]);
    } catch (err) {
      console.error('Dice outcome error:', err);
      toast.error(err.message || 'Failed to set outcome queue');
    } finally {
      setLoading(false);
    }
  };

  // Verify the saved queue from Firebase
  const verifySavedQueue = async () => {
    if (!telegramUrlOrId.trim()) return toast.error('Enter Telegram Group URL or User ID');
    
    const telegramId = extractTelegramId(telegramUrlOrId);
    if (!telegramId) return toast.error('Invalid Telegram URL or ID');
    
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('telegramId', '==', String(telegramId)));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        const savedQueue = userData.outcomeQueue || [];
        console.log(`📋 FIREBASE VERIFICATION for ${telegramId}:`, savedQueue);
        toast.success(`✅ Saved queue: ${savedQueue.map(n => DICE_FACES[n] || n).join(' → ')} (${savedQueue.join(',')})`);
      } else {
        toast.error('❌ User not found in Firebase');
      }
    } catch (err) {
      console.error('Verify error:', err);
      toast.error('Failed to verify queue');
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

          {/* Outcome Queue (5 items) */}
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.8rem', fontWeight: 600 }}>
              QUEUE OF 5 OUTCOMES
            </label>
            <div style={{ 
              display: 'flex', 
              gap: '0.8rem', 
              justifyContent: 'space-between',
              background: 'rgba(0,0,0,0.2)',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              flexWrap: 'wrap'
            }}>
              {[0, 1, 2, 3, 4].map((index) => (
                <div key={index} style={{ flex: '1', minWidth: '80px' }}>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(3, 1fr)', 
                    gap: '0.4rem'
                  }}>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <button
                        key={n}
                        onClick={() => updateQueueItem(index, n)}
                        style={{
                          padding: '0.6rem',
                          borderRadius: '6px',
                          border: outcomeQueue[index] === n ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                          background: outcomeQueue[index] === n ? 'rgba(124,111,255,0.2)' : 'rgba(255,255,255,0.05)',
                          color: '#fff',
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontSize: '1rem',
                          transition: 'all 0.2s',
                        }}
                      >
                        {DICE_FACES[n]}
                      </button>
                    ))}
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--muted)' }}>
                    Roll #{index + 1}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Queue preview */}
            <div style={{ 
              background: 'rgba(100,200,255,0.1)',
              border: '1px solid rgba(100,200,255,0.3)',
              borderRadius: '6px',
              padding: '0.8rem',
              textAlign: 'center',
              fontSize: '1.2rem',
              fontWeight: 'bold',
              color: '#fff'
            }}>
              Queue: {outcomeQueue.map((o, i) => `${DICE_FACES[o]}`).join(' → ')}
            </div>
          </div>

          {/* Submit Button */}
          <div style={{ display: 'flex', gap: '0.8rem' }}>
            <button 
              className="btn btn-primary btn-lg" 
              onClick={setOutcomeQueue_Firebase}
              disabled={loading}
              style={{ flex: 1, marginTop: '1rem' }}
            >
              {loading ? '⏳ Setting...' : `✅ Set Queue`}
            </button>
            <button 
              className="btn btn-secondary btn-lg" 
              onClick={verifySavedQueue}
              disabled={loading}
              style={{ flex: 1, marginTop: '1rem', background: 'rgba(100,200,255,0.2)', border: '1px solid rgba(100,200,255,0.5)' }}
            >
              {loading ? '⏳ Checking...' : `🔍 Verify`}
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
            2. Select outcome for each of the 5 upcoming rolls<br/>
            3. Click "Set Outcome Queue"<br/>
            4. Each time user rolls, the next outcome in queue is used<br/>
            5. After all 5 rolls are used, queue resets
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
