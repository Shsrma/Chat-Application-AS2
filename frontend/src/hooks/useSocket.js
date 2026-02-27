import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import useAuthStore from '../store/authStore';
import useChatStore from '../store/chatStore';

export const useSocket = () => {
    const socketRef = useRef(null);
    const { user } = useAuthStore();
    const { addMessage } = useChatStore();

    const connectSocket = useCallback(() => {
        if (!user) return;
        
        // We assume the backend issues a short lived token for socket auth.
        // For simplicity in this structure, using the session cookie or getting token from state 
        // (if it was returned to frontend memory)
        // If HTTP Only, we might rely on the cookie taking precedence in handshakes 
        // but socket.io cross-domain can be tricky. We'll use polling + cookie or JWT explicitly if available.
        
        // Using same origin since vite proxies /api but socket.io needs the base URL or will hit vite dev server.
        // If we proxy socket.io in vite config, we can just use '/'
        
        socketRef.current = io('/', {
            path: '/socket.io', // default
            withCredentials: true,
            // Assuming we added an endpoint or the login returned the AccessToken to state for this purpose
        });

        socketRef.current.on('connect', () => {
            console.log('Connected to socket server');
            socketRef.current.emit('setup');
        });

        socketRef.current.on('message_received', (newMessage) => {
            // Forward to Zustand store to handle UI updates
            addMessage(newMessage);
        });

        // Other events (typing, presence, WebRTC signaling) handled here or in specific components

    }, [user, addMessage]);

    const disconnectSocket = useCallback(() => {
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (user) {
            connectSocket();
        } else {
            disconnectSocket();
        }
        
        return () => disconnectSocket();
    }, [user, connectSocket, disconnectSocket]);

    return socketRef.current;
};
