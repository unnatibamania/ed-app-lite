import { NextResponse } from 'next/server';
import supabaseServer from '../../../../lib/supabase-server';

export async function GET(
  request: Request,
  { params }: { params: { folderId: string } }
) {
  try {
    const folderId = params.folderId;

    if (!folderId) {
      return NextResponse.json(
        { error: 'Folder ID is required' },
        { status: 400 }
      );
    }

    // Get folder details
    const { data, error } = await supabaseServer
      .from('folders')
      .select('*')
      .eq('id', folderId)
      .single();

    if (error) {
      console.error('Error fetching folder:', error);
      return NextResponse.json(
        { error: 'Failed to fetch folder' },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Folder not found' },
        { status: 404 }
      );
    }

    // Get file count for this folder
    const { count, error: countError } = await supabaseServer
      .from('files')
      .select('*', { count: 'exact', head: true })
      .eq('folder_id', folderId);

    if (countError) {
      console.error('Error counting files:', countError);
    }

    return NextResponse.json({
      folder: data,
      fileCount: count || 0,
    });
  } catch (error) {
    console.error('Error fetching folder:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 