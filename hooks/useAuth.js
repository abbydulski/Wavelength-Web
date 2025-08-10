'use client'
import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile 
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  addDoc, 
  collection, 
  deleteDoc,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Get additional user data from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        
        setUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          ...userData
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const refreshUser = async () => {
    if (auth.currentUser) {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();
      
      setUser({
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        displayName: auth.currentUser.displayName,
        photoURL: auth.currentUser.photoURL,
        ...userData
      });
    }
  };

  const followUser = async (targetUserId) => {
    if (!user || user.uid === targetUserId) return false;

    try {
      // Add targetUserId to current user's following list
      await updateDoc(doc(db, 'users', user.uid), {
        following: arrayUnion(targetUserId)
      });

      // Add current user to target user's followers list
      await updateDoc(doc(db, 'users', targetUserId), {
        followers: arrayUnion(user.uid)
      });

      // Refresh current user data to update UI
      await refreshUser();
      
      return true;
    } catch (error) {
      console.error('Error following user:', error);
      return false;
    }
  };

  const unfollowUser = async (targetUserId) => {
    if (!user || user.uid === targetUserId) return false;

    try {
      // Remove targetUserId from current user's following list
      await updateDoc(doc(db, 'users', user.uid), {
        following: arrayRemove(targetUserId)
      });

      // Remove current user from target user's followers list
      await updateDoc(doc(db, 'users', targetUserId), {
        followers: arrayRemove(user.uid)
      });

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
      const postRef = doc(db, 'posts', postId);
      // Remove from disagree if present, add to agree
      await updateDoc(postRef, {
        agreedBy: arrayUnion(user.uid),
        disagreedBy: arrayRemove(user.uid)
      });
      return true;
    } catch (error) {
      console.error('Error agreeing with post:', error);
      return false;
    }
  };

  const disagreeWithPost = async (postId) => {
    if (!user) return false;

    try {
      const postRef = doc(db, 'posts', postId);
      // Remove from agree if present, add to disagree
      await updateDoc(postRef, {
        disagreedBy: arrayUnion(user.uid),
        agreedBy: arrayRemove(user.uid)
      });
      return true;
    } catch (error) {
      console.error('Error disagreeing with post:', error);
      return false;
    }
  };

  const removeReaction = async (postId) => {
    if (!user) return false;

    try {
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        agreedBy: arrayRemove(user.uid),
        disagreedBy: arrayRemove(user.uid)
      });
      return true;
    } catch (error) {
      console.error('Error removing reaction:', error);
      return false;
    }
  };

  const getUserReaction = (post) => {
    if (!user || !post) return null;
    if (post?.agreedBy?.includes(user.uid)) return 'agree';
    if (post?.disagreedBy?.includes(user.uid)) return 'disagree';
    return null;
  };

  const addComment = async (postId, commentText) => {
    if (!user || !commentText.trim()) return false;

    try {
      const comment = {
        postId,
        userId: user.uid,
        username: user.displayName || 'User',
        userAvatar: user.photoURL || '',
        text: commentText.trim(),
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'comments'), comment);
      return true;
    } catch (error) {
      console.error('Error adding comment:', error);
      return false;
    }
  };

  const deletePost = async (postId) => {
    if (!user) return false;

    try {
      await deleteDoc(doc(db, 'posts', postId));
      return true;
    } catch (error) {
      console.error('Error deleting post:', error);
      return false;
    }
  };

  const signup = async (email, password, displayName) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName });
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', result.user.uid), {
        displayName,
        email,
        createdAt: new Date().toISOString(),
        bio: '',
        followers: [],
        following: [],
        postsCount: 0
      });
      
      return result.user;
    } catch (error) {
      throw error;
    }
  };

  const login = async (email, password) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
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
        const existing = await getDocs(query(collection(db, 'followRequests'), where('fromUserId', '==', user.uid), where('toUserId', '==', toUserId)));
        if (!existing.empty) return true;
        await addDoc(collection(db, 'followRequests'), {
          fromUserId: user.uid,
          toUserId,
          createdAt: new Date().toISOString(),
        });
        return true;
      } catch (e) {
        console.error('Error sending follow request', e);
        return false;
      }
    },
    cancelFollowRequest: async (toUserId) => {
      if (!user) return false;
      try {
        const snap = await getDocs(query(collection(db, 'followRequests'), where('fromUserId', '==', user.uid), where('toUserId', '==', toUserId)));
        const batchDeletes = snap.docs.map(d => deleteDoc(d.ref));
        await Promise.all(batchDeletes);
        return true;
      } catch (e) {
        console.error('Error cancelling follow request', e);
        return false;
      }
    },
    acceptFollowRequest: async (fromUserId) => {
      if (!user) return false;
      try {
        // Add to following/followers
        await updateDoc(doc(db, 'users', user.uid), { followers: arrayUnion(fromUserId) });
        await updateDoc(doc(db, 'users', fromUserId), { following: arrayUnion(user.uid) });
        // Remove pending request
        const snap = await getDocs(query(collection(db, 'followRequests'), where('fromUserId', '==', fromUserId), where('toUserId', '==', user.uid)));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
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
        const snap = await getDocs(query(collection(db, 'followRequests'), where('fromUserId', '==', fromUserId), where('toUserId', '==', user.uid)));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
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