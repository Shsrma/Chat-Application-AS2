import React, { useState } from 'react';
import axios from 'axios';

const Login = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const url = isLogin ? '/api/users/login' : '/api/users/register';
      const response = await axios.post(url, formData);
      
      onLogin(response.data.user, response.data.token);
    } catch (err) {
      setError(err.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ justifyContent: 'center', alignItems: 'center' }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        padding: 'var(--spacing-xl)',
        background: 'var(--background-sidebar)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg)',
        border: '1px solid var(--border-color)',
        backdropFilter: 'blur(20px)'
      }}>
        {/* Logo/Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--spacing-xl)' }}>
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto var(--spacing-md)',
            background: 'var(--gradient-primary)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            color: 'white',
            fontWeight: 'bold',
            boxShadow: 'var(--shadow-md)'
          }}>
            💬
          </div>
          <h1 style={{
            color: 'var(--text-primary)',
            fontSize: '28px',
            fontWeight: '700',
            marginBottom: 'var(--spacing-sm)'
          }}>
            Chat App
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '16px',
            margin: 0
          }}>
            {isLogin ? 'Welcome back! Sign in to continue' : 'Create your account to start chatting'}
          </p>
        </div>
        
        {error && (
          <div style={{
            color: '#ff6b6b',
            background: 'rgba(255, 107, 107, 0.1)',
            border: '1px solid rgba(255, 107, 107, 0.3)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-lg)',
            textAlign: 'center',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label style={{
                display: 'block',
                color: 'var(--text-primary)',
                marginBottom: 'var(--spacing-sm)',
                fontWeight: '500'
              }}>
                Username
              </label>
              <input
                type="text"
                name="username"
                className="form-control"
                value={formData.username}
                onChange={handleChange}
                required={!isLogin}
                minLength="3"
                placeholder="Enter your username"
              />
            </div>
          )}

          <div className="form-group">
            <label style={{
              display: 'block',
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-sm)',
              fontWeight: '500'
            }}>
              Email
            </label>
            <input
              type="email"
              name="email"
              className="form-control"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label style={{
              display: 'block',
              color: 'var(--text-primary)',
              marginBottom: 'var(--spacing-sm)',
              fontWeight: '500'
            }}>
              Password
            </label>
            <input
              type="password"
              name="password"
              className="form-control"
              value={formData.password}
              onChange={handleChange}
              required
              minLength="6"
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ 
              width: '100%', 
              marginBottom: 'var(--spacing-lg)',
              padding: 'var(--spacing-md)',
              fontSize: '16px',
              fontWeight: '600'
            }}
            disabled={loading}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginRight: 'var(--spacing-sm)'
                }}></span>
                {isLogin ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center' }}>
          <p style={{
            color: 'var(--text-secondary)',
            marginBottom: 'var(--spacing-md)'
          }}>
            {isLogin ? "Don't have an account?" : "Already have an account?"}
          </p>
          <button
            className="btn btn-secondary"
            style={{ 
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              fontSize: '14px'
            }}
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setFormData({ username: '', email: '', password: '' });
            }}
          >
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 'var(--spacing-xl)',
          textAlign: 'center',
          borderTop: '1px solid var(--border-color)',
          paddingTop: 'var(--spacing-lg)'
        }}>
          <p style={{
            color: 'var(--text-muted)',
            fontSize: '12px',
            margin: 0
          }}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Login;
