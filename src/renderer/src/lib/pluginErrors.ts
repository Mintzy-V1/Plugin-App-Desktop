/**
 * End-user facing error helpers.
 * Never surface stacks, HTTP jargon, axios text, or gateway wrapper noise.
 */

function firstString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

function extractRawMessage(err: unknown): { raw: string; status?: number } {
  const anyErr = err as any;
  const data = anyErr?.response?.data;
  const status = anyErr?.response?.status as number | undefined;

  const raw = firstString(
    data?.details?.detail,
    data?.details?.message,
    data?.details?.error,
    typeof data?.details === 'string' ? data.details : null,
    data?.detail,
    data?.message,
    data?.error,
    typeof data === 'string' ? data : null,
    anyErr?.message,
  );

  return { raw, status };
}

function looksTechnical(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    /plugin request failed|plugin returned status|request failed with status code|status code \d{3}|econnrefused|enotfound|econnreset|etimedout|net::|axioserror|httperror|sha512|latest\.yml|stack trace|at\s+\S+\s+\(|mongodb|cast to objectid|validationerror|syntaxerror|typeerror|referenceerror|cannot read propert|undefined is not|internal server error|bad gateway|gateway timeout/i.test(
      lower,
    )
  );
}

/** Map common backend / network failures to plain language. */
export function pluginErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  const { raw, status } = extractRawMessage(err);
  const lower = raw.toLowerCase();

  if (!raw && status === 401) {
    return 'Your session expired. Please sign in again.';
  }
  if (!raw && status === 403) {
    return 'You don’t have permission to do that.';
  }
  if (!raw && status === 404) {
    return 'We couldn’t find what you were looking for.';
  }
  if (!raw && status && status >= 500) {
    return 'Our servers are temporarily unavailable. Please try again in a moment.';
  }
  if (!raw && /network|offline|timeout|econn|enotfound|net::/i.test(String((err as any)?.message || ''))) {
    return 'Could not reach Mintzy. Check your internet connection and try again.';
  }

  // Gateway wrapper noise
  if (/plugin request failed|plugin returned status/.test(lower)) {
    if (status === 401 || /status 401/.test(lower)) {
      return 'Broker rejected the login code. Enter a fresh 6-digit TOTP from your authenticator, and confirm your API key, client code, and PIN are correct.';
    }
    if (status === 404 || /status 404/.test(lower)) {
      return 'This broker session expired. Go back and connect your credentials again.';
    }
    if ((status && status >= 500) || /status 5\d\d/.test(lower)) {
      return 'The trading engine is temporarily unavailable. Please try again in a moment.';
    }
    return fallback;
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
    const nested = raw.replace(/^Authentication failed:\s*/i, '').trim();
    if (nested && nested.toLowerCase() !== lower) {
      if (/invalid api key|app not found/i.test(nested)) {
        return 'Invalid Angel One API key. Check the key in the Angel SmartAPI portal and try again.';
      }
      if (!looksTechnical(nested)) {
        return `Broker authentication failed: ${nested}`;
      }
    }
    return 'Broker authentication failed. Use a fresh TOTP and confirm your credentials.';
  }
  if (/session not found|expired/.test(lower)) {
    return 'This broker session expired. Go back and connect your credentials again.';
  }
  if (/second auth|trading pin|second_auth/i.test(lower)) {
    return 'Registered mobile number is required for Bear Street. Please enter it and try again.';
  }
  if (/active trading session cannot be abandoned/.test(lower)) {
    return 'This session is already trading. Stop it from the live dashboard instead.';
  }
  if (/maximum of \d+ trading configurations|max.*saved/i.test(lower)) {
    return 'You’ve reached the maximum number of saved strategies. Delete one to save another.';
  }
  if (/no trading logs|tradebook not found|final tradebook not found/i.test(lower)) {
    return 'No trade history is available for this session yet.';
  }

  // Generic HTTP / network phrasing from axios
  if (/request failed with status code|status code \d{3}/.test(lower)) {
    if (status === 401) return 'Your session expired. Please sign in again.';
    if (status === 403) return 'You don’t have permission to do that.';
    if (status === 404) return 'We couldn’t find what you were looking for.';
    if (status && status >= 500) return 'Our servers are temporarily unavailable. Please try again in a moment.';
    return fallback;
  }
  if (/network error|failed to fetch|load failed|econnrefused|enotfound|etimedout|net::/i.test(lower)) {
    return 'Could not reach Mintzy. Check your internet connection and try again.';
  }

  // Safe to show only if it already reads like a product message
  if (raw && !looksTechnical(raw) && raw.length <= 180) {
    return raw;
  }

  return fallback;
}
