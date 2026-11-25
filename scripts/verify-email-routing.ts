import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

// Verify routing without opening an SMTP connection or sending any email.
Object.assign(process.env, {
  SMTP_HOST: 'smtp.admin.example', SMTP_PORT: '465', SMTP_SECURE: 'true',
  SMTP_USER: 'admin@example.com', SMTP_PASS: 'test-only-admin-password',
  SMTP_FROM_EMAIL: 'admin@example.com', OWNER_NOTIFICATION_EMAIL: 'owner@example.com',
  CUSTOMER_SMTP_HOST: 'smtp.customer.example', CUSTOMER_SMTP_PORT: '587',
  CUSTOMER_SMTP_SECURE: 'false', CUSTOMER_SMTP_USER: 'info@example.com',
  CUSTOMER_SMTP_PASS: 'test-only-customer-password',
  CUSTOMER_SMTP_FROM_EMAIL: 'info@example.com', CUSTOMER_SMTP_FROM_NAME: 'Spectra Pack Machines',
});

type Delivery = { host: string; user: string; from: unknown; to: unknown; replyTo: unknown; subject: string };
const deliveries: Delivery[] = [];
let connections = 0;
const realCreateTransport = nodemailer.createTransport;
nodemailer.createTransport = ((options: { host: string; auth: { user: string }; requireTLS: boolean }) => {
  connections++;
  if (options.host === 'smtp.customer.example') assert.equal(options.requireTLS, true);
  return {
    sendMail: async (mail: { from: unknown; to: unknown; replyTo: unknown; subject: string }) => {
      deliveries.push({ host: options.host, user: options.auth.user, ...mail });
      return { accepted: ['test@example.com'] };
    },
  };
}) as typeof nodemailer.createTransport;

async function main() {
  try {
    const { sendLeadThankYouEmail, sendCatalogEmail, sendLeadOwnerNotificationEmail } = await import('../src/lib/notifications');
    await sendLeadThankYouEmail({ email: 'customer@example.com', name: 'Internal routing test' });
    await sendCatalogEmail({ email: 'customer@example.com', name: 'Internal routing test', catalogPath: '/catalog.pdf' });
    await sendLeadOwnerNotificationEmail({
      name: 'Internal routing test', email: 'customer@example.com', phone: '+919999999999',
      message: 'Internal test', source: 'contact',
    });
    assert.equal(deliveries.length, 3);
    for (const mail of deliveries.slice(0, 2)) {
      assert.equal(mail.host, 'smtp.customer.example');
      assert.equal(mail.user, 'info@example.com');
      assert.deepEqual(mail.from, { name: 'Spectra Pack Machines', address: 'info@example.com' });
      assert.equal(mail.replyTo, 'info@example.com');
    }
    assert.equal(deliveries[2].host, 'smtp.admin.example');
    assert.equal(deliveries[2].user, 'admin@example.com');
    assert.equal(deliveries[2].to, 'owner@example.com');
    assert.equal(deliveries[2].replyTo, 'customer@example.com');
    assert.equal(connections, 2, 'Each mailbox reuses its own connection');
    console.log('Customer thank-you/catalog and admin alert SMTP routing passed; no emails sent.');
  } finally {
    nodemailer.createTransport = realCreateTransport;
  }
}
main().catch(() => { console.error('Email routing verification failed.'); process.exitCode = 1; });
