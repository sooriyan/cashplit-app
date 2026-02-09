import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// Update this to your API URL
// For local development with Expo Go, use your computer's local IP address
// For example: 'http://192.168.1.100:3000'
// For production, use your deployed API URL
const API_BASE_URL = 'https://cashplit.vercel.app';

class ApiService {
    private instance: AxiosInstance;
    private userId: string | null = null;

    constructor() {
        this.instance = axios.create({
            baseURL: API_BASE_URL,
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Add request interceptor to include user ID header
        this.instance.interceptors.request.use(
            (config: InternalAxiosRequestConfig) => {
                console.log('API Request:', config.method?.toUpperCase(), config.url, 'userId:', this.userId);
                if (this.userId) {
                    config.headers['x-user-id'] = this.userId;
                }
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );

        // Add response interceptor for error handling
        this.instance.interceptors.response.use(
            (response) => response,
            (error) => {
                // Log detailed error information for debugging
                console.log('API Error Details:', {
                    url: error.config?.url,
                    method: error.config?.method,
                    status: error.response?.status,
                    message: error.message,
                    code: error.code,
                    isNetworkError: error.message === 'Network Error',
                });

                if (error.response?.status === 401) {
                    // Handle unauthorized - could trigger sign out
                    console.log('Unauthorized request');
                }
                return Promise.reject(error);
            }
        );
    }

    setUserId(userId: string | null) {
        this.userId = userId;
    }

    getUserId() {
        return this.userId;
    }

    // Generic request methods
    get(url: string, config?: any) {
        return this.instance.get(url, config);
    }

    post(url: string, data?: any, config?: any) {
        return this.instance.post(url, data, config);
    }

    put(url: string, data?: any, config?: any) {
        return this.instance.put(url, data, config);
    }

    delete(url: string, config?: any) {
        return this.instance.delete(url, config);
    }

    // Specific API methods

    // Groups
    getGroups() {
        return this.get('/api/groups');
    }

    createGroup(name: string) {
        return this.post('/api/groups', { name });
    }

    getGroup(id: string) {
        return this.get(`/api/groups/${id}`);
    }

    getGroupBalances(id: string) {
        return this.get(`/api/groups/${id}/balances`);
    }

    // Expenses
    addExpense(groupId: string, data: {
        description: string;
        amount: number;
        paidBy: string;
        splitBetween: string[];
        splitType: 'equal' | 'percentage';
        percentages?: Record<string, number>;
    }) {
        return this.post(`/api/groups/${groupId}/expenses`, data);
    }

    getExpense(groupId: string, expenseId: string) {
        return this.get(`/api/groups/${groupId}/expenses/${expenseId}`);
    }

    updateExpense(groupId: string, expenseId: string, data: {
        description: string;
        amount: number;
        paidBy: string;
        splitBetween: string[];
        splitType: 'equal' | 'percentage';
        percentages?: Record<string, number>;
    }) {
        return this.put(`/api/groups/${groupId}/expenses/${expenseId}`, data);
    }

    deleteExpense(groupId: string, expenseId: string) {
        return this.delete(`/api/groups/${groupId}/expenses/${expenseId}`);
    }

    // Members
    addMember(groupId: string, email: string) {
        return this.post(`/api/groups/${groupId}/members`, { email });
    }

    // Settlements
    markSettlementPaid(groupId: string, data: { payeeId: string; amount: number }) {
        return this.post(`/api/groups/${groupId}/settlements`, data);
    }

    leaveGroup(groupId: string) {
        return this.post(`/api/groups/${groupId}/leave`);
    }

    // Profile
    getProfile() {
        return this.get('/api/profile');
    }

    updateProfile(data: { name?: string; phone?: string; upiId?: string }) {
        return this.put('/api/profile', data);
    }

    // User suggestions
    getUserSuggestions() {
        return this.get('/api/users/suggestions');
    }
}

// Export singleton instance
const api = new ApiService();
export default api;
