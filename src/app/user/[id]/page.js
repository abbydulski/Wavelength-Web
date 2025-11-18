'use client'
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Layout from '../../../../components/Layout';
import { supabase } from '../../../../lib/supabase';
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
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching user:', error);
        return;
      }

      // Get follower/following counts
      const { data: followers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId);

      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      setProfile({
        id: data.id,
        displayName: data.display_name,
        email: data.email,
        bio: data.bio,
        photoURL: data.photo_url,
        followers: followers?.map(f => f.follower_id) || [],
        following: following?.map(f => f.following_id) || []
      });
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching posts:', error);
        setLoading(false);
        return;
      }

      const transformedPosts = data.map(p => ({
        id: p.id,
        userId: p.user_id,
        username: p.username,
        userAvatar: p.user_avatar,
        caption: p.caption,
        location: p.location,
        coordinates: p.coordinates,
        rating: p.rating,
        category: p.category,
        photos: p.photos,
        isPublic: p.is_public,
        createdAt: p.created_at
      }));

      setPosts(transformedPosts);
      setLoading(false);
    };

    fetchPosts();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('user-posts-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'posts', filter: `user_id=eq.${userId}` },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const canFollow = currentUser && currentUser.uid !== userId;
  const following = isFollowing(userId);
  const isSelf = currentUser?.uid === userId;

  // Check if there's a pending request from current to viewed user
  useEffect(() => {
    if (!currentUser || !userId) return;
    (async () => {
      const { data } = await supabase
        .from('follow_requests')
        .select('id')
        .eq('from_user_id', currentUser.uid)
        .eq('to_user_id', userId);

      setPending(data && data.length > 0);
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
                <button disabled className="px-3 py-2 rounded border bg-gray-100 text-gray-500 cursor-default">Requested</button>
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


