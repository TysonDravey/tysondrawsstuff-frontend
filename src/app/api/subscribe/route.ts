// Email sign-up ("first look at new work"): adds the address to MailerLite.
// Needs MAILERLITE_API_KEY (MailerLite → Integrations → API) and, optionally, MAILERLITE_GROUP_ID
// (the group new sign-ups join). Turn on double opt-in for API sign-ups in MailerLite's settings so
// each person confirms by email first (Canada's anti-spam law).
// Each sign-up also emails Kirk, through the same Gmail login the order emails use (SMTP_* vars).
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

async function notifyKirk(email: string) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'orders@tysondrawsstuff.com',
    to: process.env.EMAIL_TO || 'kirkbrillon@gmail.com',
    subject: `New sign-up: ${email}`,
    text: `${email} just signed up for "first look at new work" on tysondrawsstuff.com.

They're on your list in MailerLite once they confirm by email.`,
  });
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  let body: { email?: unknown; website?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }

  // Honeypot: a hidden field people never see. Bots fill it in; pretend it worked.
  if (typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'That email address doesn’t look right.' }, { status: 400 });
  }

  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) {
    console.error('subscribe: MAILERLITE_API_KEY is not set');
    return NextResponse.json({ error: 'Sign-up isn’t open yet.' }, { status: 503 });
  }

  const groupId = process.env.MAILERLITE_GROUP_ID;

  try {
    const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email,
        ...(groupId && { groups: [groupId] }),
      }),
    });
    if (!res.ok) {
      console.error('subscribe: MailerLite answered', res.status, await res.text());
      if (res.status === 422) {
        return NextResponse.json({ error: 'That email address doesn’t look right.' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 502 });
    }
    // 201 = new to the list (200 = already on it). A failed notification must not fail the sign-up.
    if (res.status === 201) await notifyKirk(email).catch(err => console.error('subscribe: notification email failed', err));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('subscribe: could not reach MailerLite', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 502 });
  }
}
