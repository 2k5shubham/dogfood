import nodemailer from 'nodemailer'

interface SendEmailParams {
  to: string
  subject: string
  html: string
  text: string
}

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
  }
  return null
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<{ sent: boolean; method: string }> {
  const from = process.env.SMTP_FROM || 'Dogfood Platform <noreply@dogfood.internal>'

  // 1. Try Resend if API key is present
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
      })
      if (res.ok) {
        console.log(`[EMAIL:RESEND] Sent successfully to ${to}`)
        return { sent: true, method: 'resend' }
      }
      const errJson = await res.json().catch(() => ({}))
      console.warn('[EMAIL:RESEND] Error:', errJson)
    } catch (err) {
      console.error('[EMAIL:RESEND] Network error:', err)
    }
  }

  // 2. Try SendGrid if API key is present
  if (process.env.SENDGRID_API_KEY) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: from.includes('<') ? from.split('<')[1].replace('>', '') : from },
          subject,
          content: [
            { type: 'text/plain', value: text },
            { type: 'text/html', value: html },
          ],
        }),
      })
      if (res.ok || res.status === 202) {
        console.log(`[EMAIL:SENDGRID] Sent successfully to ${to}`)
        return { sent: true, method: 'sendgrid' }
      }
    } catch (err) {
      console.error('[EMAIL:SENDGRID] Network error:', err)
    }
  }

  // 3. Try standard SMTP if configured (Mailgun, Postmark, AWS SES, Gmail)
  const transporter = getTransporter()
  if (transporter) {
    try {
      await transporter.sendMail({ from, to, subject, html, text })
      console.log(`[EMAIL:SMTP] Sent successfully to ${to}`)
      return { sent: true, method: 'smtp' }
    } catch (err) {
      console.error('[EMAIL:SMTP] Transport error:', err)
    }
  }

  // 3. Fallback: Log clearly to server console (Self-host / Dev mode default)
  console.log('\n' + '='.repeat(60))
  console.log(`📨 [EMAIL NOTIFICATION] (Local Transport)`)
  console.log(`To: ${to}`)
  console.log(`Subject: ${subject}`)
  console.log(`Body:\n${text}`)
  console.log('='.repeat(60) + '\n')

  return { sent: true, method: 'console' }
}

function getBaseTemplate({ title, subtitle, otp, extra }: { title: string; subtitle: string; otp: string; extra?: string }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 480px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .logo { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: #a78bfa; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: 700; color: #ffffff; margin-bottom: 8px; }
    .subtitle { font-size: 14px; color: #94a3b8; line-height: 1.5; margin-bottom: 28px; }
    .code-box { background: rgba(139, 92, 246, 0.12); border: 2px dashed #8b5cf6; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .otp-code { font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #c4b5fd; font-family: monospace; }
    .extra { font-size: 13px; color: #cbd5e1; margin-bottom: 24px; line-height: 1.5; }
    .footer { font-size: 12px; color: #64748b; line-height: 1.5; border-top: 1px solid #1e293b; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">DOGFOOD // PLATFORM</div>
    <div class="title">${title}</div>
    <div class="subtitle">${subtitle}</div>
    <div class="code-box">
      <div class="otp-code">${otp}</div>
    </div>
    ${extra ? `<div class="extra">${extra}</div>` : ''}
    <div class="footer">
      This code will expire in 10 minutes. If you did not request this code, you can safely ignore this email.
    </div>
  </div>
</body>
</html>
`
}

export async function sendRegistrationOtpEmail(to: string, otp: string) {
  const subject = `Verify your Dogfood account: ${otp}`
  const text = `Welcome to Dogfood!\n\nYour account verification code is: ${otp}\n\nThis code will expire in 10 minutes.\nPlease enter this code to complete your registration.`
  const html = getBaseTemplate({
    title: 'Verify your email address',
    subtitle: 'Welcome to Dogfood! Please enter the 6-digit verification code below to verify your email address and activate your account.',
    otp,
    extra: 'Verifying your email ensures genuine participant identity and protects against duplicate submissions.',
  })
  return sendEmail({ to, subject, html, text })
}

export async function sendPasswordResetOtpEmail(to: string, otp: string) {
  const subject = `Reset your Dogfood password: ${otp}`
  const text = `A password reset was requested for your Dogfood account.\n\nYour reset verification code is: ${otp}\n\nThis code will expire in 10 minutes.\nIf you did not request a password reset, please secure your account immediately.`
  const html = getBaseTemplate({
    title: 'Reset your password',
    subtitle: 'We received a request to reset the password for your Dogfood account. Enter the 6-digit code below to set a new password.',
    otp,
    extra: 'Never share this code with anyone. Dogfood staff will never ask for your verification code.',
  })
  return sendEmail({ to, subject, html, text })
}
