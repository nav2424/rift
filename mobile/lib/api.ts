import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

// Get API URL from config, with fallback
// For physical devices, we need to use the local network IP instead of localhost
// For iOS Simulator, we can use localhost directly
const getApiUrl = () => {
  try {
    let apiUrl = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';
    const originalApiUrl = apiUrl;
    
    // Detect if we're on a simulator
    // Constants.isDevice is false for simulators, true for physical devices, undefined in some cases
    const isSimulator = Constants.isDevice === false || Constants.isDevice === undefined;
    
    // Get network IP from hostUri if available (Expo dev server IP)
    const hostUri = Constants.expoConfig?.hostUri;
    let networkIP = hostUri ? hostUri.split(':')[0] : null;
    
    // Check if networkIP is an Expo tunnel URL (not a real IP address)
    const isExpoTunnel = networkIP && (
      networkIP.includes('.exp.direct') || 
      networkIP.includes('.expo.io') ||
      networkIP.includes('localhost') ||
      networkIP.includes('127.0.0.1') ||
      !networkIP.match(/^\d+\.\d+\.\d+\.\d+$/) // Not a valid IP format
    );
    
    // Only use networkIP if it's a real IP address (not Expo tunnel)
    if (isExpoTunnel) {
      networkIP = null;
    }
    
    // If API URL is set to localhost, handle based on device type
    if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
      // For simulators, localhost should work, but try 127.0.0.1 if available
      if (isSimulator) {
        // Use 127.0.0.1 instead of localhost for better compatibility
        apiUrl = apiUrl.replace('localhost', '127.0.0.1');
      }
      // For physical devices, use network IP if available
      else if (!isSimulator && networkIP) {
        apiUrl = apiUrl.replace(/localhost|127\.0\.0\.1/, networkIP);
      }
    } else if (isSimulator && (apiUrl.includes('192.168.') || apiUrl.includes('10.') || apiUrl.match(/^\d+\.\d+\.\d+\.\d+/))) {
      // Simulator detected but API URL has network IP - keep it (it should work)
      // No change needed
    }
    
    console.log('API URL config:', originalApiUrl, '→ resolved:', apiUrl, 'isSimulator:', isSimulator, 'isDevice:', Constants.isDevice, 'networkIP:', networkIP);
    return apiUrl;
  } catch (error) {
    console.log('Error getting API URL, using localhost:', error);
    return 'http://localhost:3000';
  }
};

const API_URL = getApiUrl();

export interface User {
  id: string;
  name: string | null;
  email: string;
  phone?: string | null;
  role?: 'USER' | 'ADMIN';
}

export interface EscrowTransaction {
  id: string;
  riftNumber: number; // Sequential rift number for tracking
  itemTitle: string;
  itemDescription: string;
  itemType: 'PHYSICAL' | 'TICKETS' | 'DIGITAL' | 'SERVICES';
  amount: number;
  currency: string;
  status: 'AWAITING_PAYMENT' | 'AWAITING_SHIPMENT' | 'IN_TRANSIT' | 'DELIVERED_PENDING_RELEASE' | 'RELEASED' | 'REFUNDED' | 'DISPUTED' | 'CANCELLED';
  buyerId: string;
  sellerId: string;
  buyer: User;
  seller: User;
  shippingAddress?: string | null;
  notes?: string | null;
  paymentReference?: string | null;
  // Fee tracking
  platformFee?: number | null;
  sellerPayoutAmount?: number | null;
  // Hybrid protection fields
  shipmentVerifiedAt?: string | null;
  trackingVerified?: boolean;
  deliveryVerifiedAt?: string | null;
  gracePeriodEndsAt?: string | null;
  autoReleaseScheduled?: boolean;
  // Type-specific fields
  eventDate?: string | null;
  venue?: string | null;
  transferMethod?: string | null;
  downloadLink?: string | null;
  licenseKey?: string | null;
  serviceDate?: string | null;
  createdAt: string;
  updatedAt: string;
  shipmentProofs?: ShipmentProof[];
  timelineEvents?: TimelineEvent[];
  disputes?: Dispute[];
}

export interface ShipmentProof {
  id: string;
  trackingNumber?: string | null;
  shippingCarrier?: string | null;
  filePath?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  type: string;
  message: string;
  createdBy?: User | null;
  createdAt: string;
}

export interface Dispute {
  id: string;
  reason: string;
  status: 'OPEN' | 'RESOLVED';
  raisedBy: User;
  adminNote?: string | null;
  createdAt: string;
}

class ApiClient {
  private async getAuthToken(): Promise<string | null> {
    return await SecureStore.getItemAsync('auth_token');
  }

  private async setAuthToken(token: string): Promise<void> {
    await SecureStore.setItemAsync('auth_token', token);
  }

