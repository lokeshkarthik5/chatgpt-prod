import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        parentId: null,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        messages: {
          select: {
            content: true,
          },
        },
      },
    });

    const processConversations = async (convs: any[]): Promise<any[]> => {
      const processedConvs = await Promise.all(convs.map(async (conv) => {
        const children = await prisma.conversation.findMany({
          where: { parentId: conv.id },
          include: {
            messages: {
              select: {
                content: true,
              },
            },
          },
        });

        return {
          ...conv,
          title: conv.messages[0]?.content.split(' ')[0] || 'New Conversation',
          children: await processConversations(children),
        };
      }));

      return processedConvs;
    };

    const processedConversations = await processConversations(conversations);

    return NextResponse.json(processedConversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
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
