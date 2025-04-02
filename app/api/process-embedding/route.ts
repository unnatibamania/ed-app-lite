import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../../../lib/supabase';
import { DocumentChunk, ChunkMetadata } from '../../../lib/types';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Maximum tokens per chunk - reduced to stay well within OpenAI's 8192 limit
const MAX_CHUNK_SIZE = 2000;

// Maximum tokens the embedding model can handle
const MAX_EMBEDDING_TOKENS = 8000; // Set below the 8192 limit to be safe

// Process embedding request from Upstash QStash
export async function POST(request: Request) {
  try {
    // Verify the request is from QStash
    // In a production app, you would validate the signature header from QStash

    
    const body = await request.json();
    const { fileId, filePath, fileName, fileType, folderId } = body;
    console.log('------------------------- process embeddings -------------------------')

    console.log('fileId', fileId);
    console.log('filePath', filePath);
    console.log('fileName', fileName);
    console.log('fileType', fileType);
    console.log('folderId', folderId);


    console.log('Processing embedding for file:', fileId);
    if (!fileId || !filePath) {
      console.log('Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify file exists before attempting to insert embeddings
    const { data: fileExists, error: fileCheckError } = await supabaseAdmin
      .from('files')
      .select('id')
      .eq('id', fileId)
      .single();

    if (fileCheckError || !fileExists) {
      console.error('File does not exist, cannot insert embeddings:', fileId);
      return NextResponse.json(
        { error: 'File does not exist' },
        { status: 400 }
      );
    }

    // 1. Download the file from Supabase storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('sheep')
      .download(filePath);

    if (downloadError || !fileData) {
      console.error('Error downloading file:', downloadError);
      return NextResponse.json(
        { error: 'Failed to download file' },
        { status: 500 }
      );
    }

    // 2. Extract text from the file based on file type
    let text = '';
    
    if (fileType.includes('text/') || fileType.includes('application/json') || fileName.endsWith('.md')) {
      // For text-based files
      text = await fileData.text();
      // Ensure text is properly sanitized
      text = sanitizeText(text);
    } else if (fileType.includes('application/pdf') || fileName.endsWith('.pdf')) {
      // For PDF files - use pdf-parse library
      try {
        // Convert the Blob to ArrayBuffer
        const arrayBuffer = await fileData.arrayBuffer();
        // Create a Buffer from the ArrayBuffer
        const buffer = Buffer.from(arrayBuffer);
        
        // Process the PDF with our helper function
        text = await processPdf(buffer, fileName);
        
        // Ensure text is properly sanitized
        text = sanitizeText(text);
      } catch (error) {
        console.error('Error parsing PDF:', error);
        return NextResponse.json(
          { error: 'Failed to parse PDF file' },
          { status: 500 }
        );
      }
    } else if (fileType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') || 
               fileType.includes('application/msword')) {
      // For Word docs - in a real app, you'd use a Word parser like mammoth
      // This is a placeholder
      text = 'Word document content would be parsed here';
      text = sanitizeText(text);
    } else {
      console.log('Unsupported file type for embedding');
      return NextResponse.json(
        { error: 'Unsupported file type for embedding' },
        { status: 400 }
      );
    }

    // 3. Split the text into chunks
    const chunks = chunkText(text, MAX_CHUNK_SIZE);

    
    if (chunks.length === 0) {
      console.log('No valid content to embed');
      return NextResponse.json(
        { error: 'No valid content to embed' },
        { status: 400 }
      );
    }

    // 4. Create document chunks and generate embeddings for each chunk
    const documentChunks: DocumentChunk[] = [];
    let chunkIndex = 0;

    // Helper function to safely generate embeddings with retries
    async function generateEmbedding(text: string): Promise<number[] | null> {
      // First, ensure the text isn't too long
      const estimatedTokens = text.length / 4;
      if (estimatedTokens > MAX_EMBEDDING_TOKENS) {
        console.warn(`Text too long for embedding: ~${Math.round(estimatedTokens)} tokens (max: ${MAX_EMBEDDING_TOKENS})`);
        return null;
      }
      
      try {
        // Generate embedding using OpenAI
        const embeddingResponse = await openai.embeddings.create({
          model: "text-embedding-ada-002",
          input: text,
        });
        
        return embeddingResponse.data[0].embedding;
      } catch (error: unknown) {
        // Check if it's a token limit error
        if (error instanceof Error && 
           (error.message.includes('maximum context length') || error.message.includes('token limit'))) {
          console.error('Token limit exceeded. Original error:', error.message);
          
          // Try more aggressive splitting
          const halfLength = Math.floor(text.length / 2);
          console.log(`Splitting text of length ${text.length} in half and retrying only first half`);
          
          // Only process first half to avoid recursive explosions
          const firstHalf = text.substring(0, halfLength);
          return generateEmbedding(firstHalf);
        }
        
        console.error('Error generating embedding:', error instanceof Error ? error.message : error);
        return null;
      }
    }

    for (const chunk of chunks) {
      // Make sure chunk is sanitized one last time before embedding
      const sanitizedChunk = sanitizeText(chunk);
      
      // Verify the chunk doesn't exceed the token limit
      // Rough estimate: 1 token is ~4 characters for English text
      const estimatedTokens = sanitizedChunk.length / 4;
      
      if (estimatedTokens > MAX_EMBEDDING_TOKENS) {
        console.warn(`Chunk ${chunkIndex} exceeds token limit (est. ${Math.round(estimatedTokens)} tokens). Splitting further.`);
        // Split this chunk further if it's too large
        const subChunks = splitLargeChunk(sanitizedChunk, MAX_EMBEDDING_TOKENS);
        
        for (const subChunk of subChunks) {
          // Use our safe embedding generator
          const embedding = await generateEmbedding(subChunk);
          
          if (embedding) {
            // Create a document chunk
            const metadata: ChunkMetadata = {
              file_name: fileName,
              file_type: fileType,
              chunk_index: chunkIndex,
              total_chunks: chunks.length + subChunks.length - 1, // Adjust total count
              folder_id: folderId,
            };

            const documentChunk: DocumentChunk = {
              id: uuidv4(),
              file_id: fileId,
              content: subChunk,
              metadata,
              embedding,
              created_at: new Date().toISOString(),
            };

            documentChunks.push(documentChunk);
            chunkIndex++;
          }
        }
      } else {
        // Use our safe embedding generator
        const embedding = await generateEmbedding(sanitizedChunk);
        
        if (embedding) {
          // Create a document chunk
          const metadata: ChunkMetadata = {
            file_name: fileName,
            file_type: fileType,
            chunk_index: chunkIndex,
            total_chunks: chunks.length,
            folder_id: folderId,
          };

          const documentChunk: DocumentChunk = {
            id: uuidv4(),
            file_id: fileId,
            content: sanitizedChunk,
            metadata,
            embedding,
            created_at: new Date().toISOString(),
          };

          documentChunks.push(documentChunk);
          chunkIndex++;
        }
      }
    }

    // Before the complex insertion, try a simple test
    try {
      const testEmbedding = new Array(1536).fill(0.1);
      const { error: testError } = await supabaseAdmin
        .from('document_embeddings')
        .insert([{
          id: uuidv4(),
          file_id: fileId,
          content: 'Test content',
          metadata: { test: true },
          embedding: testEmbedding,
          created_at: new Date().toISOString()
        }]);
      
      if (testError) {
        console.error('Test insertion failed:', testError);
      } else {
        console.log('Test insertion succeeded!');
      }
    } catch (e) {
      console.error('Test insertion threw exception:', e);
    }

    // Log the document chunks summary for debugging
    console.log(`Processing ${documentChunks.length} chunks for insertion with sizes:`);
    documentChunks.forEach((chunk, i) => {
      // Estimate token count based on content length
      const estTokens = Math.round(chunk.content.length / 4);
      console.log(`Chunk ${i}: ~${estTokens} tokens, ${chunk.content.length} chars`);
    });

    // 5. Store the document chunks and embeddings in Supabase pgvector
    // Make sure your Supabase database has pgvector extension enabled with a vector column
    try {
      const { error: insertError } = await supabaseAdmin
        .from('document_embeddings')
        .insert(
          documentChunks.map(chunk => ({
            id: chunk.id,
            file_id: chunk.file_id,
            content: chunk.content,
            metadata: chunk.metadata,
            embedding: chunk.embedding,
            created_at: chunk.created_at
          }))
        );

      if (insertError) {
        console.error('Error inserting document embeddings:', insertError);
        console.error('Error details:', JSON.stringify(insertError, null, 2));
        // Try inserting one chunk at a time to identify which one causes issues
        let successfulInserts = 0;
        for (const chunk of documentChunks) {
          try {
            const { error: singleInsertError } = await supabaseAdmin
              .from('document_embeddings')
              .insert([{
                id: chunk.id,
                file_id: chunk.file_id,
                content: chunk.content,
                metadata: chunk.metadata,
                embedding: chunk.embedding,
                created_at: chunk.created_at
              }]);
            
            if (singleInsertError) {
              console.error('Error inserting single chunk:', chunk.id, singleInsertError);
              // Try a more aggressive sanitization for this chunk
              const ultraSafeContent = chunk.content.replace(/[^\x20-\x7E]/g, '');
              const { error: retryError } = await supabaseAdmin
                .from('document_embeddings')
                .insert([{
                  id: chunk.id,
                  file_id: chunk.file_id,
                  content: ultraSafeContent,
                  metadata: chunk.metadata,
                  embedding: chunk.embedding,
                  created_at: chunk.created_at
                }]);
                
              if (!retryError) {
                successfulInserts++;
                console.log('Successfully inserted chunk with aggressive sanitization:', chunk.id);
              }
            } else {
              successfulInserts++;
            }
          } catch (err) {
            console.error('Exception during single chunk insertion:', err);
          }
        }
        
        if (successfulInserts === 0) {
          return NextResponse.json(
            { error: 'Failed to store any document embeddings' },
            { status: 500 }
          );
        } else {
          console.log(`Successfully inserted ${successfulInserts}/${documentChunks.length} chunks`);
        }
      }

      // 6. Update the file record to indicate embeddings are available
      const { error: updateError } = await supabaseAdmin
        .from('files')
        .update({ has_embeddings: true })
        .eq('id', fileId);

      if (updateError) {
        console.error('Error updating file record:', updateError);
        // Continue anyway since embeddings were stored successfully
      }

      return NextResponse.json({
        success: true,
        fileId,
        chunks: documentChunks.length,
      });
    } catch (error) {
      console.error('Error processing embeddings insertion:', error);
      return NextResponse.json(
        { error: 'An unexpected error occurred during embedding insertion' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing embedding:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during embedding process' },
      { status: 500 }
    );
  }
}

// Function to split text into chunks of manageable size
function chunkText(text: string, maxTokens: number): string[] {
  // Clean and normalize the text
  const cleanText = sanitizeText(text);
  
  // For PDF content, we need to be smarter about chunking as sentences may not be well-defined
  // First, try to split by paragraphs
  const paragraphs = cleanText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  // If we have paragraphs, use them for initial chunking
  if (paragraphs.length > 1) {
    return chunkByParagraphs(paragraphs, maxTokens);
  }
  
  // Otherwise fall back to sentence-based chunking
  const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    // Rough approximation: 1 token ~= 4 characters
    const estimatedTokens = currentChunk.length / 4;
    
    if (estimatedTokens + sentence.length / 4 > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    
    currentChunk += sentence + '. ';
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  // If we still have no chunks, fall back to character-based chunking
  if (chunks.length === 0 && cleanText.length > 0) {
    return chunkBySize(cleanText, maxTokens);
  }
  
  return chunks;
}

// Function to further split a large chunk that exceeds the embedding model's token limit
function splitLargeChunk(text: string, maxTokens: number): string[] {
  // For very large chunks, split by paragraphs first
  const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
  
  if (paragraphs.length > 1) {
    // If we have multiple paragraphs, try to chunk by paragraphs
    return chunkByParagraphs(paragraphs, maxTokens);
  } else {
    // Otherwise, just split the text into equal-sized chunks
    return chunkBySize(text, maxTokens);
  }
}

// Helper function to chunk by paragraphs
function chunkByParagraphs(paragraphs: string[], maxTokens: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    const estimatedTokens = currentChunk.length / 4;
    const paragraphTokens = paragraph.length / 4;
    
    if (estimatedTokens + paragraphTokens > maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    
    if (paragraphTokens > maxTokens) {
      // If a single paragraph is too large, split it further
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      const subChunks = chunkBySize(paragraph, maxTokens);
      chunks.push(...subChunks);
    } else {
      currentChunk += paragraph + '\n\n';
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

// Helper function to chunk text by size when we have no natural breaks
function chunkBySize(text: string, maxTokens: number): string[] {
  const chunks: string[] = [];
  const maxChars = maxTokens * 4; // Approximate chars per token
  
  let i = 0;
  while (i < text.length) {
    // Find a good breaking point near the max size
    let end = Math.min(i + maxChars, text.length);
    
    // If we're not at the end, try to find a sentence or word boundary
    if (end < text.length) {
      // Look for sentence end
      const sentenceEnd = text.lastIndexOf('.', end);
      if (sentenceEnd > i && sentenceEnd > end - 100) {
        end = sentenceEnd + 1;
      } else {
        // Look for word boundary
        const spacePos = text.lastIndexOf(' ', end);
        if (spacePos > i) {
          end = spacePos;
        }
      }
    }
    
    chunks.push(text.substring(i, end).trim());
    i = end;
  }
  
  return chunks;
}

// Function to sanitize text by removing or replacing problematic characters
function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  try {
    // Remove null bytes and other control characters
    let sanitized = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Replace other potentially problematic unicode characters
    sanitized = sanitized.replace(/\\u0000/g, '');
    sanitized = sanitized.replace(/[\uFFFD\uFFFE\uFFFF]/g, ''); // Replace replacement character and non-characters
    
    // Handle JSON.stringify issues with certain Unicode sequences
    sanitized = sanitized.replace(/[\u2028\u2029]/g, ' '); // Replace line/paragraph separators
    
    // Remove emoji and other complex unicode characters that might cause issues
    sanitized = sanitized.replace(/[\u{1F000}-\u{1FFFF}]/gu, '');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    // Test if the string can be safely stored in the database
    JSON.stringify(sanitized); // Will throw an error if there are problematic characters
    
    return sanitized;
  } catch (error) {
    console.error('Error during text sanitization:', error);
    // If JSON.stringify fails, perform more aggressive sanitization
    // Convert to ASCII only as a last resort
    return text.replace(/[^\x20-\x7E]/g, '').trim();
  }
}

async function processPdf(pdfBuffer: Buffer, fileName: string): Promise<string> {
  console.log(`Starting PDF processing for file: ${fileName}`);
  
  try {
    // PDF parsing options
    const options = {
      // Limit to 0 means parse all pages (default)
      max: 0
    };
    
    // Parse the PDF
    const pdfData = await pdfParse(pdfBuffer, options);
    
    // Basic validation
    if (!pdfData || !pdfData.text) {
      throw new Error('PDF parsing failed to extract text');
    }
    
    // Extract text from the PDF
    let extractedText = pdfData.text;
    console.log(`PDF parsing complete: ${pdfData.numpages} pages, ${extractedText.length} characters extracted`);
    
    // Log some metadata for debugging
    if (pdfData.info) {
      const metadata = {
        producer: pdfData.info.Producer,
        creator: pdfData.info.Creator,
        author: pdfData.info.Author,
        title: pdfData.info.Title,
      };
      console.log('PDF metadata:', JSON.stringify(metadata));
    }
    
    // Check if we actually got content
    if (extractedText.trim().length === 0) {
      throw new Error('PDF parsing resulted in empty text');
    }
    
    // Normalize PDF text
    extractedText = extractedText
      // Replace excessive newlines with just two
      .replace(/\n{3,}/g, '\n\n')
      // Replace tabs with spaces
      .replace(/\t/g, ' ')
      // Normalize spaces
      .replace(/\s+/g, ' ')
      // Some PDFs have form feed characters
      .replace(/\f/g, '\n\n')
      .trim();
      
    return extractedText;
  } catch (error) {
    console.error('Error in PDF processing:', error);
    throw error;
  }
} 