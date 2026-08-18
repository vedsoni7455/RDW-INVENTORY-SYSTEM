import { emailTransporter, companyEmail, smtpFrom } from '../config/nodemailer';

export interface LowStockAlertData {
  productName: string;
  category: string;
  currentStock: number;
  minimumThreshold: number;
  unit: string;
}

export async function sendLowStockEmailAlert(alert: LowStockAlertData): Promise<boolean> {
  try {
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; }
          .card { background-color: #ffffff; border-radius: 8px; padding: 24px; max-width: 600px; margin: 0 auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { border-bottom: 2px solid #e1251b; padding-bottom: 12px; margin-bottom: 20px; }
          .header h2 { color: #e1251b; margin: 0; font-size: 20px; }
          .content-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .content-table th, .content-table td { padding: 12px; text-align: left; border-bottom: 1px solid #edf2f7; }
          .content-table th { background-color: #f8fafc; color: #475569; font-size: 13px; text-transform: uppercase; }
          .badge-low { background-color: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px; }
          .footer { font-size: 12px; color: #64748b; margin-top: 24px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h2>🚨 RDW RESTAURANT LOW STOCK ALERT</h2>
          </div>
          <p>The following restaurant ingredient/item has fallen to or below its minimum required threshold:</p>
          <table class="content-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Min Threshold</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>${alert.productName}</strong></td>
                <td>${alert.category}</td>
                <td style="color: #dc2626; font-weight: bold;">${alert.currentStock} ${alert.unit}</td>
                <td>${alert.minimumThreshold} ${alert.unit}</td>
                <td><span class="badge-low">LOW STOCK</span></td>
              </tr>
            </tbody>
          </table>
          <p>Please reorder this inventory item immediately to avoid kitchen disruption.</p>
          <div class="footer">
            <p>RDW Restaurant Inventory Automated Alert Engine</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const info = await emailTransporter.sendMail({
      from: smtpFrom,
      to: companyEmail,
      subject: `🚨 [LOW STOCK ALERT] ${alert.productName} (${alert.currentStock} ${alert.unit} remaining)`,
      html: htmlBody,
    });

    console.log(`[Email Alert Sent] MessageId: ${info.messageId} to ${companyEmail}`);
    return true;
  } catch (err: any) {
    console.error(`[Email Alert Failed] Error: ${err.message}`);
    return false;
  }
}
