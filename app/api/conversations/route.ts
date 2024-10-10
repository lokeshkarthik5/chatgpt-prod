import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      include: {
        messages: true,
        children: {
          include: {
            messages: true,
          },
        },
      },
      where: {
        parentId: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    const processConversations = (convs: any[]): any[] => {
      return convs.map(conv => ({
        ...conv,
        title: conv.messages[0]?.content.split(' ')[0] || 'New Conversation',
        children: processConversations(conv.children || []),
      }));
    };

    const processedConversations = processConversations(conversations);

    return NextResponse.json(processedConversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST(req: Request) {
  try {
    const { title, parentId } = await req.json();
    const newConversation = await prisma.conversation.create({
      data: {
        title: title || 'New Conversation',
        parentId,
      },
      include: {
        messages: true,
      },
    });

    return NextResponse.json(newConversation);
  } catch (error) {
    console.error('Error creating new conversation:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}