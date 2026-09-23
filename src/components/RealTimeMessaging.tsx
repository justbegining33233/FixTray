'use client';

import { usePhrase } from '@/lib/usePhrase';
import { useEffect, useState, useRef } from 'react';
import { useSocket } from '@/lib/socket';

interface RealTimeMessagingProps {
  userId: string;
  shopId?: string;
  userRole: string;
  recipientId?: string;
  recipientRole?: string;
}

export default function RealTimeMessaging({
  userId,
  shopId,
  userRole,
  recipientId,
  recipientRole
}: RealTimeMessagingProps) {
  const say = usePhrase();
  const { isConnected, emit, on, off } = useSocket();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!isConnected) return;

    // Listen for new messages
    const handleNewMessage = (data: any) => {
      setMessages(prev => [...prev, data]);
    };

    // Listen for typing indicators
    const handleTypingStart = (data: any) => {
      setTypingUsers(prev => [...prev.filter(u => u !== data.from), data.fromName]);
    };

    const handleTypingStop = (data: any) => {
      setTypingUsers(prev => prev.filter(u => u !== data.fromName));
    };

    on('new-message', handleNewMessage);
    on('user-typing', handleTypingStart);
    on('user-stopped-typing', handleTypingStop);

    return () => {
      off('new-message', handleNewMessage);
      off('user-typing', handleTypingStart);
      off('user-stopped-typing', handleTypingStop);
    };
  }, [isConnected, on, off]);

  const sendMessage = () => {
    if (!newMessage.trim() || !emit) return;

    const messageData = {
      content: newMessage.trim(),
      to: recipientId,
      toRole: recipientRole,
      toShop: !recipientId && !recipientRole && shopId,
      timestamp: new Date(),
    };

    emit('send-message', messageData);
    setMessages(prev => [...prev, {
      ...messageData,
      from: userId,
      fromRole: userRole,
      isOwn: true,
    }]);

    setNewMessage('');
    setIsTyping(false);
    emit('typing-stop', { to: recipientId });
  };

  const handleTyping = () => {
    if (!isTyping && emit) {
      setIsTyping(true);
      emit('typing-start', { to: recipientId });
    }
  };

  const handleStopTyping = () => {
    if (isTyping && emit) {
      setIsTyping(false);
      emit('typing-stop', { to: recipientId });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      handleStopTyping();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '500px',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      background: 'rgba(0,0,0,0.3)',
    }}>
      {/* Connection Status */}
      <div style={{
        padding: '8px 16px',
        background: isConnected ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
        color: isConnected ? '#22c55e' : '#f87171',
        fontSize: 12,
        fontWeight: 600,
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        {isConnected ? say(" Connected") : say(" Disconnected")}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.map((message, index) => (
          <div
            key={index}
            style={{
              alignSelf: message.from === userId ? 'flex-end' : 'flex-start',
              maxWidth: '70%',
            }}
          >
            <div style={{
              padding: '8px 12px',
              background: message.from === userId
                ? 'rgba(59,130,246,0.2)'
                : 'rgba(255,255,255,0.1)',
              border: `1px solid ${message.from === userId
                ? 'rgba(59,130,246,0.3)'
                : 'rgba(255,255,255,0.2)'}`,
              borderRadius: 8,
              color: '#e5e7eb',
              fontSize: 14,
            }}>
              {say(message.content)}
            </div>
            <div style={{
              fontSize: 11,
              color: '#9aa3b2',
              marginTop: 4,
              textAlign: message.from === userId ? 'right' : 'left',
            }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}

        {/* Typing Indicators */}
        {typingUsers.length > 0 && (
          <div style={{
            fontSize: 12,
            color: '#9aa3b2',
            fontStyle: 'italic',
          }}>
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div style={{
        padding: 16,
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        gap: 8,
      }}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={handleTyping}
          onBlur={handleStopTyping}
          placeholder={say("Type a message...")}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            color: '#e5e7eb',
            fontSize: 14,
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!newMessage.trim() || !isConnected}
          style={{
            padding: '8px 16px',
            background: !newMessage.trim() || !isConnected
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(59,130,246,0.2)',
            border: `1px solid ${!newMessage.trim() || !isConnected
              ? 'rgba(255,255,255,0.2)'
              : 'rgba(59,130,246,0.5)'}`,
            color: !newMessage.trim() || !isConnected ? '#9aa3b2' : '#3b82f6',
            borderRadius: 6,
            cursor: !newMessage.trim() || !isConnected ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {say("Send")}{' '}</button>
      </div>
    </div>
  );
}