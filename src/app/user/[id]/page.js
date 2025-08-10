'use client'
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Layout from '../../../../components/Layout';
import { db } from '../../../../lib/firebase';
import { collection, doc, getDoc, onSnapshot, orderBy, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../../../hooks/useAuth';
import Link from 'next/link';

export default function UserProfilePage() {
  const params = useParams();
  const userId = params?.id;
  const { user: currentUser, isFollowing, sendFollowRequest, cancelFollowRequest } = useAuth();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);
  const [pending, setPending] = useState(false);

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
  const isSelf = currentUser?.uid === userId;

  // No direct follow; always request first. Unfollow can be restored later if needed.

  // Check if there's a pending request from current to viewed user
  useEffect(() => {
    if (!currentUser || !userId) return;
    (async () => {
      const snap = await getDocs(query(collection(db, 'followRequests'), where('fromUserId', '==', currentUser.uid), where('toUserId', '==', userId)));
      setPending(!snap.empty);
    })();
  }, [currentUser, userId]);

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
              ) : following ? (
                <span className="text-sm text-gray-600">Friends</span>
              ) : pending ? (
                <button onClick={async ()=>{ setFollowBusy(true); await cancelFollowRequest(userId); setFollowBusy(false); setPending(false); }} disabled={followBusy} className={`px-3 py-2 rounded border ${followBusy ? 'bg-gray-100 text-gray-500' : 'hover:bg-gray-50'}`}>Cancel Request</button>
              ) : (
                <button onClick={async ()=>{ setFollowBusy(true); await sendFollowRequest(userId); setFollowBusy(false); setPending(true); }} disabled={followBusy} className={`px-3 py-2 rounded bg-indigo-600 text-white ${followBusy ? '' : 'hover:bg-indigo-700'}`}>Add Friend</button>
              )}
            </div>
          </div>
        </div>

        {/* Posts */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-gray-600">Loading…</div>
          ) : !isSelf && !following ? (
            <div className="text-center text-gray-600">Posts are hidden until your friend request is accepted.</div>
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


