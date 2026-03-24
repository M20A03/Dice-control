import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/AuthContext';
import { db } from '../lib/firebase';
import { collection, addDoc, query, where, orderBy, limit, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const DICE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export default function GamePage() {
  const { user, userData, refreshUserData } = useAuth();
  const [choice, setChoice] = useState(1);
  const [prediction, setPrediction] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [displayNum, setDisplayNum] = useState(null);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    if (!user) return;
    try {
      const q = query(
        collection(db, 'games'),
        where('firebaseUid', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const games = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setHistory(games);
    } catch (e) { 
      console.error('Fetch history error:', e);
    }
    setLoadingHistory(false);
  };

  const rollDice = async () => {
    if (rolling) return;
    setRolling(true);
    setResult(null);

    // Animate through random numbers
    let count = 0;
    const interval = setInterval(() => {
      setDisplayNum(Math.floor(Math.random() * 6) + 1);
      count++;
      if (count > 15) clearInterval(interval);
    }, 80);

    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? userSnap.data() : {};
      
      let result;
      const forcedOutcome = userData.forcedOutcome;
      
      // Check for forced outcome
      if (forcedOutcome && forcedOutcome >= 1 && forcedOutcome <= 6) {
        result = forcedOutcome;
        // Clear forced outcome after use
        await updateDoc(userRef, { forcedOutcome: null });
      } else {
        result = Math.floor(Math.random() * 6) + 1;
      }

      const isWin = parseInt(choice) === result;
      const isPredictionCorrect = parseInt(prediction) === result;
      let coinsEarned = 0;
      if (isWin) coinsEarned += 10;
      if (isPredictionCorrect) coinsEarned += 5;

      // Save game record
      await addDoc(collection(db, 'games'), {
        firebaseUid: user.uid,
        username: userData?.username || user.displayName || 'Player',
        choice: parseInt(choice),
        prediction: parseInt(prediction),
        result,
        isWin,
        isPredictionCorrect,
        coinsEarned,
        platform: 'website',
        createdAt: new Date(),
      });

      // Update user stats
      const stats = userData.stats || { totalGames: 0, wins: 0, losses: 0, coins: 0, currentStreak: 0, bestStreak: 0, winRate: 0 };
      const newWins = stats.wins + (isWin ? 1 : 0);
      const newLosses = stats.losses + (isWin ? 0 : 1);
      const newStreak = isWin ? (stats.currentStreak || 0) + 1 : 0;
      const newBestStreak = Math.max(stats.bestStreak || 0, newStreak);

      await updateDoc(userRef, {
        stats: {
          totalGames: (stats.totalGames || 0) + 1,
          wins: newWins,
          losses: newLosses,
          coins: (stats.coins || 0) + coinsEarned,
          currentStreak: newStreak,
          bestStreak: newBestStreak,
          winRate: Math.round((newWins / ((stats.totalGames || 0) + 1)) * 100),
        }
      });

      setTimeout(() => {
        clearInterval(interval);
        setDisplayNum(result);
        setResult({ result, isWin, isPredictionCorrect, coinsEarned });
        setRolling(false);
        refreshUserData();
        fetchHistory();
        if (isWin) toast.success(`🏆 You won! +${coinsEarned} coins`);
        else if (isPredictionCorrect) toast('🎯 Prediction correct! +5 coins', { icon: '🎯' });
        else toast.error('❌ Better luck next time!');
      }, 1300);
    } catch (err) {
      clearInterval(interval);
      setRolling(false);
      console.error('Roll error:', err);
      toast.error(err.message || 'Failed to roll');
    }
  };

  const stats = userData?.stats || {};

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
        {/* ── Left: Main Game ───────────────────────────── */}
        <div>
          {/* Stats strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Games', value: stats.totalGames || 0 },
              { label: 'Wins', value: stats.wins || 0 },
              { label: 'Win Rate', value: `${stats.winRate || 0}%` },
              { label: '🔥 Streak', value: stats.currentStreak || 0 },
            ].map(s => (
              <div className="stat-box" key={s.label}>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Game card */}
          <div className="card" style={{ textAlign: 'center' }}>
            {/* Dice */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
              <div className={`dice-display${rolling ? ' rolling' : ''}`} style={{ width: 140, height: 140, fontSize: '4.5rem' }}>
                {displayNum != null ? DICE_FACES[displayNum] : '🎲'}
              </div>
            </div>

            {/* Result overlay */}
            <AnimatePresence>
              {result && !rolling && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`card${result.isWin ? ' result-win' : ' result-lose'}`}
                  style={{ marginBottom: '1.5rem', textAlign: 'left' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>
                        {result.isWin ? '✅ You Won!' : '❌ Try Again!'}
                      </div>
                      <div style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        Choice: {result.result === choice ? `${choice} ✓` : `${choice} ✗`} &nbsp;|&nbsp;
                        Prediction: {result.isPredictionCorrect ? `${prediction} ✓` : `${prediction} ✗`} &nbsp;|&nbsp;
                        Rolled: {DICE_FACES[result.result]} {result.result}
                      </div>
                    </div>
                    {result.coinsEarned > 0 && (
                      <span className="badge badge-gold">+{result.coinsEarned} 🪙</span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Your Choice */}
            <div style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: '0.6rem' }}>
                YOUR CHOICE
              </label>
              <div className="num-picker">
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} className={`num-btn${choice === n ? ' selected' : ''}`} onClick={() => setChoice(n)}>{n}</button>
                ))}
              </div>
            </div>

            {/* Prediction */}
            <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: '0.6rem' }}>
                YOUR PREDICTION (bonus +5 🪙 if correct)
              </label>
              <div className="num-picker">
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} className={`num-btn${prediction === n ? ' selected' : ''}`} onClick={() => setPrediction(n)}
                    style={{ borderColor: prediction === n ? 'var(--accent2)' : undefined, background: prediction === n ? 'var(--accent2)' : undefined, color: prediction === n ? '#1a1000' : undefined }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Roll button */}
            <motion.button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', fontSize: '1.2rem', padding: '1.1rem' }}
              onClick={rollDice}
              disabled={rolling}
              whileTap={{ scale: 0.97 }}
            >
              {rolling ? '🎲 Rolling...' : '🎲 Roll Dice!'}
            </motion.button>

            {/* Coins display */}
            <p style={{ marginTop: '1rem', color: 'var(--muted)', fontSize: '0.85rem' }}>
              💰 Coins: <strong style={{ color: 'var(--accent2)' }}>{stats.coins || 0}</strong>
              &nbsp;&nbsp;🏅 Best Streak: <strong>{stats.bestStreak || 0}</strong>
            </p>
          </div>
        </div>

        {/* ── Right: History ─────────────────────────────── */}
        <div>
          <h3 style={{ marginBottom: '1rem' }}>📜 Recent Games</h3>
          {loadingHistory ? (
            <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '2rem' }}>Loading...</div>
          ) : history.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
              No games yet.<br />Roll to start! 🎲
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {history.map((g, i) => (
                <div key={g.id || i} className="hist-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ fontSize: '1.4rem' }}>{DICE_FACES[g.result]}</span>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        Rolled {g.result} &nbsp;
                        <span style={{ color: g.isWin ? 'var(--success)' : 'var(--accent3)' }}>
                          {g.isWin ? '✓ Win' : '✗ Loss'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        Chose {g.choice} · Predicted {g.prediction}
                        {g.isPredictionCorrect && ' ✓'}
                      </div>
                    </div>
                  </div>
                  {g.coinsEarned > 0 && (
                    <span className="badge badge-gold">+{g.coinsEarned}🪙</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
