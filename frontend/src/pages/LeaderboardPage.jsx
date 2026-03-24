import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          orderBy('stats.wins', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(q);
        const players = snapshot.docs.map((doc, i) => ({
          rank: i + 1,
          uid: doc.id,
          username: doc.data().username || 'Anonymous',
          wins: doc.data().stats?.wins || 0,
          totalGames: doc.data().stats?.totalGames || 0,
          winRate: doc.data().stats?.winRate || 0,
          coins: doc.data().stats?.coins || 0,
        }));
        setPlayers(players);
      } catch (err) {
        console.error('Leaderboard error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h1>🏆 Leaderboard</h1>
        <p style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>Top players by wins</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>Loading rankings...</div>
      ) : players.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
          No players yet. Be the first! 🎲
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {players.map((p, i) => (
            <div
              key={p.uid}
              className={`lb-row${i < 3 ? ' top-3' : ''}`}
              style={{ borderBottom: i < players.length - 1 ? '1px solid var(--card-border)' : 'none',
                background: p.uid === user?.uid ? 'rgba(124,111,255,0.08)' : undefined }}
            >
              {/* Rank */}
              <div style={{ width: 36, textAlign: 'center', fontSize: i < 3 ? '1.3rem' : '0.9rem', fontWeight: 700, color: 'var(--muted)', flexShrink: 0 }}>
                {MEDALS[i] || `#${p.rank}`}
              </div>

              {/* Avatar */}
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: `hsl(${(p.username.charCodeAt(0) * 17) % 360}, 60%, 45%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, color: '#fff', fontSize: '0.9rem',
              }}>
                {p.username[0].toUpperCase()}
              </div>

              {/* Name */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  {p.username}
                  {p.uid === user?.uid && <span style={{ color: 'var(--accent)', marginLeft: '0.4rem', fontSize: '0.75rem' }}>(you)</span>}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{p.totalGames} games · {p.winRate}% win rate</div>
              </div>

              {/* Stats */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 800, color: 'var(--success)', fontSize: '1.1rem' }}>{p.wins}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>wins</div>
              </div>
              <div style={{ textAlign: 'right', minWidth: 50 }}>
                <div style={{ fontWeight: 700, color: 'var(--accent2)', fontSize: '0.95rem' }}>{p.coins} 🪙</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
