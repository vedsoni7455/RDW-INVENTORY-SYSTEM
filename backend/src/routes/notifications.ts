import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { dispatchMultiChannelLowStockAlert } from '../services/notificationService';

const router = Router();

// POST /api/v1/notifications/push-token - Register device Expo Push token
router.post('/push-token', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { pushToken } = req.body;
    const userId = req.user?.id;

    if (!pushToken || !userId) {
      return res.status(400).json({ success: false, error: 'pushToken and user session are required.' });
    }

    const { error } = await supabase
      .from('users')
      .update({ push_token: pushToken, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;

    res.json({ success: true, message: 'Push notification token registered successfully.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/notifications/test-alert - Test multi-channel alert dispatch (Owner/Manager only)
router.post('/test-alert', requireAuth, requireRole(['owner', 'manager']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, error: 'productId is required.' });
    }

    const restaurantId = req.user?.restaurant_id;
    if (!restaurantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Tenant context missing.' });
    }

    // Verify product belongs to user's restaurant (IDOR check)
    const { data: product, error: checkErr } = await supabase
      .from('products')
      .select('id')
      .eq('id', productId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (checkErr || !product) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. This product does not belong to your restaurant.',
      });
    }

    dispatchMultiChannelLowStockAlert(productId).catch(err => console.error(err));

    res.json({ success: true, message: 'Test multi-channel low stock notification triggered (Push, Email, SMS).' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
