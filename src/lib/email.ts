import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const SMTP_FROM_EMAIL =
  process.env.SMTP_FROM_EMAIL || process.env.ADMIN_EMAIL || '';
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Spectra Pack Machines';

// Customer enquiry replies can use the company mailbox independently of admin alerts.
const CUSTOMER_SMTP_HOST = process.env.CUSTOMER_SMTP_HOST || '';
const CUSTOMER_SMTP_PORT = Number(process.env.CUSTOMER_SMTP_PORT || '587');
const CUSTOMER_SMTP_USER = process.env.CUSTOMER_SMTP_USER || '';
const CUSTOMER_SMTP_PASS = process.env.CUSTOMER_SMTP_PASS || '';
const CUSTOMER_SMTP_SECURE = process.env.CUSTOMER_SMTP_SECURE === 'true' || CUSTOMER_SMTP_PORT === 465;
const CUSTOMER_SMTP_FROM_EMAIL = process.env.CUSTOMER_SMTP_FROM_EMAIL || '';
const CUSTOMER_SMTP_FROM_NAME = process.env.CUSTOMER_SMTP_FROM_NAME || SMTP_FROM_NAME;
const hasCustomerSettings = Object.keys(process.env).some((key) =>
  key.startsWith('CUSTOMER_SMTP_') && Boolean(process.env[key]),
);

export const EMAIL_CONFIG_MESSAGE =
  'Email delivery is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM_EMAIL to enable automatic emails.';

let transporterPromise: Promise<nodemailer.Transporter> | null = null;
let customerTransporter: nodemailer.Transporter | null = null;

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export function isEmailConfigured() {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && SMTP_FROM_EMAIL);
}

async function getTransporter() {
  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        requireTLS: !SMTP_SECURE,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      }),
    );
  }

  return transporterPromise;
}

export async function sendEmail(input: SendEmailInput) {
  if (!isEmailConfigured()) {
    console.warn(EMAIL_CONFIG_MESSAGE);
    return { sent: false, reason: EMAIL_CONFIG_MESSAGE } as const;
  }

  const transporter = await getTransporter();
  const result = await transporter.sendMail({
    from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: input.replyTo,
  });
  if (!Array.isArray(result.accepted) || result.accepted.length === 0) {
    throw new Error('Email server did not accept any recipient.');
  }

  return { sent: true } as const;
}

export async function sendCustomerEmail(input: SendEmailInput) {
  if (!hasCustomerSettings) return sendEmail(input);

  // A partial customer setup must never silently send from the admin mailbox.
  if (!(CUSTOMER_SMTP_HOST && CUSTOMER_SMTP_PORT && CUSTOMER_SMTP_USER && CUSTOMER_SMTP_PASS && CUSTOMER_SMTP_FROM_EMAIL)) {
    console.warn('Customer email delivery is not configured. Complete the CUSTOMER_SMTP settings.');
    return { sent: false, reason: 'Customer email delivery is not configured.' } as const;
  }

  if (!customerTransporter) {
    customerTransporter = nodemailer.createTransport({
      host: CUSTOMER_SMTP_HOST,
      port: CUSTOMER_SMTP_PORT,
      secure: CUSTOMER_SMTP_SECURE,
      requireTLS: !CUSTOMER_SMTP_SECURE,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth: { user: CUSTOMER_SMTP_USER, pass: CUSTOMER_SMTP_PASS },
    });
  }

  const result = await customerTransporter.sendMail({
    from: { name: CUSTOMER_SMTP_FROM_NAME, address: CUSTOMER_SMTP_FROM_EMAIL },
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    replyTo: CUSTOMER_SMTP_FROM_EMAIL,
  });
  if (!Array.isArray(result.accepted) || result.accepted.length === 0) {
    throw new Error('Email server did not accept any recipient.');
  }
  return { sent: true } as const;
}
