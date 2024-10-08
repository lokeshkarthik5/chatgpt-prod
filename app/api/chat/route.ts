import { NextResponse } from 'next/server';
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const cleanedMessages = messages.map(({ role, content }: { role: string; content: string }) => ({ role, content }));

    const res = await groq.chat.completions.create({
      messages: cleanedMessages,  // Changed from 'cleanedMessages' to 'messages'
      model: "llama3-70b-8192"
    });

    let response = res?.choices?.[0]?.message?.content;

    if (!response) {
      throw new Error('No response from Groq API');
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Error in chat API route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}