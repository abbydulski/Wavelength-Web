'use client'
import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import Link from 'next/link';
import Image from 'next/image';

// Temporary simple components - we'll make these fancier later
function RatingDisplay({ rating }) {
  const getRatingColor = (rating) => {
    if (rating >= 8) return 'bg-green-500';
    if (rating >= 6) return 'bg-yellow-500'; 
    if (rating >= 4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className={`${getRatingColor(rating)} text-white px-3 py-1 rounded-full text-sm font-bold flex items-center`}>
      <span className="mr-1">⭐</span>
      {rating}/10
    </div>
  );
}

function ReactionButtons({ post }) {
  const { agreeWithPost, disagreeWithPost, removeReaction, getUserReaction } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const userReaction = getUserReaction(post);
  const agreeCount = post?.agreedBy?.length || 0;
  const disagreeCount = post?.disagreedBy?.length || 0;
  
  const handleAgree = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
      if (userReaction === 'agree') {
        await removeReaction(post.id);
      } else {
        await agreeWithPost(post.id);
      }
    } catch (error) {
      console.error('Error handling agree:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDisagree = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
      if (userReaction === 'disagree') {
        await removeReaction(post.id);
      } else {
        await disagreeWithPost(post.id);
      }
    } catch (error) {
      console.error('Error handling disagree:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleAgree}
        disabled={loading}
        className={`px-4 py-2 rounded-lg border transition-colors ${
          userReaction === 'agree' 
            ? 'bg-green-500 text-white border-green-500' 
            : 'bg-white text-green-500 border-green-500 hover:bg-green-50'
        }`}
      >
        Agree {agreeCount > 0 && `(${agreeCount})`}
      </button>
      
      <button
        onClick={handleDisagree}
        disabled={loading}
        className={`px-4 py-2 rounded-lg border transition-colors ${
          userReaction === 'disagree' 
            ? 'bg-red-500 text-white border-red-500' 
            : 'bg-white text-red-500 border-red-500 hover:bg-red-50'
        }`}
      >
        Disagree {disagreeCount > 0 && `(${disagreeCount})`}
      </button>
    </div>
  );
}

export default function Feed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { user } = useAuth();

  const categories = [
    { id: 'all', name: 'All', icon: '🏠' },
    { id: 'food', name: 'Food', icon: '🍽️' },
    { id: 'travel', name: 'Travel', icon: '✈️' },
    { id: 'entertainment', name: 'Fun', icon: '🎵' },
    { id: 'shopping', name: 'Shopping', icon: '🛍️' },
    { id: 'fitness', name: 'Fitness', icon: '💪' },
    { id: 'work', name: 'Work', icon: '💼' },
    { id: 'social', name: 'Social', icon: '👥' },
    { id: 'other', name: 'Other', icon: '⭐' },
  ];

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allPosts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter to show only posts from friends (people you follow) + your own posts
      const friendsPosts = allPosts.filter(post => {
        return post.userId === user.uid || // Your own posts
               (user.following && user.following.includes(post.userId)); // Friends' posts
      });
      
      setPosts(friendsPosts);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const filteredPosts = selectedCategory === 'all' 
    ? posts 
    : posts.filter(post => post.category === selectedCategory);

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - postTime) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <span className="ml-3 text-gray-600">Loading your feed...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Category Filter */}
      <div className="bg-white rounded-lg shadow-sm mb-6 p-4">
        <div className="flex space-x-2 overflow-x-auto">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-full whitespace-nowrap transition-colors ${
                selectedCategory === category.id
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{category.icon}</span>
              <span className="text-sm font-medium">{category.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-6">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <div className="text-6xl mb-4">👥</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No posts from friends</h3>
            <p className="text-gray-600 mb-6">Follow some friends to see their posts here!</p>
            <a
              href="/search"
              className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Find Friends
            </a>
          </div>
        ) : (
          filteredPosts.map(post => (
            <div key={post.id} className="bg-white rounded-xl shadow-sm overflow-hidden ring-1 ring-gray-100 hover:shadow-md transition-shadow">
              {/* Post Header */}
              <div className="flex items-center justify-between p-4">
                <a href={`/user/${post.userId}`} className="flex items-center space-x-3 hover:opacity-90">
                  <img
                    src={post.userAvatar || 'https://via.placeholder.com/40'}
                    alt={post.username}
                    className="w-10 h-10 rounded-full"
                  />
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="font-bold text-gray-900">{post.username}</h3>
                      {!post.isPublic && (
                        <span className="text-gray-500 text-sm">👥</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">{formatTimeAgo(post.createdAt)}</p>
                  </div>
                </a>
                <RatingDisplay rating={post.rating} />
              </div>

              {/* Post Image */}
              <div className="relative w-full h-80">
                <Image
                  src={post.photos[0]}
                  alt="Post"
                  fill
                  sizes="(max-width: 768px) 100vw, 800px"
                  className="object-cover transform-gpu hover:scale-[1.01] transition-transform"
                  priority={false}
                />
              </div>

              {/* Post Content */}
              <div className="p-5">
                <p className="text-gray-800 mb-3">{post.caption}</p>
                
                {post.location && (
                  <div className="flex items-center text-gray-500 text-sm mb-2">
                    <span className="mr-1">📍</span>
                    {post.location}
                  </div>
                )}

                {post.category && (
                  <div className="inline-block bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg text-xs font-medium mb-4">
                    {categories.find(c => c.id === post.category)?.name || post.category}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <ReactionButtons post={post} />
                  <div className="flex items-center space-x-4">
                    <Link href={`/post/${post.id}`} className="text-indigo-600 hover:underline text-sm">View</Link>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}