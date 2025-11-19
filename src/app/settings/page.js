'use client'
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../../components/Layout';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const { user, refreshUser, acceptFollowRequest, declineFollowRequest } = useAuth();
  const [incoming, setIncoming] = useState([]);

  // Incoming follow requests list
  useEffect(() => {
    if (!user) return;

    const fetchRequests = async () => {
      const { data: requests, error } = await supabase
        .from('follow_requests')
        .select(`
          id,
          from_user_id,
          created_at,
          users!follow_requests_from_user_id_fkey (
            display_name,
            photo_url
          )
        `)
        .eq('to_user_id', user.uid);

      if (error) {
        console.error('Error fetching requests:', error);
        return;
      }

      const enriched = requests.map(r => ({
        id: r.id,
        fromUserId: r.from_user_id,
        fromName: r.users?.display_name || 'User',
        fromPhoto: r.users?.photo_url || '',
        createdAt: r.created_at
      }));

      setIncoming(enriched);
    };

    fetchRequests();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('follow-requests-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'follow_requests', filter: `to_user_id=eq.${user.uid}` },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasPreview, setHasPreview] = useState(false); // Track if user selected a new photo
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user && !hasPreview) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setPhotoURL(user.photoURL || '');
    }
  }, [user, hasPreview]);

  const handleChooseFile = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setHasPreview(true); // Prevent user data from overwriting preview
      // Show preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoURL(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (!user) return;
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }
    setSaving(true);
    try {
      let finalPhotoURL = photoURL;
      if (file) {
        console.log('🔵 Step 1: Uploading file...', file.name);
        const filename = `${user.uid}/avatar_${Date.now()}_${file.name}`;

        const { data, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filename, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.error('❌ Upload error:', uploadError);
          throw new Error(`Upload failed: ${uploadError.message}`);
        }

        console.log('✅ Step 2: Upload successful! Data:', data);

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filename);

        console.log('✅ Step 3: Got public URL:', urlData.publicUrl);
        finalPhotoURL = urlData.publicUrl;
      }

      console.log('🔵 Step 4: Updating user profile in database...');
      // Update user profile in database
      const { error: updateError } = await supabase
        .from('users')
        .update({
          display_name: displayName.trim(),
          bio: bio.trim(),
          photo_url: finalPhotoURL || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.uid);

      if (updateError) {
        console.error('❌ Database update error:', updateError);
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      console.log('✅ Step 5: Database updated!');

      console.log('🔵 Step 6: Updating auth metadata...');
      // Update auth metadata (non-blocking)
      try {
        await supabase.auth.updateUser({
          data: {
            display_name: displayName.trim(),
            photo_url: finalPhotoURL || ''
          }
        });
        console.log('✅ Step 7: Auth metadata updated!');
      } catch (authErr) {
        console.warn('⚠️ Auth metadata update failed (non-critical):', authErr);
        // Continue anyway - database is the source of truth
      }

      // Update references in posts and comments to keep avatars consistent
      console.log('🔵 Step 8: Updating posts and comments...');
      try {
        const newName = displayName.trim();
        const newAvatar = finalPhotoURL || '';

        await supabase
          .from('posts')
          .update({ username: newName, user_avatar: newAvatar })
          .eq('user_id', user.uid);

        await supabase
          .from('comments')
          .update({ username: newName, user_avatar: newAvatar })
          .eq('user_id', user.uid);

        console.log('✅ Step 9: Posts/comments updated!');
      } catch (updateErr) {
        console.warn('⚠️ Non-critical: Failed to update posts/comments:', updateErr);
        // Non-blocking: if this fails, new posts still show the latest avatar
      }

      console.log('🔵 Step 10: Refreshing user data...');

      // Refresh user data (with timeout protection)
      try {
        const refreshPromise = refreshUser();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Refresh timeout')), 3000)
        );
        await Promise.race([refreshPromise, timeoutPromise]);
        console.log('✅ Step 11: User data refreshed!');
      } catch (refreshErr) {
        console.warn('⚠️ Refresh timed out or failed (non-critical):', refreshErr);
        // Continue anyway - page reload will show updated data
      }

      // Reset preview flag and update local state
      setHasPreview(false);
      setPhotoURL(finalPhotoURL);
      setFile(null);

      console.log('🎉 SUCCESS! Profile saved! Redirecting to profile...');
      router.push('/profile');
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <form onSubmit={handleSave} className="bg-white rounded-lg shadow-sm p-6 space-y-5">
          <h1 className="text-2xl font-bold">Edit Profile</h1>
          {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded">{error}</div>}

          <div className="flex items-center gap-4">
            <img src={photoURL || 'https://via.placeholder.com/96'} alt="avatar" className="w-16 h-16 rounded-full object-cover" />
            <div className="space-x-2">
              <button type="button" onClick={handleChooseFile} className="px-3 py-2 border rounded hover:bg-gray-50">Change Photo</button>
              {file && <span className="text-sm text-gray-600">{file.name}</span>}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Display Name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full border rounded px-3 py-2" maxLength={30} />
            <div className="text-right text-xs text-gray-500">{displayName.length}/30</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Bio</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full border rounded px-3 py-2" rows={4} maxLength={150} />
            <div className="text-right text-xs text-gray-500">{bio.length}/150</div>
          </div>

          <div className="flex gap-3">
            <button disabled={saving} className={`px-4 py-2 rounded text-white ${saving ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>{saving ? 'Saving…' : 'Save Changes'}</button>
            <button type="button" onClick={() => router.push('/profile')} className="px-4 py-2 rounded border hover:bg-gray-50">Cancel</button>
          </div>
        </form>

        {incoming.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
            <h2 className="text-lg font-semibold mb-3">Friend Requests</h2>
            <ul className="space-y-2">
              {incoming.map(r => (
                <li key={r.id} className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-2">
                    {r.fromPhoto ? <img src={r.fromPhoto} alt="avatar" className="w-6 h-6 rounded-full" /> : <span>👤</span>}
                    Request from {r.fromName}
                  </span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={async()=>{ await acceptFollowRequest(r.fromUserId); }} className="px-2 py-1 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700">Accept</button>
                    <button type="button" onClick={async()=>{ await declineFollowRequest(r.fromUserId); }} className="px-2 py-1 text-xs rounded border hover:bg-gray-50">Decline</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
}


