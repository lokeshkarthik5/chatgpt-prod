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

function convertMarkdownToPlainText(markdown: string): string {
  // This is a simple conversion. For more complex markdown, consider using a library.
  return markdown
    .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
    .replace(/\*(.*?)\*/g, '$1')     // Italic
    .replace(/`(.*?)`/g, '$1')       // Inline code
    .replace(/^#+\s*(.*)$/gm, '$1')  // Headers
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Links
    .replace(/^\s*[-*+]\s/gm, '')    // Unordered lists
    .replace(/^\s*\d+\.\s/gm, '')    // Ordered lists
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    await ensureTableExists();

    const { prompt, conversationId,convertToPlainText = false  } = await req.json();

    // Fetch previous messages for the conversation
    const previousMessages = await sql`
      SELECT user_message, assistant_response
      FROM conversations
      WHERE conversation_id = ${conversationId}
      ORDER BY created_at ASC
    `;

    // Prepare the messages array for the Groq API
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: "You are an intelligent LLM model" },
      ...previousMessages.flatMap(msg => [
        { role: 'user' as const, content: msg.user_message },
        { role: 'assistant' as const, content: msg.assistant_response }
      ]),
      { role: "user" as const, content: prompt }
    ];

    const gen = await groq.chat.completions.create({
      messages,
      model: "llama3-70b-8192"
    });

    let response = gen?.choices?.[0]?.message?.content;

    if (convertToPlainText && response) {
      response = convertMarkdownToPlainText(response!);
    }

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