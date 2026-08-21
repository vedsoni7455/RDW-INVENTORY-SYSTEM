import { Router, Response } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireRole, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/v1/products
 * @desc    Get all inventory products with stock levels
 * @access  Private (Authenticated Users)
 */
router.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { category, search } = req.query;

    const restaurantId = req.user?.restaurant_id;
    if (!restaurantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Tenant context missing.' });
    }

    // Try fetching from v_live_stock view first
    let { data: liveStock, error } = await supabase
      .from('v_live_stock')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name', { ascending: true });

    // Fallback to querying products table directly if view is missing
    if (error || !liveStock) {
      const { data: rawProducts, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('name', { ascending: true });

      if (prodErr) throw prodErr;

      liveStock = (rawProducts || []).map(p => {
        const total = Number(p.total_stock) || 0;
        const min = Number(p.minimum_threshold) || 5;
        let status = 'OK';
        if (total <= 0) status = 'OUT OF STOCK';
        else if (total <= min) status = 'LOW STOCK';

        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          unit: p.unit,
          opening_stock: p.opening_stock,
          total_stock_in: p.opening_stock,
          total_stock_out: 0,
          current_stock: total,
          minimum_threshold: min,
          status,
          updated_at: p.updated_at,
        };
      });
    }

    let products = (liveStock || []).map(item => {
      const current = Number(item.current_stock ?? item.total_stock ?? 0);
      const min = Number(item.minimum_threshold ?? 5);
      let status = item.status;
      if (!status) {
        if (current <= 0) status = 'OUT OF STOCK';
        else if (current <= min) status = 'LOW STOCK';
        else status = 'OK';
      }

      return {
        id: item.id || item.product_id,
        sku: item.sku || '',
        name: item.name || item.item_name,
        category: item.category || 'General',
        unit: item.unit || 'Kg',
        opening_stock: Number(item.opening_stock || 0),
        total_stock_in: Number(item.total_stock_in || 0),
        total_stock_out: Number(item.total_stock_out || 0),
        current_stock: current,
        total_stock: current,
        currentStock: current,
        minimum_threshold: min,
        minStock: min,
        status: status,
        updated_at: item.updated_at || new Date().toISOString(),
      };
    });

    if (category && category !== 'ALL' && category !== 'All') {
      const catLower = (category as string).toLowerCase();
      products = products.filter(p => p.category.toLowerCase() === catLower);
    }

    if (search) {
      const q = (search as string).toLowerCase();
      products = products.filter(
        p => p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q))
      );
    }

    res.json({
      success: true,
      message: 'Products retrieved successfully',
      count: products.length,
      data: products,
    });
  } catch (error: any) {
    console.error('Error fetching products:', error.message);
    res.status(500).json({ success: false, error: 'Failed to retrieve products', details: error.message });
  }
});

/**
 * @route   POST /api/v1/products
 * @desc    Create a new product item
 * @access  Private (Owner & Manager)
 */
router.post('/', requireAuth, requireRole(['owner', 'manager']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, category, unit, minStock, openingStock, sku } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Product name is required.' });
    }

    const restaurantId = req.user?.restaurant_id;
    if (!restaurantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Tenant context missing.' });
    }

    const minVal = Number(minStock) || 5;
    const openVal = Number(openingStock) || 0;

    const { data, error } = await supabase
      .from('products')
      .insert({
        sku: sku || `SKU-${Date.now().toString().slice(-4)}`,
        name,
        category: category || 'General',
        unit: unit || 'Kg',
        minimum_threshold: minVal,
        opening_stock: openVal,
        total_stock: openVal,
        restaurant_id: restaurantId,
      })
      .select()
      .single();

    if (error) throw error;

    let status = 'OK';
    if (openVal <= 0) status = 'OUT OF STOCK';
    else if (openVal <= minVal) status = 'LOW STOCK';

    const formattedProduct = {
      id: data.id,
      sku: data.sku,
      name: data.name,
      category: data.category,
      unit: data.unit,
      current_stock: openVal,
      total_stock: openVal,
      minimum_threshold: minVal,
      status,
    };

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: formattedProduct,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   PUT /api/v1/products/:id
 * @desc    Update a product item
 * @access  Private (Owner & Manager)
 */
router.put('/:id', requireAuth, requireRole(['owner', 'manager']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, category, unit, minStock, totalStock } = req.body;

    const restaurantId = req.user?.restaurant_id;
    if (!restaurantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Tenant context missing.' });
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (unit !== undefined) updates.unit = unit;
    if (minStock !== undefined) updates.minimum_threshold = Number(minStock);
    if (totalStock !== undefined) updates.total_stock = Number(totalStock);

    // Verify product ownership (IDOR check)
    const { data: existingProduct, error: checkErr } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .single();

    if (checkErr || !existingProduct) {
      return res.status(403).json({ success: false, error: 'Forbidden. This product does not belong to your restaurant.' });
    }

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .select()
      .single();

    if (error) throw error;

    const current = Number(data.total_stock);
    const min = Number(data.minimum_threshold);
    let status = 'OK';
    if (current <= 0) status = 'OUT OF STOCK';
    else if (current <= min) status = 'LOW STOCK';

    const formattedProduct = {
      id: data.id,
      sku: data.sku,
      name: data.name,
      category: data.category,
      unit: data.unit,
      current_stock: current,
      total_stock: current,
      minimum_threshold: min,
      status,
    };

    res.json({
      success: true,
      message: 'Product updated successfully',
      data: formattedProduct,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   DELETE /api/v1/products/:id
 * @desc    Delete a product item
 * @access  Private (Owner & Manager)
 */
router.delete('/:id', requireAuth, requireRole(['owner', 'manager']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const restaurantId = req.user?.restaurant_id;
    if (!restaurantId) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Tenant context missing.' });
    }

    // Verify product ownership (IDOR check)
    const { data: existingProduct, error: checkErr } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .eq('restaurant_id', restaurantId)
      .single();

    if (checkErr || !existingProduct) {
      return res.status(403).json({ success: false, error: 'Forbidden. This product does not belong to your restaurant.' });
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('restaurant_id', restaurantId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Product deleted successfully',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;