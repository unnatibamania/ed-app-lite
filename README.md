# File Storage App with Supabase

This application allows users to upload multiple files to a folder. The folder is created in a PostgreSQL database (via Supabase), and the files are uploaded to Supabase Storage with links to the folder.

## Setup

### 1. Supabase Setup

1. Create a Supabase account at [supabase.com](https://supabase.com)
2. Create a new project
3. Get your Supabase URL and anon key from the project settings (API section)
4. Set up the database tables by running the SQL in `supabase/migrations/20231001000000_create_tables.sql` in the Supabase SQL Editor
5. Create a storage bucket named "files" in the Supabase Storage section

### 2. Environment Variables

Update the `.env.local` file with your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Development Server

```bash
npm run dev
```

## Database Schema

The application uses two main tables:

### `folders` Table

- `id`: UUID (primary key)
- `name`: Text (folder name)
- `created_at`: Timestamp
- `updated_at`: Timestamp

### `files` Table

- `id`: UUID (primary key)
- `folder_id`: UUID (foreign key to folders.id)
- `name`: Text (original file name)
- `size`: BigInt (file size in bytes)
- `type`: Text (file MIME type)
- `path`: Text (path in Supabase Storage)
- `created_at`: Timestamp
- `updated_at`: Timestamp

## How It Works

1. User enters a folder name and selects multiple files
2. On submission:
   - A new folder record is created in the database
   - Each file is uploaded to Supabase Storage in a path based on the folder ID
   - For each file, a file record is created in the database linking to the folder
3. Progress is shown during upload
4. Success message is displayed upon completion with folder ID and file list

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
