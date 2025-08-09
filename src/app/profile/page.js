'use client'
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import { useAuth } from '../../../hooks/useAuth';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, deletePost } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'posts'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            <img src={user?.photoURL || 'https://via.placeholder.com/80'} alt="avatar" className="w-16 h-16 rounded-full" />
            <div>
              <div className="text-2xl font-bold">{user?.displayName || 'User'}</div>
              <div className="text-gray-500">{user?.email}</div>
              <div className="text-sm text-gray-600 mt-2">
                <span className="mr-4">Followers: {user?.followers?.length || 0}</span>
                <span>Following: {user?.following?.length || 0}</span>
              </div>
            </div>
            <div className="ml-auto">
              <Link href="/settings" className="px-3 py-2 rounded border hover:bg-gray-50">Edit Profile</Link>
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-gray-600">Loading…</div>
          ) : posts.length === 0 ? (
            <div className="text-center text-gray-600">No posts yet</div>
          ) : (
            posts.map(p => (
              <div key={p.id} className="bg-white rounded-lg shadow-sm overflow-hidden relative">
                <img src={p.photos?.[0]} alt="post" className="w-full h-72 object-cover" />
                <div className="p-4">
                  <div className="font-semibold mb-1">{p.caption}</div>
                  <div className="text-sm text-gray-500">{p.location}</div>
                </div>
                <div className="absolute top-3 right-3">
                  <button
                    onClick={async () => {
                      const ok = confirm('Delete this post?');
                      if (!ok) return;
                      const success = await deletePost(p.id);
                      if (success) setPosts(curr => curr.filter(x => x.id !== p.id));
                    }}
                    className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}


