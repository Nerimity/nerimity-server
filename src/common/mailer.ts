import nodemailer from 'nodemailer';
import env from './env';

const transporter = nodemailer.createTransport({
  service: process.env.SMTP_SERVICE,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface Options {
  to: string; // email address
  subject: string;
  body: string;
}

export async function sendMail(opts: Options) {
  return await transporter.sendMail({
    from: env.SMTP_FROM,
    to: opts.to.toLowerCase().trim(),
    subject: `${opts.subject} - Nerimity`,
    html: opts.body,
  });
}
