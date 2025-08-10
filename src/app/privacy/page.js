'use client'
import Layout from '../../../components/Layout';

export default function PrivacyPage() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto prose">
        <h1>Privacy Policy</h1>
        <p>We store your account data (email, display name) and content you create (posts, comments, reactions). Location is only saved if you choose a place when posting. Public posts may be shown on Discover anonymously within 100 miles.</p>
        <p>We use Firebase for authentication, database, and storage. See Google’s Privacy Policy for those services.</p>
      </div>
    </Layout>
  );
}


