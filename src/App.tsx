import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Link, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Home } from './pages/Home';
import { AccountGate } from './components/AccountGate';
const CreateRoom = lazy(() => import('./pages/CreateRoom').then(m => ({ default: m.CreateRoom })));
const Room = lazy(() => import('./pages/Room').then(m => ({ default: m.Room })));

const LiveTV = lazy(() => import('./pages/LiveTV').then(m => ({ default: m.LiveTV })));

export default function App() {
  return <AuthProvider><BrowserRouter>
    <a className="skip-link" href="#main">Skip to content</a><Navbar />
    <main id="main"><Suspense fallback={<p className="loading-state" role="status">Loading…</p>}>
      <Routes>
        <Route path="/live" element={<LiveTV />} />
        <Route path="/" element={<Home />} /><Route path="/create" element={<AccountGate><CreateRoom /></AccountGate>} />
        <Route path="/room/:roomId" element={<AccountGate><Room /></AccountGate>} />
        <Route path="/account" element={<AccountGate><Navigate to="/" replace /></AccountGate>} />
        <Route path="*" element={<section className="setup-wrap panel form-panel"><h1>Page not found</h1><Link className="back-link" to="/">Return to lobby</Link></section>} />
      </Routes>
    </Suspense></main>
  </BrowserRouter></AuthProvider>;
}
