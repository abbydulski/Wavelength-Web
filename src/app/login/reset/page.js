'use client'
import { useState } from 'react';
import Layout from '../../../../components/Layout';
import { supabase } from '../../../../lib/supabase';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) return setError('Enter your email');
    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login/update-password`,
      });

      if (resetError) throw resetError;
      setSent(true);
    } catch (e) {
      setError(e.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold mb-2">Reset Password</h1>
        <p className="text-sm text-gray-600 mb-4">Enter your email to receive a password reset link.</p>
        {error && <div className="bg-red-100 text-red-700 px-3 py-2 rounded mb-3">{error}</div>}
        {sent ? (
          <div className="text-green-700 bg-green-100 px-3 py-2 rounded">Check your email for the reset link.</div>
        ) : (
          <form onSubmit={handleReset} className="space-y-3">
            <input value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="you@example.com" type="email" />
            <button disabled={loading} className={`w-full py-2 rounded text-white ${loading?'bg-indigo-400':'bg-indigo-600 hover:bg-indigo-700'}`}>{loading?'Sending…':'Send reset link'}</button>
          </form>
        )}
      </div>
    </Layout>
  );
}


