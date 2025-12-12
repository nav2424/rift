import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { subscribeToMessages } from '@/lib/realtime-messaging';
import PremiumGlassCard from './PremiumGlassCard';
import { Colors } from '@/constants/Colors';

export interface Message {
  id: string;
  body: string;
  senderId: string | null;
  createdAt: string;
  readAt: string | null;
}

interface Conversation {
  id: string;
  createdAt: string;
  lastMessageAt: string | null;
}

interface MessagingPanelProps {
  transactionId: string;
}

export default function MessagingPanel({ transactionId }: MessagingPanelProps) {
  const { user } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const fetchMessages = async () => {
    try {
      const data = await api.getConversation(transactionId);
      setConversation(data.conversation);
      setMessages(data.messages || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      if (err.message?.includes('Forbidden') || err.message?.includes('403')) {
        setError('You do not have access to this conversation.');
      } else {
        setError('Failed to load messages. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    return () => {
      // Cleanup realtime subscription
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [transactionId]);

  // Set up realtime subscription when conversation is available
  useEffect(() => {
    if (!conversation?.id || !user) return;

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Subscribe to new messages
    unsubscribeRef.current = subscribeToMessages(
      conversation.id,
      (newMessage) => {
        // Only add if we don't already have this message
        setMessages((prev) => {
          const exists = prev.some((msg) => msg.id === newMessage.id);
          if (exists) return prev;
          return [...prev, newMessage];
        });
      },
      (err) => {
        console.error('Realtime subscription error:', err);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [conversation?.id, user]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || sending) return;

    const textToSend = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      // Optimistically add message to UI
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        body: textToSend,
        senderId: user?.id || null,
        createdAt: new Date().toISOString(),
        readAt: null,
      };
      setMessages((prev) => [...prev, optimisticMessage]);

      // Send to server (realtime will add the real message)
      const newMessage = await api.sendMessage(transactionId, textToSend);

      // Replace optimistic message with real one (in case realtime didn't fire)
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === optimisticMessage.id ? newMessage : msg
        )
      );

      // Scroll to bottom
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err: any) {
      console.error('Error sending message:', err);
      // Remove optimistic message on error
      setMessages((prev) =>
        prev.filter((msg) => msg.id !== `temp-${Date.now()}`)
      );
      setMessageText(textToSend); // Restore message text
      setError('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <PremiumGlassCard variant="premium" style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.text} />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </PremiumGlassCard>
    );
  }

  if (error && !conversation) {
    return (
      <PremiumGlassCard variant="premium" style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </PremiumGlassCard>
    );
  }

  return (
    <PremiumGlassCard variant="premium" style={styles.container}>
      <Text style={styles.title}>Messages</Text>

      <View style={styles.messagesWrapper}>
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled={true}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={40} color={Colors.textTertiary} />
              <Text style={styles.emptyText}>
                No messages yet
              </Text>
              <Text style={styles.emptySubtext}>
                Start the conversation for this transaction
              </Text>
            </View>
          ) : (
            messages.map((message) => {
              const isMine = message.senderId === user?.id;

              return (
                <View
                  key={message.id}
                  style={[
                    styles.messageRow,
                    isMine ? styles.messageRowRight : styles.messageRowLeft,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isMine ? styles.messageTextMine : styles.messageTextTheirs,
                      ]}
                    >
                      {message.body}
                    </Text>
                    <Text
                      style={[
                        styles.messageTime,
                        isMine ? styles.messageTimeMine : styles.messageTimeTheirs,
                      ]}
                    >
                      {formatTime(message.createdAt)}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Type a message..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              maxLength={1000}
              editable={!sending}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!messageText.trim() || sending}
              style={[
                styles.sendButton,
                (!messageText.trim() || sending) && styles.sendButtonDisabled,
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={Colors.text} />
              ) : (
                <Ionicons name="send" size={18} color={Colors.text} />
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </PremiumGlassCard>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    marginBottom: 20,
  },
  messagesWrapper: {
    maxHeight: 400,
    minHeight: 200,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginLeft: 12,
    color: Colors.text,
    fontSize: 14,
  },
  errorContainer: {
    padding: 20,
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  messagesContainer: {
    flex: 1,
    maxHeight: 300,
    marginBottom: 12,
  },
  messagesContent: {
    paddingBottom: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  emptyText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 12,
  },
  emptySubtext: {
    color: Colors.textTertiary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  messageRow: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  messageBubbleMine: {
    backgroundColor: 'rgba(96, 165, 250, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.5)',
  },
  messageBubbleTheirs: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  messageTextMine: {
    color: Colors.text,
  },
  messageTextTheirs: {
    color: Colors.text,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 2,
  },
  messageTimeMine: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  messageTimeTheirs: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    maxHeight: 100,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: 'rgba(96, 165, 250, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.5)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
