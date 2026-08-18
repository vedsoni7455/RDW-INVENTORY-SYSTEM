import fs from 'fs';
import path from 'path';

export interface ProductRecord {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  minimum_threshold: number;
  opening_stock: number;
  total_stock_in: number;
  total_stock_out: number;
  total_stock: number;
  current_stock: number;
  status: 'OK' | 'LOW STOCK' | 'OUT OF STOCK';
  updated_at: string;
}

export interface TransactionRecord {
  id: string;
  product_id: string;
  change_type: 'IN' | 'OUT';
  quantity: number;
  unit: string;
  remark?: string;
  created_by?: string;
  created_by_name: string;
  created_at: string;
  products?: {
    name: string;
    category?: string;
  };
}

class MockStore {
  private products: ProductRecord[] = [];
  private transactions: TransactionRecord[] = [];

  constructor() {
    this.initProducts();
    this.initTransactions();
  }

  private initProducts() {
    try {
      const seedPath = path.resolve(__dirname, '../../../database/seed_data.json');
      if (fs.existsSync(seedPath)) {
        const raw = fs.readFileSync(seedPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.products)) {
          this.products = parsed.products.map((p: any, idx: number) => {
            const minStock = Number(p.min_stock) || 5;
            const opening = Number(p.opening_stock) || 0;
            // Seed sample live stocks
            const stockIn = opening > 0 ? opening : (idx % 3 === 0 ? minStock * 3 : minStock * 2);
            const stockOut = idx % 5 === 0 ? Math.max(0, stockIn - Math.max(1, minStock - 2)) : Math.floor(stockIn * 0.4);
            const totalStock = Math.max(0, stockIn - stockOut);
            
            let status: 'OK' | 'LOW STOCK' | 'OUT OF STOCK' = 'OK';
            if (totalStock === 0) status = 'OUT OF STOCK';
            else if (totalStock <= minStock) status = 'LOW STOCK';

            const skuId = (idx + 1).toString().padStart(4, '0');
            return {
              id: `prod-${skuId}`,
              sku: `SKU-${skuId}`,
              name: p.name,
              category: p.category || 'General',
              unit: p.unit || 'Kg',
              minimum_threshold: minStock,
              opening_stock: opening,
              total_stock_in: stockIn,
              total_stock_out: stockOut,
              total_stock: totalStock,
              current_stock: totalStock,
              status,
              updated_at: new Date().toISOString(),
            };
          });
        }
      }
    } catch (e) {
      console.warn('[MockStore] Fallback to default product list:', e);
    }

