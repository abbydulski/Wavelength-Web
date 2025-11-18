'use client'
import { useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import Feed from '../../components/Feed';
import { supabase } from '../../lib/supabase';
import Link from 'next/link';

export default function Home() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthed(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <Layout>
      {authed ? (
        <Feed />
      ) : (
        <div className="max-w-2xl mx-auto text-center py-16">
          <h1 className="text-4xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">See your friends, not short‑form content</h1>
          <p className="mt-4 text-gray-600">Follow real posts with photos and ratings. Discover useful places within 100 miles.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/login" className="px-5 py-3 rounded text-white bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 hover:opacity-95">Log in / Sign up</Link>
            <Link href="/discover" className="px-5 py-3 rounded border hover:bg-gray-50">Explore Discover</Link>
          </div>
        </div>
      )}
    </Layout>
  );
}