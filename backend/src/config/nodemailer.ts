import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

export const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

export const companyEmail = process.env.COMPANY_EMAIL || 'inventory@rdwrestaurant.com';
export const smtpFrom = process.env.SMTP_FROM || 'RDW Inventory System <alerts@rdwrestaurant.com>';
