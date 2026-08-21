import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// POST /api/v1/batch/adjustments - Bulk stock adjustment (Owner & Manager only)
router.post('/adjustments', requireAuth, requireRole(['owner', 'manager']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items array is required' });
    }

    const restaurantId = req.user?.restaurant_id;
    if (!restaurantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Tenant context missing.' });
    }

    // Prepare the records for Supabase, ensuring data integrity
    const transactionsToInsert = items
      .filter(item => item.productId && item.changeType && item.quantity > 0)
      .map(item => ({
        product_id: item.productId,
        restaurant_id: restaurantId,
        change_type: item.changeType,
        quantity: Number(item.quantity),
        unit: item.unit,
        remark: item.remark || 'Bulk Batch Adjustment',
        created_by: req.user?.id,
        created_by_name: req.user?.user_metadata?.full_name || 'System',
      }));

    if (transactionsToInsert.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid items to process.' });
    }

    // Verify product ownership for all batch items (IDOR check)
    const productIds = Array.from(new Set(transactionsToInsert.map(t => t.product_id)));
    const { data: validProducts, error: checkErr } = await supabase
      .from('products')
      .select('id')
      .in('id', productIds)
      .eq('restaurant_id', restaurantId);

    if (checkErr || !validProducts || validProducts.length !== productIds.length) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. One or more products do not belong to your restaurant.',
      });
    }

    // Insert all valid transactions in a single batch call to the database
    const { data, error } = await supabase
      .from('stock_transactions')
      .insert(transactionsToInsert)
      .select();

    if (error) {
      throw error;
    }

    res.json({
      success: true,
      message: `Processed ${data.length} batch inventory updates.`,
      data: data,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
