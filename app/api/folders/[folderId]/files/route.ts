import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase';
import { FileRecord } from '../../../../../lib/types';

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

    // Get files for the specified folder
    const { data, error } = await supabaseAdmin
      .from('files')
      .select('*')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching files:', error);
      return NextResponse.json(
        { error: 'Failed to fetch files' },
        { status: 500 }
      );
    }

    // For each file, generate a URL
    const filesWithUrls = await Promise.all(
      data.map(async (file: FileRecord) => {
        const { data: urlData } = await supabaseAdmin.storage
          .from('sheep')
          .createSignedUrl(file.path, 3600); // 1 hour expiry

        return {
          ...file,
          url: urlData?.signedUrl || null,
        };
      })
    );

    return NextResponse.json({
      files: filesWithUrls,
      count: filesWithUrls.length,
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 