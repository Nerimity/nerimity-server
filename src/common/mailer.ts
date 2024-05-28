import nodemailer from 'nodemailer';
import env from './env';

const transporter = nodemailer.createTransport({
  service: env.SMTP_SERVICE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

interface Options {
  to: string; // email address
  subject: string;
  body: string;
}

export async function sendMail(opts: Options) {
  return await transporter.sendMail({
    from: `Nerimity ${env.SMTP_FROM}`,
    to: opts.to.toLowerCase().trim(),
    subject: `${opts.subject} - Nerimity`,
    html: opts.body,
  });
}

export async function sendConfirmCodeMail(code: string, to: string) {
  let htmlDigits = '';

  for (let i = 0; i < code.length; i++) {
    const htmlDigit = `<div style=${
      i !== code.length ? 'margin-left:5px;' : ''
    }text-align:center;display:inline-block;line-height:1.6;width:40px;height:40px;background-color:#00000075;border-radius:8px;font-size:24px>${
      code[i]
    }</div>`;
    htmlDigits += htmlDigit;
  }

  const string = `<html lang=en style=overflow:hidden><meta content="width=device-width,initial-scale=1"name=viewport><body style=color:#fff;font-family:Arial><div style=background:#232629;border-radius:8px;padding:5px;width:100%;display:inline-block><a href=https://nerimity.com style=text-decoration:none;color:#fff><center><center><img src=https://nerimity.com/assets/logo.png style=background-color:#0000004d;border-radius:50%;width:80px;margin-top:20px;margin-bottom:10px><h1 style=font-size:24px>Nerimity</h1></center></a><p style="text-align:center;padding:0;font-size:18px;margin:10px 0 20px 0">Your confirmation Code:<center>${htmlDigits}</center><p style="text-align:center;margin:30px 10px 20px 10px;opacity:.8;font-size:14px">If you did not request this code, you can safely ignore this email.</div>`;

  return await sendMail({
    to,
    subject: 'Confirmation Code',
    body: string,
  });
}

export async function sendResetPasswordMail(link: string, to: string) {

  const string = `<html lang=en style=overflow:hidden><meta content="width=device-width,initial-scale=1"name=viewport><body style=color:#fff;font-family:Arial><div style=background:#232629;border-radius:8px;padding:5px;width:100%;display:inline-block><a href=https://nerimity.com style=text-decoration:none;color:#fff><center><center><img src=https://nerimity.com/assets/logo.png style=background-color:#0000004d;border-radius:50%;width:80px;margin-top:20px;margin-bottom:10px><h1 style=font-size:24px>Nerimity</h1></center></a><p style="text-align:center;padding:0;font-size:18px;margin:10px 0 20px 0">Click on this link to reset your password:<center>${link}</center><p style="text-align:center;margin:30px 10px 20px 10px;opacity:.8;font-size:14px">If you did not request this, you can safely ignore this email.</div>`;

  return await sendMail({
    to,
    subject: 'Reset Password',
    body: string,
  });
}
