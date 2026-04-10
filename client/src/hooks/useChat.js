import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace('/api', '')

export function useChat(userId) {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [typingUsers, setTypingUsers] = useState(new Set())
  const [onlineUsers, setOnlineUsers] = useState(new Set())
  const [lastMessage, setLastMessage] = useState(null)
  
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  useEffect(() => {
    if (!userId) return

    // Initialize socket connection
    const token = localStorage.getItem('sw_token')
    const newSocket = io(API_BASE, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    })

    // Connection events
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id)
      setIsConnected(true)
      reconnectAttempts.current = 0
      
      // Join user room
      newSocket.emit('join', userId)
    })

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected')
      setIsConnected(false)
      setOnlineUsers(prev => new Set([...prev].filter(id => id !== userId)))
    })

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      setIsConnected(false)
      
      // Attempt reconnection
      if (reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++
        setTimeout(() => {
          newSocket.connect()
        }, 1000 * reconnectAttempts.current)
      }
    })

    // Message events
    newSocket.on('new_message', (message) => {
      console.log('New message received:', message)
      setLastMessage(message)
      // Update unread count
      setUnreadCount(prev => prev + 1)
      
      // Play notification sound
      try {
        const audio = new Audio('/notification-sound.mp3')
        audio.play().catch(() => {
          // Ignore autoplay errors
        })
      } catch (e) {
        // Fallback notification
        if (window.Notification && Notification.permission === 'granted') {
          new Notification('New Message', {
            body: `${message.display_name || message.username}: ${message.content || '[Media]'}`,
            icon: '/favicon.ico'
          })
        }
      }
    })

    newSocket.on('message_sent', (message) => {
      console.log('Message sent successfully:', message)
    })

    newSocket.on('message_read', (data) => {
      console.log('Message read:', data)
    })

    // Typing indicators
    newSocket.on('user_typing', (data) => {
      setTypingUsers(prev => new Set([...prev, data.userId]))
      setTimeout(() => {
        setTypingUsers(prev => {
          const newSet = new Set(prev)
          newSet.delete(data.userId)
          return newSet
        })
      }, 3000) // Stop showing after 3 seconds
    })

    newSocket.on('user_stop_typing', (data) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev)
        newSet.delete(data.userId)
        return newSet
      })
    })

    // Status updates
    newSocket.on('status_update', (data) => {
      if (data.status === 'online') {
        setOnlineUsers(prev => new Set([...prev, data.userId]))
      } else {
        setOnlineUsers(prev => new Set([...prev].filter(id => id !== data.userId)))
      }
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [userId])

  // Send message
  const sendMessage = (receiverId, content, messageType = 'text', mediaPath = null, voicePath = null) => {
    if (!socket || !isConnected) {
      console.error('Socket not connected')
      return
    }

    socket.emit('send_message', {
      receiverId,
      content,
      messageType,
      mediaPath,
      voicePath
    })
  }

  // Mark message as read
  const markAsRead = (messageId) => {
    if (!socket || !isConnected) return
    socket.emit('mark_read', messageId)
  }

  // Typing indicators
  const startTyping = (receiverId) => {
    if (!socket || !isConnected) return
    socket.emit('typing', { receiverId })
  }

  const stopTyping = (receiverId) => {
    if (!socket || !isConnected) return
    socket.emit('stop_typing', { receiverId })
  }

  // Get unread count
  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/messages/unread/count`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sw_token')}`
        }
      })
      const data = await response.json()
      setUnreadCount(data.count || 0)
    } catch (error) {
      console.error('Failed to fetch unread count:', error)
    }
  }

  // Reset unread count
  const resetUnreadCount = () => {
    setUnreadCount(0)
  }

  return {
    socket,
    isConnected,
    unreadCount,
    typingUsers,
    onlineUsers,
    lastMessage,
    sendMessage,
    markAsRead,
    startTyping,
    stopTyping,
    fetchUnreadCount,
    resetUnreadCount
  }
}