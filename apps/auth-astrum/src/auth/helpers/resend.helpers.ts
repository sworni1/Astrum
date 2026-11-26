import {
  RESEND_EMAIL_KEY_PREFIX,
  RESEND_IP_KEY_PREFIX,
} from "../constants/auth.constants";

export const resendEmailKey = (email: string): string =>
  `${RESEND_EMAIL_KEY_PREFIX}${email}`;

export const resendIpKey = (ip: string): string =>
  `${RESEND_IP_KEY_PREFIX}${ip}`;
