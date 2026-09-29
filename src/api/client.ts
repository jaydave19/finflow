export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private baseUrl: string;

  constructor() {
    this.accessToken = localStorage.getItem('finflow_access_token');
    // Use VITE_API_BASE_URL from environment, fallback to /api for local development
    this.baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  }

  setToken(token: string | null) {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('finflow_access_token', token);
    } else {
      localStorage.removeItem('finflow_access_token');
    }
  }

  getToken(): string | null {
    return this.accessToken;
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers = new Headers(options.headers || {});

    if (this.accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    let response = await fetch(url, config);

    // If 401 Unauthorized and not already refreshing auth itself, attempt token refresh
    if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      const newToken = await this.refreshToken();
      if (newToken) {
        headers.set('Authorization', `Bearer ${newToken}`);
        response = await fetch(url, { ...options, headers });
      }
    }

    const contentType = response.headers.get('content-type');
    let data: any;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType && (contentType.includes('text/csv') || contentType.includes('spreadsheetml'))) {
      data = await response.blob();
      return data as T;
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMsg = data?.error || data?.message || `Request failed with status ${response.status}`;
      throw new Error(errorMsg);
    }

    return data as T;
  }

  private async refreshToken(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        if (!res.ok) {
          this.setToken(null);
          return null;
        }

        const data = await res.json();
        if (data.accessToken) {
          this.setToken(data.accessToken);
          return data.accessToken;
        }
        return null;
      } catch {
        this.setToken(null);
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  get<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T = any>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  put<T = any>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  }

  delete<T = any>(endpoint: string, body?: any, options: RequestInit = {}): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const api = new ApiClient();
