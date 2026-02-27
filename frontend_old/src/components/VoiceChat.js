import React, { useState, useRef, useEffect } from 'react';

const VoiceChat = ({ chatId, userId, socket }) => {
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, connected
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnection = useRef(null);
  const localStreamRef = useRef(null);

  useEffect(() => {
    // Setup WebRTC event listeners
    if (socket) {
      socket.on('voice_call_request', handleIncomingCall);
      socket.on('voice_call_answered', handleCallAnswered);
      socket.on('voice_call_ended', handleCallEnded);
      socket.on('ice_candidate', handleIceCandidate);
      socket.on('offer', handleOffer);
      socket.on('answer', handleAnswer);

      return () => {
        socket.off('voice_call_request');
        socket.off('voice_call_answered');
        socket.off('voice_call_ended');
        socket.off('ice_candidate');
        socket.off('offer');
        socket.off('answer');
      };
    }
  }, [socket]);

  const createPeerConnection = () => {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const pc = new RTCPeerConnection(configuration);
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice_candidate', {
          candidate: event.candidate,
          chatId: chatId
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onconnectionstatechange = (event) => {
      if (pc.connectionState === 'connected') {
        setCallStatus('connected');
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall();
      }
    };

    return pc;
  };

  const startCall = async (isVideoCall = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoCall,
        audio: true
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      peerConnection.current = createPeerConnection();
      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
      });

      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      socket.emit('voice_call_request', {
        chatId: chatId,
        offer: offer,
        isVideoCall: isVideoCall,
        from: userId
      });

      setIsInCall(true);
      setCallStatus('calling');
      setIsCameraOn(isVideoCall);
    } catch (error) {
      console.error('Error starting call:', error);
      alert('Failed to start call. Please check camera/microphone permissions.');
    }
  };

  const handleIncomingCall = async (data) => {
    if (data.chatId !== chatId) return;
    
    setCallStatus('calling');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: data.isVideoCall,
        audio: true
      });

      localStreamRef.current = stream;
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      peerConnection.current = createPeerConnection();
      stream.getTracks().forEach(track => {
        peerConnection.current.addTrack(track, stream);
      });

      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      socket.emit('voice_call_answered', {
        chatId: chatId,
        answer: answer,
        to: data.from
      });

      setIsInCall(true);
      setIsCameraOn(data.isVideoCall);
    } catch (error) {
      console.error('Error answering call:', error);
      socket.emit('voice_call_rejected', { chatId: chatId, to: data.from });
    }
  };

  const handleCallAnswered = async (data) => {
    if (data.chatId !== chatId) return;
    
    try {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
      console.error('Error handling call answered:', error);
    }
  };

  const handleOffer = async (data) => {
    if (data.chatId !== chatId) return;
    
    try {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      socket.emit('answer', {
        chatId: chatId,
        answer: answer,
        to: data.from
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleAnswer = async (data) => {
    if (data.chatId !== chatId) return;
    
    try {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  const handleIceCandidate = async (data) => {
    if (data.chatId !== chatId) return;
    
    try {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isCameraOn;
        setIsCameraOn(!isCameraOn);
      }
    }
  };

  const endCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    socket.emit('voice_call_ended', { chatId: chatId });
    
    setIsInCall(false);
    setCallStatus('idle');
    setIsMuted(false);
    setIsCameraOn(false);
    setLocalStream(null);
    setRemoteStream(null);
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  };

  const handleCallEnded = () => {
    endCall();
  };

  return (
    <div>
      {/* Call Controls */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
        <button
          onClick={() => startCall(false)}
          disabled={isInCall}
          className="btn"
          style={{ 
            background: 'none', 
            padding: '8px',
            color: isInCall ? 'var(--text-muted)' : 'var(--text-primary)'
          }}
          title="Voice Call"
        >
          📞
        </button>
        <button
          onClick={() => startCall(true)}
          disabled={isInCall}
          className="btn"
          style={{ 
            background: 'none', 
            padding: '8px',
            color: isInCall ? 'var(--text-muted)' : 'var(--text-primary)'
          }}
          title="Video Call"
        >
          📹
        </button>
      </div>

      {/* Call Modal */}
      {isInCall && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.9)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            maxWidth: '1200px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {/* Remote Video */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'black',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {remoteStream ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div style={{ color: 'white', fontSize: '24px' }}>
                  {callStatus === 'calling' ? 'Calling...' : 'Waiting for connection...'}
                </div>
              )}
            </div>

            {/* Local Video */}
            {localStream && (
              <div style={{
                position: 'absolute',
                bottom: '20px',
                right: '20px',
                width: '200px',
                height: '150px',
                background: 'black',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '2px solid var(--primary-green)'
              }}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              </div>
            )}

            {/* Call Controls */}
            <div style={{
              position: 'absolute',
              bottom: '40px',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 'var(--spacing-md)',
              background: 'rgba(0, 0, 0, 0.7)',
              padding: 'var(--spacing-md)',
              borderRadius: 'var(--radius-lg)'
            }}>
              <button
                onClick={toggleMute}
                className="btn"
                style={{
                  background: isMuted ? 'red' : 'var(--primary-green)',
                  color: 'white',
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%'
                }}
              >
                {isMuted ? '🎤' : '🔇'}
              </button>
              
              {isCameraOn && (
                <button
                  onClick={toggleCamera}
                  className="btn"
                  style={{
                    background: isCameraOn ? 'var(--primary-green)' : 'red',
                    color: 'white',
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%'
                  }}
                >
                  📹
                </button>
              )}
              
              <button
                onClick={endCall}
                className="btn"
                style={{
                  background: 'red',
                  color: 'white',
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%'
                }}
              >
                📞
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceChat;
