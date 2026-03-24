import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import toast from 'react-hot-toast';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim();
    const normalizedUsername = username.trim();

    if (!normalizedEmail || !password) {
      toast.error('Email and password are required');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(normalizedEmail, password);
        toast.success('Welcome back! 🎲');
        navigate('/game');
      } else {
        if (!normalizedUsername) throw new Error('Username is required');
        await signup(normalizedEmail, password, normalizedUsername);
        toast.success('Account created! Verify your Telegram next.');
        navigate('/verify-telegram');
      }
    } catch (err) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-centered" style={{ background: 'radial-gradient(ellipse at top, #1a1030 0%, #0a0a14 70%)' }}>
      <div className="auth-card card">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🎲</div>
          <h1 style={{ fontSize: '1.8rem', background: 'linear-gradient(135deg, #7c6fff, #f5c542)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            DiceGame
          </h1>
          <p style={{ color: 'var(--muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Play. Compete. Win.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '4px', marginBottom: '1.5rem' }}>
          {['Sign In', 'Sign Up'].map((tab, i) => (
            <button
              key={tab}
              onClick={() => setIsLogin(i === 0)}
              style={{
                flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none',
                background: (i === 0) === isLogin ? 'var(--accent)' : 'transparent',
                color: (i === 0) === isLogin ? '#fff' : 'var(--muted)',
                fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.9rem',
                transition: 'all 0.2s',
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {!isLogin && (
            <div>
              <label style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.4rem', display: 'block' }}>Username</label>
              <input className="input" placeholder="Enter username" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
          )}
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.4rem', display: 'block' }}>Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.4rem', display: 'block' }}>Password</label>
            <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? '⏳ Please wait...' : isLogin ? '🎲 Sign In & Play' : '🚀 Create Account'}
          </button>
        </form>

        {!isLogin && (
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)', marginTop: '1rem' }}>
            After signup, you'll verify your Telegram account to unlock group features.
          </p>
        )}
      </div>
    </div>
  );
}
