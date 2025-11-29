'use client'
import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../../../components/Layout';
import { useAuth } from '../../../hooks/useAuth';
import { supabase } from '../../../lib/supabase';

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
  const [files, setFiles] = useState([]); // up to 3 files
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (files.length === 0) return setError('Please select at least one image');
    if (!caption.trim()) return setError('Please enter a caption');
    if (!category) return setError('Please select a category');
    setLoading(true);
    try {
      // Upload images to Supabase Storage (up to 3)
      const uploads = await Promise.all(files.slice(0,3).map(async (f, idx) => {
        const filename = `${user.uid}/${Date.now()}_${idx}_${f.name}`;
        const { data, error } = await supabase.storage
          .from('posts')
          .upload(filename, f, {
            cacheControl: '3600',
            upsert: false
          });

        if (error) throw error;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('posts')
          .getPublicUrl(filename);

        return publicUrl;
      }));

      // Prepare location fields
      const locationText = selectedPlace?.name || locationQuery.trim();
      const coordinates = selectedPlace
        ? { latitude: Number(selectedPlace.lat), longitude: Number(selectedPlace.lon) }
        : null;

      // Create Supabase post
      const { error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: user.uid,
          username: user.displayName || 'User',
          user_avatar: user.photoURL || '',
          caption: caption.trim(),
          location: locationText,
          coordinates,
          rating,
          category,
          photos: uploads,
          is_public: isPublic
        });

      if (insertError) throw insertError;

      // Reset form
      setCaption('');
      setCategory('');
      setLocationQuery('');
      setSelectedPlace(null);
      setRating(5);
      setIsPublic(true);
      setFiles([]);
      setPreviews([]);
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
            <label className="block text-sm font-medium mb-1">Photos (up to 3)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const list = Array.from(e.target.files || []);
                const limited = list.slice(0, 3);
                setFiles(limited);
                setPreviews(limited.map(f => URL.createObjectURL(f)));
              }}
            />
            {previews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {previews.map((src, idx) => (
                  <div key={idx} className="relative w-full aspect-square overflow-hidden rounded border">
                    <img src={src} alt={`preview-${idx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      className="absolute top-1 right-1 bg-white/80 rounded px-1 text-xs"
                      onClick={() => {
                        setFiles(curr => curr.filter((_, i) => i !== idx));
                        setPreviews(curr => curr.filter((_, i) => i !== idx));
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            <label htmlFor="public">Public (post will be shown on discover feed as anonymous to users within 100 miles)</label>
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
  const [localCity, setLocalCity] = useState('');
  const [localCountry, setLocalCountry] = useState(''); // ISO2 country for Mapbox country filter
  const controllerRef = useRef(null);
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Try to get user location once to bias results
  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        // Try to resolve a nearby city/state once for better brand fallback queries
        (async () => {
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`);
            const data = await res.json();
            const city = data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.county || '';
            const state = data?.address?.state || '';
            const country = data?.address?.country_code?.toUpperCase() || '';
            const parts = [city, state || country].filter(Boolean);
            setLocalCity(parts.join(', '));
            setLocalCountry(country);
          } catch {}
        })();
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

  // Debounced search for places (Mapbox preferred, Nominatim fallback)
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
        let results = [];
        // Normalize common brand shortcuts
        const normalizeBrand = (text) => {
          const t = text.toLowerCase().trim();
          // Fitness
          if (t.startsWith('24 hour')) return '24 Hour Fitness';
          if (t.includes('24hr')) return '24 Hour Fitness';
          if (t === 'planet' || t.startsWith('planet fit')) return 'Planet Fitness';
          // Coffee
          if (t === 'philz' || t.startsWith('philz ')) return 'Philz Coffee';
          if (t === 'peets' || t === 'peet' || t.startsWith('peets ') || t.startsWith('peet ')) return "Peet's Coffee";
          if (t === 'starbucks' || t === 'sbux') return 'Starbucks';
          if (t === 'bluebottle' || t === 'blue bottle') return 'Blue Bottle Coffee';
          if (t === 'dunkin') return 'Dunkin';
          // Fast food
          if (t === 'mcdonalds' || t === 'mcd' || t === 'mcds') return "McDonald's";
          if (t === 'chipotle' || t === 'chip') return 'Chipotle';
          if (t === 'chickfila' || t === 'chick fil a') return 'Chick-fil-A';
          // Retail
          if (t === 'target' || t === 'tgt') return 'Target';
          if (t === 'walmart' || t === 'wmt') return 'Walmart';
          if (t === 'wholefoods' || t === 'whole foods') return 'Whole Foods';
          if (t === 'traderjoes' || t === 'trader joes' || t === 'tj') return "Trader Joe's";
          return text;
        };
        const nq = normalizeBrand(q);
        if (MAPBOX_TOKEN) {
          // Build bbox around ~100 miles (160km)
          let bboxParam = '';
          if (userLocation) {
            const km = 160;
            const dLat = km / 111;
            const dLon = km / (111 * Math.cos((userLocation.lat * Math.PI) / 180));
            const minLon = userLocation.lon - dLon;
            const maxLon = userLocation.lon + dLon;
            const minLat = userLocation.lat - dLat;
            const maxLat = userLocation.lat + dLat;
            bboxParam = `&bbox=${minLon},${minLat},${maxLon},${maxLat}`; // minLon,minLat,maxLon,maxLat
          }

          // Helper to filter out street addresses (only keep POIs)
          const filterPOIs = (features) => {
            return features.filter(f => {
              // Keep if it has POI type
              const types = f.place_type || [];
              if (types.includes('poi')) return true;
              // Reject if it's just an address
              if (types.includes('address') && !types.includes('poi')) return false;
              return true;
            });
          };

          // Pass 1: strict POIs nearby
          const url1 = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(nq)}.json?access_token=${MAPBOX_TOKEN}&limit=10&types=poi${bboxParam}${userLocation ? `&proximity=${userLocation.lon},${userLocation.lat}` : ''}${localCountry ? `&country=${localCountry}` : ''}`;
          let res = await fetch(url1, { signal: controller.signal });
          if (res.ok) {
            const data = await res.json();
            const pois = filterPOIs(data.features || []);
            results = pois.map((f) => ({ name: f.place_name, lat: f.center?.[1], lon: f.center?.[0] }));
          }
          // Pass 2: if no POIs found, try original query (not normalized)
          if (results.length === 0 && nq !== q) {
            const url2 = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${MAPBOX_TOKEN}&limit=10&types=poi,address${bboxParam}${userLocation ? `&proximity=${userLocation.lon},${userLocation.lat}` : ''}${localCountry ? `&country=${localCountry}` : ''}`;
            res = await fetch(url2, { signal: controller.signal });
            if (res.ok) {
              const data2 = await res.json();
              results = (data2.features || []).map((f) => ({ name: f.place_name, lat: f.center?.[1], lon: f.center?.[0] }));
            }
          }
          // Pass 3: if still no results, allow addresses
          if (results.length === 0) {
            const url3 = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(nq)}.json?access_token=${MAPBOX_TOKEN}&limit=8&types=poi,address${bboxParam}${userLocation ? `&proximity=${userLocation.lon},${userLocation.lat}` : ''}${localCountry ? `&country=${localCountry}` : ''}`;
            res = await fetch(url3, { signal: controller.signal });
            if (res.ok) {
              const data3 = await res.json();
              results = (data3.features || []).map((f) => ({ name: f.place_name, lat: f.center?.[1], lon: f.center?.[0] }));
            }
          }
        }
        if (!MAPBOX_TOKEN || results.length === 0) {
          // Fallback to Nominatim
          const base = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=${encodeURIComponent(q)}`;
          const nearbyUrl = userLocation
            ? `${base}&viewbox=${computeViewbox(userLocation.lat, userLocation.lon, 30)}&bounded=1`
            : base;
          let res = await fetch(nearbyUrl, { signal: controller.signal, headers: { Accept: 'application/json' } });
          let data = await res.json();
          results = (data || []).map((d) => ({ name: d.display_name, lat: d.lat, lon: d.lon }));
          if (results.length === 0 && userLocation) {
            res = await fetch(base, { signal: controller.signal, headers: { Accept: 'application/json' } });
            data = await res.json();
            results = (data || []).map((d) => ({ name: d.display_name, lat: d.lat, lon: d.lon }));
          }
        }

        setLocationSuggestions(results);
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
              {MAPBOX_TOKEN && (
                <div className="px-3 py-1 border-t text-[11px] text-gray-400">Search by Mapbox</div>
              )}
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


