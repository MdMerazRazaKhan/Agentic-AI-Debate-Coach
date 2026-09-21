"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import AuthModal from './AuthModal';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingRoute, setPendingRoute] = useState(null);
  const [userInitial, setUserInitial] = useState('D');
  const [isCoach, setIsCoach] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const checkLoginStatus = () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('logos_ai_jwt') : null;
      setIsLoggedIn(!!token);
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const role = (payload.role || '').toLowerCase();
          setIsCoach(role.includes('coach') || role.includes('educator'));
          const cachedName = localStorage.getItem('logos_ai_user_name');
          if (cachedName && cachedName.trim() && !cachedName.toLowerCase().includes('hardwill')) {
            setUserInitial(cachedName.trim().charAt(0).toUpperCase());
          } else {
            const resolvedName = payload.full_name || (payload.sub ? (payload.sub.toLowerCase().includes('dayan') ? 'Dayan' : payload.sub.split('@')[0]) : 'User');
            setUserInitial(resolvedName.trim().charAt(0).toUpperCase());
          }
        } catch (e) {
          const cachedName = typeof window !== 'undefined' ? localStorage.getItem('logos_ai_user_name') : null;
          if (cachedName && cachedName.trim()) {
            setUserInitial(cachedName.trim().charAt(0).toUpperCase());
          }
        }
        fetchNotifications();
      }
    };

    checkLoginStatus();
    
    // Set interval to poll notifications periodically
    const interval = setInterval(checkLoginStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/notifications/my-alerts");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      // Offline fallback values
      setNotifications([
        {
          id: 1,
          category: "Session Reminder",
          title: "Upcoming Debate Match",
          message: "Your debate session on 'AI Governance' is scheduled in 30 minutes.",
          timestamp: "Just now",
          read: false
        },
        {
          id: 2,
          category: "Feedback Alert",
          title: "Analysis Ready",
          message: "Coach Sofia Vance left detailed feedback on your last debate rebuttal.",
          timestamp: "2 hours ago",
          read: false
        }
      ]);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await fetch(`http://localhost:8000/api/v1/notifications/read/${id}`, {
        method: "POST"
      });
    } catch (err) {}
    
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const handleLogout = () => {
    localStorage.removeItem('logos_ai_jwt');
    setIsLoggedIn(false);
    setShowDropdown(false);
    router.push('/');
  };

  const handleAuthSuccess = () => {
    setIsLoggedIn(true);
    setIsAuthModalOpen(false);
    if (pendingRoute) {
      router.push(pendingRoute);
      setPendingRoute(null);
    }
  };

  const handleProtectedNav = (e, targetRoute) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('logos_ai_jwt') : null;
    if (!token) {
      if (e && e.preventDefault) e.preventDefault();
      setPendingRoute(targetRoute);
      setIsAuthModalOpen(true);
      return false;
    }
    return true;
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <>
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onAuthSuccess={handleAuthSuccess}
      />

      <nav className="navbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 3rem', background: '#fff', borderBottom: '1px solid #e5e5eb', position: 'sticky', top: 0, zIndex: 1000 }}>
        <Link href="/" className="brand-logo" style={{ fontFamily: "'Outfit', sans-serif", fontSize: '1.5rem', fontWeight: 900, color: '#000' }}>
          LOGOS.AI
        </Link>

        {/* Nav Links: DEBATE SIMULATION, PRESENTATION-ANALYSIS, ARGUMENT-ANALYSIS, FALLACY-DETECTOR, COUNTER-ARGUMENT */}
        <div className="nav-links" style={{ display: 'flex', gap: '1.2rem', alignItems: 'center' }}>
          <Link 
            href="/simulation" 
            onClick={(e) => handleProtectedNav(e, '/simulation')}
            className={`nav-link ${pathname === '/simulation' ? 'active' : ''}`}
          >
            DEBATE SIMULATION
          </Link>
          <Link 
            href="/presentation-analysis" 
            onClick={(e) => handleProtectedNav(e, '/presentation-analysis')}
            className={`nav-link ${pathname === '/presentation' || pathname === '/presentation-analysis' ? 'active' : ''}`}
          >
            PRESENTATION-ANALYSIS
          </Link>
          <Link 
            href="/argument-analysis" 
            className={`nav-link ${pathname === '/argument-analysis' ? 'active' : ''}`}
          >
            ARGUMENT-ANALYSIS
          </Link>
          <Link 
            href="/fallacy-detector" 
            className={`nav-link ${pathname === '/fallacy-detector' ? 'active' : ''}`}
          >
            FALLACY-DETECTOR
          </Link>
          <Link 
            href="/counter-argument" 
            className={`nav-link ${pathname === '/counter-argument' ? 'active' : ''}`}
          >
            COUNTER-ARGUMENT
          </Link>
        </div>

        {/* Actions / Notifications & Red Dashboard Box */}
        <div className="nav-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          
          {/* Interactive Notification Bell */}
          {isLoggedIn && (
            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowDropdown(!showDropdown)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', position: 'relative', padding: '0.25rem' }}
              >
                🔔
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: 0, right: 0, background: 'var(--accent-red)', color: '#fff', fontSize: '0.65rem', fontWeight: 800, padding: '0.15rem 0.35rem', borderRadius: '50%' }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Drawer */}
              {showDropdown && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', width: '320px', background: '#fff', border: '1px solid #e5e5eb', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e5eb', paddingBottom: '0.5rem' }}>
                    <strong style={{ fontSize: '0.88rem' }}>NOTIFICATIONS ({unreadCount})</strong>
                    <button 
                      onClick={() => {
                        notifications.forEach(n => handleMarkAsRead(n.id));
                      }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-red)', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Clear All
                    </button>
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: '#6B7280', textAlign: 'center', padding: '1.5rem 0' }}>
                      No active notifications.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {notifications.map((notif) => (
                        <div 
                          key={notif.id} 
                          onClick={() => handleMarkAsRead(notif.id)}
                          style={{ 
                            padding: '0.6rem 0.75rem', 
                            background: notif.read ? '#fff' : '#F9FAFB', 
                            borderLeft: `3px solid ${notif.read ? '#e5e5eb' : 'var(--accent-red)'}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.15rem' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--accent-red)', fontWeight: 800, textTransform: 'uppercase' }}>
                              {notif.category}
                            </span>
                            <span style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>{notif.timestamp}</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', fontWeight: notif.read ? 500 : 700, color: '#111827', marginBottom: '0.1rem' }}>
                            {notif.title}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#4B5563', lineHeight: '1.3' }}>
                            {notif.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Red/Dark Dashboard Box with User Initial Squircle */}
          {isLoggedIn ? (
            <Link 
              href="/dashboard"
              className="dash-action-btn"
              style={{
                background: isCoach ? '#111827' : '#D90429',
                color: '#FFFFFF',
                padding: '0.45rem 1.1rem 0.45rem 0.55rem',
                borderRadius: '8px',
                fontWeight: 800,
                fontSize: '0.8rem',
                letterSpacing: '0.04em',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.6rem',
                boxShadow: isCoach ? '0 2px 8px rgba(17, 24, 39, 0.25)' : '0 2px 8px rgba(217, 4, 41, 0.25)',
                transition: 'all 0.18s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = isCoach ? '#000000' : '#B00320'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = isCoach ? '#111827' : '#D90429'; }}
              title={isCoach ? "Open Debate Coach Dashboard" : "Open User Dashboard"}
            >
              {/* User Initial Squircle with curved edges */}
              <span style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                background: '#FFFFFF',
                color: isCoach ? '#111827' : '#D90429',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '0.9rem',
                fontFamily: "'Inter', sans-serif",
                lineHeight: 1
              }}>
                {userInitial}
              </span>
              <span>{isCoach ? 'COACH DASHBOARD' : 'DASHBOARD'}</span>
            </Link>
          ) : (
            <>
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="btn btn-login" 
                style={{ padding: '0.55rem 1.25rem', border: '1px solid #e5e5eb', borderRadius: '8px', background: 'transparent', color: '#000', textTransform: 'uppercase', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Login
              </button>
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="btn btn-dark" 
                style={{ padding: '0.55rem 1.25rem', borderRadius: '8px', background: '#18181b', color: '#fff', textTransform: 'uppercase', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Sign Up
              </button>
            </>
          )}
        </div>
      </nav>
    </>
  );
}
