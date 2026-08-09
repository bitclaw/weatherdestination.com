import { err, ok, type Result } from '@bitclaw/result';
import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { Resend } from 'resend';
import { config } from '@/config';
import { getAppUrl } from '@/lib/app-url';
import { ERROR_CODES } from '@/lib/constants';
import {
  OnboardingDay3Email,
  OnboardingDay7Email,
  ReceiptEmail,
  ReengagementEmail,
  TrialExpiringEmail,
  WelcomeEmail
} from './email-templates';

type SendEmailParams = {
  to: string | string[];
  subject: string;
  // CAN-SPAM one-click-unsubscribe header - only set this for marketing/
  // promotional sends (onboarding, reengagement). Transactional mail (OTP,
  // receipts, welcome) should leave it unset.
  unsubscribeUrl?: string;
} & ({ react: ReactElement; html?: never } | { html: string; react?: never });

export const sendEmail = async (
  params: SendEmailParams
): Promise<Result<{ id: string }>> => {
  const html = params.react
    ? await render(params.react)
    : (params.html as string);

  const provider = process.env.EMAIL_PROVIDER ?? 'resend';
  const headers = params.unsubscribeUrl
    ? {
        'List-Unsubscribe': `<${params.unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
      }
    : undefined;

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY ?? '';
    if (!apiKey)
      return err(
        ERROR_CODES.EMAIL_PROVIDER_NOT_CONFIGURED,
        'RESEND_API_KEY is not set'
      );

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: `${config.resend.fromName} <${config.resend.fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html,
      ...(headers && { headers })
    });

    if (error || !data)
      return err(
        ERROR_CODES.EMAIL_SEND_FAILED,
        error?.message ?? 'Send failed'
      );
    return ok({ id: data.id });
  }

  if (provider === 'smtp') {
    const { default: nodemailer } = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'localhost',
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      ...(process.env.SMTP_USER && process.env.SMTP_PASS
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
        : {})
    });

    const info = await transport.sendMail({
      from: `${config.resend.fromName} <${config.resend.fromEmail}>`,
      to: params.to,
      subject: params.subject,
      html,
      ...(headers && { headers })
    });

    return ok({ id: info.messageId });
  }

  return err(
    ERROR_CODES.EMAIL_PROVIDER_NOT_CONFIGURED,
    `Unknown EMAIL_PROVIDER "${provider}". Supported: resend, smtp`
  );
};

export const sendWelcomeEmail = async (email: string, name?: string | null) => {
  const appUrl = getAppUrl();
  return sendEmail({
    to: email,
    subject: `Welcome to ${config.appName}!`,
    react: WelcomeEmail({
      name,
      appName: config.appName,
      dashboardUrl: `${appUrl}/dashboard`
    })
  });
};

export const sendOnboardingDay3Email = async (
  email: string,
  name?: string | null
) => {
  const appUrl = getAppUrl();
  const unsubscribeUrl = `${appUrl}/dashboard/settings/notifications`;
  return sendEmail({
    to: email,
    subject: `Getting the most out of ${config.appName}`,
    unsubscribeUrl,
    react: OnboardingDay3Email({
      name,
      appName: config.appName,
      dashboardUrl: `${appUrl}/dashboard`,
      unsubscribeUrl
    })
  });
};

export const sendOnboardingDay7Email = async (
  email: string,
  name?: string | null
) => {
  const appUrl = getAppUrl();
  const unsubscribeUrl = `${appUrl}/dashboard/settings/notifications`;
  return sendEmail({
    to: email,
    subject: `How's it going with ${config.appName}?`,
    unsubscribeUrl,
    react: OnboardingDay7Email({
      name,
      appName: config.appName,
      dashboardUrl: `${appUrl}/dashboard`,
      unsubscribeUrl
    })
  });
};

export const sendTrialExpiringEmail = async (
  email: string,
  name: string | null,
  daysLeft: number
) => {
  const appUrl = getAppUrl();
  return sendEmail({
    to: email,
    subject: `Your ${config.appName} trial ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    react: TrialExpiringEmail({
      name,
      appName: config.appName,
      daysLeft,
      billingUrl: `${appUrl}/dashboard/billing`
    })
  });
};

export const sendReceiptEmail = async (
  email: string,
  name: string | null,
  planName: string,
  amount: number,
  currency: string
) => {
  const appUrl = getAppUrl();
  return sendEmail({
    to: email,
    subject: `Your ${config.appName} receipt`,
    react: ReceiptEmail({
      name,
      appName: config.appName,
      planName,
      amount,
      currency,
      dashboardUrl: `${appUrl}/dashboard`
    })
  });
};

export const sendReengagementEmail = async (
  email: string,
  name?: string | null
) => {
  const appUrl = getAppUrl();
  const unsubscribeUrl = `${appUrl}/dashboard/settings/notifications`;
  return sendEmail({
    to: email,
    subject: `We miss you at ${config.appName}`,
    unsubscribeUrl,
    react: ReengagementEmail({
      name,
      appName: config.appName,
      dashboardUrl: `${appUrl}/dashboard`,
      unsubscribeUrl
    })
  });
};
