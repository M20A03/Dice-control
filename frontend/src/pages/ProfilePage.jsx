import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export default function ProfilePage() {
  const { user, userData, logout } = useAuth();
  const navigate = useNavigate();
  const [rank, setRank] = useState(null);

  useEffect(() => {
    if (user) fetchRank();
  }, [user]);

  const fetchRank = async () => {
    try {
      const q = query(collection(db, 'users'), where('stats.wins', '>', userData?.stats?.wins || 0));
      const snapshot = await getDocs(q);
      setRank(snapshot.size + 1);
    } catch (err) {
      console.error('Rank fetch error:', err);
    }
  };

  if (!user) return null;
  const stats = userData?.stats || {};

  const badges = [
    { label: 'First Roll', icon: '🎲', earned: stats.totalGames > 0 },
    { label: 'Winner', icon: '✅', earned: stats.wins >= 1 },
    { label: '10 Win Streak', icon: '🔥', earned: stats.bestStreak >= 10 },
    { label: '50 Wins', icon: '👑', earned: stats.wins >= 50 },
    { label: 'Telegram Linked', icon: '✈️', earned: userData?.telegramVerified },
  ];

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Profile header */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', fontWeight: 900, color: '#1a1000', flexShrink: 0
        }}>
          {(userData?.username || user.displayName || 'U')[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ marginBottom: '0.25rem' }}>{userData?.username || user.displayName || 'Player'}</h2>
          <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{user.email}</div>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {userData?.telegramVerified ? (
              <span className="badge badge-accent">✈️ Telegram Verified</span>
            ) : (
              <button className="badge badge-red" style={{ cursor: 'pointer', border: 'none', fontFamily: 'inherit' }}
                onClick={() => navigate('/verify-telegram')}>
                ⚠️ Verify Telegram
              </button>
            )}
            {rank && <span className="badge badge-gold">🏆 Rank #{rank}</span>}
            {userData?.role === 'admin' && <span className="badge badge-green">⚙️ Admin</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <h3 style={{ marginBottom: '0.75rem' }}>📊 Statistics</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Games', value: stats.totalGames || 0 },
          { label: 'Wins', value: stats.wins || 0 },
          { label: 'Losses', value: stats.losses || 0 },
          { label: 'Win Rate', value: `${stats.winRate || 0}%` },
          { label: 'Best Streak', value: stats.bestStreak || 0 },
          { label: 'Coins', value: `${stats.coins || 0} 🪙` },
        ].map(s => (
          <div className="stat-box" key={s.label}>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Badges */}
      <h3 style={{ marginBottom: '0.75rem' }}>🏅 Achievements</h3>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        {badges.map(b => (
          <div key={b.label} className="card" style={{
            opacity: b.earned ? 1 : 0.35,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '1rem', minWidth: 90, gap: '0.4rem',
            border: b.earned ? '1px solid var(--accent)' : undefined,
          }}>
            <div style={{ fontSize: '1.8rem' }}>{b.icon}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--muted)', textAlign: 'center' }}>{b.label}</div>
          </div>
        ))}
      </div>

      <button className="btn btn-danger" onClick={async () => { await logout(); navigate('/auth'); }}>
        Sign Out
      </button>
    </div>
  );
}
