import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
const authToken = process.env.TWILIO_AUTH_TOKEN || '';
export const twilioPhone = process.env.TWILIO_PHONE_NUMBER || '';

let client: twilio.Twilio | null = null;

if (accountSid && authToken && accountSid.startsWith('AC')) {
  try {
    client = twilio(accountSid, authToken);
  } catch (err: any) {
    console.warn(`[Twilio Config Warning] Could not initialize Twilio client: ${err.message}`);
    client = null;
  }
} else if (accountSid) {
  console.warn('[Twilio Config Note] Twilio SID is unconfigured or set to placeholder value. SMS alerts will run in simulation mode.');
}

export const twilioClient = client;
