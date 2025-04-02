import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../lib/supabase';
import OpenAI from 'openai';

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query, threshold = 0.7, limit = 10 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // 1. Generate an embedding for the search query
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: query,
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 2. Search for similar documents using the SQL function
    const { data: matchingDocuments, error } = await supabaseAdmin.rpc(
      'search_documents', 
      { 
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit
      }
    );

    if (error) {
      console.error('Error searching documents:', error);
      return NextResponse.json(
        { error: 'Failed to search documents' },
        { status: 500 }
      );
    }

    // 3. Return search results
    return NextResponse.json({
      results: matchingDocuments,
      count: matchingDocuments.length,
    });
  } catch (error) {
    console.error('Error during vector search:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during search' },
      { status: 500 }
    );
  }
} 