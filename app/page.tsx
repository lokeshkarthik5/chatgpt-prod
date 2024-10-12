'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { Pencil, Check, X, Plus, ChevronRight } from 'lucide-react'
import { cn } from "@/lib/utils"

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

type Conversation = {
  id: string;
  messages: Message[];
  title: string;
  parentId: string | null;
  children: Conversation[];
}

export default function ChatGPT() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const { toast } = useToast()
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchConversations()
  }, [])

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [conversations, currentConversationId])

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations')
      if (!response.ok) {
        throw new Error('Failed to fetch conversations')
      }
      const fetchedConversations = await response.json()
      setConversations(Array.isArray(fetchedConversations) ? fetchedConversations : [])
      if (fetchedConversations.length > 0 && !currentConversationId) {
        setCurrentConversationId(fetchedConversations[0].id)
      }
    } catch (error) {
      console.error('Error fetching conversations:', error)
      toast({
        title: "Error",
        description: "Failed to fetch conversations. Please try again.",
        variant: "destructive",
      })
      setConversations([])
    }
  }

  const findConversationById = (id: string, convs: Conversation[]): Conversation | null => {
    for (const conv of convs) {
      if (conv.id === id) {
        return conv
      }
      if (conv.children) {
        const found = findConversationById(id, conv.children)
        if (found) {
          return found
        }
      }
    }
    return null
  }

  const currentConversation = currentConversationId
    ? findConversationById(currentConversationId, conversations)
    : null

  const updateConversationInState = (updatedConversation: Conversation) => {
    setConversations(prevConversations => {
      const updateConversationInTree = (convs: Conversation[]): Conversation[] => {
        return convs.map(conv => {
          if (conv.id === updatedConversation.id) {
            return {
              ...updatedConversation,
              title: updatedConversation.messages[0]?.content.split(' ').slice(0, 3).join(' ') || 'New Conversation',
              children: conv.children || []
            }
          }
          if (conv.children) {
            return {
              ...conv,
              children: updateConversationInTree(conv.children)
            }
          }
          return conv
        })
      }
      return updateConversationInTree(prevConversations)
    })
  }

  const handleSendMessage = async (messageToSend: string, editedMessageId: string | null = null) => {
    if (!messageToSend.trim() || !currentConversationId) {
      toast({
        title: "Error",
        description: "Please enter a message and select a conversation.",
        variant: "destructive",
      })
      return
    }

    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          message: messageToSend,
          conversationId: currentConversationId,
          editedMessageId
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to send message')
      }

      const updatedConversation = await response.json()

      if (editedMessageId) {
        // Create a new branch
        setConversations(prevConversations => {
          const updateConversationInTree = (convs: Conversation[]): Conversation[] => {
            return convs.map(conv => {
              if (conv.id === currentConversationId) {
                return {
                  ...conv,
                  children: [...(conv.children || []), updatedConversation]
                }
              }
              if (conv.children) {
                return {
                  ...conv,
                  children: updateConversationInTree(conv.children)
                }
              }
              return conv
            })
          }
          return updateConversationInTree(prevConversations)
        })
        setCurrentConversationId(updatedConversation.id)
      } else {
        // Update existing conversation
        updateConversationInState(updatedConversation)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setEditingMessageId(null)
    }
  }

  const handleEditMessage = (messageId: string) => {
    const messageToEdit = currentConversation?.messages.find(m => m.id === messageId)
    if (messageToEdit) {
      setInputMessage(messageToEdit.content)
      setEditingMessageId(messageId)
    }
  }

  const handleCancelEdit = () => {
    setInputMessage('')
    setEditingMessageId(null)
  }

  const handleNewConversation = async () => {
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'New Conversation' }),
      })

      if (!response.ok) {
        throw new Error('Failed to create new conversation')
      }

      const newConversation = await response.json()
      setConversations(prevConversations => [...prevConversations, {...newConversation, children: []}])
      setCurrentConversationId(newConversation.id)
    } catch (error) {
      console.error('Error creating new conversation:', error)
      toast({
        title: "Error",
        description: "Failed to create a new conversation. Please try again.",
        variant: "destructive",
      })
    }
  }

  const renderConversationTree = (convs: Conversation[], depth = 0) => {
    return convs.map((conv) => (
      <div key={conv.id} className={`mb-2 ${depth > 0 ? 'ml-4' : ''}`}>
        <Button
          variant={conv.id === currentConversationId ? "secondary" : "ghost"}
          className={cn(
            "w-full justify-start overflow-hidden",
            conv.id === currentConversationId ? "bg-secondary" : ""
          )}
          onClick={() => setCurrentConversationId(conv.id)}
        >
          {depth > 0 && <ChevronRight className="mr-2 h-4 w-4" />}
          {conv.title}
        </Button>
        {conv.children && conv.children.length > 0 && renderConversationTree(conv.children, depth + 1)}
      </div>
    ))
  }

  const renderMessageContent = (content: string) => {
    const parts = content.split(/(\*\*[^*]+\*\*)/)
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>
      }
      return <span key={index}>{part}</span>
    })
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-gray-100 p-4 overflow-auto">
        <Button onClick={handleNewConversation} className="w-full mb-4">
          <Plus className="mr-2 h-4 w-4" /> New Conversation
        </Button>
        {renderConversationTree(conversations)}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col p-4">
        <h1 className="text-2xl font-bold mb-4">{currentConversation?.title || 'New Conversation'}</h1>
        <ScrollArea className="flex-grow mb-4 p-4 border rounded-md" ref={scrollAreaRef}>
          {currentConversation?.messages && currentConversation.messages.length > 0 ? (
            currentConversation.messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
                <div className={`flex items-start ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>{message.role === 'user' ? 'U' : 'AI'}</AvatarFallback>
                  </Avatar>
                  <div className={`mx-2 p-2 rounded-lg ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                    {renderMessageContent(message.content)}
                  </div>
                  {message.role === 'user' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditMessage(message.id)}
                      className="ml-2"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-gray-500">No messages yet. Start a conversation!</div>
          )}
          {isLoading && (
            <div className="flex justify-start mb-4">
              <div className="flex items-center bg-gray-200 rounded-lg p-2">
                <div className="dot-flashing"></div>
              </div>
            </div>
          )}
        </ScrollArea>
        <div className="flex space-x-2">
          <Input
            type="text"
            placeholder={editingMessageId ? "Edit your message..." : "Type your message..."}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage(inputMessage, editingMessageId)
              }
            }}
          />
          {editingMessageId ? (
            <>
              <Button onClick={() => handleSendMessage(inputMessage, editingMessageId)} disabled={isLoading}>
                <Check className="h-4 w-4 mr-2" /> Update
              </Button>
              <Button onClick={handleCancelEdit} variant="outline">
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
            </>
          ) : (
            <Button onClick={() => handleSendMessage(inputMessage)} disabled={isLoading}>Send</Button>
          )}
        </div>
      </div>
    </div>
  )
}