import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { dispatchMultiChannelLowStockAlert } from '../services/notificationService';

const router = Router();

// POST /api/v1/transactions - Log Stock In or Stock Out
router.post('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId, changeType, quantity, unit, remark } = req.body;

    if (!productId || !changeType || quantity === undefined) {
      return res.status(400).json({
        success: false,
        error: 'productId, changeType (IN/OUT), and quantity are required.',
      });
    }

    if (!['IN', 'OUT'].includes(changeType)) {
      return res.status(400).json({
        success: false,
        error: "changeType must be 'IN' or 'OUT'.",
      });
    }

    // Role-based check: Only owners/managers can add stock
    if (changeType === 'IN' && !['owner', 'manager'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. You do not have permission to add stock.',
      });
    }

    const qtyNum = Number(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Quantity must be a positive number.',
      });
    }

    // Persist transaction to Supabase
    const { data: transactionData, error: transactionError } = await supabase
      .from('stock_transactions')
      .insert({
        product_id: productId,
        change_type: changeType,
        quantity: qtyNum,
        unit: unit || 'Kg',
        remark: remark,
        created_by: req.user?.id,
        created_by_name: req.user?.user_metadata?.full_name || 'System',
      })
      .select()
      .single();

    if (transactionError) throw transactionError;

    // Retrieve updated stock level from products table
    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    const product: any = productData;

    if (productError || !product) {
      console.warn(`[Warning] Transaction logged, but failed to retrieve updated stock for product ${productId}`);
    } else {
      const currentStock = Number(product.total_stock || 0);
      const minStock = Number(product.minimum_threshold || 5);

      // Evaluate low stock threshold & trigger async notification
      if (changeType === 'OUT' && currentStock <= minStock) {
        dispatchMultiChannelLowStockAlert(product.id).catch(err => {
          console.warn(`[Alert Dispatch Note] ${err.message}`);
        });
      }
    }

    res.status(201).json({
      success: true,
      message: `Stock ${changeType} logged successfully.`,
      data: {
        transaction: transactionData,
        product: product,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/v1/transactions - Fetch transaction history logs
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { limit = 50, productId } = req.query;

    let query = supabase
      .from('stock_transactions')
      .select('*, product:products(name, category)')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (productId) {
      query = query.eq('product_id', productId as string);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      count: data ? data.length : 0,
      data: data || [],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
