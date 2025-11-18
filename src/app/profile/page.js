'use client'
import { useEffect, useState } from 'react';
import Layout from '../../../components/Layout';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../lib/supabase';
import Link from 'next/link';

export default function ProfilePage() {
  const { user, deletePost } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchPosts = async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.uid)
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
      .channel('my-posts-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'posts', filter: `user_id=eq.${user.uid}` },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
            <div className="ml-auto flex items-center gap-2">
              <Link href="/settings" className="px-3 py-2 rounded border hover:bg-gray-50">Edit Profile</Link>
              <button
                onClick={async () => {
                  if (!user) return;
                  setSyncing(true);
                  try {
                    const newName = user.displayName || 'User';
                    const newAvatar = user.photoURL || '';

                    await supabase
                      .from('posts')
                      .update({ username: newName, user_avatar: newAvatar })
                      .eq('user_id', user.uid);

                    await supabase
                      .from('comments')
                      .update({ username: newName, user_avatar: newAvatar })
                      .eq('user_id', user.uid);

                    alert('Profile synced to your posts and comments');
                  } catch (e) {
                    alert('Failed to sync profile to posts.');
                  } finally {
                    setSyncing(false);
                  }
                }}
                disabled={syncing}
                className={`px-3 py-2 rounded border ${syncing ? 'bg-gray-100 text-gray-500' : 'hover:bg-gray-50'}`}
              >
                {syncing ? 'Syncing…' : 'Sync Profile to Posts'}
              </button>
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


