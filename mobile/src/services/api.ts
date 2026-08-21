import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { ProductItem, StockTransaction, SummaryData } from '../types';

export async function getAuthHeaders(role?: string): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  if (role) {
    headers['x-user-role'] = role;
  }
  
  return headers;
}

function getApiBaseUrl(): string {
  if (Platform.OS === 'web') {
    // In web browsers, default to localhost or the production Render server
    if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname === 'localhost') {
      return 'http://localhost:5000/api/v1';
    }
    return 'https://rdw-inventory-system.onrender.com/api/v1';
  }

  // Extract local Wi-Fi IP address when running inside Expo Go on physical phones
  const manifestHost = Constants.expoConfig?.hostUri?.split(':')[0];
  if (manifestHost && manifestHost !== 'localhost' && manifestHost !== '127.0.0.1') {
    return `http://${manifestHost}:5000/api/v1`;
  }
  return 'https://rdw-inventory-system.onrender.com/api/v1';
}

export const API_BASE_URL = getApiBaseUrl();

// Local cache for instant optimistic updates & offline fallback
let localProductsCache: ProductItem[] = [];

export async function fetchProducts(role: string, category?: string, search?: string): Promise<ProductItem[]> {
  try {
    let url = `${API_BASE_URL}/products?`;
    if (category && category !== 'All' && category !== 'ALL') url += `category=${encodeURIComponent(category)}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    const headers = await getAuthHeaders(role);
    const res = await fetch(url, {
      headers,
    });
    const json = await res.json();
    if (json.success && json.data) {
      localProductsCache = json.data;
      return json.data;
    }
    return localProductsCache;
  } catch (err) {
    console.warn('[API Fetch Products] Using cached products');
    let filtered = [...localProductsCache];
    if (category && category !== 'All' && category !== 'ALL') {
      filtered = filtered.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q)));
    }
    return filtered;
  }
}

export async function fetchSummaryData(role: string): Promise<SummaryData | null> {
  try {
    const headers = await getAuthHeaders(role);
    const res = await fetch(`${API_BASE_URL}/reports/summary`, {
      headers,
    });
    const json = await res.json();
    if (json.success) return json.data;
    return null;
  } catch (err) {
    return null;
  }
}

export async function logStockTransaction(
  role: string,
  data: { productId: string; changeType: 'IN' | 'OUT'; quantity: number; unit: string; remark?: string }
): Promise<{ success: boolean; error?: string; message?: string; product?: ProductItem }> {
  try {
    const headers = await getAuthHeaders(role);
    const res = await fetch(`${API_BASE_URL}/transactions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: 'Network error or backend offline' };
  }
}

export async function createProductItem(
  role: string,
  data: { name: string; category: string; unit: string; minStock: number; openingStock: number; sku?: string }
): Promise<{ success: boolean; error?: string; data?: ProductItem }> {
  try {
    const headers = await getAuthHeaders(role);
    const res = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: 'Failed to connect to backend server' };
  }
}

export async function updateProductItem(
  role: string,
  id: string,
  data: { name?: string; category?: string; unit?: string; minStock?: number; totalStock?: number }
): Promise<{ success: boolean; error?: string; data?: ProductItem }> {
  try {
    const headers = await getAuthHeaders(role);
    const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: 'Failed to connect to backend server' };
  }
}

export async function deleteProductItem(
  role: string,
  id: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const headers = await getAuthHeaders(role);
    const res = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: 'Failed to connect to backend server' };
  }
}

export async function exportReportCSV(
  role: string,
  type: 'livestock' | 'lowstock' | 'stockin' | 'stockout'
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const headers = await getAuthHeaders(role);
    const res = await fetch(`${API_BASE_URL}/reports/export?type=${type}`, {
      headers,
    });
    const text = await res.text();
    return { success: true, data: text };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchTransactions(
  role: string,
  limit = 200,
  productId?: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    let url = `${API_BASE_URL}/transactions?limit=${limit}`;
    if (productId) url += `&productId=${productId}`;
    const headers = await getAuthHeaders(role);
    const res = await fetch(url, {
      headers,
    });
    const json = await res.json();
    return { success: json.success, data: json.data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
