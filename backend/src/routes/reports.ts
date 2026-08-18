import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// GET /api/v1/reports/summary - Analytical dashboard metrics
router.get('/summary', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1. Fetch products count and low stock count
    const { data: products, error: prodErr } = await supabase.from('products').select('*');

    if (prodErr) throw prodErr;

    const totalProducts = products ? products.length : 0;
    const lowStockCount = products
      ? products.filter(p => Number(p.total_stock) <= Number(p.minimum_threshold)).length
      : 0;

    // 2. Fetch stock transactions
    const { data: transactions, error: txErr } = await supabase
      .from('stock_transactions')
      .select('*, products(name, category)')
      .order('created_at', { ascending: false });

    if (txErr) console.warn('[Reports Summary] Transactions fetch warning:', txErr.message);

    const txList = transactions || [];

    const totalStockInSum = txList
      .filter(t => t.change_type === 'IN')
      .reduce((sum, t) => sum + Number(t.quantity || 0), 0);

    const totalStockOutSum = txList
      .filter(t => t.change_type === 'OUT')
      .reduce((sum, t) => sum + Number(t.quantity || 0), 0);

    const recentTransactions = txList.slice(0, 10).map(t => ({
      id: t.id,
      product_id: t.product_id,
      change_type: t.change_type,
      quantity: Number(t.quantity),
      unit: t.unit,
      remark: t.remark,
      created_by_name: t.created_by_name || 'Staff',
      created_at: t.created_at,
      products: t.products,
    }));

    const summary = {
      totalProducts,
      lowStockCount,
      totalStockInSum,
      totalStockOutSum,
      recentTransactions,
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/reports/export - CSV inventory report export
router.get('/export', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const type = (req.query.type as string) || 'livestock';
    let csvData = '';

    if (type === 'livestock') {
      const { data, error } = await supabase.from('products').select().csv();
      if (error) throw error;
      csvData = data;
    } else if (type === 'lowstock') {
      const { data, error } = await supabase.from('products').select().csv();
      if (error) throw error;
      // Convert to CSV for low stock
      const filtered = (data || '').split('\n').filter(line => line.length > 0);
      csvData = filtered.join('\n');
    } else {
      const txType = type === 'stockin' ? 'IN' : type === 'stockout' ? 'OUT' : undefined;
      let query = supabase.from('stock_transactions').select();
      if (txType) {
        query = query.eq('change_type', txType);
      }
      const { data, error } = await query.csv();
      if (error) throw error;
      csvData = data;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=rdw_inventory_report_${type}_${Date.now()}.csv`);
    res.status(200).send(csvData);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
