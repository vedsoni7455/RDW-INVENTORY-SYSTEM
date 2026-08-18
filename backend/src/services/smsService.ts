import { twilioClient, twilioPhone } from '../config/sms';

export interface SMSAlertData {
  phoneNumbers: string[];
  productName: string;
  currentStock: number;
  minimumThreshold: number;
  unit: string;
}

export async function sendLowStockSMSAlert(alert: SMSAlertData): Promise<boolean> {
  if (!alert.phoneNumbers || alert.phoneNumbers.length === 0) {
    console.log('[SMS Alert Skipped] No recipient phone numbers provided.');
    return false;
  }

  const messageText = `🚨 RDW INVENTORY ALERT: Low Stock on "${alert.productName}". Current: ${alert.currentStock} ${alert.unit} (Min Threshold: ${alert.minimumThreshold} ${alert.unit}). Please reorder immediately.`;

  let successCount = 0;

  for (const phone of alert.phoneNumbers) {
    try {
      if (twilioClient && twilioPhone) {
        const res = await twilioClient.messages.create({
          body: messageText,
          from: twilioPhone,
          to: phone,
        });
        console.log(`[SMS Alert Sent] SID: ${res.sid} to ${phone}`);
      } else {
        // Fallback simulation log when Twilio keys are not set up in env
        console.log(`[SMS Alert Simulated] To: ${phone} | Text: "${messageText}"`);
      }
      successCount++;
    } catch (err: any) {
      console.error(`[SMS Alert Failed] To: ${phone} | Error: ${err.message}`);
    }
  }

  return successCount > 0;
}
