import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

export default function TelegramVerifyPage() {
  const { user, refreshUserData } = useAuth();
  const [telegramId, setTelegramId] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // Step 1: Enter ID, Step 2: Enter OTP
  const [generatedOtp, setGeneratedOtp] = useState(null);
  const navigate = useNavigate();

  // Step 1: Send OTP to Telegram
  const sendOtpToTelegram = async () => {
    if (!telegramId.trim()) return toast.error('Enter your Telegram User ID');
    if (!/^\d{9,20}$/.test(telegramId.trim())) return toast.error('Invalid Telegram ID format');
    
    setLoading(true);
    try {
      // Generate random 6-digit OTP
      const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Save OTP to Firebase with 5-minute expiry
      const otpRef = doc(db, 'otpVerification', user.uid);
      await setDoc(otpRef, {
        telegramId: telegramId.trim(),
        otp: newOtp,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 5 * 60000).toISOString(), // 5 minutes
      });
      
      setGeneratedOtp(newOtp);
      setStep(2);
      toast.success(`✅ OTP sent to your Telegram DM from @MayaDiceGamebot`);
    } catch (err) {
      console.error('OTP send error:', err);
      toast.error('Failed to generate OTP: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const verifyOtp = async () => {
    if (!otp.trim()) return toast.error('Enter the OTP');
    if (otp.trim() !== generatedOtp) return toast.error('❌ Wrong OTP!');
    
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        telegramId: telegramId.trim(),
        telegramVerified: true,
        telegramVerifiedAt: new Date().toISOString(),
      });
      
      // Delete OTP after verification
      // await deleteDoc(doc(db, 'otpVerification', user.uid));
      
      await refreshUserData();
      toast.success('✅ Telegram ID verified! Going to admin panel...');
      setTimeout(() => navigate('/admin'), 1000);
    } catch (err) {
      console.error('Verify OTP error:', err);
      toast.error(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-centered" style={{ background: 'radial-gradient(ellipse at top, #0d1d35 0%, #0a0a14 70%)' }}>
      <div className="auth-card card" style={{ maxWidth: 450 }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔐</div>
          <h2 style={{ marginBottom: '0.5rem' }}>Verify Telegram ID</h2>
          <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
            {step === 1 ? 'Enter your Telegram ID' : 'Enter the OTP sent to Telegram'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {step === 1 ? (
            // Step 1: Enter Telegram ID
            <>
              <div style={{ background: 'rgba(124,111,255,0.1)', border: '1px solid rgba(124,111,255,0.25)', borderRadius: '10px', padding: '1rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--accent)' }}>📱 How to find your ID:</strong>
                <ol style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', lineHeight: '1.8' }}>
                  <li>Open Telegram, search <strong>@userinfobot</strong></li>
                  <li>Send it a message</li>
                  <li>Copy your ID number</li>
                </ol>
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.6rem', display: 'block', fontWeight: 600 }}>TELEGRAM USER ID</label>
                <input 
                  className="input" 
                  type="number"
                  placeholder="e.g. 609161014" 
                  value={telegramId} 
                  onChange={e => setTelegramId(e.target.value)}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>

              <button 
                className="btn btn-primary btn-lg" 
                onClick={sendOtpToTelegram}
                disabled={loading}
              >
                {loading ? '⏳ Sending OTP...' : '📤 Send OTP to Telegram'}
              </button>

              <button className="btn btn-secondary" onClick={() => navigate('/admin')}>
                Skip for now
              </button>
            </>
          ) : (
            // Step 2: Enter OTP
            <>
              <div style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '10px', padding: '1rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--success)' }}>✅ OTP Sent!</strong><br/>
                Check your Telegram DM from <strong>@MayaDiceGamebot</strong> for the 6-digit code.
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.6rem', display: 'block', fontWeight: 600 }}>ENTER OTP CODE</label>
                <input 
                  className="input" 
                  type="text"
                  placeholder="e.g. 123456" 
                  value={otp} 
                  onChange={e => setOtp(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: '1.2rem', letterSpacing: '0.5rem', textAlign: 'center' }}
                  maxLength="6"
                />
              </div>

              <button 
                className="btn btn-primary btn-lg" 
                onClick={verifyOtp}
                disabled={loading}
              >
                {loading ? '⏳ Verifying...' : '✅ Verify OTP'}
              </button>

              <button className="btn btn-secondary" onClick={() => { setStep(1); setOtp(''); }}>
                ← Back & Change ID
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
