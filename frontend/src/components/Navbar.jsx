import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import toast from 'react-hot-toast';

export default function Navbar() {
  const { user, userData, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/auth');
  };

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <NavLink to="/game" className="navbar-logo">🎲 DiceGame</NavLink>

        <div className="nav-links">
          {user ? (
            <>
              <NavLink to="/game" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>🎲 Play</NavLink>
              <NavLink to="/leaderboard" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>🏆 Ranks</NavLink>
              <NavLink to="/profile" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>👤 Profile</NavLink>
              {userData?.role === 'admin' && (
                <NavLink to="/admin" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>⚙️ Admin</NavLink>
              )}
              <button className="btn btn-sm btn-secondary" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <NavLink to="/auth" className="btn btn-sm btn-primary">Sign In</NavLink>
          )}
        </div>
      </div>
    </nav>
  );
}
