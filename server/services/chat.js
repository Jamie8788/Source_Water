const { Server } = require('socket.io')
const db = require('../db/connection')
const { requireAuth } = require('../middleware/auth')

class ChatService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    })
    
    this.setupEvents()
  }

  setupEvents() {
    this.io.on('connection', (socket) => {
      console.log('User connected:', socket.id)

      // Join user to their personal room
      socket.on('join', (userId) => {
        socket.userId = userId
        socket.join(`user_${userId}`)
        console.log(`User ${userId} joined room user_${userId}`)
        
        // Mark user as online
        this.setUserOnline(userId, true)
        
        // Send online status to user's friends (simplified - just notify user)
        socket.emit('status_update', { userId, status: 'online' })
      })

      // Send message
      socket.on('send_message', async (data) => {
        try {
          const { receiverId, content, messageType = 'text', mediaPath, voicePath } = data
          
          if (!socket.userId) {
            socket.emit('error', { message: 'Authentication required' })
            return
          }

          // Save message to database
          const result = db.prepare(`
            INSERT INTO direct_messages (sender_id, receiver_id, content, media, voice_note, message_type, read)
            VALUES (?,?,?,?,?,?,0)
          `).run(socket.userId, receiverId, content || null, mediaPath || null, voicePath || null, messageType)

          const message = db.prepare(`
            SELECT dm.*, u.username, u.display_name, u.avatar_emoji 
            FROM direct_messages dm 
            JOIN users u ON dm.sender_id = u.id 
            WHERE dm.id = ?
          `).get(result.lastInsertRowid)

          // Send to receiver
          socket.to(`user_${receiverId}`).emit('new_message', message)
          
          // Send back to sender
          socket.emit('message_sent', message)

          // Award points for sending message
          db.prepare('INSERT INTO leaderboard_points (user_id,points,action,month) VALUES (?,?,?,?)')
            .run(socket.userId, 1, 'dm_sent', new Date().toISOString().slice(0,7))

          // Create notification for receiver
          const sender = db.prepare('SELECT display_name, username FROM users WHERE id=?').get(socket.userId)
          db.prepare('INSERT INTO notifications (user_id,type,title,message,link) VALUES (?,?,?,?,?)')
            .run(receiverId, 'dm', 'New Message', `${sender.display_name || sender.username} sent you a message`, `/messages/${socket.userId}`)

        } catch (error) {
          console.error('Error sending message:', error)
          socket.emit('error', { message: 'Failed to send message' })
        }
      })

      // Mark message as read
      socket.on('mark_read', async (messageId) => {
        try {
          db.prepare('UPDATE direct_messages SET read = 1 WHERE id = ?').run(messageId)
          socket.emit('message_read', { messageId })
        } catch (error) {
          console.error('Error marking message as read:', error)
        }
      })

      // Typing indicators
      socket.on('typing', (data) => {
        const { receiverId } = data
        socket.to(`user_${receiverId}`).emit('user_typing', { userId: socket.userId })
      })

      socket.on('stop_typing', (data) => {
        const { receiverId } = data
        socket.to(`user_${receiverId}`).emit('user_stop_typing', { userId: socket.userId })
      })

      // Disconnect
      socket.on('disconnect', () => {
        console.log('User disconnected:', socket.userId)
        if (socket.userId) {
          this.setUserOnline(socket.userId, false)
          socket.emit('status_update', { userId: socket.userId, status: 'offline' })
        }
      })
    })
  }

  setUserOnline(userId, isOnline) {
    db.run('UPDATE users SET is_active = ? WHERE id = ?', [isOnline ? 1 : 0, userId])
      .catch(err => console.error('Error updating user status:', err.message))
  }

  // Get user's online status
  async getUserStatus(userId) {
    const user = await db.get('SELECT is_active FROM users WHERE id = ?', [userId])
    return user ? user.is_active === true || user.is_active === 1 : false
  }

  // Get unread count for user
  getUnreadCount(userId) {
    const result = db.prepare('SELECT COUNT(*) as count FROM direct_messages WHERE receiver_id = ? AND read = 0').get(userId)
    return result ? result.count : 0
  }
}

module.exports = ChatService