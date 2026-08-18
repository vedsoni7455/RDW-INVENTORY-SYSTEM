import { Router } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user (defaults to 'staff' role)
 * @access  Public
 */
router.post('/register', async (req, res) => {
  const { email, password, full_name } = req.body;

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Email, password, and full_name are required.' });
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name,
          // All public registrations are set to 'staff' by default for security.
          // Owner/Manager roles should be assigned manually in the Supabase dashboard.
          role: 'staff',
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Registration successful, but no user data returned.');

    res.status(201).json({ message: 'User registered successfully. Please check your email to verify.' });
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