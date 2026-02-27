import axios from "axios";
import useAuthStore from "../store/authStore";

const api = axios.create({
  baseURL: "http://localhost:5001/api",
  withCredentials: true, // Crucial for sending/receiving HttpOnly cookies
});

// Interceptor for handling token expiration
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // If the error status is 401 and there is no originalRequest._retry flag,
    // it means the token has expired and we need to refresh it
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry
    ) {
      // Don't retry the refresh token endpoint itself to avoid infinite loop
      if (originalRequest.url === "/auth/refresh-token") {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      try {
        // Assume API refresh endpoint 1) checks the HttpOnly cookie and
        // 2) Sets a new HttpOnly cookie. We don't need to manually attach tokens.
        await axios.post("/api/auth/refresh-token", null, {
          withCredentials: true,
        });

        // Retry the original request
        return api(originalRequest);
      } catch (err) {
        // Refresh failed, token is completely invalid or revoked.
        // Tell Zustand to log the user out
        useAuthStore.getState().setUser(null);
        return Promise.reject(err);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
