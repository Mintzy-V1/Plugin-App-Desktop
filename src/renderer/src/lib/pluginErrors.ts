/** Pull the most useful human-readable message from a plugin/gateway error. */
export function pluginErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const data = (err as any)?.response?.data;
  const status = (err as any)?.response?.status as number | undefined;

  const detailCandidates = [
    data?.details?.detail,
    data?.details?.message,
    data?.details?.error,
    typeof data?.details === 'string' ? data.details : null,
    data?.detail,
    data?.message,
  ];

  let raw = '';
  for (const c of detailCandidates) {
    if (typeof c === 'string' && c.trim()) {
      raw = c.trim();
      break;
    }
  }

  const lower = raw.toLowerCase();

  // Strip gateway wrapper if we still only have that.
  if (/plugin request failed|plugin returned status/.test(lower)) {
    if (status === 401 || /status 401/.test(lower)) {
      return 'Broker rejected the login code. Enter a fresh 6-digit TOTP from your authenticator, and confirm your API key, client code, and PIN are correct.';
    }
    if (status === 404 || /status 404/.test(lower)) {
      return 'This broker session expired. Go back and connect your credentials again.';
    }
    if (status && status >= 500) {
      return 'The trading engine is temporarily unavailable. Please try again in a moment.';
    }
  }

  if (/invalid api key|app not found/.test(lower)) {
    return 'Invalid Angel One API key. Check the key in the Angel SmartAPI portal and try again.';
  }
  if (/invalid.*totp|totp.*invalid|incorrect.*otp|otp.*expired/.test(lower)) {
    return 'Invalid or expired TOTP. Wait for a new code in your authenticator and try again.';
  }
  if (/invalid.*password|invalid.*client|ab1001|ab1002|ab1003/.test(lower)) {
    return 'Broker rejected the credentials. Recheck client code and PIN, then try again.';
  }
  if (/authentication failed/.test(lower)) {
    // Plugin wraps Angel errors as: Authentication failed: <reason>
    const nested = raw.replace(/^Authentication failed:\s*/i, '').trim();
    if (nested && nested.toLowerCase() !== raw.toLowerCase()) {
      if (/invalid api key|app not found/i.test(nested)) {
        return 'Invalid Angel One API key. Check the key in the Angel SmartAPI portal and try again.';
      }
      return `Broker authentication failed: ${nested}`;
    }
    return 'Broker authentication failed. Use a fresh TOTP and confirm your credentials.';
  }
  if (/session not found|expired/.test(lower)) {
    return 'This broker session expired. Go back and connect your credentials again.';
  }

  if (raw && !/plugin request failed/.test(lower)) return raw;
  return fallback;
}
