'use client'
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await loadUserData(session.user.id);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (userId) => {
    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      // Get followers and following counts
      const { data: followers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', userId);

      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId);

      setUser({
        uid: userId,
        email: userData.email,
        displayName: userData.display_name,
        photoURL: userData.photo_url,
        bio: userData.bio,
        createdAt: userData.created_at,
        postsCount: userData.posts_count,
        followers: followers?.map(f => f.follower_id) || [],
        following: following?.map(f => f.following_id) || []
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await loadUserData(authUser.id);
    }
  };

  // Updated: first interaction creates a follow request instead of immediate follow
  const followUser = async (targetUserId) => {
    if (!user || user.uid === targetUserId) return false;
    try {
      // If already following, nothing to do
      if (user.following?.includes(targetUserId)) return true;

      // Create request if not already pending
      const { data: existing } = await supabase
        .from('follow_requests')
        .select('id')
        .eq('from_user_id', user.uid)
        .eq('to_user_id', targetUserId)
        .single();

      if (existing) return true;

      const { error } = await supabase
        .from('follow_requests')
        .insert({
          from_user_id: user.uid,
          to_user_id: targetUserId
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error requesting follow:', error);
      return false;
    }
  };

  const unfollowUser = async (targetUserId) => {
    if (!user || user.uid === targetUserId) return false;

    try {
      // Delete the follow relationship
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.uid)
        .eq('following_id', targetUserId);

      if (error) throw error;

      // Refresh current user data to update UI
      await refreshUser();

      return true;
    } catch (error) {
      console.error('Error unfollowing user:', error);
      return false;
    }
  };

  const isFollowing = (targetUserId) => {
    return user?.following?.includes(targetUserId) || false;
  };

  const agreeWithPost = async (postId) => {
    if (!user) return false;

    try {
      // Get current post
      const { data: post } = await supabase
        .from('posts')
        .select('agreed_by, disagreed_by')
        .eq('id', postId)
        .single();

      const agreedBy = post?.agreed_by || [];
      const disagreedBy = post?.disagreed_by || [];

      // Remove from disagree if present, add to agree
      const newAgreedBy = [...agreedBy.filter(id => id !== user.uid), user.uid];
      const newDisagreedBy = disagreedBy.filter(id => id !== user.uid);

      const { error } = await supabase
        .from('posts')
        .update({
          agreed_by: newAgreedBy,
          disagreed_by: newDisagreedBy
        })
        .eq('id', postId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error agreeing with post:', error);
      return false;
    }
  };

  const disagreeWithPost = async (postId) => {
    if (!user) return false;

    try {
      // Get current post
      const { data: post } = await supabase
        .from('posts')
        .select('agreed_by, disagreed_by')
        .eq('id', postId)
        .single();

      const agreedBy = post?.agreed_by || [];
      const disagreedBy = post?.disagreed_by || [];

      // Remove from agree if present, add to disagree
      const newAgreedBy = agreedBy.filter(id => id !== user.uid);
      const newDisagreedBy = [...disagreedBy.filter(id => id !== user.uid), user.uid];

      const { error } = await supabase
        .from('posts')
        .update({
          agreed_by: newAgreedBy,
          disagreed_by: newDisagreedBy
        })
        .eq('id', postId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error disagreeing with post:', error);
      return false;
    }
  };

  const removeReaction = async (postId) => {
    if (!user) return false;

    try {
      // Get current post
      const { data: post } = await supabase
        .from('posts')
        .select('agreed_by, disagreed_by')
        .eq('id', postId)
        .single();

      const agreedBy = post?.agreed_by || [];
      const disagreedBy = post?.disagreed_by || [];

      const { error } = await supabase
        .from('posts')
        .update({
          agreed_by: agreedBy.filter(id => id !== user.uid),
          disagreed_by: disagreedBy.filter(id => id !== user.uid)
        })
        .eq('id', postId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing reaction:', error);
      return false;
    }
  };

  const getUserReaction = (post) => {
    if (!user || !post) return null;
    if (post?.agreed_by?.includes(user.uid)) return 'agree';
    if (post?.disagreed_by?.includes(user.uid)) return 'disagree';
    return null;
  };

  const addComment = async (postId, commentText) => {
    if (!user || !commentText.trim()) return false;

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.uid,
          username: user.displayName || 'User',
          user_avatar: user.photoURL || '',
          text: commentText.trim()
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error adding comment:', error);
      return false;
    }
  };

  const deletePost = async (postId) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.uid);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting post:', error);
      return false;
    }
  };

  const signup = async (email, password, displayName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName
          }
        }
      });

      if (error) throw error;

      // User profile is created automatically via database trigger
      return data.user;
    } catch (error) {
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      return data.user;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    signup,
    login,
    logout,
    loading,
    refreshUser,
    followUser,
    unfollowUser,
    isFollowing,
    agreeWithPost,
    disagreeWithPost,
    removeReaction,
    getUserReaction,
    addComment,
    deletePost,
    // Follow request helpers (MVP client-side)
    sendFollowRequest: async (toUserId) => {
      if (!user || user.uid === toUserId) return false;
      try {
        const { data: existing } = await supabase
          .from('follow_requests')
          .select('id')
          .eq('from_user_id', user.uid)
          .eq('to_user_id', toUserId)
          .single();

        if (existing) return true;

        const { error } = await supabase
          .from('follow_requests')
          .insert({
            from_user_id: user.uid,
            to_user_id: toUserId
          });

        if (error) throw error;
        return true;
      } catch (e) {
        console.error('Error sending follow request', e);
        return false;
      }
    },
    cancelFollowRequest: async (toUserId) => {
      if (!user) return false;
      try {
        const { error } = await supabase
          .from('follow_requests')
          .delete()
          .eq('from_user_id', user.uid)
          .eq('to_user_id', toUserId);

        if (error) throw error;
        return true;
      } catch (e) {
        console.error('Error cancelling follow request', e);
        return false;
      }
    },
    acceptFollowRequest: async (fromUserId) => {
      if (!user) return false;
      try {
        // Add to follows table
        const { error: followError } = await supabase
          .from('follows')
          .insert({
            follower_id: fromUserId,
            following_id: user.uid
          });

        if (followError) throw followError;

        // Remove pending request
        const { error: deleteError } = await supabase
          .from('follow_requests')
          .delete()
          .eq('from_user_id', fromUserId)
          .eq('to_user_id', user.uid);

        if (deleteError) throw deleteError;

        await refreshUser();
        return true;
      } catch (e) {
        console.error('Error accepting follow request', e);
        return false;
      }
    },
    declineFollowRequest: async (fromUserId) => {
      if (!user) return false;
      try {
        const { error } = await supabase
          .from('follow_requests')
          .delete()
          .eq('from_user_id', fromUserId)
          .eq('to_user_id', user.uid);

        if (error) throw error;
        return true;
      } catch (e) {
        console.error('Error declining follow request', e);
        return false;
      }
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}