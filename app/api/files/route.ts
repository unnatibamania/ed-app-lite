import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../../../lib/supabase';
import { FileRecord } from '../../../lib/types';

export async function POST(request: Request) {
  try {
    // Get the form data from the request
    const formData = await request.formData();
    const folderId = formData.get('folderId') as string;
    const files = formData.getAll('files') as File[];

    // Validate input
    if (!folderId) {
      return NextResponse.json(
        { error: 'Folder ID is required' },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files were provided' },
        { status: 400 }
      );
    }

    // Upload each file to Supabase Storage and create file records
    const fileIds: string[] = [];
    const fileRecords: FileRecord[] = [];

    for (const file of files) {
      const fileId = uuidv4();
      const fileExt = file.name.split('.').pop();
      const filePath = `${folderId}/${fileId}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from('sheep')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        return NextResponse.json(
          { error: 'Failed to upload file' },
          { status: 500 }
        );
      }

      // Create a file record
      const fileRecord: FileRecord = {
        id: fileId,
        folder_id: folderId,
        name: file.name,
        size: file.size,
        type: file.type,
        path: filePath,
        created_at: new Date().toISOString(),
      };

      fileRecords.push(fileRecord);
      fileIds.push(fileId);
    }

    // Insert all file records in a single operation
    const { error: fileRecordError } = await supabaseAdmin
      .from('files')
      .insert(fileRecords);

    if (fileRecordError) {
      console.error('Error creating file records:', fileRecordError);
      return NextResponse.json(
        { error: 'Failed to create file records' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      folderId,
      fileIds,
      fileCount: files.length,
    });
  } catch (error) {
    console.error('Error processing file upload:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 