import React, { useState, useEffect } from 'react';
import axios from 'axios';
import socket from '../socket.js';

const AccountSwitcher = ({ currentAccount, onAccountSwitch }) => {
  const [accounts, setAccounts] = useState([]);
  const [showAccountList, setShowAccountList] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ username: '', email: '', password: '' });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = () => {
    const savedAccounts = JSON.parse(localStorage.getItem('chatAccounts') || '[]');
    setAccounts(savedAccounts);
  };

  const saveAccounts = (updatedAccounts) => {
    localStorage.setItem('chatAccounts', JSON.stringify(updatedAccounts));
    setAccounts(updatedAccounts);
  };

  const addAccount = async () => {
    try {
      const response = await axios.post('/api/users/login', {
        email: newAccount.email,
        password: newAccount.password
      });

      const accountData = {
        ...response.data.user,
        token: response.data.token,
        password: newAccount.password // Store password for easy switching
      };

      const updatedAccounts = [...accounts, accountData];
      saveAccounts(updatedAccounts);
      
      setNewAccount({ username: '', email: '', password: '' });
      setShowAddAccount(false);
      
      onAccountSwitch(accountData);
    } catch (error) {
      alert('Failed to add account: ' + (error.response?.data?.error || error.message));
    }
  };

  const switchAccount = (account) => {
    onAccountSwitch(account);
    setShowAccountList(false);
  };

  const removeAccount = (accountId, e) => {
    e.stopPropagation();
    
    if (confirm('Are you sure you want to remove this account?')) {
      const updatedAccounts = accounts.filter(acc => acc._id !== accountId);
      saveAccounts(updatedAccounts);
      
      if (currentAccount._id === accountId) {
        // Switch to first available account if removing current
        if (updatedAccounts.length > 0) {
          switchAccount(updatedAccounts[0]);
        }
      }
    }
  };

  const updateAccountStatus = (accountId, isOnline) => {
    const updatedAccounts = accounts.map(acc => 
      acc._id === accountId ? { ...acc, isOnline } : acc
    );
    saveAccounts(updatedAccounts);
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Current Account Display */}
      <div
        onClick={() => setShowAccountList(!showAccountList)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          cursor: 'pointer',
          padding: 'var(--spacing-sm)',
          borderRadius: 'var(--radius-md)',
          transition: 'var(--transition-fast)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--background-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'var(--gradient-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: '600',
          fontSize: '14px'
        }}>
          {currentAccount?.username?.charAt(0).toUpperCase() || '?'}
        </div>
        <div>
          <div style={{ 
            fontSize: '14px', 
            fontWeight: '500',
            color: 'var(--text-primary)'
          }}>
            {currentAccount?.username || 'Unknown'}
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: 'var(--text-secondary)'
          }}>
            {currentAccount?.email}
          </div>
        </div>
        <span style={{ color: 'var(--text-muted)' }}>▼</span>
      </div>

      {/* Account List Dropdown */}
      {showAccountList && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'var(--background-sidebar)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          zIndex: 1000,
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {/* Header */}
          <div style={{
            padding: 'var(--spacing-md)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ 
              fontSize: '14px', 
              fontWeight: '600',
              color: 'var(--text-primary)'
            }}>
              Accounts
            </span>
            <button
              onClick={() => setShowAddAccount(true)}
              className="btn btn-primary"
              style={{ padding: 'var(--spacing-xs) var(--spacing-sm)', fontSize: '12px' }}
            >
              + Add Account
            </button>
          </div>

          {/* Account Items */}
          {accounts.map(account => (
            <div
              key={account._id}
              onClick={() => switchAccount(account)}
              style={{
                padding: 'var(--spacing-md)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-md)',
                cursor: 'pointer',
                background: currentAccount._id === account._id ? 'var(--background-hover)' : 'transparent',
                transition: 'var(--transition-fast)'
              }}
              onMouseEnter={(e) => {
                if (currentAccount._id !== account._id) {
                  e.currentTarget.style.background = 'var(--background-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentAccount._id !== account._id) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'var(--gradient-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '600',
                fontSize: '16px',
                position: 'relative'
              }}>
                {account.username?.charAt(0).toUpperCase() || '?'}
                {account.isOnline && (
                  <div style={{
                    position: 'absolute',
                    bottom: '0',
                    right: '0',
                    width: '12px',
                    height: '12px',
                    background: 'var(--status-online)',
                    borderRadius: '50%',
                    border: '2px solid var(--background-sidebar)'
                  }}></div>
                )}
              </div>
              
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '14px', 
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)'
                }}>
                  {account.username}
                  {currentAccount._id === account._id && (
                    <span style={{
                      background: 'var(--primary-green)',
                      color: 'white',
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '10px'
                    }}>
                      Current
                    </span>
                  )}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: 'var(--text-secondary)'
                }}>
                  {account.email}
                </div>
              </div>
              
              <button
                onClick={(e) => removeAccount(account._id, e)}
                className="btn"
                style={{
                  background: 'none',
                  color: '#ff6b6b',
                  padding: '4px',
                  fontSize: '16px'
                }}
                title="Remove Account"
              >
                ×
              </button>
            </div>
          ))}

          {accounts.length === 0 && (
            <div style={{
              padding: 'var(--spacing-lg)',
              textAlign: 'center',
              color: 'var(--text-secondary)'
            }}>
              No accounts added yet
            </div>
          )}
        </div>
      )}

      {/* Add Account Modal */}
      {showAddAccount && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--background-sidebar)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--spacing-xl)',
            width: '100%',
            maxWidth: '400px',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ 
              margin: '0 0 var(--spacing-lg) 0',
              color: 'var(--text-primary)'
            }}>
              Add New Account
            </h3>
            
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
                className="form-control"
                value={newAccount.email}
                onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                placeholder="Enter email"
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
                className="form-control"
                value={newAccount.password}
                onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>
            
            <div style={{ 
              display: 'flex', 
              gap: 'var(--spacing-md)',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowAddAccount(false);
                  setNewAccount({ username: '', email: '', password: '' });
                }}
                className="btn"
                style={{ background: 'none', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                onClick={addAccount}
                className="btn btn-primary"
                disabled={!newAccount.email || !newAccount.password}
              >
                Add Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close dropdown when clicking outside */}
      {showAccountList && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999
          }}
          onClick={() => setShowAccountList(false)}
        />
      )}
    </div>
  );
};

export default AccountSwitcher;
