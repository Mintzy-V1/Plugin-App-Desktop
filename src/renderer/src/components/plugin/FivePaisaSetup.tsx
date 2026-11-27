import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Loader2, ShieldCheck } from 'lucide-react';
import { getMyEgress } from '../../lib/gateway';
import type { EgressAssignment } from '../../lib/gateway';

type Load =
  | { state: 'loading' }
  | { state: 'error' }
  | { state: 'ready'; assignment: EgressAssignment | null };

/**
 * The one-time 5paisa setup: an Xstream API app, the static IP Mintzy assigned
 * to the account (5paisa only accepts orders from the IP registered on the
 * app), and TOTP. The IP comes from the gateway (GET /users/me/egress).
 */
export default function FivePaisaSetup() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    getMyEgress()
      .then((list) => {
        if (!alive) return;
        const assignment = list.find((a) => a.broker === 'fivepaisa') ?? null;
        setLoad({ state: 'ready', assignment });
      })
      .catch(() => alive && setLoad({ state: 'error' }));
    return () => { alive = false; };
  }, []);

  const copy = async (ip: string) => {
    try {
      await navigator.clipboard.writeText(ip);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the IP is still on screen */
    }
  };

  const assignment = load.state === 'ready' ? load.assignment : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Your static IP</p>
        {load.state === 'loading' && (
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Checking…
          </p>
        )}
        {load.state === 'error' && (
          <p className="mt-2 text-sm text-loss">Could not load your static IP. Check your connection and open this page again.</p>
        )}
        {load.state === 'ready' && !assignment && (
          <p className="mt-2 text-sm text-secondary">
            Not assigned yet. Mintzy assigns one IP to each 5paisa account; it will appear here. Do not register any other IP.
          </p>
        )}
        {assignment && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="rounded-lg bg-subtle px-3 py-1.5 text-lg font-semibold tabular-nums text-ink">{assignment.static_ip}</code>
            <button type="button" onClick={() => copy(assignment.static_ip)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-secondary transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40">
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-gain" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {assignment.status === 'active' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gain-soft px-2.5 py-1 text-[11px] font-semibold text-gain">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Verified
              </span>
            ) : (
              <span className="rounded-full bg-attention-soft px-2.5 py-1 text-[11px] font-semibold text-attention">Register this IP</span>
            )}
            {assignment.client_code && (
              <span className="text-xs text-muted">for client code {assignment.client_code}</span>
            )}
          </div>
        )}
      </div>

      <ol className="list-decimal space-y-2 pl-5 text-sm text-secondary">
        <li>On <strong>xstream.5paisa.com</strong>, create an API app of type <strong>non-algo</strong>. Note its User Key, Encryption Key and User ID.</li>
        <li>
          On that app, register the static IP above as its IP address.
          {' '}5paisa only accepts orders from this IP, and NSE lets you change it at most once a week, so enter it exactly.
        </li>
        <li>In the 5paisa app, turn on <strong>TOTP</strong> (two-factor login with an authenticator app).</li>
        <li>In Mintzy, connect 5paisa with the User Key, Encryption Key, User ID and your client code. Each morning, enter your PIN and a fresh TOTP, before 10:30 to be included in the day.</li>
      </ol>
    </div>
  );
}
