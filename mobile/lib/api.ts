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
  riftUserId?: string | null;
}

export interface RiftTransaction {
  id: string;
  riftNumber: number | null; // Sequential rift number for tracking
  itemTitle: string;
  itemDescription: string;
  itemType: 'PHYSICAL' | 'TICKETS' | 'DIGITAL' | 'SERVICES';
  // New fee structure
  subtotal?: number | null; // Transaction amount (before fees)
  amount: number; // Legacy field, use subtotal if available
  buyerFee?: number | null; // 3% buyer fee
  sellerFee?: number | null; // 5% seller fee
  sellerNet?: number | null; // Amount seller receives (subtotal - sellerFee)
  currency: string;
  // New state machine statuses
  status: 'AWAITING_PAYMENT' | 'FUNDED' | 'PROOF_SUBMITTED' | 'UNDER_REVIEW' | 'RELEASED' | 'DISPUTED' | 'RESOLVED' | 'PAYOUT_SCHEDULED' | 'PAID_OUT' | 'CANCELED' 
    // Legacy statuses (for backward compatibility)
    | 'AWAITING_SHIPMENT' | 'IN_TRANSIT' | 'DELIVERED_PENDING_RELEASE' | 'REFUNDED' | 'CANCELLED';
  buyerId: string;
  sellerId: string;
  buyer: User;
  seller: User;
  shippingAddress?: string | null;
  notes?: string | null;
  paymentReference?: string | null;
  // Legacy fee tracking (deprecated, use buyerFee/sellerFee)
  platformFee?: number | null;
  sellerPayoutAmount?: number | null;
  // Hybrid protection fields (legacy)
  shipmentVerifiedAt?: string | null;
  trackingVerified?: boolean;
  deliveryVerifiedAt?: string | null;
  gracePeriodEndsAt?: string | null;
  autoReleaseScheduled?: boolean;
  autoReleaseAt?: string | null; // New auto-release deadline
  // Type-specific fields
  eventDate?: string | null;
  venue?: string | null;
  transferMethod?: string | null;
  downloadLink?: string | null;
  licenseKey?: string | null;
  serviceDate?: string | null;
  createdAt: string;
  updatedAt: string;
  // Legacy proofs
  shipmentProofs?: ShipmentProof[];
  // New proof system
  proofs?: Proof[];
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

export interface Proof {
  id: string;
  proofType: 'PHYSICAL' | 'SERVICE' | 'DIGITAL';
  proofPayload: any; // JSON payload with proof data
  uploadedFiles?: string[] | null;
  status: 'PENDING' | 'VALID' | 'REJECTED';
  submittedAt: string;
  validatedAt?: string | null;
  rejectionReason?: string | null;
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
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { 
            error: 'Unknown error',
            details: `HTTP ${response.status}: ${response.statusText}`
          };
        }
        const errorMessage = errorData.error || `Request failed (${response.status})`;
        // Include details if available (for development)
        const errorDetails = errorData.details && process.env.NODE_ENV === 'development' 
          ? `\n\nDetails: ${errorData.details}` 
          : '';
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
        const errorData = await response.json().catch(() => ({ error: 'Invalid credentials' }));
        // Use message field if available (for verification errors), otherwise use error field
        const errorMessage = errorData.message || errorData.error || 'Invalid credentials';
        const error = new Error(errorMessage);
        // Preserve error code for verification errors
        if (errorData.error && ['VERIFICATION_REQUIRED', 'EMAIL_NOT_VERIFIED', 'PHONE_NOT_VERIFIED'].includes(errorData.error)) {
          (error as any).code = errorData.error;
        }
        throw error;
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

