'use client'
import { useState } from 'react';
import Layout from '../../../components/Layout';
import { db } from '../../../lib/firebase';
import { addDoc, collection } from 'firebase/firestore';

export default function FeedbackPage() {
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!text.trim()) return setError('Please enter feedback');
    setLoading(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        text: text.trim(),
        createdAt: new Date().toISOString(),
      });
      setSent(true);
      setText('');
    } catch (e) {
      setError('Failed to send feedback');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold mb-2">Send Feedback</h1>
        {error && <div className="bg-red-100 text-red-700 px-3 py-2 rounded mb-3">{error}</div>}
        {sent ? (
          <div className="text-green-700 bg-green-100 px-3 py-2 rounded">Thanks! Your feedback was sent.</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea value={text} onChange={(e)=>setText(e.target.value)} className="w-full border rounded px-3 py-2" rows={4} placeholder="What should we improve?" />
            <button disabled={loading} className={`w-full py-2 rounded text-white ${loading?'bg-indigo-400':'bg-indigo-600 hover:bg-indigo-700'}`}>{loading?'Sending…':'Send'}</button>
          </form>
        )}
      </div>
    </Layout>
  );
}


