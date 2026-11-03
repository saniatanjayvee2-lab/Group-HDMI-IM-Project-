# FixTrack Forgot Password Email Setup

The password reset API already supports one-time, 30-minute reset links for **customer and administrator** accounts, sent using SMTP. Technicians recover their passwords through **Admin → Manage Technicians → Reset Password**.

## Configure Vercel

Open **Vercel → fixtrack-backend → Settings → Environment Variables**. Add the following to the **Production** environment:

| Variable | Example for Gmail |
| --- | --- |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | Your dedicated Gmail sender email |
| `SMTP_PASS` | That Gmail account's App Password |
| `MAIL_FROM` | Same sender email address |
| `FRONTEND_URL` | `https://fixtrack-management.vercel.app` |

Enable two-step verification for the Gmail sender and create an App Password if available. Do not use your normal login password. For another SMTP provider, use its host, port and sender credentials instead. Keep all credentials in backend environment variables only, never in GitHub or frontend JavaScript.

After saving the variables, **redeploy the backend project** so they take effect. Check **Admin → Manage Administrators → Reset Email Status**, then perform an actual Forgot Password request with a registered customer/admin email. Check spam if it does not arrive. Configuration status does not guarantee delivery.

The endpoint intentionally gives a generic response for unknown emails to avoid account enumeration. If no sender has been configured, the backend logs an error without revealing account existence to the requester.
