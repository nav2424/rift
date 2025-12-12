import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { subscribeToUserConversations } from '@/lib/realtime-messaging';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '@/constants/Colors';
import { Spacing } from '@/constants/DesignSystem';
import { Ionicons } from '@expo/vector-icons';

export interface ConversationListItem {
  id: string;
  transactionId: string;
  transactionTitle: string;
  transactionStatus: string;
  otherParticipant: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  lastMessage: {
    id: string;
    body: string;
    senderId: string | null;
    isSystem: boolean;
    createdAt: string;
  } | null;
  updatedAt: string;
  unreadCount: number;
}

export default function MessagesScreen() {
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    loadConversations();

    // Subscribe to new conversations
    if (user?.id) {
      unsubscribeRef.current = subscribeToUserConversations(
        user.id,
        () => {
          // Refresh conversations when a new one is created
          loadConversations();
        },
        (err) => {
          // Log as warning since subscription errors are often transient
          console.warn('Realtime subscription warning:', err.message || err);
        }
      );
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user?.id]);

  const loadConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data.conversations || []);
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      // Log the full error for debugging
      if (error.message) {
        console.error('Error message:', error.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const handleDeleteConversation = (conversationId: string) => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation? All messages will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteConversation(conversationId);
              // Remove from local state
              setConversations((prev) =>
                prev.filter((conv) => conv.id !== conversationId)
              );
            } catch (err: any) {
              console.error('Error deleting conversation:', err);
              Alert.alert('Error', 'Failed to delete conversation. Please try again.');
            }
          },
        },
      ]
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RELEASED':
        return '#4ade80';
      case 'REFUNDED':
        return '#f87171';
      case 'DISPUTED':
        return '#fbbf24';
      case 'CANCELLED':
        return '#9ca3af';
      default:
        return '#60a5fa';
    }
  };

  const renderConversationItem = ({ item }: { item: ConversationListItem }) => {
    const isLastMessageMine = item.lastMessage?.senderId === user?.id;
    const displayName = item.otherParticipant?.name || item.otherParticipant?.email || 'Unknown';

    return (
      <TouchableOpacity
        onPress={() => router.push(`/messages/${item.id}?transactionId=${item.transactionId}`)}
        onLongPress={() => handleDeleteConversation(item.id)}
        activeOpacity={0.92}
        style={styles.conversationCard}
      >
        <View style={styles.conversationCardShadow} />
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.02)', 'rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <View style={styles.conversationInfo}>
                <Text style={styles.participantName} numberOfLines={1}>
                  {displayName}
                </Text>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(item.transactionStatus) + '25' },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: getStatusColor(item.transactionStatus) },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(item.transactionStatus) },
                      ]}
                      numberOfLines={1}
                    >
                      {item.transactionStatus.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.timeText}>{formatTime(item.updatedAt)}</Text>
            </View>

            <Text style={styles.transactionTitle} numberOfLines={1}>
              {item.transactionTitle}
            </Text>

            {item.lastMessage && (
              <View style={styles.lastMessageRow}>
                <Text
                  style={[
                    styles.lastMessageText,
                    isLastMessageMine && styles.lastMessageMine,
                  ]}
                  numberOfLines={1}
                >
                  {isLastMessageMine ? 'You: ' : ''}
                  {item.lastMessage.isSystem
                    ? `---- ${item.lastMessage.body} ----`
                    : item.lastMessage.body}
                </Text>
              </View>
            )}

            {!item.lastMessage && (
              <Text style={styles.noMessageText}>No messages yet</Text>
            )}
          </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0C0C0C', '#000000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.text} />
          <Text style={styles.loadingText}>Loading conversations...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0C0C0C', '#000000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color={Colors.textTertiary} />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>
            Start a conversation from any transaction detail page
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#ffffff"
              colors={['#ffffff']}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 80 : Spacing.xxl + 8,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 34,
    fontWeight: '300',
    color: Colors.text,
    letterSpacing: -0.8,
  },
  listContent: {
    paddingHorizontal: Spacing.xl + 4,
    paddingTop: Spacing.md,
    paddingBottom: 100,
  },
  conversationCard: {
    marginBottom: Spacing.md + 4,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  conversationCardShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  conversationContent: {
    padding: Spacing.xl + 4,
    position: 'relative',
    zIndex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  conversationInfo: {
    flex: 1,
    marginRight: 12,
  },
  participantName: {
    fontSize: 18,
    fontWeight: '300',
    color: Colors.text,
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '300',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '400',
  },
  transactionTitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  lastMessageRow: {
    marginTop: 4,
  },
  lastMessageText: {
    fontSize: 14,
    color: Colors.textTertiary,
    fontWeight: '400',
  },
  lastMessageMine: {
    color: Colors.textSecondary,
  },
  noMessageText: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 16,
    color: Colors.textTertiary,
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '300',
    color: Colors.text,
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

