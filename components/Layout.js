'use client'
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useRouter } from 'next/navigation';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { usePathname } from 'next/navigation';

export default function Layout({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen for incoming follow requests
  useEffect(() => {
    if (!user) { setPendingCount(0); return; }
    const q = query(collection(db, 'followRequests'), where('toUserId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => setPendingCount(snap.size));
    return () => unsub();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Redirect unauthenticated users to /login
  if (!user) {
    if (typeof window !== 'undefined') {
      router.replace('/login');
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Redirecting to login…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 text-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold flex items-center gap-2">
              <span>🌊</span>
              <span>Wavelength</span>
            </Link>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm">
                {user.displayName || user.email}
              </span>
              <Link href="/settings" className="bg-white/10 text-white hover:bg-white/20 px-3 py-1 rounded-lg text-sm border border-white/20 backdrop-blur transition">
                Settings
              </Link>
              {pendingCount > 0 && (
                <span className="text-xs bg-white/20 px-2 py-1 rounded">{pendingCount} request{pendingCount>1?'s':''}</span>
              )}
              <button
                onClick={handleLogout}
                className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg text-sm transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex space-x-8">
            <Link 
              href="/" 
              className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${pathname==='/'?'text-indigo-600 border-indigo-600':'text-gray-600 hover:text-indigo-600 border-transparent hover:border-indigo-600'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="font-medium">Feed</span>
            </Link>
            
            <Link 
              href="/search" 
              className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${pathname?.startsWith('/search')?'text-indigo-600 border-indigo-600':'text-gray-600 hover:text-indigo-600 border-transparent hover:border-indigo-600'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="font-medium">Search</span>
            </Link>
            
            <Link 
              href="/discover" 
              className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${pathname?.startsWith('/discover')?'text-indigo-600 border-indigo-600':'text-gray-600 hover:text-indigo-600 border-transparent hover:border-indigo-600'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 0c1.657 0 3 3.582 3 8s-1.343 8-3 8-3-3.582-3-8 1.343-8 3-8zm0 0c4.418 0 8 1.343 8 3s-3.582 3-8 3-8-1.343-8-3 3.582-3 8-3zm0 10c4.418 0 8 1.343 8 3s-3.582 3-8 3-8-1.343-8-3 3.582-3 8-3z" />
              </svg>
              <span className="font-medium">Discover</span>
            </Link>
            
            <Link 
              href="/create" 
              className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${pathname?.startsWith('/create')?'text-indigo-600 border-indigo-600':'text-gray-600 hover:text-indigo-600 border-transparent hover:border-indigo-600'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-medium">Create</span>
            </Link>
            
            <Link 
              href="/profile" 
              className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${pathname?.startsWith('/profile')?'text-indigo-600 border-indigo-600':'text-gray-600 hover:text-indigo-600 border-transparent hover:border-indigo-600'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="font-medium">Profile</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}