import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MdLocalMovies, MdLogout, MdMeetingRoom } from 'react-icons/md';
import { useAuth } from '../../contexts/session';

export function Navbar() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [error, setError] = useState('');
  return <header className="masthead">
    <nav className="shell nav-inner" aria-label="Main navigation">
      <Link to="/" className="wordmark"><span className="brand-icon"><MdLocalMovies /></span>WatchParty</Link>
      <div className="nav-right">
        {user && <span className="identity"><b aria-hidden="true">{Array.from(user.displayName)[0]}</b><span>{user.displayName}</span></span>}
        {pathname !== '/' ? <Link to="/" className="nav-link"><MdMeetingRoom /> Lobby</Link> : null}
        {
           user ? <button className="nav-link" onClick={() => { setError(''); logout().catch(() => setError('Sign-out failed. Try again.')); }}><MdLogout /> Sign out</button> : pathname === '/' && <Link to="/account" className="nav-link">Sign in</Link>}
      </div>
    </nav>
    {error && <p className="shell error" role="alert">{error}</p>}
  </header>;
}
