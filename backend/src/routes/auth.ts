import { Router } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user (defaults to 'staff' role)
 * @access  Public
 */
router.post('/register', async (req, res) => {
  const { email, password, full_name, role, restaurant_name, restaurant_id } = req.body;

  if (!email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'Email, password, full_name, and role are required.' });
  }

  if (!['owner', 'manager', 'staff'].includes(role)) {
    return res.status(400).json({ error: "Invalid role. Must be 'owner', 'manager', or 'staff'." });
  }

  try {
    let finalRestaurantId = restaurant_id;

    // 1. Handle Tenant/Restaurant Setup
    if (role === 'owner') {
      if (!restaurant_name || !restaurant_name.trim()) {
        return res.status(400).json({ error: 'Restaurant name is required for Owner accounts.' });
      }
      
      const { data: restaurant, error: restErr } = await supabase
        .from('restaurants')
        .insert({ name: restaurant_name.trim() })
        .select()
        .single();

      if (restErr || !restaurant) {
        throw new Error(restErr?.message || 'Failed to create restaurant.');
      }
      finalRestaurantId = restaurant.id;
    } else {
      if (!restaurant_id) {
        return res.status(400).json({ error: 'Restaurant ID is required for Manager or Staff accounts.' });
      }

      const { data: restaurant, error: restErr } = await supabase
        .from('restaurants')
        .select('id')
        .eq('id', restaurant_id)
        .single();

      if (restErr || !restaurant) {
        return res.status(400).json({ error: 'Invalid Restaurant ID. The restaurant does not exist.' });
      }
      finalRestaurantId = restaurant.id;
    }

    // 2. Sign up user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name,
          role: role,
          restaurant_id: finalRestaurantId,
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Registration successful, but no user data returned.');

    // 3. Create user profile in public.users table linked to restaurant_id
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name: full_name,
        role: role,
        restaurant_id: finalRestaurantId,
      });

    if (profileError) {
      throw new Error(`Profile creation failed: ${profileError.message}`);
    }

    res.status(201).json({ 
      success: true,
      message: 'User registered successfully. Please verify your email if required.',
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: role,
        restaurant_id: finalRestaurantId
      }
    });
  } catch (error: any) {
    console.error('Registration Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @route   POST /api/v1/auth/login
 * @desc    Log in a user and get a session token
 * @access  Public
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    res.json({ message: 'Login successful', user: data.user, session: data.session });
  } catch (error: any) {
    console.error('Login Error:', error.message);
    res.status(400).json({ error: error.message });
  }
});

export default router;