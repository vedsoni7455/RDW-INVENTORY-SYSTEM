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

// --- Invite Redirection Route ---
app.get('/', (req, res) => {
  const { restaurantId, role } = req.query;

  if (restaurantId && role) {
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Onboarding - Rajubhai Dosawala</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            background-color: #060911;
            color: #f8fafc;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            padding: 20px;
            box-sizing: border-box;
            text-align: center;
          }
          .card {
            background-color: #101827;
            border: 1px solid #1e2e4a;
            border-radius: 20px;
            padding: 30px;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          }
          h1 {
            color: #00f2fe;
            margin-top: 0;
            font-size: 24px;
          }
          p {
            color: #94a3b8;
            line-height: 1.5;
            margin-bottom: 25px;
            font-size: 15px;
          }
          .btn {
            background-color: #00f2fe;
            color: #060911;
            text-decoration: none;
            padding: 12px 24px;
            border-radius: 12px;
            font-weight: bold;
            display: inline-block;
            transition: background-color 0.2s;
            margin-bottom: 12px;
            border: none;
            cursor: pointer;
            width: 100%;
            box-sizing: border-box;
          }
          .btn:hover {
            background-color: #00c6d2;
          }
          .btn-secondary {
            background-color: transparent;
            color: #38bdf8;
            border: 2px solid #38bdf8;
            text-decoration: none;
            padding: 10px 24px;
            border-radius: 12px;
            font-weight: bold;
            display: inline-block;
            transition: all 0.2s;
            margin-bottom: 20px;
            cursor: pointer;
            width: 100%;
            box-sizing: border-box;
          }
          .btn-secondary:hover {
            background-color: rgba(56, 189, 248, 0.15);
            color: #ffffff;
            border-color: #ffffff;
          }
          .sub-text {
            font-size: 11px;
            color: #64748b;
            line-height: 1.4;
          }
        </style>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.location.href = "rdwinventory://invite?restaurantId=${restaurantId}&role=${role}";
            }, 500);
          };
        </script>
      </head>
      <body>
        <div class="card">
          <h1>🍳 Invitation Received</h1>
          <p>You have been invited to join <strong>Rajubhai Dosawala</strong> as a <strong>\${(role as string).toUpperCase()}</strong>.</p>
          <a class="btn" href="rdwinventory://invite?restaurantId=\${restaurantId}&role=\${role}">OPEN IN APP</a>
          <a class="btn-secondary" href="/download-apk">DOWNLOAD APP (APK)</a>
          <div class="sub-text">If the app does not open automatically, make sure you have the Rajubhai Dosawala APK installed on your device and click "Open in App".</div>
        </div>
      </body>
      </html>
    `);
  }

  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>RDW Inventory Backend</title>
      <style>
        body { background-color: #060911; color: #f8fafc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        h1 { color: #00f2fe; font-size: 28px; }
      </style>
    </head>
    <body>
      <h1>✅ RDW Inventory Backend Service Online</h1>
    </body>
    </html>
  `);
});

// --- APK Download Redirect Route ---
app.get('/download-apk', (req, res) => {
  const latestApkUrl = process.env.LATEST_APK_URL || 'https://expo.dev/artifacts/eas/34F1ecg1fQgZUS7TFFT9IWRpgA6C1oWF6qRLPmFzHUY.apk';
  res.redirect(latestApkUrl);
});

// --- Health Check Route ---
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ service: 'rdw-inventory-backend', status: 'ok' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});