import { useState } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const DICE_FACES = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };

export default function AdminPage() {
  const { user, userData, logout } = useAuth();
  const navigate = useNavigate();
  const [targetTelegramId, setTargetTelegramId] = useState('');
  const [outcome, setOutcome] = useState(3);
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // All users can control dice for Telegram groups
  const setDiceOutcome = async () => {
    if (!targetTelegramId.trim()) return toast.error('Enter Telegram User ID');
    if (!/^\d{5,20}$/.test(targetTelegramId.trim())) return toast.error('Invalid Telegram User ID');
    
    setLoading(true);
    try {
      // Find user by telegramId using modern Firebase SDK
      const q = query(collection(db, 'users'), where('telegramId', '==', targetTelegramId.trim()));
      const snapshot = await getDocs(q);
      
      let uid;
      if (!snapshot.empty) {
        uid = snapshot.docs[0].id;
      } else {
        // If not found, use telegramId as fallback uid
        uid = targetTelegramId.trim();
      }

      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { 
        forcedOutcome: outcome,
        telegramId: targetTelegramId.trim(),
      }, { merge: true });
      
      toast.success(`✅ Next /roll for Telegram ID ${targetTelegramId} will be ${outcome} ${DICE_FACES[outcome]}`);
      setTargetTelegramId('');
      setOutcome(3);
    } catch (err) {
      console.error('Dice outcome error:', err);
      toast.error(err.message || 'Failed to set outcome');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="card" style={{ maxWidth: 500, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎲</div>
          <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Dice Control Panel</h1>
          <p style={{ color: 'var(--muted)' }}>Set the next dice outcome for Telegram group rolls</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Telegram ID Input */}
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.6rem', fontWeight: 600 }}>
              TELEGRAM USER ID
            </label>
            <input 
              className="input" 
              type="number"
              placeholder="e.g. 609161014" 
              value={targetTelegramId} 
              onChange={e => setTargetTelegramId(e.target.value)}
              style={{ fontFamily: 'monospace' }}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.4rem' }}>
              Get ID from @userinfobot in Telegram
            </p>
          </div>

          {/* Dice Outcome Selector */}
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.8rem', fontWeight: 600 }}>
              CHOOSE OUTCOME ({outcome} {DICE_FACES[outcome]})
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.6rem' }}>
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => setOutcome(n)}
                  style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    border: outcome === n ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                    background: outcome === n ? 'rgba(124,111,255,0.2)' : 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '1.5rem',
                    transition: 'all 0.2s',
                  }}
                >
                  {DICE_FACES[n]}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button 
            className="btn btn-primary btn-lg" 
            onClick={setDiceOutcome}
            disabled={loading}
            style={{ marginTop: '1rem' }}
          >
            {loading ? '⏳ Setting...' : `🎲 Set Next Roll = ${outcome}`}
          </button>

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
            1. Enter the Telegram User ID<br/>
            2. Choose the dice outcome (1-6)<br/>
            3. When they /roll in group, they get that number<br/>
            4. After one roll, outcome resets automatically
          </div>

          {/* Logout */}
          <button 
            className="btn btn-secondary"
            onClick={handleLogout}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
