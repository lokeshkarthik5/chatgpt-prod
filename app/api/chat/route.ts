import { NextResponse } from 'next/server';
import Groq from "groq-sdk";
import prisma from '@/lib/prisma';
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { message, conversationId, editedMessageId } = await req.json();

    if (!message || !conversationId) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    let conversation;

    if (editedMessageId) {
      const originalConversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { messages: true },
      });

      if (!originalConversation) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }

      const editIndex = originalConversation.messages.findIndex(m => m.id === editedMessageId);
      const messagesToKeep = originalConversation.messages.slice(0, editIndex);

      conversation = await prisma.conversation.create({
        data: {
          parentId: conversationId,
          title: messagesToKeep[0]?.content.split(' ')[0] || 'Edited Conversation',
          messages: {
            create: [
              ...messagesToKeep.map(m => ({ role: m.role, content: m.content })),
              { role: 'user', content: message },
            ],
          },
        },
        include: { messages: true },
      });
    } else {
      conversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          messages: {
            create: { role: 'user', content: message },
          },
        },
        include: { messages: true },
      });
    }

    const formattedMessages = conversation.messages.map(({ role, content }) => ({
      role: role as 'system' | 'user' | 'assistant',
      content
    }));

    const res = await groq.chat.completions.create({
      messages: formattedMessages,
      model: "llama3-70b-8192"
    });

    let response = res?.choices?.[0]?.message?.content;

    if (!response) {
      throw new Error('No response from Groq API');
    }

    const updatedConversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        messages: {
          create: { role: 'assistant', content: response },
        },
        title: conversation.messages[0]?.content.split(' ')[0] || 'New Conversation',
      },
      include: {
        messages: true,
        children: {
          include: {
            messages: true,
          },
        },
      },
    });

    return NextResponse.json(updatedConversation);
  } catch (error) {
    console.error('Error in chat API route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}