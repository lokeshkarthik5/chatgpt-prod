import { NextResponse } from "next/server";
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
export async function GET(request: Request) {
  try {
    await ensureTableExists();

    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId'); // Get conversationId from URL

    let result;

    if (conversationId) {
      // Fetch all messages for a specific conversation
      result = await sql`
        SELECT
          conversation_id as id,
          user_message,
          assistant_response,
          created_at
        FROM conversations
        WHERE conversation_id = ${conversationId}
        ORDER BY created_at ASC
      `;

      if (result.length === 0) {
        return NextResponse.json({ error: 'No messages found for this conversation' }, { status: 404 });
      }

      // Prepare messages by combining user_message and assistant_response
      const messages = result.map(row => ({
        userMessage: row.user_message,
        assistantResponse: row.assistant_response,
        createdAt: row.created_at,
      }));

      console.log("GET request result for conversationId:", messages);
      return NextResponse.json({ conversationId, messages });
    } else {
      // Fetch all distinct conversations
      result = await sql`
        SELECT DISTINCT ON (conversation_id)
          conversation_id as id,
          user_message,
          assistant_response,
          created_at
        FROM conversations
        ORDER BY conversation_id, created_at ASC
      `;

      if (result.length === 0) {
        return NextResponse.json({ error: 'No conversations found' }, { status: 404 });
      }

      // Prepare response with distinct conversation IDs and first user message
      const conversations = result.map(row => ({
        id: row.id,
        firstMessage: row.user_message,
        responeMessage:row.assistant_response,
        createdAt: row.created_at,
      }));

      console.log("GET request result for all conversations:", conversations);
      return NextResponse.json(conversations);
    }
  } catch (error: unknown) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'An error occurred', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
