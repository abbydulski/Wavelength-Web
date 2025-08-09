'use client'
import Layout from '../../../components/Layout';
import dynamic from 'next/dynamic';

const DiscoverMap = dynamic(() => import('../../../components/DiscoverMap'), { ssr: false });

export default function DiscoverPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <DiscoverMap />
      </div>
    </Layout>
  );
}