    if (this.products.length === 0) {
      this.products = [
        {
          id: 'prod-0001',
          sku: 'SKU-0001',
          name: 'Red Chilli Sauce 750 ML',
          category: 'Sauce',
          unit: 'Bottle',
          minimum_threshold: 5,
          opening_stock: 0,
          total_stock_in: 20,
          total_stock_out: 8,
          total_stock: 12,
          current_stock: 12,
          status: 'OK',
          updated_at: new Date().toISOString(),
        },
        {
          id: 'prod-0002',
          sku: 'SKU-0002',
          name: 'Green Chilli Sauce 750 ML',
          category: 'Sauce',
          unit: 'Bottle',
          minimum_threshold: 5,
          opening_stock: 0,
          total_stock_in: 15,
          total_stock_out: 12,
          total_stock: 3,
          current_stock: 3,
          status: 'LOW STOCK',
          updated_at: new Date().toISOString(),
        },
        {
          id: 'prod-0013',
          sku: 'SKU-0013',
          name: 'Toor Dal',
          category: 'Grocery',
          unit: 'Kg',
          minimum_threshold: 10,
          opening_stock: 0,
          total_stock_in: 50,
          total_stock_out: 46,
          total_stock: 4,
          current_stock: 4,
          status: 'LOW STOCK',
          updated_at: new Date().toISOString(),
        },
        {
          id: 'prod-0046',
          sku: 'SKU-0046',
          name: 'Paneer',
          category: 'Dairy',
          unit: 'Kg',
          minimum_threshold: 10,
          opening_stock: 0,
          total_stock_in: 30,
          total_stock_out: 15,
          total_stock: 15,
          current_stock: 15,
          status: 'OK',
          updated_at: new Date().toISOString(),
        },
      ];
    }
  }

  private initTransactions() {
    this.transactions = [
      {
        id: 'tx-001',
        product_id: 'prod-0013',
        change_type: 'IN',
        quantity: 25,
        unit: 'Kg',
        remark: 'Fresh Grocery Delivery',
        created_by_name: 'Store Manager',
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        products: { name: 'Toor Dal', category: 'Grocery' },
      },
      {
        id: 'tx-002',
        product_id: 'prod-0001',
        change_type: 'OUT',
        quantity: 3,
        unit: 'Bottle',
        remark: 'Kitchen Chinese Station Prep',
        created_by_name: 'Kitchen Staff',
        created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
        products: { name: 'Red Chilli Sauce 750 ML', category: 'Sauce' },
      },
      {
        id: 'tx-003',
        product_id: 'prod-0046',
        change_type: 'IN',
        quantity: 15,
        unit: 'Kg',
        remark: 'Morning Dairy Supply Refill',
        created_by_name: 'Restaurant Owner',
        created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
        products: { name: 'Paneer', category: 'Dairy' },
      },
    ];
  }

  // --- Product Methods ---
  public getProducts(category?: string, search?: string, lowStockOnly?: boolean): ProductRecord[] {
    let result = [...this.products];
    if (category && category !== 'ALL' && category !== 'All') {
      result = result.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    if (lowStockOnly) {
      result = result.filter(p => p.status === 'LOW STOCK' || p.status === 'OUT OF STOCK' || p.total_stock <= p.minimum_threshold);
    }
    return result;
  }

  public getProductById(id: string): ProductRecord | undefined {
    return this.products.find(p => p.id === id || p.sku.toLowerCase() === id.toLowerCase());
  }

  public addProduct(item: Partial<ProductRecord>): ProductRecord {
    const nextIdx = this.products.length + 1;
    const sku = item.sku || `SKU-${nextIdx.toString().padStart(4, '0')}`;
    const id = `prod-${nextIdx.toString().padStart(4, '0')}-${Date.now().toString().slice(-4)}`;
    const minStock = Number(item.minimum_threshold) || 5;
    const opening = Number(item.opening_stock) || 0;
    const current = Number(item.total_stock) || opening;

    let status: 'OK' | 'LOW STOCK' | 'OUT OF STOCK' = 'OK';
    if (current === 0) status = 'OUT OF STOCK';
    else if (current <= minStock) status = 'LOW STOCK';

    const newProd: ProductRecord = {
      id,
      sku,
      name: item.name || 'Unnamed Ingredient',
      category: item.category || 'General',
      unit: item.unit || 'Kg',
      minimum_threshold: minStock,
      opening_stock: opening,
      total_stock_in: opening,
      total_stock_out: 0,
      total_stock: current,
      current_stock: current,
      status,
      updated_at: new Date().toISOString(),
    };

    this.products.unshift(newProd);
    return newProd;
  }

  public updateProduct(id: string, updates: Partial<ProductRecord>): ProductRecord | null {
    const idx = this.products.findIndex(p => p.id === id || p.sku.toLowerCase() === id.toLowerCase());
    if (idx === -1) return null;

    const existing = this.products[idx];
    const updated: ProductRecord = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updates.minimum_threshold !== undefined || updates.total_stock !== undefined) {
      const current = updated.total_stock;
      const min = updated.minimum_threshold;
      if (current <= 0) updated.status = 'OUT OF STOCK';
      else if (current <= min) updated.status = 'LOW STOCK';
      else updated.status = 'OK';
      updated.current_stock = current;
    }

    this.products[idx] = updated;
    return updated;
  }

  public deleteProduct(id: string): boolean {
    const lenBefore = this.products.length;
    this.products = this.products.filter(p => p.id !== id && p.sku.toLowerCase() !== id.toLowerCase());
    return this.products.length < lenBefore;
  }

  // --- Transaction Methods ---
  public addTransaction(tx: {
    productId: string;
    changeType: 'IN' | 'OUT';
    quantity: number;
    unit: string;
    remark?: string;
    createdBy?: string;
    createdByName?: string;
  }): { transaction: TransactionRecord; product: ProductRecord } | { error: string } {
    const product = this.getProductById(tx.productId);
    if (!product) {
      return { error: 'Product not found.' };
    }

    const qty = Number(tx.quantity);
    if (isNaN(qty) || qty <= 0) {
      return { error: 'Quantity must be a positive number.' };
    }

    if (tx.changeType === 'OUT' && product.total_stock < qty) {
      return {
        error: `Insufficient stock for "${product.name}". Available: ${product.total_stock} ${product.unit}, Requested: ${qty} ${product.unit}`,
      };
    }

    // Apply stock change
    if (tx.changeType === 'IN') {
      product.total_stock += qty;
      product.total_stock_in += qty;
    } else {
      product.total_stock -= qty;
      product.total_stock_out += qty;
    }
    product.current_stock = product.total_stock;
    product.updated_at = new Date().toISOString();

    if (product.total_stock <= 0) product.status = 'OUT OF STOCK';
    else if (product.total_stock <= product.minimum_threshold) product.status = 'LOW STOCK';
    else product.status = 'OK';

    const newTx: TransactionRecord = {
      id: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      product_id: product.id,
      change_type: tx.changeType,
      quantity: qty,
      unit: tx.unit || product.unit,
      remark: tx.remark,
      created_by: tx.createdBy,
      created_by_name: tx.createdByName || 'Staff Member',
      created_at: new Date().toISOString(),
      products: {
        name: product.name,
        category: product.category,
      },
    };

    this.transactions.unshift(newTx);
    return { transaction: newTx, product };
  }

  public getTransactions(limit = 50, type?: string, productId?: string): TransactionRecord[] {
    let list = [...this.transactions];
    if (type) {
      list = list.filter(t => t.change_type.toUpperCase() === type.toUpperCase());
    }
    if (productId) {
      list = list.filter(t => t.product_id === productId);
    }
    return list.slice(0, limit);
  }

  public getSummary() {
    const totalProducts = this.products.length;
    const lowStockCount = this.products.filter(p => p.status === 'LOW STOCK' || p.status === 'OUT OF STOCK' || p.total_stock <= p.minimum_threshold).length;
    const totalStockInSum = this.products.reduce((sum, p) => sum + (p.total_stock_in || 0), 0);
    const totalStockOutSum = this.products.reduce((sum, p) => sum + (p.total_stock_out || 0), 0);

    return {
      totalProducts,
      lowStockCount,
      totalStockInSum,
      totalStockOutSum,
      recentTransactions: this.transactions.slice(0, 10),
    };
  }
}

export const mockStore = new MockStore();
