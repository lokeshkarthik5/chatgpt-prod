'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { Pencil, Check, X, Plus } from 'lucide-react'
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
}

export default function ChatGPT() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationIndex, setCurrentConversationIndex] = useState(0)
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const { toast } = useToast()
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (conversations.length === 0) {
      setConversations([{ id: '1', messages: [], title: 'New Conversation' }])
    }
  }, [conversations])

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [conversations])

  const currentConversation = conversations[currentConversationIndex] || { id: '1', messages: [], title: 'New Conversation' }

  const handleSendMessage = async (messageToSend: string, editedMessageId: string | null = null) => {
    if (!messageToSend.trim()) return

    const newMessage: Message = { id: Date.now().toString(), role: 'user', content: messageToSend }
    
    let updatedMessages: Message[]
    updatedMessages = [...currentConversation.messages, newMessage]

    setConversations(prevConversations => 
      prevConversations.map((conv, index) => 
        index === currentConversationIndex ? { ...conv, messages: updatedMessages } : conv
      )
    )

    setInputMessage('')
    setIsLoading(true)
    setEditingMessageId(null)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          messages: updatedMessages.map(({ role, content }) => ({ role, content }))
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()
      const assistantMessage: Message = { id: Date.now().toString(), role: 'assistant', content: data.response }
      
      setConversations(prevConversations => 
        prevConversations.map((conv, index) => 
          index === currentConversationIndex
            ? { ...conv, messages: [...updatedMessages, assistantMessage] } 
            : conv
        )
      )

      // Update conversation title if it's the first message
      if (updatedMessages.length === 1) {
        setConversations(prevConversations =>
          prevConversations.map((conv, index) =>
            index === currentConversationIndex
              ? { ...conv, title: messageToSend.slice(0, 30) + (messageToSend.length > 30 ? '...' : '') }
              : conv
          )
        )
      }
    } catch (error) {
      console.error('Error fetching response:', error)
      toast({
        title: "Error",
        description: "Failed to get a response. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditMessage = (messageId: string) => {
    const messageToEdit = currentConversation.messages.find(m => m.id === messageId)
    if (messageToEdit) {
      setInputMessage(messageToEdit.content)
      setEditingMessageId(messageId)
    }
  }

  const handleCancelEdit = () => {
    setInputMessage('')
    setEditingMessageId(null)
  }

  const handleNewConversation = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      messages: [],
      title: 'New Conversation'
    }
    setConversations([...conversations, newConversation])
    setCurrentConversationIndex(conversations.length)
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-gray-100 p-4 overflow-auto">
        <Button onClick={handleNewConversation} className="w-full mb-4">
          <Plus className="mr-2 h-4 w-4" /> New Conversation
        </Button>
        {conversations.map((conv, index) => (
          <Button
            key={conv.id}
            variant={index === currentConversationIndex ? "secondary" : "ghost"}
            className={cn(
              "w-full justify-start mb-2 overflow-hidden",
              index === currentConversationIndex ? "bg-secondary" : ""
            )}
            onClick={() => setCurrentConversationIndex(index)}
          >
            {conv.title}
          </Button>
        ))}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col p-4">
        <h1 className="text-2xl font-bold mb-4">{currentConversation.title}</h1>
        <ScrollArea className="flex-grow mb-4 p-4 border rounded-md" ref={scrollAreaRef}>
          {currentConversation.messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
              <div className={`flex items-start ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <Avatar className="w-8 h-8">
                  <AvatarFallback>{message.role === 'user' ? 'U' : 'AI'}</AvatarFallback>
                </Avatar>
                <div className={`mx-2 p-2 rounded-lg ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}>
                  {message.content}
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
          ))}
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