'use client'
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../hooks/useAuth';

export default function SearchPage() {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const { user, followUser, unfollowUser, isFollowing, cancelFollowRequest } = useAuth();
  const [pendingMap, setPendingMap] = useState({});
  const [debounceId, setDebounceId] = useState(null);

  const runSearch = async () => {
    if (!term.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('displayName', '>=', term), where('displayName', '<=', term + '\uf8ff'));
      const snapshot = await getDocs(q);
      const users = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.id !== user?.uid);
      setResults(users);
    } finally {
      setLoading(false);
    }
  };

  // Debounced auto-search as you type
  useEffect(() => {
    if (debounceId) clearTimeout(debounceId);
    if (!term || term.trim().length < 2) {
      setResults([]);
      return;
    }
    const id = setTimeout(() => {
      runSearch();
    }, 300);
    setDebounceId(id);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  // Live-sync pending requests so results show "Requested" if already sent
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'followRequests'), where('fromUserId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data?.toUserId) map[data.toUserId] = true;
      });
      setPendingMap(map);
    });
    return () => unsub();
  }, [user]);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex gap-3">
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search users by name"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            />
            <button
              onClick={runSearch}
              className="px-5 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Search
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {loading && (
            <div className="text-center text-gray-600">Searching…</div>
          )}
          {!loading && results.length === 0 && term && (
            <div className="text-center text-gray-600">No users found</div>
          )}
          {results.map((u) => {
            const following = isFollowing(u.id);
            const pending = pendingMap[u.id];
            return (
              <div key={u.id} className="bg-white rounded-lg shadow-sm p-4 flex items-center justify-between">
                <a href={`/user/${u.id}`} className="flex items-center gap-3 hover:opacity-90">
                  <img src={u.photoURL || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full" alt={u.displayName} />
                  <div>
                    <div className="font-semibold">{u.displayName || 'User'}</div>
                    <div className="text-xs text-gray-500">Followers: {u.followers?.length || 0}</div>
                  </div>
                </a>
                {following ? (
                  <span className="text-sm text-gray-600">Friends</span>
                ) : pending ? (
                  <button onClick={async ()=>{ await cancelFollowRequest(u.id); setPendingMap(m=>({...m,[u.id]:false})); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Requested</button>
                ) : (
                  <button onClick={async ()=>{ await followUser(u.id); setPendingMap(m=>({...m,[u.id]:true})); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Follow</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}


