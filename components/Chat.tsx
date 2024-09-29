"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  firstMessage: string;
  responseMessage: string;
  createdAt: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeConversation: string;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

const Sidebar: React.FC<SidebarProps> = React.memo(({ conversations, activeConversation, onSelectConversation, onNewConversation }) => (
  <div className="w-64 bg-[#171717] h-screen p-4 text-white overflow-y-auto">
    <button
      onClick={onNewConversation}
      className="w-full bg-black text-white p-2 rounded mb-4 hover:bg-gray-900"
    >
      New Conversation
    </button>
    {conversations.map((conv) => (
      <div
        key={conv.id}
        onClick={() => onSelectConversation(conv.id)}
        className={`p-2 mb-2 rounded cursor-pointer ${
          activeConversation === conv.id ? 'bg-gray-800' : 'hover:bg-gray-800'
        }`}
      >
        {conv.firstMessage.substring(0, 30)}...
      </div>
    ))}
  </div>
));

Sidebar.displayName = 'SideBar';

interface MessageItemProps {
  message: Message;
  onEdit: (id: string) => void;
  isEditing: boolean;
  onUpdate: (id: string, content: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = React.memo(({ message, onEdit, isEditing, onUpdate }) => (
  <div className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
    {message.role === 'user' && isEditing ? (
      <form onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const input = e.currentTarget.querySelector('input') as HTMLInputElement;
        onUpdate(message.id, input.value);
      }}>
        <input
          type="text"
          defaultValue={message.content}
          className="bg-[#2f2f2f] text-white border border-[#4a4a4a] rounded p-1 mr-2 w-full"
          autoFocus
        />
        <button type="submit" className="bg-blue-500 text-white px-2 py-1 rounded mt-2">
          Update
        </button>
      </form>
    ) : (
      <>
        <span
          className={`inline-block p-2 rounded ${
            message.role === 'user' ? 'bg-blue-500' : 'bg-gray-700'
          }`}
        >
          {message.content}
        </span>
        {message.role === 'user' && (
          <button
            onClick={() => onEdit(message.id)}
            className="ml-2 text-sm text-gray-400 hover:text-gray-200"
          >
            Edit
          </button>
        )}
      </>
    )}
  </div>
));

MessageItem.displayName = 'MessageItem';

const Chat: React.FC = () => {
  const [input, setInput] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/list');
      if (!response.ok) throw new Error('Failed to fetch conversations');
      const data: Conversation[] = await response.json();
      setConversations(data);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setConversations([]);
    }
  }, []);

  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const response = await fetch(`/api/list?conversationId=${conversationId}`);
      if (!response.ok) throw new Error('Failed to fetch messages');
      const data: { messages: { user_message: string; assistant_response: string; created_at: string }[] } = await response.json();
      const formattedMessages: Message[] = data.messages.flatMap((msg) => [
        { id: `user-${uuidv4()}`, role: 'user', content: msg.user_message, createdAt: msg.created_at },
        { id: `assistant-${uuidv4()}`, role: 'assistant', content: msg.assistant_response, createdAt: msg.created_at }
      ]);
      setActiveMessages(formattedMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setActiveMessages([]);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation);
    }
  }, [activeConversation, fetchMessages]);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() === '') return;

    const messageId = uuidv4();
    const conversationId = activeConversation || uuidv4();

    const newMessage: Message = { id: messageId, role: 'user', content: input, createdAt: new Date().toISOString() };

    setActiveMessages(prev => [...prev, newMessage]);
    setActiveConversation(conversationId);
    setLoading(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: input, conversationId,convertToPlainText: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate response');
      }

      const data: string = await response.json();

      const assistantMessage: Message = { 
        id: uuidv4(), 
        role: 'assistant', 
        content: data, 
        createdAt: new Date().toISOString() 
      };

      setActiveMessages(prev => [...prev, assistantMessage]);

      // Update conversations list
      await fetchConversations();

    } catch (error) {
      console.error(error);
      setActiveMessages(prev => [...prev, { id: uuidv4(), role: 'assistant', content: 'Sorry, an error occurred', createdAt: new Date().toISOString() }]);
    }

    setLoading(false);
    setInput('');
  }, [input, activeConversation, fetchConversations]);

  const handleNewConversation = useCallback(() => {
    const newId = uuidv4();
    setActiveConversation(newId);
    setActiveMessages([]);
  }, []);

  const handleEditMessage = useCallback((messageId: string) => {
    setEditingMessageId(messageId);
  }, []);

  const handleUpdateMessage = useCallback(async (messageId: string, newContent: string) => {
    if (newContent.trim() === '') return;

    setActiveMessages(prev =>
      prev.map(msg =>
        msg.id === messageId ? { ...msg, content: newContent } : msg
      )
    );
    setEditingMessageId(null);
    setLoading(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: newContent, conversationId: activeConversation }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate response');
      }

      const data: string = await response.json();

      setActiveMessages(prev => {
        const updatedIndex = prev.findIndex(msg => msg.id === messageId);
        if (updatedIndex !== -1 && updatedIndex + 1 < prev.length) {
          const newMessages = [...prev];
          newMessages[updatedIndex + 1] = { ...newMessages[updatedIndex + 1], content: data };
          return newMessages;
        } else {
          return [...prev, { id: uuidv4(), role: 'assistant', content: data, createdAt: new Date().toISOString() }];
        }
      });

      // Update conversations list
      await fetchConversations();
    } catch (error) {
      console.error(error);
      setActiveMessages(prev => [...prev, { id: uuidv4(), role: 'assistant', content: 'Sorry, an error occurred', createdAt: new Date().toISOString() }]);
    }

    setLoading(false);
  }, [activeConversation, fetchConversations]);

  const memoizedSidebar = useMemo(() => (
    <Sidebar
      conversations={conversations}
      activeConversation={activeConversation || ''}
      onSelectConversation={setActiveConversation}
      onNewConversation={handleNewConversation}
    />
  ), [conversations, activeConversation, handleNewConversation]);

  return (
    <div className="flex h-screen bg-[#212121] text-white">
      {memoizedSidebar}
      <div className="flex-grow flex flex-col h-full p-4">
        <div className="flex-grow overflow-auto mb-4 border border-[#2f2f2f] rounded p-4">
          {activeMessages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              onEdit={handleEditMessage}
              isEditing={editingMessageId === message.id}
              onUpdate={handleUpdateMessage}
            />
          ))}
          {loading && <div className="text-center">Loading...</div>}
        </div>

        <form onSubmit={handleSubmit} className="flex">
          <input
            type="text"
            value={input}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
            className="flex-grow bg-[#2f2f2f] text-white border border-[#4a4a4a] rounded-l p-2"
            placeholder="Type your message..."
          />
          <button
            type="submit"
            className="bg-slate-800 text-white px-4 py-2 rounded-r"
            disabled={loading}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

Chat.displayName = 'Chat';

export default Chat;