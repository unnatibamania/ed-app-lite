import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../../../lib/supabase';
import { Folder, FileRecord, UploadResult } from '../../../lib/types';
import { Client } from '@upstash/qstash';

// Initialize QStash client
const qstash = new Client({
  token: process.env.QSTASH_TOKEN || "",
});

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const folderName = formData.get('folderName') as string;
    const files = formData.getAll('files') as File[];

    // Validate input
    if (!folderName || !folderName.trim()) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files were provided' },
        { status: 400 }
      );
    }

    // Create a folder record in the database
    const folderId = uuidv4();
    const folder: Folder = {
      id: folderId,
      name: folderName.trim(),
      created_at: new Date().toISOString(),
    };

    const { error: folderError } = await supabaseAdmin.from('folders').insert([folder]);

    if (folderError) {
      console.error('Error creating folder:', folderError);
      return NextResponse.json(
        { error: 'Failed to create folder' },
        { status: 500 }
      );
    }

    // Upload each file to Supabase Storage and create file records
    const fileIds: string[] = [];
    const fileRecords: FileRecord[] = [];
    const embeddingTasks: Promise<{ messageId: string }>[] = [];

    for (const file of files) {
      const fileId = uuidv4();
      const fileExt = file.name.split('.').pop();
      const filePath = `${folderId}/${fileId}.${fileExt}`;

      console.log('Uploading file:', filePath);

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

      console.log('File record:', fileRecord);
      console.log('fileID   ', fileId);
      console.log('file ext ',  fileExt);

      // Queue the embedding generation task with Upstash
      // Only process file types we can extract text from
      if (['pdf', 'txt', 'doc', 'docx', 'csv', 'md', 'json', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'ico', 'webp'].includes(fileExt?.toLowerCase() || '')) {
        console.log('embedding task');
        const embedTask = qstash.publishJSON({
          url: `${process.env.NEXT_PUBLIC_APP_URL}/api/process-embedding`,
          body: {
            fileId,
            filePath,
            fileName: file.name,
            fileType: file.type,
            folderId
          },
          delay: 0, // Process immediately
          retries: 3, // Retry 3 times if it fails
        });
        
        embeddingTasks.push(embedTask);

        console.log('embeddingTasks', embeddingTasks);

        console.log('Embedding task:', embedTask);
      }
    }

    // Insert all file records in a single operation
    const { error: fileRecordError } = await supabaseAdmin
      .from('files')
      .insert(fileRecords);

    console.log('File record error:', fileRecordError);

    if (fileRecordError) {
      console.error('Error creating file records:', fileRecordError);
      return NextResponse.json(
        { error: 'Failed to create file records' },
        { status: 500 }
      );
    }

    // Wait for all embedding tasks to be queued
    try {
      console.log('embeddingTasks', embeddingTasks);
      await Promise.all(embeddingTasks);
    } catch (error) {
      console.error('Error queuing embedding tasks:', error);
      // We'll continue even if queuing fails, since the files were uploaded successfully
    }

    const result: UploadResult = {
      folderId,
      fileIds,
      success: true,
      embeddingQueued: embeddingTasks.length > 0
    };

    console.log('result', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error processing upload:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 