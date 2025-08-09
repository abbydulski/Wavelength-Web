'use client'
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Layout from '../../../../components/Layout';
import { db } from '../../../../lib/firebase';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc } from 'firebase/firestore';
import { useAuth } from '../../../../hooks/useAuth';

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { id } = params || {};
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);
  const { user, agreeWithPost, disagreeWithPost, removeReaction, getUserReaction, deletePost } = useAuth();

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'posts', id));
        if (!snap.exists()) {
          router.replace('/');
          return;
        }
        setPost({ id: snap.id, ...snap.data() });
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'comments'), where('postId', '==', id), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
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
              <img src={post.photos?.[0]} alt="post" className="w-full h-96 object-cover" />
              <div className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{post.username || 'User'}</div>
                  <div className="text-sm">Rating: {post.rating}/10</div>
                </div>
                <div className="text-gray-800">{post.caption}</div>
                {post.location && (
                  <div className="text-sm text-gray-500">📍 {post.location}</div>
                )}

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


