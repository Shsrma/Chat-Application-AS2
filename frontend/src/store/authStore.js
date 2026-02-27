import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  
  // Set User Initial State
  setUser: (userData) => set({ user: userData, isAuthenticated: !!userData, isLoading: false, error: null }),
  
  // Login action
  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/login', credentials);
      
      if (response.data.requires2FA) {
        set({ isLoading: false });
        return { requires2FA: true, userId: response.data.userId };
      }

      set({ 
        user: response.data.user, 
        isAuthenticated: true, 
        isLoading: false 
      });
      return { success: true };
    } catch (error) {
      set({ 
        error: error.response?.data?.message || 'Login failed', 
        isLoading: false 
      });
      return { success: false, error: error.response?.data?.message };
    }
  },

  // Verify 2FA
  verify2FA: async (data) => {
      set({ isLoading: true, error: null });
      try {
          const response = await api.post('/auth/verify-2fa', data);
          set({ 
            user: response.data.user, 
            isAuthenticated: true, 
            isLoading: false 
          });
          return { success: true };
      } catch (error) {
          set({ error: error.response?.data?.message || 'Invalid 2FA code', isLoading: false });
          return { success: false, error: error.response?.data?.message };
      }
  },

  // Register action
  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/auth/register', userData);
      set({ isLoading: false });
      return { success: true, message: response.data.message };
    } catch (error) {
      set({ 
        error: error.response?.data?.message || 'Registration failed', 
        isLoading: false 
      });
      return { success: false, error: error.response?.data?.message };
    }
  },

  // Logout action
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      set({ user: null, isAuthenticated: false, error: null });
    }
  },

  // Check auth session on load
  checkAuth: async () => {
    try {
      // Assuming a /me route exists or derived from success of fetching initial data
      // For this architecture, we rely on silent refresh. If refresh fails, they are logged out.
      const response = await api.post('/auth/refresh-token');
      // After success, we can safely decode their JWT (if returned) or 
      // fetch a `/api/users/me` endpoint. We will add a `/users/me` endpoint in backend
      const userRes = await api.get('/users/me');
      set({ user: userRes.data, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  }
}));

export default useAuthStore;
