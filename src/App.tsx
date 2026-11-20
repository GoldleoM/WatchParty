import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Home } from './pages/Home';
const CreateRoom = lazy(() => import('./pages/CreateRoom').then(m => ({ default: m.CreateRoom })));
const Room = lazy(() => import('./pages/Room').then(m => ({ default: m.Room })));

export default function App() {
  return <AuthProvider><BrowserRouter>
    <a className="skip-link" href="#main">Skip to content</a><Navbar />
    <main id="main"><Suspense fallback={<p className="loading-state" role="status">Loading…</p>}>
      <Routes>
        <Route path="/" element={<Home />} /><Route path="/create" element={<CreateRoom />} />
        <Route path="/room/:roomId" element={<Room />} />
        <Route path="*" element={<section className="setup-wrap panel form-panel"><h1>Page not found</h1><Link className="back-link" to="/">Return to lobby</Link></section>} />
      </Routes>
    </Suspense></main>
  </BrowserRouter></AuthProvider>;
}
