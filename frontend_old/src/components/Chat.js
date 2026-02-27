import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import socket from '../socket.js';
import Message from './Message.js';
import EmojiPicker from './EmojiPicker.js';
import AvatarUpload from './AvatarUpload.js';
import VoiceChat from './VoiceChat.js';
import AccountSwitcher from './AccountSwitcher.js';

const Chat = ({ user, onLogout }) => {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState([]);
  const [showUserList, setShowUserList] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [userAvatar, setUserAvatar] = useState(user.avatar);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchChats();
    fetchUsers();

    // Socket event listeners
    socket.on('receive_message', (message) => {
      if (selectedChat && message.chat === selectedChat._id) {
        setMessages(prev => [...prev, message]);
        markMessageAsSeen(message._id);
      }
      updateChatLastMessage(message);
    });

    socket.on('message_delivered', (messageId) => {
      setMessages(prev => prev.map(msg => 
        msg._id === messageId ? { ...msg, status: 'delivered' } : msg
      ));
    });

    socket.on('message_seen', ({ messageId, seenBy }) => {
      if (seenBy === user._id) return;
      setMessages(prev => prev.map(msg => 
        msg._id === messageId ? { ...msg, status: 'seen' } : msg
      ));
    });

    socket.on('user_typing', ({ userId, isTyping }) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        if (isTyping) {
          newSet.add(userId);
        } else {
          newSet.delete(userId);
        }
        return newSet;
      });
    });

    socket.on('user_online', (userId) => {
      setOnlineUsers(prev => new Set(prev).add(userId));
      updateUserOnlineStatus(userId, true);
    });

    socket.on('user_offline', (userId) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      updateUserOnlineStatus(userId, false);
    });

    return () => {
      socket.off('receive_message');
      socket.off('message_delivered');
      socket.off('message_seen');
      socket.off('user_typing');
      socket.off('user_online');
      socket.off('user_offline');
    };
  }, [selectedChat, user._id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChats = async () => {
    try {
      const response = await axios.get('/api/users/chats', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setChats(response.data.chats);
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setUsers(response.data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchMessages = async (chatId) => {
    try {
      const response = await axios.get(`/api/users/chats/${chatId}/messages`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const selectChat = (chat) => {
    setSelectedChat(chat);
    socket.emit('join_chat', chat._id);
    fetchMessages(chat._id);
  };

  const createChat = async (userId) => {
    try {
      const response = await axios.post('/api/users/chats', {
        participantId: userId,
        isGroupChat: false
      }, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      const newChat = response.data.chat;
      setChats(prev => [newChat, ...prev]);
      setSelectedChat(newChat);
      socket.emit('join_chat', newChat._id);
      setMessages([]);
      setShowUserList(false);
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !selectedChat) return;

    const messageData = {
      chatId: selectedChat._id,
      content: newMessage.trim() || (selectedFile ? 'Shared a file' : ''),
      messageType: selectedFile ? 'file' : 'text'
    };

    if (selectedFile) {
      // Handle file upload
      uploadAndSendFile(messageData);
    } else {
      socket.emit('send_message', messageData);
      setNewMessage('');
      stopTyping();
    }
  };

  const uploadAndSendFile = async (messageData) => {
    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('chatId', selectedChat._id);

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      messageData.fileUrl = response.data.fileUrl;
      messageData.fileName = selectedFile.name;
      messageData.fileSize = selectedFile.size;

      socket.emit('send_message', messageData);
      setNewMessage('');
      setSelectedFile(null);
      stopTyping();
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleAvatarChange = (newAvatarUrl) => {
    setUserAvatar(newAvatarUrl);
    // Update user in local state
    user.avatar = newAvatarUrl;
  };

  const markMessageAsSeen = (messageId) => {
    socket.emit('mark_seen', {
      chatId: selectedChat._id,
      messageId
    });
  };

  const updateChatLastMessage = (message) => {
    setChats(prev => prev.map(chat => 
      chat._id === message.chat 
        ? { ...chat, lastMessage: message, updatedAt: new Date() }
        : chat
    ));
  };

  const updateUserOnlineStatus = (userId, isOnline) => {
    setUsers(prev => prev.map(u => 
      u._id === userId ? { ...u, isOnline } : u
    ));
    setChats(prev => prev.map(chat => ({
      ...chat,
      participants: chat.participants.map(p => 
        p._id === userId ? { ...p, isOnline } : p
      )
    })));
  };

  const handleTyping = () => {
    if (!typingTimeoutRef.current) {
      socket.emit('typing', { chatId: selectedChat._id });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 1000);
  };

  const stopTyping = () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      socket.emit('stop_typing', { chatId: selectedChat._id });
    }
  };

  const getChatName = (chat) => {
    if (chat.isGroupChat) {
      return chat.name;
    }
    const otherParticipant = chat.participants.find(p => p._id !== user._id);
    return otherParticipant?.username || 'Unknown';
  };

  const getChatAvatar = (chat) => {
    if (chat.isGroupChat) {
      return '👥';
    }
    const otherParticipant = chat.participants.find(p => p._id !== user._id);
    return otherParticipant?.username?.charAt(0).toUpperCase() || '?';
  };

  const getTypingUsers = () => {
    if (!selectedChat) return [];
    return Array.from(typingUsers).filter(userId => {
      return selectedChat.participants.some(p => p._id === userId);
    });
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredChats = chats.filter(chat => 
    getChatName(chat).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="container">
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--spacing-md)',
        padding: 'var(--spacing-md)',
        background: 'var(--background-sidebar)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <AvatarUpload
            currentAvatar={userAvatar}
            onAvatarChange={handleAvatarChange}
            userId={user._id}
          />
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Chat App</h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
              {onlineUsers.size + 1} online
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <AccountSwitcher
            currentAccount={user}
            onAccountSwitch={onLogout}
          />
          <button 
            className="btn btn-secondary"
            onClick={onLogout}
            style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="chat-container">
        {/* Sidebar */}
        <div className="chat-sidebar">
          {/* Search Bar */}
          <div style={{ padding: 'var(--spacing-md)', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search chats or users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '40px' }}
              />
              <span style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}>
                🔍
              </span>
            </div>
            
            <button 
              className="btn btn-primary" 
              style={{ 
                width: '100%', 
                marginTop: 'var(--spacing-md)',
                padding: 'var(--spacing-sm)'
              }}
              onClick={() => setShowUserList(!showUserList)}
            >
              {showUserList ? '← Back to Chats' : '+ New Chat'}
            </button>
            
            {showUserList && (
              <div style={{ marginTop: 'var(--spacing-md)', maxHeight: '300px', overflowY: 'auto' }}>
                {filteredUsers.map(u => (
                  <div 
                    key={u._id} 
                    className="chat-list-item"
                    onClick={() => createChat(u._id)}
                  >
                    <div className="chat-avatar">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="chat-info">
                      <div className="chat-name">{u.username}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {u.email}
                      </div>
                    </div>
                    {u.isOnline ? (
                      <span className="online-indicator"></span>
                    ) : (
                      <span className="offline-indicator"></span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat List */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {!showUserList && filteredChats.map(chat => (
              <div
                key={chat._id}
                className={`chat-list-item ${selectedChat?._id === chat._id ? 'active' : ''}`}
                onClick={() => selectChat(chat)}
              >
                <div className="chat-avatar">
                  {getChatAvatar(chat)}
                </div>
                <div className="chat-info">
                  <div className="chat-name">{getChatName(chat)}</div>
                  {chat.lastMessage && (
                    <div className="chat-last-message">
                      {chat.lastMessage.content.substring(0, 30)}...
                    </div>
                  )}
                </div>
                <div className="chat-meta">
                  {chat.updatedAt && (
                    <div className="chat-time">
                      {formatTime(chat.updatedAt)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="chat-main">
          {selectedChat ? (
            <>
              <div className="chat-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                  <div className="chat-avatar">
                    {getChatAvatar(selectedChat)}
                  </div>
                  <div>
                    <h3 style={{ margin: 0 }}>{getChatName(selectedChat)}</h3>
                    <p style={{ 
                      margin: 0, 
                      fontSize: '12px', 
                      color: 'var(--text-secondary)' 
                    }}>
                      {selectedChat.participants.find(p => p._id !== user._id)?.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
                  <VoiceChat
                    chatId={selectedChat._id}
                    userId={user._id}
                    socket={socket}
                  />
                  <button className="btn" style={{ background: 'none', padding: '8px' }}>
                    ℹ️
                  </button>
                </div>
              </div>

              <div className="chat-messages">
                {messages.map(message => (
                  <Message
                    key={message._id}
                    message={message}
                    isOwn={message.sender._id === user._id}
                  />
                ))}
                
                {getTypingUsers().length > 0 && (
                  <div className="typing-indicator">
                    {getTypingUsers().map(userId => {
                      const typingUser = users.find(u => u._id === userId);
                      return typingUser?.username;
                    }).join(', ')} {getTypingUsers().length === 1 ? 'is' : 'are'} typing...
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={sendMessage} className="chat-input">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                />
                
                <button 
                  type="button" 
                  className="btn" 
                  style={{ background: 'none', padding: '8px', borderRadius: '50%' }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach File"
                >
                  📎
                </button>
                
                <input
                  type="text"
                  className="form-control"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    handleTyping();
                  }}
                  placeholder="Type a message..."
                  style={{ flex: 1 }}
                />
                
                {selectedFile && (
                  <div style={{
                    background: 'var(--background-input)',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)'
                  }}>
                    📎 {selectedFile.name}
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '2px'
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
                
                <div style={{ position: 'relative' }}>
                  <button 
                    type="button" 
                    className="btn" 
                    style={{ background: 'none', padding: '8px', borderRadius: '50%' }}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    title="Emoji"
                  >
                    😊
                  </button>
                  
                  {showEmojiPicker && (
                    <EmojiPicker
                      onEmojiSelect={handleEmojiSelect}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>
                
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ 
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  disabled={(!newMessage.trim() && !selectedFile) || uploadingFile}
                >
                  {uploadingFile ? (
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid white',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                  ) : (
                    '➤'
                  )}
                </button>
              </form>
            </>
          ) : (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              color: 'var(--text-secondary)',
              textAlign: 'center'
            }}>
              <div style={{
                width: '120px',
                height: '120px',
                background: 'var(--gradient-primary)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '48px',
                marginBottom: 'var(--spacing-lg)',
                opacity: 0.8
              }}>
                💬
              </div>
              <h3 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-primary)' }}>
                Welcome to Chat App
              </h3>
              <p style={{ maxWidth: '300px' }}>
                Select a chat from the sidebar or create a new conversation to start messaging
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
