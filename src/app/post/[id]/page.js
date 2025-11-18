'use client'
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Layout from '../../../../components/Layout';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../hooks/useAuth';
import Image from 'next/image';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params || {};
  const search = useSearchParams();
  const isAnon = (search?.get('anon') === '1');
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);
  const { user, agreeWithPost, disagreeWithPost, removeReaction, getUserReaction, deletePost } = useAuth();
  const shareUrl = useMemo(() => (typeof window !== 'undefined' ? window.location.href : ''), []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .eq('id', id)
          .single();

        if (error || !data) {
          router.replace('/');
          return;
        }

        // Transform to expected format
        setPost({
          id: data.id,
          userId: data.user_id,
          username: data.username,
          userAvatar: data.user_avatar,
          caption: data.caption,
          location: data.location,
          coordinates: data.coordinates,
          rating: data.rating,
          category: data.category,
          photos: data.photos,
          isPublic: data.is_public,
          createdAt: data.created_at,
          agreedBy: data.agreed_by || [],
          disagreedBy: data.disagreed_by || []
        });
      } catch (error) {
        console.error('Error fetching post:', error);
        router.replace('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  useEffect(() => {
    if (!id) return;

    const fetchComments = async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching comments:', error);
        return;
      }

      const transformedComments = data.map(c => ({
        id: c.id,
        postId: c.post_id,
        userId: c.user_id,
        username: c.username,
        userAvatar: c.user_avatar,
        text: c.text,
        createdAt: c.created_at
      }));

      setComments(transformedComments);
    };

    fetchComments();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('comments-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${id}` },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const userReaction = getUserReaction(post);

  const handleAgree = async () => {
    if (!post) return;
    if (userReaction === 'agree') {
      await removeReaction(post.id);
    } else {
      await agreeWithPost(post.id);
    }
  };

  const handleDisagree = async () => {
    if (!post) return;
    if (userReaction === 'disagree') {
      await removeReaction(post.id);
    } else {
      await disagreeWithPost(post.id);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim() || !user || !post) return;
    setCommenting(true);
    try {
      const newComment = {
        postId: post.id,
        userId: user.uid,
        username: user.displayName || 'User',
        userAvatar: user.photoURL || '',
        text: commentText.trim(),
        createdAt: new Date().toISOString(),
      };
      await addDoc(collection(db, 'comments'), newComment);
      setCommentText('');
    } finally {
      setCommenting(false);
    }
  };

  const handleDelete = async () => {
    if (!post || !user || post.userId !== user.uid) return;
    const ok = confirm('Delete this post?');
    if (!ok) return;
    const success = await deletePost(post.id);
    if (success) router.replace('/profile');
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {loading ? (
          <div className="text-center text-gray-600">Loading…</div>
        ) : (
          post && (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="relative w-full bg-black">
                <div className="w-full" style={{position:'relative', paddingTop:'75%'}}>
                  <Image src={post.photos?.[0]} alt="post" fill className="object-contain bg-black" sizes="(max-width: 768px) 100vw, 800px" />
                </div>
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{isAnon ? 'Anonymous' : (post.username || 'User')}</div>
                  <div className="text-sm">Rating: {post.rating}/10</div>
                </div>
                <div className="text-gray-800">{post.caption}</div>
                {post.location && (
                  <div className="text-sm text-gray-500">📍 {post.location}</div>
                )}
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (navigator?.share) {
                        try { await navigator.share({ title: 'Wavelength Post', url: shareUrl }); } catch {}
                      } else {
                        await navigator.clipboard.writeText(shareUrl);
                        alert('Link copied');
                      }
                    }}
                    className="text-sm px-3 py-1.5 rounded border hover:bg-gray-50"
                  >
                    Share
                  </button>
                </div>

                {/* Reactions */}
                <div className="pt-3 flex items-center gap-3 border-t border-gray-100 mt-2">
                  <button onClick={handleAgree} className={`px-4 py-2 rounded-lg border ${userReaction==='agree'?'bg-green-500 text-white border-green-500':'text-green-600 border-green-500 hover:bg-green-50'}`}>Agree {post.agreedBy?.length>0?`(${post.agreedBy.length})`:''}</button>
                  <button onClick={handleDisagree} className={`px-4 py-2 rounded-lg border ${userReaction==='disagree'?'bg-red-500 text-white border-red-500':'text-red-600 border-red-500 hover:bg-red-50'}`}>Disagree {post.disagreedBy?.length>0?`(${post.disagreedBy.length})`:''}</button>
                  {user && post.userId === user.uid && (
                    <button onClick={handleDelete} className="ml-auto px-3 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">Delete</button>
                  )}
                </div>
              </div>

              {/* Comments */}
              <div className="px-4 pb-4">
                <h3 className="font-semibold mt-2 mb-2">Comments</h3>
                <form onSubmit={handleAddComment} className="flex gap-2 mb-3">
                  <input
                    value={commentText}
                    onChange={(e)=>setCommentText(e.target.value)}
                    placeholder="Add a comment…"
                    className="flex-1 border rounded px-3 py-2"
                  />
                  <button disabled={commenting || !commentText.trim()} className={`px-4 py-2 rounded text-white ${commenting?'bg-indigo-400':'bg-indigo-600 hover:bg-indigo-700'}`}>{commenting?'Posting…':'Post'}</button>
                </form>

                <div className="space-y-3">
                  {comments.length===0 ? (
                    <div className="text-sm text-gray-500">No comments yet</div>
                  ) : (
                    comments.map(c => (
                      <div key={c.id} className="flex items-start gap-3">
                        <img src={c.userAvatar || 'https://via.placeholder.com/32'} alt="avatar" className="w-8 h-8 rounded-full" />
                        <div>
                          <div className="text-sm"><span className="font-semibold">{c.username}</span> {c.text}</div>
                          <div className="text-xs text-gray-500">{new Date(c.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </Layout>
  );
}


