import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../../../lib/supabase';
import { Folder } from '../../../lib/types';

// We don't need the request object for a simple GET all
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: Request) {
  try {
    const { data: folders, error } = await supabaseAdmin
      .from('folders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching folders:', error);
      return NextResponse.json({ error: 'Failed to fetch folders', details: error.message }, { status: 500 });
    }

    return NextResponse.json(folders || []);

  } catch (err) {
    console.error('Unexpected error fetching folders:', err);
    // Check if it's an error object before accessing message
    const message = err instanceof Error ? err.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'An unexpected server error occurred', details: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name } = await request.json();
    
    // Validate input
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Folder name is required' },
        { status: 400 }
      );
    }
    
    // Create a folder record in the database
    const folderId = uuidv4();
    const folder: Folder = {
      id: folderId,
      name: name.trim(),
      created_at: new Date().toISOString(),
    };
    
    const { error } = await supabaseAdmin.from('folders').insert([folder]);
    
    if (error) {
      console.error('Error creating folder:', error);
      return NextResponse.json(
        { error: 'Failed to create folder' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ folderId, success: true });
  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 