import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import productRoutes from './routes/products';
import authRoutes from './routes/auth';
import transactionRoutes from './routes/transactions';
import reportRoutes from './routes/reports';
import batchRoutes from './routes/batch';
import notificationRoutes from './routes/notifications';
import { requireAuth, requireRole } from './middleware/auth';

const app = express();

// --- Middleware ---
// Enable Cross-Origin Resource Sharing
app.use(cors());
// Log HTTP requests
app.use(morgan('dev'));
// Add security headers
app.use(helmet());
// Parse JSON bodies
app.use(express.json());

// --- Rate Limiting ---
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// --- API Routes ---
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', requireAuth, productRoutes);
app.use('/api/v1/transactions', requireAuth, transactionRoutes);
app.use('/api/v1/reports', requireAuth, reportRoutes);
app.use('/api/v1/batch', requireAuth, requireRole(['owner', 'manager']), batchRoutes);
app.use('/api/v1/notifications', requireAuth, notificationRoutes);

// --- Health Check Route ---
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ service: 'rdw-inventory-backend', status: 'ok' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});