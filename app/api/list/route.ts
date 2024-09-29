import { NextRequest, NextResponse } from "next/server";
import sql from "@/db";


// Ensure table exists before querying
async function createTableIfNotExists() {
  try {
    const result = await sql`
      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        conversation_id UUID DEFAULT gen_random_uuid(),
        user_message TEXT,
        assistant_response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log("Table creation result:", result);
    console.log("Table 'conversations' created or already exists.");
  } catch (error) {
    console.error("Error creating table:", error);
    throw error;
  }
}

async function checkTableExists() {
  try {
    const result = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'conversations'
      );
    `;
    console.log("Table existence check result:", result);
    return result[0].exists;
  } catch (error) {
    console.error("Error checking table existence:", error);
    throw error;
  }
}

async function ensureTableExists() {
  const tableExists = await checkTableExists();
  if (!tableExists) {
    await createTableIfNotExists();
  } else {
    console.log("Table 'conversations' already exists.");
  }
}

// Handle GET request
export async function GET(req:NextRequest) {
  try {
    await ensureTableExists();

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (conversationId) {
      // Fetch messages for a specific conversation
      const messages = await sql`
        SELECT user_message, assistant_response, created_at
        FROM conversations
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at ASC
      `;
      return NextResponse.json({ messages });
    } else {
      // Fetch all conversations
      const result = await sql`
        SELECT DISTINCT ON (conversation_id)
          conversation_id as id,
          user_message as first_message,
          assistant_response as response_message,
          created_at
        FROM conversations
        ORDER BY conversation_id, created_at DESC
      `;
      
      const conversations = result.map(row => ({
        id: row.id,
        firstMessage: row.first_message,
        responseMessage: row.response_message,
        createdAt: row.created_at
      }));

      return NextResponse.json(conversations);
    }
  } catch (error:unknown) {
    console.error('Error in GET request:', error);
    return NextResponse.json(
      { error: 'An error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}