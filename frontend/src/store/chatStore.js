import { create } from 'zustand';
import api from '../services/api';

const useChatStore = create((set, get) => ({
  chats: [],
  selectedChat: null,
  messages: [],
  isChatsLoading: false,
  isMessagesLoading: false,
  
  setChats: (chats) => set({ chats }),
  setSelectedChat: (chat) => set({ selectedChat: chat }),
  setMessages: (messages) => set({ messages }),
  
  // Real-time updates
  addMessage: (message) => {
    const { selectedChat, messages, chats } = get();
    
    // Only add to current view if it belongs to selected chat
    if (selectedChat && selectedChat._id === message.chat._id) {
       set({ messages: [...messages, message] });
    }
    
    // Update latest message in chats list
    const updatedChats = chats.map(c => 
       c._id === message.chat._id ? { ...c, lastMessage: message } : c
    );
    
    // Sort logic to bubble up the chat with new msg
    updatedChats.sort((a,b) => new Date(b.lastMessage?.createdAt || b.createdAt) - new Date(a.lastMessage?.createdAt || a.createdAt));
    
    set({ chats: updatedChats });
  },

  // Fetch all user chats
  fetchChats: async () => {
    set({ isChatsLoading: true });
    try {
      const { data } = await api.get('/chat');
      set({ chats: data, isChatsLoading: false });
    } catch (error) {
      console.error(error);
      set({ isChatsLoading: false });
    }
  },

  // Fetch messages for selected chat
  fetchMessages: async (chatId) => {
    set({ isMessagesLoading: true });
    try {
      const { data } = await api.get(`/message/${chatId}`);
      set({ messages: data, isMessagesLoading: false });
    } catch (error) {
      console.error(error);
      set({ isMessagesLoading: false });
    }
  }
}));

export default useChatStore;
