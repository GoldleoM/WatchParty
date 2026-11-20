import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MdAdd, MdConfirmationNumber, MdMovieCreation, MdLink } from 'react-icons/md';
import { roomCodeFrom } from '../utils/links';
import cinema from '../assets/cinema.webp';

export function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  function join(event: FormEvent) {
    event.preventDefault();
    const room = roomCodeFrom(code);
    if (!room) { setError('Enter a six-character code or paste a room invite link.'); return; }
    navigate('/room/' + room);
  }
  return <div className="shell lobby">
    <section className="cinema-hero">
      <img src={cinema} alt="" fetchPriority="high" />
      <div className="hero-copy">
        <h1>Movie night,<br /><em>together.</em></h1>
        <p>Watch in sync and chat with friends in your own room, wherever you are.</p>
      </div>
    </section>
    <div className="lobby-actions">
      <section className="action-card">
        <span className="card-icon"><MdMovieCreation /></span>
        <div><h2>Host a room</h2><p>Pick a video and invite your people.</p></div>
        <Link className="btn primary" to="/create"><MdAdd /> Create room</Link>
      </section>
      <section className="action-card">
        <span className="card-icon"><MdConfirmationNumber /></span>
        <div><h2>Join a room</h2><p>Use the code or invite link from your host.</p></div>
        <form className="join-form" onSubmit={join}>
          <label className="visually-hidden" htmlFor="room-code">Room code or invite link</label>
          <div className="input-icon"><MdLink /><input id="room-code" value={code} onChange={e => { setCode(e.target.value); setError(''); }} placeholder="Room code or link" required autoComplete="off" spellCheck={false} aria-invalid={!!error} aria-describedby={error ? 'code-error' : undefined} /></div>
          <button className="btn secondary">Join room</button>
          {error && <p role="alert" className="error" id="code-error">{error}</p>}
        </form>
      </section>
    </div>
  </div>;
}
