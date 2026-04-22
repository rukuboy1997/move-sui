// Lightweight email sender. Tries Resend if RESEND_API_KEY is configured;
// otherwise logs to the server console (useful during development).

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'myWorld <onboarding@resend.dev>';

export function isEmailConfigured() {
  return !!RESEND_API_KEY;
}

export async function sendEmail({ to, subject, text, html }) {
  if (!RESEND_API_KEY) {
    console.log('\n=========== EMAIL (dev fallback — no RESEND_API_KEY set) ===========');
    console.log('TO:     ', to);
    console.log('SUBJECT:', subject);
    console.log('BODY:\n' + (text || html));
    console.log('====================================================================\n');
    return { devMode: true };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, text, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Email send failed: ${res.status} ${err}`);
  }
  return await res.json();
}
