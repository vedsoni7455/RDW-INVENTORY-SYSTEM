export type UserRole = 'owner' | 'manager' | 'staff';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone_number?: string;
  restaurant_id?: string;
}

export interface ProductItem {
  id: string;
  sku?: string;
  name: string;
  category: string;
  unit: string;
  opening_stock: number;
  total_stock_in?: number;
  total_stock_out?: number;
  current_stock: number;
  total_stock?: number;
  minimum_threshold: number;
  status: 'OK' | 'LOW STOCK' | 'OUT OF STOCK';
  updated_at?: string;
}

export interface StockTransaction {
  id: string;
  product_id: string;
  change_type: 'IN' | 'OUT';
  quantity: number;
  unit: string;
  remark?: string;
  created_by_name?: string;
  created_at: string;
  products?: {
    name: string;
    category?: string;
  };
}

export interface SummaryData {
  totalProducts: number;
  lowStockCount: number;
  totalStockInSum: number;
  totalStockOutSum: number;
  recentTransactions: StockTransaction[];
  weeklyMovements?: {
    day: string;
    date: string;
    stockIn: number;
    stockOut: number;
  }[];
}