  async signUp(firstName: string, lastName: string, birthday: string, email: string, password: string): Promise<{ user: User; token: string }> {
    const response = await fetch(`${API_URL}/api/auth/mobile-signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, birthday, email, password }),
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
    // API returns user directly, not wrapped in { user: ... }
    const user = await this.request<User>('/api/auth/me');
    return user;
  }

  async updateProfile(data: { name?: string | null; phone?: string | null }): Promise<{ user: User }> {
    return this.request<{ user: User }>('/api/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async getEscrows(): Promise<RiftTransaction[]> {
    const response = await this.request<{ rifts: RiftTransaction[] }>('/api/rifts/list');
    return response.rifts || [];
  }

  async getEscrow(id: string): Promise<RiftTransaction> {
    return this.request<RiftTransaction>(`/api/rifts/${id}`);
  }

  async createEscrow(data: {
    itemTitle: string;
    itemDescription: string;
    itemType: 'PHYSICAL' | 'TICKETS' | 'DIGITAL' | 'SERVICES';
    amount: number;
    currency: string;
    creatorRole?: 'BUYER' | 'SELLER';
    sellerId?: string;
    sellerEmail?: string;
    buyerId?: string;
    buyerEmail?: string;
    partnerId?: string;
    partnerEmail?: string;
    shippingAddress?: string;
    notes?: string;
    eventDate?: string;
    venue?: string;
    transferMethod?: string;
    downloadLink?: string;
    licenseKey?: string;
    serviceDate?: string;
  }): Promise<{ escrowId: string }> {
    return this.request<{ escrowId: string }>('/api/rifts/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // New payment flow: fund endpoint (POST to create payment intent, PUT to confirm)
  async fundEscrow(escrowId: string): Promise<{ clientSecret: string; paymentIntentId: string; buyerTotal: number; subtotal: number; buyerFee: number }> {
    return this.request(`/api/rifts/${escrowId}/fund`, {
      method: 'POST',
    });
  }

  async confirmPayment(escrowId: string, paymentIntentId: string): Promise<{ success: boolean; status: string }> {
    return this.request(`/api/rifts/${escrowId}/fund`, {
      method: 'PUT',
      body: JSON.stringify({ paymentIntentId }),
    });
  }

  // Legacy methods (deprecated, use fundEscrow + confirmPayment instead)
  async createPaymentIntent(escrowId: string): Promise<{ clientSecret: string; paymentIntentId: string }> {
    // Redirect to new fund endpoint
    return this.fundEscrow(escrowId);
  }

  async markPaid(escrowId: string, paymentIntentId?: string): Promise<{ success: boolean; paymentReference?: string }> {
    if (!paymentIntentId) {
      throw new Error('paymentIntentId is required');
    }
    const result = await this.confirmPayment(escrowId, paymentIntentId);
    return { success: result.success, paymentReference: undefined };
  }

  async cancelEscrow(escrowId: string): Promise<{ success: boolean }> {
    return this.request(`/api/rifts/${escrowId}/cancel`, {
      method: 'POST',
    });
  }

  async confirmReceived(escrowId: string): Promise<{ success: boolean; newStatus?: string; payoutId?: string }> {
    return this.request(`/api/rifts/${escrowId}/confirm-received`, {
      method: 'POST',
    });
  }

  async releaseFunds(escrowId: string): Promise<{ success: boolean; status: string }> {
    // Use new /release endpoint (matches website)
    return this.request(`/api/rifts/${escrowId}/release`, {
      method: 'POST',
    });
  }

  // New proof submission system
  async submitProof(
    escrowId: string,
    data: {
      proofPayload: any; // JSON payload with proof data (trackingNumber, carrier, etc.)
      uploadedFiles?: string[]; // Array of file URLs
    }
  ): Promise<{ success: boolean; proofId: string; status: string; autoReleaseAt?: string; validation: any }> {
    return this.request(`/api/rifts/${escrowId}/proof`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Legacy methods (deprecated, use submitProof instead)
  async uploadShipmentProof(
    escrowId: string,
    data: {
      trackingNumber?: string;
      shippingCarrier?: string;
      fileUri?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean }> {
    // Convert to new proof format
    const proofPayload: any = {};
    if (data.trackingNumber) proofPayload.trackingNumber = data.trackingNumber;
    if (data.shippingCarrier) proofPayload.carrier = data.shippingCarrier;
    if (data.notes) proofPayload.notes = data.notes;

    const uploadedFiles: string[] = [];
    if (data.fileUri) {
      // In a real implementation, upload the file first and get the URL
      // For now, we'll include the URI (this should be uploaded to a file service)
      uploadedFiles.push(data.fileUri);
    }

    const result = await this.submitProof(escrowId, { proofPayload, uploadedFiles });
    return { success: result.success };
  }

  async markDelivered(
    escrowId: string,
    data: {
      fileUri?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; status?: string }> {
    // Convert to new proof format
    const proofPayload: any = {};
    if (data.notes) proofPayload.notes = data.notes;

    const uploadedFiles: string[] = [];
    if (data.fileUri) {
      uploadedFiles.push(data.fileUri);
    }

    const result = await this.submitProof(escrowId, { proofPayload, uploadedFiles });
    return { success: result.success, status: result.status };
  }

  async raiseDispute(escrowId: string, reason: string, type: string, evidence?: any): Promise<{ success: boolean; disputeId: string; status: string }> {
    return this.request(`/api/rifts/${escrowId}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason, type, evidence }),
    });
  }

  async getDisputes(): Promise<Dispute[]> {
    const response = await this.request<{ disputes: Dispute[] }>('/api/admin/disputes');
    return response.disputes || [];
  }

  async getUserDisputes(): Promise<Array<Dispute & { rift?: RiftTransaction }>> {
    const response = await this.request<{ disputes: Array<Dispute & { rift?: RiftTransaction }> }>('/api/me/disputes');
    return response.disputes || [];
  }

  async getAdminEscrows(): Promise<RiftTransaction[]> {
    const response = await this.request<{ rifts: RiftTransaction[] }>('/api/admin/rifts');
    return response.rifts || [];
  }

  async getLeaderboard(): Promise<Array<{ user: User; transactionCount: number }>> {
    // Try to get all rifts (admin endpoint first, fallback to user rifts)
    let rifts: RiftTransaction[];
    try {
      rifts = await this.getAdminEscrows();
    } catch {
      // If not admin or endpoint fails, use user's rifts
      rifts = await this.getEscrows();
    }
    
    // Count transactions per user (as buyer or seller)
    const userCounts = new Map<string, { user: User; count: number }>();
    
    rifts.forEach((rift) => {
      // Count buyer
      if (rift.buyer) {
        const existing = userCounts.get(rift.buyerId);
        if (existing) {
          existing.count++;
        } else {
          userCounts.set(rift.buyerId, { user: rift.buyer, count: 1 });
        }
      }
      
      // Count seller
      if (rift.seller) {
        const existing = userCounts.get(rift.sellerId);
        if (existing) {
          existing.count++;
        } else {
          userCounts.set(rift.sellerId, { user: rift.seller, count: 1 });
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

