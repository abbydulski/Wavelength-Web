'use client'
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '../../../components/Layout';
import { useAuth } from '../../../hooks/useAuth';
import { auth, db, storage } from '../../../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

export default function SettingsPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setPhotoURL(user.photoURL || '');
    }
  }, [user]);

  const handleChooseFile = () => fileInputRef.current?.click();

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
        const filename = `profiles/${user.uid}/avatar_${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filename);
        const snap = await uploadBytes(storageRef, file);
        finalPhotoURL = await getDownloadURL(snap.ref);
      }

      // Update Auth profile
      await updateProfile(auth.currentUser, {
        displayName: displayName.trim(),
        photoURL: finalPhotoURL || null,
      });

      // Update Firestore user document
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim(),
        bio: bio.trim(),
        photoURL: finalPhotoURL || '',
        updatedAt: new Date().toISOString(),
      });

      await refreshUser();
      router.push('/profile');
    } catch (err) {
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
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
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
      </div>
    </Layout>
  );
}


