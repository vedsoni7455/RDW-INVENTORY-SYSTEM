import { supabase } from '../config/supabase';

export interface ReportFilter {
  type: 'stockin' | 'stockout' | 'livestock' | 'lowstock';
  productName?: string;
  category?: string;
  fromDate?: string;
  toDate?: string;
}

export async function generateCSVReport(filter: ReportFilter): Promise<string> {
  let rows: any[] = [];
  let headers: string[] = [];

  if (filter.type === 'livestock' || filter.type === 'lowstock') {
    headers = ['SKU', 'Item Name', 'Category', 'Opening Stock', 'Total Stock In', 'Total Stock Out', 'Current Stock', 'Min Threshold', 'Status', 'Unit'];
    
    let query = supabase.from('v_live_stock').select('*');
    if (filter.type === 'lowstock') {
      query = query.or('status.eq.LOW STOCK,status.eq.OUT OF STOCK');
    }
    if (filter.category) {
      query = query.eq('category', filter.category);
    }

    const { data } = await query;
    rows = (data || []).map(r => [
      r.sku || '',
      `"${r.name.replace(/"/g, '""')}"`,
      `"${r.category.replace(/"/g, '""')}"`,
      r.opening_stock,
      r.total_stock_in,
      r.total_stock_out,
      r.current_stock,
      r.minimum_threshold,
      r.status,
      r.unit
    ]);
  } else {
    headers = ['Date & Time', 'Item Name', 'Transaction Type', 'Quantity', 'Unit', 'Remark', 'Log User'];
    
    let query = supabase.from('stock_transactions')
      .select('created_at, change_type, quantity, unit, remark, created_by_name, products(name)')
      .order('created_at', { ascending: false });

    if (filter.type === 'stockin') {
      query = query.eq('change_type', 'IN');
    } else if (filter.type === 'stockout') {
      query = query.eq('change_type', 'OUT');
    }

    if (filter.fromDate) {
      query = query.gte('created_at', filter.fromDate);
    }
    if (filter.toDate) {
      query = query.lte('created_at', filter.toDate);
    }

    const { data } = await query;
    rows = (data || []).map((r: any) => [
      new Date(r.created_at).toISOString().split('T')[0],
      `"${(r.products?.name || 'Unknown Item').replace(/"/g, '""')}"`,
      r.change_type,
      r.quantity,
      r.unit,
      `"${(r.remark || '').replace(/"/g, '""')}"`,
      `"${(r.created_by_name || 'Staff').replace(/"/g, '""')}"`
    ]);
  }

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  return csvContent;
}
