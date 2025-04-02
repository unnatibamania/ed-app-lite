import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../../../lib/supabase';
import { Folder } from '../../../lib/types';

export async function GET() {
  try {
    // Get all folders
    const { data, error } = await supabaseAdmin
      .from('folders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching folders:', error);
      return NextResponse.json(
        { error: 'Failed to fetch folders' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      folders: data,
      count: data.length,
    });
  } catch (error) {
    console.error('Error fetching folders:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
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