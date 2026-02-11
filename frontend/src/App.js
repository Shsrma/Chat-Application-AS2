import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login.js';
import Chat from './components/Chat.js';
import socket from './socket.js';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      // Verify token and get user info
      fetch('/api/users/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(response => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Invalid token');
      })
      .then(data => {
        setUser(data.user);
        socket.connect();
        socket.emit('join', data.user._id);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
      });
    }
  }, [token]);

  const handleLogin = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('token', userToken);
    socket.connect();
    socket.emit('join', userData._id);
  };

  const handleAccountSwitch = (accountData) => {
    // Disconnect current socket connection
    socket.disconnect();
    
    // Switch to new account
    setUser(accountData.user);
    setToken(accountData.token);
    localStorage.setItem('token', accountData.token);
    
    // Reconnect with new user
    socket.connect();
    socket.emit('join', accountData.user._id);
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    socket.disconnect();
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={!user ? <Login onLogin={handleLogin} /> : <Navigate to="/chat" />} 
          />
          <Route 
            path="/chat" 
            element={user ? <Chat user={user} onLogout={handleAccountSwitch} /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/" 
            element={<Navigate to={user ? "/chat" : "/login"} />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
