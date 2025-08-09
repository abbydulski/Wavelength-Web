'use client'
import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../../../components/Layout';
import { useAuth } from '../../../hooks/useAuth';
import { db, storage } from '../../../lib/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

const categories = [
  { id: 'food', name: 'Food' },
  { id: 'travel', name: 'Travel' },
  { id: 'entertainment', name: 'Fun' },
  { id: 'shopping', name: 'Shopping' },
  { id: 'fitness', name: 'Fitness' },
  { id: 'work', name: 'Work' },
  { id: 'social', name: 'Social' },
  { id: 'other', name: 'Other' },
];

export default function CreatePage() {
  const { user } = useAuth();
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [selectedPlace, setSelectedPlace] = useState(null); // { name, lat, lon }
  const [locating, setLocating] = useState(false);
  const [rating, setRating] = useState(5);
  const [isPublic, setIsPublic] = useState(true);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!file) return setError('Please select an image');
    if (!caption.trim()) return setError('Please enter a caption');
    if (!category) return setError('Please select a category');
    setLoading(true);
    try {
      // Upload image
      const filename = `posts/${user.uid}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, filename);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Prepare location fields
      const locationText = selectedPlace?.name || locationQuery.trim();
      const coordinates = selectedPlace
        ? { latitude: Number(selectedPlace.lat), longitude: Number(selectedPlace.lon) }
        : null;

      // Create Firestore post (schema aligned with mobile)
      await addDoc(collection(db, 'posts'), {
        userId: user.uid,
        username: user.displayName || 'User',
        userAvatar: user.photoURL || '',
        caption: caption.trim(),
        location: locationText,
        coordinates,
        rating,
        category,
        photos: [downloadURL],
        isPublic,
        createdAt: new Date().toISOString(),
        agreedBy: [],
        disagreedBy: [],
      });

      // Reset form
      setCaption('');
      setCategory('');
      setLocationQuery('');
      setSelectedPlace(null);
      setRating(5);
      setIsPublic(true);
      setFile(null);
      alert('Post created!');
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6 space-y-5">
          <h1 className="text-2xl font-bold">Create Post</h1>
          {error && <div className="bg-red-100 text-red-700 px-4 py-2 rounded">{error}</div>}

          <div>
            <label className="block text-sm font-medium mb-1">Photo</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Caption</label>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full border rounded px-3 py-2" rows={3} />
          </div>

          <LocationPicker
            locationQuery={locationQuery}
            setLocationQuery={setLocationQuery}
            locationSuggestions={locationSuggestions}
            setLocationSuggestions={setLocationSuggestions}
            selectedPlace={selectedPlace}
            setSelectedPlace={setSelectedPlace}
            locating={locating}
            setLocating={setLocating}
          />

          <div>
            <label className="block text-sm font-medium mb-1">Rating: {rating}/10</label>
            <input type="range" min={1} max={10} value={rating} onChange={(e) => setRating(Number(e.target.value))} className="w-full" />
          </div>

          <div className="flex items-center gap-3">
            <input id="public" type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            <label htmlFor="public">Public</label>
          </div>

          <button disabled={loading} className={`w-full py-3 rounded text-white font-semibold ${loading ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {loading ? 'Posting…' : 'Share Post'}
          </button>
        </form>
      </div>
    </Layout>
  );
}

function LocationPicker({
  locationQuery,
  setLocationQuery,
  locationSuggestions,
  setLocationSuggestions,
  selectedPlace,
  setSelectedPlace,
  locating,
  setLocating,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [userLocation, setUserLocation] = useState(null); // { lat, lon }
  const controllerRef = useRef(null);

  // Try to get user location once to bias results
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {}
    );
  }, []);

  function computeViewbox(lat, lon, km = 25) {
    const dLat = km / 111; // approx degrees latitude per km
    const dLon = km / (111 * Math.cos((lat * Math.PI) / 180));
    const top = lat + dLat;
    const bottom = lat - dLat;
    const left = lon - dLon;
    const right = lon + dLon;
    // viewbox expects: left,top,right,bottom
    return `${left},${top},${right},${bottom}`;
  }

  // Debounced search for places via Nominatim
  useEffect(() => {
    const q = locationQuery.trim();
    setIsOpen(!!q);
    if (controllerRef.current) controllerRef.current.abort();
    if (q.length < 3) {
      setLocationSuggestions([]);
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    const id = setTimeout(async () => {
      try {
        const base = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`;
        const url = userLocation
          ? `${base}&viewbox=${computeViewbox(userLocation.lat, userLocation.lon, 30)}&bounded=1`
          : base;
        const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
        const data = await res.json();
        const mapped = (data || []).map((d) => ({
          name: d.display_name,
          lat: d.lat,
          lon: d.lon,
        }));
        setLocationSuggestions(mapped);
      } catch (_) {
        // ignore aborts
      }
    }, 350);
    return () => clearTimeout(id);
  }, [locationQuery, setLocationSuggestions, userLocation]);

  const handleSelect = (place) => {
    setSelectedPlace(place);
    setLocationQuery(place.name);
    setIsOpen(false);
  };

  const handleUseMyLocation = async () => {
    if (!('geolocation' in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          // reverse geocode to a readable name
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
          const data = await res.json();
          const name = data?.display_name || 'My location';
          const place = { name, lat, lon };
          setSelectedPlace(place);
          setLocationQuery(name);
        } catch {
          const place = { name: 'My location', lat, lon };
          setSelectedPlace(place);
          setLocationQuery('My location');
        } finally {
          setLocating(false);
        }
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1">Location</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={locationQuery}
            onChange={(e) => {
              setLocationQuery(e.target.value);
              setSelectedPlace(null);
            }}
            className="w-full border rounded px-3 py-2"
            placeholder="Search places…"
            onFocus={() => setIsOpen(true)}
            autoComplete="off"
          />
          {isOpen && locationSuggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow">
              {locationSuggestions.map((s, idx) => (
                <button
                  key={`${s.lat}-${s.lon}-${idx}`}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className="block w-full text-left px-3 py-2 hover:bg-gray-50"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleUseMyLocation}
          className={`px-3 py-2 rounded border ${locating ? 'bg-gray-100 text-gray-500' : 'bg-white hover:bg-gray-50'}`}
          disabled={locating}
        >
          {locating ? 'Locating…' : 'Use my location'}
        </button>
      </div>
      {selectedPlace && (
        <div className="text-sm text-gray-600 mt-1">Selected: {selectedPlace.name}</div>
      )}
    </div>
  );
}


