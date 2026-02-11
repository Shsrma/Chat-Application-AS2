import React from 'react';

const Message = ({ message, isOwn }) => {
  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = () => {
    if (isOwn) {
      switch (message.status) {
        case 'sent':
          return <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>✓</span>;
        case 'delivered':
          return <span style={{ color: 'rgba(255, 255, 255, 0.8)' }}>✓✓</span>;
        case 'seen':
          return <span style={{ color: 'var(--message-seen)' }}>✓✓</span>;
        default:
          return <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>✓</span>;
      }
    }
    return null;
  };

  const renderFileContent = () => {
    if (message.messageType === 'file' && message.fileUrl) {
      const isImage = message.fileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      const isVideo = message.fileName?.match(/\.(mp4|webm|ogg)$/i);
      
      if (isImage) {
        return (
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
            <img
              src={message.fileUrl}
              alt={message.fileName}
              style={{
                maxWidth: '200px',
                maxHeight: '200px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer'
              }}
              onClick={() => window.open(message.fileUrl, '_blank')}
            />
            <div style={{ 
              fontSize: '12px', 
              color: 'rgba(255, 255, 255, 0.8)',
              marginTop: 'var(--spacing-xs)'
            }}>
              {message.fileName}
            </div>
          </div>
        );
      }
      
      if (isVideo) {
        return (
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
            <video
              src={message.fileUrl}
              controls
              style={{
                maxWidth: '200px',
                maxHeight: '200px',
                borderRadius: 'var(--radius-md)'
              }}
            />
            <div style={{ 
              fontSize: '12px', 
              color: 'rgba(255, 255, 255, 0.8)',
              marginTop: 'var(--spacing-xs)'
            }}>
              {message.fileName}
            </div>
          </div>
        );
      }
      
      // For other file types
      return (
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: 'var(--spacing-md)',
          borderRadius: 'var(--radius-md)',
          marginTop: 'var(--spacing-sm)',
          cursor: 'pointer',
          transition: 'var(--transition-fast)'
        }}
        onClick={() => window.open(message.fileUrl, '_blank')}
        onMouseEnter={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.target.style.background = 'rgba(255, 255, 255, 0.1)';
        }}
      >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <span style={{ fontSize: '24px' }}>📄</span>
            <div>
              <div style={{ 
                fontSize: '14px', 
                fontWeight: '500',
                wordBreak: 'break-all'
              }}>
                {message.fileName}
              </div>
              {message.fileSize && (
                <div style={{ 
                  fontSize: '12px', 
                  color: 'rgba(255, 255, 255, 0.6)'
                }}>
                  {formatFileSize(message.fileSize)}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className={`message ${isOwn ? 'own' : ''}`}>
      {!isOwn && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 'var(--spacing-sm)',
          marginBottom: 'var(--spacing-xs)'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: message.sender?.avatar 
              ? `url(${message.sender.avatar}) center/cover` 
              : 'var(--gradient-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: '600',
            color: 'white',
            flexShrink: 0
          }}>
            {!message.sender?.avatar && (message.sender?.username?.charAt(0).toUpperCase() || '?')}
          </div>
          <div style={{ 
            fontSize: '12px', 
            color: 'var(--text-secondary)',
            fontWeight: '500'
          }}>
            {message.sender?.username || 'Unknown'}
          </div>
        </div>
      )}
      
      <div className="message-content">
        {message.content && (
          <div style={{ 
            wordBreak: 'break-word',
            lineHeight: '1.4',
            fontSize: '14px'
          }}>
            {message.content}
          </div>
        )}
        
        {renderFileContent()}
        
        <div className="message-info">
          <span style={{ 
            fontSize: '11px',
            opacity: 0.8
          }}>
            {formatTime(message.createdAt)}
          </span>
          {getStatusIcon() && (
            <span style={{ 
              marginLeft: 'var(--spacing-xs)',
              display: 'flex',
              alignItems: 'center'
            }}>
              {getStatusIcon()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Message;