  private async clearAuthToken(): Promise<void> {
    await SecureStore.deleteItemAsync('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getAuthToken();
    const headers: HeadersInit = {
      ...options.headers,
    };

    // Only set Content-Type for JSON requests
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (response.status === 401) {
        // Don't immediately clear token - let the auth context handle it
        // This prevents logging out users on temporary errors
        const errorData = await response.json().catch(() => ({ error: 'Unauthorized' }));
        throw new Error(errorData.error || 'Unauthorized');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ 
          error: 'Unknown error',
          details: `HTTP ${response.status}: ${response.statusText}`
        }));
        const errorMessage = error.error || 'Request failed';
        const errorDetails = error.details ? ` (${error.details})` : '';
        throw new Error(`${errorMessage}${errorDetails}`);
      }

      return response.json();
    } catch (error: any) {
      // Handle network errors - don't clear token on network errors
      if (error.message === 'Failed to fetch' || error.message.includes('Network') || error.message.includes('fetch')) {
        throw new Error('Network error: Please check your connection and ensure the backend is running');
      }
      // Re-throw other errors (including Unauthorized) as-is
      throw error;
    }
  }

  async signIn(email: string, password: string): Promise<{ user: User; token: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${API_URL}/api/auth/mobile-signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Invalid credentials' }));
        throw new Error(error.error || 'Invalid credentials');
      }

      const data = await response.json();
      await this.setAuthToken(data.token);
      return data;
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('Network request timed out')) {
        throw new Error(`Connection timeout: Could not reach the backend at ${API_URL}. Please ensure the backend server is running and the API URL is correct.`);
      }
      if (error.message === 'Failed to fetch' || error.message?.includes('Network')) {
        throw new Error(`Network error: Could not connect to ${API_URL}. Please check your connection and ensure the backend is running.`);
      }
      throw error;
    }
  }

  async signUp(name: string, email: string, password: string): Promise<{ user: User; token: string }> {
    const response = await fetch(`${API_URL}/api/auth/mobile-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Sign up failed' }));
      throw new Error(error.error || 'Sign up failed');
    }

    const data = await response.json();
    await this.setAuthToken(data.token);
    return data;
  }

  async signOut(): Promise<void> {
    await this.clearAuthToken();
  }

  async getUsers(): Promise<User[]> {
    const response = await this.request<{ users: User[] }>('/api/users');
    return response.users;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.request<{ user: User }>('/api/auth/me');
    return response.user;
  }

  async updateProfile(data: { name?: string | null; phone?: string | null }): Promise<{ user: User }> {
    return this.request<{ user: User }>('/api/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getEscrows(): Promise<EscrowTransaction[]> {
    const response = await this.request<{ escrows: EscrowTransaction[] }>('/api/escrows/list');
    return response.escrows || [];
  }

  async getEscrow(id: string): Promise<EscrowTransaction> {
    return this.request<EscrowTransaction>(`/api/escrows/${id}`);
  }

  async createEscrow(data: {
    itemTitle: string;
    itemDescription: string;
    itemType: 'PHYSICAL' | 'TICKETS' | 'DIGITAL' | 'SERVICES';
    amount: number;
    currency: string;
    sellerId?: string;
    sellerEmail?: string;
    shippingAddress?: string;
    notes?: string;
    eventDate?: string;
    venue?: string;
    transferMethod?: string;
    downloadLink?: string;
    licenseKey?: string;
    serviceDate?: string;
  }): Promise<{ escrowId: string }> {
    return this.request<{ escrowId: string }>('/api/escrows/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createPaymentIntent(escrowId: string): Promise<{ clientSecret: string; paymentIntentId: string }> {
    return this.request(`/api/escrows/${escrowId}/payment-intent`, {
      method: 'POST',
    });
  }

  async markPaid(escrowId: string, paymentIntentId?: string): Promise<{ success: boolean; paymentReference?: string }> {
    return this.request(`/api/escrows/${escrowId}/mark-paid`, {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId }),
    });
  }

  async cancelEscrow(escrowId: string): Promise<{ success: boolean }> {
    return this.request(`/api/escrows/${escrowId}/cancel`, {
      method: 'POST',
    });
  }

  async confirmReceived(escrowId: string): Promise<{ success: boolean; newStatus?: string; payoutId?: string }> {
    return this.request(`/api/escrows/${escrowId}/confirm-received`, {
      method: 'POST',
    });
  }

  async releaseFunds(escrowId: string): Promise<{ success: boolean; newStatus?: string; payoutId?: string }> {
    return this.request(`/api/escrows/${escrowId}/release-funds`, {
      method: 'POST',
    });
  }

  async uploadShipmentProof(
    escrowId: string,
    data: {
      trackingNumber?: string;
      shippingCarrier?: string;
      fileUri?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean }> {
    const formData = new FormData();
    if (data.trackingNumber) formData.append('trackingNumber', data.trackingNumber);
    if (data.shippingCarrier) formData.append('shippingCarrier', data.shippingCarrier);
    if (data.notes) formData.append('notes', data.notes);
    if (data.fileUri) {
      formData.append('file', {
        uri: data.fileUri,
        type: 'image/jpeg',
        name: 'shipment-proof.jpg',
      } as any);
    }

    const token = await this.getAuthToken();
    const response = await fetch(`${API_URL}/api/escrows/${escrowId}/upload-shipment-proof`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Upload failed');
    }

    return response.json();
  }

  async markDelivered(
    escrowId: string,
    data: {
      fileUri?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; status?: string }> {
    const formData = new FormData();
    if (data.notes) formData.append('notes', data.notes);
    if (data.fileUri) {
      formData.append('file', {
        uri: data.fileUri,
        type: 'image/jpeg',
        name: 'delivery-proof.jpg',
      } as any);
    }

    const token = await this.getAuthToken();
    const API_URL = getApiUrl();
    const response = await fetch(`${API_URL}/api/escrows/${escrowId}/mark-delivered`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to mark as delivered');
    }

    return response.json();
  }

  async raiseDispute(escrowId: string, reason: string, type?: string): Promise<{ success: boolean }> {
    return this.request(`/api/escrows/${escrowId}/raise-dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason, type }),
    });
  }

  async getDisputes(): Promise<Dispute[]> {
    const response = await this.request<{ disputes: Dispute[] }>('/api/admin/disputes');
    return response.disputes || [];
  }

  async getUserDisputes(): Promise<Array<Dispute & { escrow?: EscrowTransaction }>> {
    const response = await this.request<{ disputes: Array<Dispute & { escrow?: EscrowTransaction }> }>('/api/me/disputes');
    return response.disputes || [];
  }

  async getAdminEscrows(): Promise<EscrowTransaction[]> {
    const response = await this.request<{ escrows: EscrowTransaction[] }>('/api/admin/escrows');
    return response.escrows || [];
  }

  async getLeaderboard(): Promise<Array<{ user: User; transactionCount: number }>> {
    // Try to get all escrows (admin endpoint first, fallback to user escrows)
    let escrows: EscrowTransaction[];
    try {
      escrows = await this.getAdminEscrows();
    } catch {
      // If not admin or endpoint fails, use user's escrows
      escrows = await this.getEscrows();
    }
    
    // Count transactions per user (as buyer or seller)
    const userCounts = new Map<string, { user: User; count: number }>();
    
    escrows.forEach((escrow) => {
      // Count buyer
      if (escrow.buyer) {
        const existing = userCounts.get(escrow.buyerId);
        if (existing) {
          existing.count++;
        } else {
          userCounts.set(escrow.buyerId, { user: escrow.buyer, count: 1 });
        }
      }
      
      // Count seller
      if (escrow.seller) {
        const existing = userCounts.get(escrow.sellerId);
        if (existing) {
          existing.count++;
        } else {
          userCounts.set(escrow.sellerId, { user: escrow.seller, count: 1 });
        }
      }
    });
    
    // Convert to array and sort by count
    return Array.from(userCounts.values())
      .map(({ user, count }) => ({ user, transactionCount: count }))
      .sort((a, b) => b.transactionCount - a.transactionCount);
  }

  async getConversations(): Promise<{
    conversations: Array<{
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
        createdAt: string;
      } | null;
      updatedAt: string;
      unreadCount: number;
    }>;
  }> {
    return this.request('/api/conversations');
  }

  async getConversation(transactionId: string): Promise<{
    conversation: {
      id: string;
      createdAt: string;
      lastMessageAt: string | null;
    };
    messages: Array<{
      id: string;
      body: string;
      senderId: string | null;
      createdAt: string;
      readAt: string | null;
    }>;
  }> {
    return this.request(`/api/conversations/transaction/${transactionId}`);
  }

  async getConversationById(conversationId: string): Promise<{
    conversation: {
      id: string;
      createdAt: string;
      lastMessageAt: string | null;
    };
    messages: Array<{
      id: string;
      body: string;
      senderId: string | null;
      createdAt: string;
      readAt: string | null;
    }>;
  }> {
    return this.request(`/api/conversations/${conversationId}`);
  }

  async sendMessage(transactionId: string, body: string): Promise<{
    id: string;
    body: string;
    senderId: string | null;
    createdAt: string;
    readAt: string | null;
  }> {
    return this.request(`/api/conversations/transaction/${transactionId}`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  async sendMessageToConversation(conversationId: string, body: string): Promise<{
    id: string;
    body: string;
    senderId: string | null;
    createdAt: string;
    readAt: string | null;
  }> {
    return this.request(`/api/conversations/${conversationId}`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  async deleteMessage(messageId: string): Promise<{ success: boolean }> {
    return this.request(`/api/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  async deleteConversation(conversationId: string): Promise<{ success: boolean }> {
    return this.request(`/api/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();

