import { devOtpEnabled } from "../config";

/**
 * OTP delivery abstraction. To go live, implement OtpProvider for a Pakistan SMS gateway
 * (credentials via env, never in browser code) and return it from getOtpProvider().
 * NO real SMS provider is implemented in this MVP.
 */
export interface OtpProvider {
  readonly name: string;
  /** devCode is returned ONLY by the development provider so the UI can display it. */
  send(phoneE164: string, code: string): Promise<{ devCode?: string }>;
}

const devProvider: OtpProvider = {
  name: "development",
  async send(_phone, code) {
    return { devCode: code };
  },
};

export function getOtpProvider(): OtpProvider | null {
  if (devOtpEnabled()) return devProvider;
  return null; // production: unavailable until a real provider is implemented
}
