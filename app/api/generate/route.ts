import { NextResponse, NextRequest } from "next/server";
import sql from "@/db";

import Groq from "groq-sdk";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

export async function POST(req: NextRequest) {
  try {
    await ensureTableExists();

    const { prompt, conversationId } = await req.json();

    const gen = await groq.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: "You are an intelligent LLM model"
        },
        {
          role: "user",
          content: prompt
        }
      ],
      model: "llama3-70b-8192"
    });

    const response = gen?.choices?.[0].message?.content;

    if (response) {
      const insertResult = await sql`
        INSERT INTO conversations 
        (conversation_id, user_message, assistant_response)
        VALUES (${conversationId || 'default'}, ${prompt}, ${response})
        RETURNING id
      `;
      console.log("Insert result:", insertResult);
    }

    return NextResponse.json(response);
  } catch (error:unknown) {
    console.error("Error in POST request:", error);
    return NextResponse.json(
      { error: "An error occurred", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}


export async function GET() {
  try {
    await ensureTableExists();

    const result = await sql`
      SELECT DISTINCT ON (conversation_id)
        conversation_id as id,
        user_message as content
      FROM conversations
      ORDER BY conversation_id, created_at ASC
    `;
    
    const conversations = result.map(row => ({
      id: row.id,
      messages: [{ content: row.content }]
    }));

    console.log("GET request result:", conversations);
    return NextResponse.json(conversations);
  } catch (error:unknown) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json(
      { error: 'An error occurred', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}