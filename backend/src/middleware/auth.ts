import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { User } from '@supabase/supabase-js';

export interface AuthenticatedRequest extends Request {
  user?: User & { role?: string };
}

/**
 * Middleware to verify Supabase JWT and attach user to request.
 */
export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Unauthorized. Invalid token.' });
    }

    // Attach user and role to the request object
    req.user = { ...data.user, role: data.user.user_metadata.role };
    next();
  } catch (error: any) {
    res.status(500).json({ error: 'An error occurred during authentication.' });
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
      return res.status(403).json({ error: 'Forbidden. You do not have the required permissions.' });
    }

    next();
  };
};