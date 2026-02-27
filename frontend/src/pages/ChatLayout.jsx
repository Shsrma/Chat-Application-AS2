import { useEffect } from 'react';
import useChatStore from '../store/chatStore';
import useAuthStore from '../store/authStore';
import { useSocket } from '../hooks/useSocket';
import { Search, MoreVertical, Edit2, LogOut, Settings } from 'lucide-react';

const ChatLayout = () => {
    // Initialize socket connection using the custom hook when the main app layout loads
    useSocket();

    const { user, logout } = useAuthStore();
    const { chats, fetchChats, selectedChat, setSelectedChat } = useChatStore();

    useEffect(() => {
        fetchChats();
    }, [fetchChats]);

    return (
        <div className="chat-layout-container text-white">
            {/* Sidebar / Chat List */}
            <div className="sidebar border-r">
                <div className="sidebar-header">
                     <div className="flex-between w-full">
                         <div className="flex-center gap-3">
                             <img src={user?.avatar} alt="Profile" className="avatar round-full" />
                             <div>
                                 <h3 className="font-semibold text-sm">{user?.username}</h3>
                                 <p className="text-xs text-green-400">Online</p>
                             </div>
                         </div>
                         <div className="flex-center gap-2 text-muted">
                              <Edit2 size={18} className="cursor-pointer hover-white" />
                              <Settings size={18} className="cursor-pointer hover-white" />
                              <LogOut size={18} className="cursor-pointer hover-red" onClick={logout} />
                         </div>
                     </div>
                     <div className="search-bar mt-4">
                         <Search size={16} className="text-muted" />
                         <input type="text" placeholder="Search chats..." className="search-input" />
                     </div>
                </div>

                <div className="chat-list custom-scrollbar">
                    {chats.length === 0 ? (
                         <div className="flex-center h-full text-muted text-sm">No chats found. Start one!</div>
                    ) : (chats.map((chat) => {
                         const chatName = chat.isGroupChat ? chat.chatName : chat.participants.find(p => p._id !== user._id)?.username;
                         const chatAvatar = chat.isGroupChat ? chat.groupAvatar || 'https://api.dicebear.com/7.x/initials/svg?seed=group' : chat.participants.find(p => p._id !== user._id)?.avatar;
                         const isSelected = selectedChat?._id === chat._id;
                         const lastMsg = chat.lastMessage?.content || "No messages yet";

                         return (
                            <div 
                                key={chat._id} 
                                onClick={() => setSelectedChat(chat)}
                                className={`chat-item ${isSelected ? 'selected' : ''}`}
                            >
                                <img src={chatAvatar} alt="Avatar" className="avatar-md round-full" />
                                <div className="chat-info">
                                    <div className="flex-between">
                                        <span className="chat-name">{chatName}</span>
                                        <span className="chat-time text-xs text-muted">
                                            {chat.lastMessage ? new Date(chat.lastMessage.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                                        </span>
                                    </div>
                                    <div className="flex-between">
                                        <span className="chat-preview text-xs text-muted truncate-1">{lastMsg}</span>
                                        {/* Unread badge would go here */}
                                    </div>
                                </div>
                            </div>
                         );
                    }))}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="main-chat">
                 {selectedChat ? (
                     <div className="flex flex-col h-full w-full">
                         {/* Chat Header */}
                         <div className="chat-header border-b">
                             <div className="flex-center gap-3">
                                 <img 
                                     src={selectedChat.isGroupChat ? (selectedChat.groupAvatar || 'https://api.dicebear.com/7.x/initials/svg?seed=group') : selectedChat.participants.find(p => p._id !== user._id)?.avatar} 
                                     alt="Chat Avatar" 
                                     className="avatar-md round-full" 
                                 />
                                 <div>
                                     <h3 className="font-semibold">{selectedChat.isGroupChat ? selectedChat.chatName : selectedChat.participants.find(p => p._id !== user._id)?.username}</h3>
                                     <p className="text-xs text-muted">
                                         {selectedChat.isGroupChat ? `${selectedChat.participants.length} members` : 'last seen recently'}
                                     </p>
                                 </div>
                             </div>
                             <div className="flex-center gap-4 text-muted">
                                 <Search size={20} className="cursor-pointer hover-white" />
                                 <MoreVertical size={20} className="cursor-pointer hover-white" />
                             </div>
                         </div>
                         
                         {/* Messages Area (Placeholder for MessageList Component) */}
                         <div className="messages-area custom-scrollbar flex-1 bg-chat-pattern relative">
                              <div className="absolute inset-0 flex-center flex-col text-muted">
                                   <div className="glass-panel p-4 text-sm mix-blend-plus-lighter">
                                       Messages will populate here using Message API. Infinite scrolling enables historical fetch.
                                   </div>
                              </div>
                         </div>
                         
                         {/* Input Area */}
                         <div className="chat-input-area border-t">
                              <input type="text" placeholder="Type a message..." className="message-input" />
                              <button className="btn-send text-accent hover:text-accent-hover cursor-pointer font-semibold">Send</button>
                         </div>
                     </div>
                 ) : (
                     <div className="flex-center h-full w-full flex-col text-muted">
                         <div className="glass-panel p-8 text-center max-w-sm">
                             <div className="bg-tertiary w-16 h-16 rounded-full flex-center mx-auto mb-4">
                                <Search size={24} />
                             </div>
                             <h2 className="text-lg font-bold text-white mb-2">Select a chat to start messaging</h2>
                             <p className="text-sm">Choose from the sidebar or search to find people to talk to in the enterprise network.</p>
                         </div>
                     </div>
                 )}
            </div>
        </div>
    );
};

// Vanilla CSS Grid/Flex Layouts for Chat App injected securely
const style = document.createElement('style');
style.textContent = `
  .chat-layout-container { display: flex; height: 100vh; width: 100vw; overflow: hidden; background-color: var(--bg-primary); }
  .sidebar { width: 320px; min-width: 320px; display: flex; flex-direction: column; background-color: var(--bg-secondary); border-color: var(--border-color); }
  .main-chat { flex: 1; display: flex; flex-direction: column; position: relative; }
  .border-r { border-right: 1px solid var(--border-color); }
  .border-b { border-bottom: 1px solid var(--border-color); }
  .border-t { border-top: 1px solid var(--border-color); }
  
  .sidebar-header { padding: 16px; display: flex; flex-direction: column; border-bottom: 1px solid var(--border-color); }
  .chat-list { flex: 1; overflow-y: auto; overflow-x: hidden; }
  
  .chat-item { display: flex; align-items: center; padding: 12px 16px; gap: 12px; cursor: pointer; transition: background 0.2s; }
  .chat-item:hover { background-color: var(--bg-tertiary); }
  .chat-item.selected { background-color: var(--accent-primary); }
  .chat-info { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
  .chat-name { font-weight: 500; font-size: 0.9rem; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  
  .chat-header { height: 64px; min-height: 64px; padding: 0 20px; display: flex; align-items: center; justify-content: space-between; background-color: var(--bg-secondary); }
  .messages-area { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
  .chat-input-area { min-height: 72px; padding: 16px 20px; background-color: var(--bg-secondary); display: flex; align-items: center; gap: 12px; }
  
  .search-bar { display: flex; align-items: center; background-color: var(--bg-tertiary); padding: 8px 12px; border-radius: 8px; gap: 8px; }
  .search-input { background: none; border: none; outline: none; color: white; width: 100%; font-size: 14px; }
  .message-input { flex: 1; background-color: var(--bg-tertiary); border: 1px solid transparent; border-radius: 24px; padding: 12px 16px; color: white; font-size: 14px; outline: none; transition: border 0.2s; }
  .message-input:focus { border-color: var(--border-color); }
  
  .flex-between { display: flex; align-items: center; justify-content: space-between; }
  .gap-3 { gap: 0.75rem; }
  .gap-2 { gap: 0.5rem; }
  .avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
  .avatar-md { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; flex-shrink: 0;}
  .text-xs { font-size: 0.75rem; }
  .text-green-400 { color: #4ade80; }
  .truncate-1 { display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
  .hover-white:hover { color: white; }
  .hover-red:hover { color: #f87171; }
  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--bg-surface); border-radius: 4px; }
  
  .bg-chat-pattern {
    background-color: var(--bg-primary);
    background-image: radial-gradient(var(--bg-tertiary) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  .mix-blend-plus-lighter { mix-blend-mode: plus-lighter; }
  .absolute { position: absolute; }
  .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
  .flex-1 { flex: 1 1 0%; }
`;
document.head.appendChild(style);

export default ChatLayout;
