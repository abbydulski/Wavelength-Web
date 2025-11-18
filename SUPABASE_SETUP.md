# Supabase Migration Setup Guide

## 🎉 Migration Complete!

Your Wavelength app has been successfully migrated from Firebase to Supabase!

## 📋 Setup Steps

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Fill in:
   - **Name**: `wavelength-web` (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your users
4. Click **"Create new project"** and wait ~2 minutes

### 2. Set Up Database Schema

1. In your Supabase project, click **"SQL Editor"** in the left sidebar
2. Click **"New query"**
3. Copy the entire contents of `supabase-schema.sql` from this project
4. Paste into the SQL editor
5. Click **"Run"** (or press Cmd/Ctrl + Enter)
6. You should see "Success. No rows returned" - this is correct!

### 3. Create Storage Buckets

1. Click **"Storage"** in the left sidebar
2. Click **"Create a new bucket"**
3. Create two buckets:

#### Bucket 1: `avatars`
- Name: `avatars`
- Public bucket: ✅ **Yes** (check this box)
- Click **"Create bucket"**

#### Bucket 2: `posts`
- Name: `posts`
- Public bucket: ✅ **Yes** (check this box)
- Click **"Create bucket"**

### 4. Set Up Storage Policies (Optional but Recommended)

For each bucket, you can add policies:

**For `avatars` bucket:**
1. Click on the bucket → **Policies** tab
2. Add policy for INSERT: Allow authenticated users to upload
3. Add policy for SELECT: Allow public read access

**For `posts` bucket:**
1. Click on the bucket → **Policies** tab
2. Add policy for INSERT: Allow authenticated users to upload
3. Add policy for SELECT: Allow public read access

### 5. Get Your Credentials

1. Click **"Settings"** (gear icon) in the left sidebar
2. Click **"API"** under Project Settings
3. Copy these values:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

### 6. Configure Environment Variables

1. Create a `.env.local` file in your project root (if it doesn't exist)
2. Add these lines (replace with your actual values):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

3. **Important**: Make sure `.env.local` is in your `.gitignore` file!

### 7. Remove Old Firebase Environment Variables

You can now remove these from your `.env.local`:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### 8. Start Your Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` and test:
- ✅ Sign up with a new account
- ✅ Create a post with photos
- ✅ Search for users
- ✅ Follow/unfollow users
- ✅ View the discover map
- ✅ Add comments and reactions

## 🔄 What Changed?

### Code Changes
- ✅ Replaced Firebase SDK with Supabase client
- ✅ Updated all authentication flows
- ✅ Migrated Firestore queries to PostgreSQL
- ✅ Updated storage uploads to Supabase Storage
- ✅ Added real-time subscriptions for live updates
- ✅ Updated all components and pages

### Database Structure
- **Firestore Collections** → **PostgreSQL Tables**
  - `users` → `users` table
  - `posts` → `posts` table
  - `comments` → `comments` table
  - `followRequests` → `follow_requests` table
  - New: `follows` table (for better relationship management)

### Benefits
- 🚀 Better performance with PostgreSQL
- 🔒 Row Level Security (RLS) policies for data protection
- 💰 More generous free tier
- 🛠️ Better developer tools and SQL editor
- 📊 Built-in analytics and monitoring

## 🐛 Troubleshooting

### "Missing Supabase env vars" error
- Make sure `.env.local` exists with correct values
- Restart your dev server after adding env vars

### Storage upload fails
- Verify buckets are created and set to **public**
- Check bucket names match exactly: `avatars` and `posts`

### Can't see posts/users
- Verify the SQL schema ran successfully
- Check browser console for errors
- Verify RLS policies are set up correctly

### Authentication issues
- Clear browser cookies and local storage
- Try signing up with a new account
- Check Supabase Auth settings allow email/password

## 📚 Next Steps

- Review the RLS policies in Supabase dashboard
- Set up email templates in Supabase Auth settings
- Configure custom SMTP for emails (optional)
- Set up database backups
- Monitor usage in Supabase dashboard

## 🎯 Need Help?

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Discord](https://discord.supabase.com)
- Check the `supabase-schema.sql` file for database structure

