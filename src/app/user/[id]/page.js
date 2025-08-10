'use client'
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Layout from '../../../../components/Layout';
import { db } from '../../../../lib/firebase';
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useAuth } from '../../../../hooks/useAuth';
import Link from 'next/link';

export default function UserProfilePage() {
  const params = useParams();
  const userId = params?.id;
  const { user: currentUser, followUser, unfollowUser, isFollowing } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists()) setProfile({ id: snap.id, ...snap.data() });
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, 'posts'), where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [userId]);

  const canFollow = currentUser && currentUser.uid !== userId;
  const following = isFollowing(userId);

  const toggleFollow = async () => {
    if (!canFollow || followBusy) return;
    setFollowBusy(true);
    try {
      if (following) await unfollowUser(userId);
      else await followUser(userId);
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            <img src={profile?.photoURL || 'https://via.placeholder.com/80'} alt="avatar" className="w-16 h-16 rounded-full" />
            <div>
              <div className="text-2xl font-bold">{profile?.displayName || 'User'}</div>
              {profile?.bio && <div className="text-gray-600 text-sm mt-1">{profile.bio}</div>}
              <div className="text-sm text-gray-600 mt-2">
                <span className="mr-4">Followers: {profile?.followers?.length || 0}</span>
                <span>Following: {profile?.following?.length || 0}</span>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {currentUser?.uid === userId ? (
                <Link href="/profile" className="px-3 py-2 rounded border hover:bg-gray-50">Your Profile</Link>
              ) : (
                <button onClick={toggleFollow} disabled={followBusy} className={`px-3 py-2 rounded ${following ? 'border hover:bg-gray-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
                  {following ? (followBusy ? 'Unfollowing…' : 'Unfollow') : (followBusy ? 'Following…' : 'Follow')}
                </button>
              )}
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
            posts.map((p) => (
              <div key={p.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
                <img src={p.photos?.[0]} alt="post" className="w-full h-72 object-cover" />
                <div className="p-4">
                  <div className="font-semibold mb-1">{p.caption}</div>
                  <div className="text-sm text-gray-500">{p.location}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}


