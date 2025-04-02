import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface Params {
  folderId: string;
}

// Get files for a specific folder
export async function GET(
  _request: Request, // Prefixed with underscore as it's unused
  { params }: { params: Promise<Params> }
) {
  const { folderId } = await params;

  if (!folderId) {
    return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
  }

  try {
    // First, check if the folder exists
    const { data: folderExists, error: folderCheckError } = await supabaseAdmin
      .from('folders')
      .select('id') // More efficient check
      .eq('id', folderId);

      console.log({
        folderExists,
      })

    // Check for error OR if the count is 0
    if (folderCheckError || !folderExists) {
      console.error(`Folder not found check failed for: ${folderId}`, folderCheckError);
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
    }

    // Fetch files associated with the folderId
    const { data: files, error: filesError } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });

    if (filesError) {
      console.error(`Error fetching files for folder ${folderId}:`, filesError);
      return NextResponse.json({ error: 'Failed to fetch files', details: filesError.message }, { status: 500 });
    }

    return NextResponse.json(files || []);

  } catch (err) {
    console.error(`Unexpected error fetching files for folder ${folderId}:`, err);
    const message = err instanceof Error ? err.message : 'An unknown server error occurred';
    return NextResponse.json({ error: 'An unexpected server error occurred', details: message }, { status: 500 });
  }
} 