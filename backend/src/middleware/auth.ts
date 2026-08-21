import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { User } from '@supabase/supabase-js';

export interface AuthenticatedRequest extends Request {
  user?: User & { role: string; restaurant_id: string };
}

/**
 * Middleware to verify Supabase JWT and populate authenticated user context with tenant details.
 */
export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Unauthorized. Access token is required.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 1. Verify token signature and retrieve authenticated user ID from Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized. Invalid or expired token.' });
    }

    // 2. Query the user profile from database to get tenant details and role
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('restaurant_id, role')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. User profile not found in database. Complete registration.',
      });
    }

    // 3. Attach session context to request object
    req.user = {
      ...authData.user,
      role: profile.role,
      restaurant_id: profile.restaurant_id,
    };

    return next();
  } catch (error: any) {
    console.error('[Auth Middleware Error] Failed to verify session:', error.message);
    return res.status(401).json({ success: false, error: 'Unauthorized. Session verification failed.' });
  }
};

/**
 * Middleware to restrict access to specific roles.
 * Must be used after `requireAuth`.
 */
export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ success: false, error: 'Forbidden. You do not have the required permissions.' });
    }

    next();
  };
};