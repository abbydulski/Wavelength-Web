'use client'
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const CircleMarker = dynamic(() => import('react-leaflet').then(m => m.CircleMarker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });
import Link from 'next/link';
const Circle = dynamic(() => import('react-leaflet').then(m => m.Circle), { ssr: false });
const Tooltip = dynamic(() => import('react-leaflet').then(m => m.Tooltip), { ssr: false });
import { useMap } from 'react-leaflet';

export default function DiscoverMap() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [userLocation, setUserLocation] = useState(null);
  const [locError, setLocError] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'posts'), where('isPublic', '==', true));
    const unsub = onSnapshot(q, (snap) => {
      const withCoords = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => p.coordinates && typeof p.coordinates.latitude === 'number' && typeof p.coordinates.longitude === 'number');
      setPosts(withCoords);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Ask for user's location (for 100-mile radius filter)
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocError('Location is not supported in this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocError('');
      },
      (err) => {
        setLocError(err.message || 'Location permission denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Default view roughly over continental US (fallback)
  const defaultCenter = [39.8283, -98.5795];

  const categories = [
    { id: 'all', name: 'All' },
    { id: 'food', name: 'Food' },
    { id: 'travel', name: 'Travel' },
    { id: 'entertainment', name: 'Fun' },
    { id: 'shopping', name: 'Shopping' },
    { id: 'fitness', name: 'Fitness' },
    { id: 'work', name: 'Work' },
    { id: 'social', name: 'Social' },
    { id: 'other', name: 'Other' },
  ];

  function haversineMiles(lat1, lon1, lat2, lon2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R_km = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R_km * c;
    return distanceKm * 0.621371; // convert to miles
  }

  // Group posts by approximate location (5 decimal places ~ 1.1m precision)
  const groupedByLocation = useMemo(() => {
    const key = (p) => {
      const lat = p.coordinates.latitude.toFixed(5);
      const lon = p.coordinates.longitude.toFixed(5);
      return `${lat},${lon}`;
    };
    const map = new Map();
    for (const p of posts) {
      const k = key(p);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(p);
    }
    return map; // Map<key, Post[]>
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (!userLocation) return [];
    const inCategory = (p) => selectedCategory === 'all' || p.category === selectedCategory;
    const map = new Map();
    for (const group of groupedByLocation.values()) {
      const items = group.filter(inCategory);
      if (items.length === 0) continue;
      const coord = items[0].coordinates;
      const key = `${coord.latitude.toFixed(5)},${coord.longitude.toFixed(5)}`;
      map.set(key, items);
    }
    const grouped = Array.from(map.values()).map((items) => ({
      posts: items,
      coordinates: items[0].coordinates,
      avgRating: items.reduce((s, p) => s + (Number(p.rating) || 0), 0) / items.length,
    }));
    const withinRadius = grouped.filter((g) => {
      const miles = haversineMiles(
        userLocation.lat,
        userLocation.lng,
        g.coordinates.latitude,
        g.coordinates.longitude
      );
      return miles <= 100;
    });
    return withinRadius;
  }, [groupedByLocation, selectedCategory, userLocation]);

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h1 className="text-xl font-bold">Discover (Map)</h1>
        <p className="text-sm text-gray-500">Public posts within 100 miles of your location</p>
        {/* Category Filter */}
        <div className="mt-3 flex gap-2 flex-wrap">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                selectedCategory === c.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
        {locError && (
          <div className="mt-3 text-sm text-red-600">{locError}. Enable location to see nearby posts.</div>
        )}
      </div>
      <div style={{ height: 600, width: '100%' }}>
        <MapContainer center={userLocation ? [userLocation.lat, userLocation.lng] : defaultCenter} zoom={userLocation ? 10 : 4} style={{ height: '100%', width: '100%' }}>
          {userLocation && <RecenterOnLocation position={[userLocation.lat, userLocation.lng]} zoom={11} />}
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          {userLocation && (
            <Circle center={[userLocation.lat, userLocation.lng]} radius={160934} pathOptions={{ color: '#94a3b8' }} />
          )}
          {filteredPosts.map((g, idx) => (
            <CircleMarker
              key={`${g.coordinates.latitude}-${g.coordinates.longitude}-${idx}`}
              center={[g.coordinates.latitude, g.coordinates.longitude]}
              radius={12}
              pathOptions={{
                color: g.avgRating >= 7 ? '#10b981' : g.avgRating >= 5 ? '#f59e0b' : '#ef4444',
                fillColor: g.avgRating >= 7 ? '#10b981' : g.avgRating >= 5 ? '#f59e0b' : '#ef4444',
                fillOpacity: 0.9,
              }}
            >
              <Tooltip permanent direction="center">{Math.round(g.avgRating)}</Tooltip>
              <Popup>
                <div className="space-y-2 max-w-xs">
                  <div className="text-sm text-gray-500">Average rating: {g.avgRating.toFixed(1)} ({g.posts.length} {g.posts.length===1?'post':'posts'})</div>
                  <div className="max-h-60 overflow-y-auto space-y-3 pr-2">
                    {g.posts.map((p) => (
                      <div key={p.id} className="border-b pb-2">
                        <div className="font-semibold text-sm">{p.username || 'User'} • {p.rating}/10</div>
                        <div className="text-sm">{p.caption}</div>
                        <div className="text-xs text-gray-500">{p.location}</div>
                        <div className="pt-1">
                          <Link href={`/post/${p.id}`} className="text-indigo-600 hover:underline text-xs">View post</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      {loading && (
        <div className="p-4 text-center text-gray-600 border-t">Loading map…</div>
      )}
      {!loading && userLocation && filteredPosts.length === 0 && (
        <div className="p-4 text-center text-gray-600 border-t">No public posts with locations yet</div>
      )}
    </div>
  );
}

function RecenterOnLocation({ position, zoom = 11 }) {
  const map = useMap();
  useEffect(() => {
    if (!position) return;
    map.setView(position, zoom, { animate: true });
  }, [map, position, zoom]);
  return null;
}


