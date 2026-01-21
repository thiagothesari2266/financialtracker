import * as nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465;
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Nexfin <dev@agenciafullup.com.br>';
const APP_URL = process.env.APP_URL || 'https://nexfin.com';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('[Email] SMTP credentials not configured');
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: true, // SSL
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }

  return transporter;
}

export function isEmailConfigured(): boolean {
  return Boolean(SMTP_USER && SMTP_PASS);
}

function getInviteEmailHtml(inviteLink: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite Nexfin</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 480px; border-collapse: collapse;">
          <!-- Header -->
          <tr>
            <td style="padding-bottom: 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #0f172a;">Nexfin</h1>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 40px 32px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #0f172a;">
                Você foi convidado!
              </h2>

              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #475569;">
                Você recebeu um convite para criar sua conta no Nexfin, sua plataforma de gestão financeira pessoal e empresarial.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${inviteLink}"
                       style="display: inline-block; padding: 14px 32px; background-color: #0f172a; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 500; border-radius: 8px;">
                      Criar minha conta
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 16px; font-size: 13px; line-height: 1.5; color: #64748b;">
                Se o botão não funcionar, copie e cole este link no seu navegador:
              </p>

              <p style="margin: 0 0 24px; font-size: 13px; line-height: 1.5; color: #0ea5e9; word-break: break-all;">
                <a href="${inviteLink}" style="color: #0ea5e9; text-decoration: none;">${inviteLink}</a>
              </p>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">

              <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #94a3b8;">
                Este convite expira em 7 dias. Se você não solicitou este convite, pode ignorar este email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 24px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} Nexfin. Todos os direitos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function getInviteEmailText(inviteLink: string): string {
  return `
Você foi convidado para o Nexfin!

Você recebeu um convite para criar sua conta no Nexfin, sua plataforma de gestão financeira pessoal e empresarial.

Clique no link abaixo para criar sua conta:
${inviteLink}

Este convite expira em 7 dias.

Se você não solicitou este convite, pode ignorar este email.

---
Nexfin - Gestão Financeira
  `.trim();
}

export interface SendEmailResult {
  success: boolean;
  error?: string;
}

export async function sendInviteEmail(
  to: string,
  inviteToken: string
): Promise<SendEmailResult> {
  const transport = getTransporter();

  if (!transport) {
    return {
      success: false,
      error: 'SMTP não configurado',
    };
  }

  const inviteLink = `${APP_URL}/login?invite=${inviteToken}`;

  try {
    await transport.sendMail({
      from: EMAIL_FROM,
      to,
      subject: 'Você foi convidado para o Nexfin',
      text: getInviteEmailText(inviteLink),
      html: getInviteEmailHtml(inviteLink),
    });

    console.log(`[Email] Invite sent to ${to}`);
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    console.error(`[Email] Failed to send invite to ${to}:`, message);
    return {
      success: false,
      error: message,
    };
  }
}
