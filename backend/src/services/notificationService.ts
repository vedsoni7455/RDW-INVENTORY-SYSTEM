import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { supabase } from '../config/supabase';
import { sendLowStockEmailAlert } from './emailService';
import { sendLowStockSMSAlert } from './smsService';
import { companyEmail } from '../config/nodemailer';

const expo = new Expo();

export async function dispatchMultiChannelLowStockAlert(productId: string): Promise<void> {
  try {
    // 1. Fetch product current stock details and its restaurant_id
    const { data: product, error: pErr } = await supabase
      .from('products')
      .select('id, name, category, unit, total_stock, minimum_threshold, restaurant_id')
      .eq('id', productId)
      .single();

    if (pErr || !product) {
      console.error(`[Notification Dispatcher] Product not found: ${productId}`);
      return;
    }

    // Verify if item is actually low stock
    if (Number(product.total_stock) > Number(product.minimum_threshold)) {
      return;
    }

    console.log(`[Multi-Channel Dispatcher] Low Stock Triggered for "${product.name}" (${product.total_stock} <= ${product.minimum_threshold})`);

    // 2. Fetch system settings for this specific restaurant
    const { data: settings } = await supabase
      .from('system_settings')
      .select('company_email, low_stock_email_alerts_enabled, low_stock_sms_alerts_enabled, low_stock_push_alerts_enabled')
      .eq('restaurant_id', product.restaurant_id)
      .maybeSingle();

    const targetEmail = settings?.company_email || companyEmail;
    const emailEnabled = settings ? settings.low_stock_email_alerts_enabled : true;
    const smsEnabled = settings ? settings.low_stock_sms_alerts_enabled : true;
    const pushEnabled = settings ? settings.low_stock_push_alerts_enabled : true;

    // 3. Fetch admin users (Owners and Managers) for THIS restaurant only
    const { data: adminUsers } = await supabase
      .from('users')
      .select('id, name, role, email, phone_number, push_token, notify_sms, notify_email, notify_push')
      .in('role', ['owner', 'manager'])
      .eq('restaurant_id', product.restaurant_id);

    const ownerManagerPhones = (adminUsers || [])
      .filter(u => u.phone_number && u.notify_sms !== false)
      .map(u => u.phone_number as string);

    const pushTokens = (adminUsers || [])
      .filter(u => u.push_token && u.notify_push !== false && Expo.isExpoPushToken(u.push_token))
      .map(u => u.push_token as string);

    // 4. Dispatch Channel 1: Mobile Push Notifications via Expo
    let pushSuccess = false;
    if (pushEnabled && pushTokens.length > 0) {
      const messages: ExpoPushMessage[] = pushTokens.map(token => ({
        to: token,
        sound: 'default',
        title: '🚨 Restaurant Low Stock Alert!',
        body: `Low stock on ${product.name}: ${product.total_stock} ${product.unit} remaining (Min: ${product.minimum_threshold} ${product.unit}).`,
        data: { productId: product.id, productName: product.name },
      }));

      const chunks = expo.chunkPushNotifications(messages);
      for (const chunk of chunks) {
        try {
          await expo.sendPushNotificationsAsync(chunk);
          pushSuccess = true;
        } catch (err: any) {
          console.error(`[Push Alert Error] ${err.message}`);
        }
      }
    } else {
      console.log('[Push Alert] Push notifications disabled or no active admin tokens.');
    }

    // 5. Dispatch Channel 2: Company Email Notification
    let emailSuccess = false;
    if (emailEnabled) {
      emailSuccess = await sendLowStockEmailAlert({
        productName: product.name,
        category: product.category,
        currentStock: Number(product.total_stock),
        minimumThreshold: Number(product.minimum_threshold),
        unit: product.unit,
      });
    }

    // 6. Dispatch Channel 3: SMS Text Message to Owner & Manager
    let smsSuccess = false;
    if (smsEnabled && ownerManagerPhones.length > 0) {
      smsSuccess = await sendLowStockSMSAlert({
        phoneNumbers: ownerManagerPhones,
        productName: product.name,
        currentStock: Number(product.total_stock),
        minimumThreshold: Number(product.minimum_threshold),
        unit: product.unit,
      });
    }

    // 7. Log Alert Dispatch Audit linked to the restaurant
    await supabase.from('low_stock_alerts_log').insert({
      product_id: product.id,
      restaurant_id: product.restaurant_id,
      product_name: product.name,
      current_stock: product.total_stock,
      minimum_threshold: product.minimum_threshold,
      email_sent: emailSuccess,
      sms_sent: smsSuccess,
      push_sent: pushSuccess,
    });

  } catch (err: any) {
    console.error(`[Multi-Channel Dispatcher Error] ${err.message}`);
  }
}
