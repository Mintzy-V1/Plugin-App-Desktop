import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { brokerFromProfile, type BrokerType } from '../components/plugin/ConnectBrokerForm';

interface Section {
  id: string;
  title: string;
  body: ReactNode;
}

const BROKER_NAME: Record<BrokerType, string> = {
  angel: 'Angel One',
  tradex: 'TradeX',
  bear_street: 'Bear Street',
};

function Cases({ items }: { items: Array<{ problem: string; fix: string }> }) {
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-100">
      {items.map((item) => (
        <div key={item.problem} className="border-b border-slate-100 px-3.5 py-2.5 last:border-b-0">
          <p className="text-[13px] font-semibold text-slate-800">{item.problem}</p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{item.fix}</p>
        </div>
      ))}
    </div>
  );
}

function buildSections(broker: BrokerType, linked: boolean): Section[] {
  const name = BROKER_NAME[broker];
  const isAngel = broker === 'angel';
  const isTradex = broker === 'tradex';
  const isBear = broker === 'bear_street';

  const connectFields = isBear
    ? [
        'API Key — the Bear Street API key from your broker / ODIN connector, not your Mintzy key.',
        'User ID — the Bear Street login user id.',
        'Password — the Bear Street password.',
        'Registered mobile number — the number on the Bear Street account. This is required. There is no separate TOTP screen.',
      ]
    : isTradex
      ? [
          'Access Key / App Key / JWT 1 — paste the first token. Spaces are stripped automatically.',
          'Client ID / User ID — your TradeX client id.',
          'Access Secret / Secret Key / JWT 2 — paste the second token. Spaces are stripped automatically.',
        ]
      : [
          'API Key — the Angel SmartAPI app key from the Angel One developer portal, not your Mintzy key.',
          'Client Code — your Angel One client code.',
          'Password / PIN — the PIN you use with SmartAPI.',
        ];

  const startLive = isTradex
    ? 'TradeX starts live as soon as you press Start Trading. There is no simulation phase and no later switch.'
    : isBear
      ? 'Bear Street always starts in simulation. The engine then switches itself to live — you do not press a second button. While it is simulating, status shows Simulating and a Simulation badge. After the switch, a Live trading divider appears in the logs and new rows are untagged.'
      : 'Angel One always starts in simulation. The engine then switches itself to live — you do not press a second button. While it is simulating, status shows Simulating and a Simulation badge. After the switch, a Live trading divider appears in the logs and new rows are untagged.';

  const sections: Section[] = [
    {
      id: 'start',
      title: 'Sign in to Mintzy',
      body: (
        <>
          <p>This app is the Mintzy Plugin desktop wrapper. You sign in with the <strong>Mintzy API key</strong> from your Mintzy account at mintzy.in — not with {name} login details.</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open Mintzy Plugin.</li>
            <li>Paste the API key. You can show or hide it with the eye icon.</li>
            <li>Continue. The key is stored on this computer until you log out.</li>
          </ol>
          <p>The key is already onboarded for <strong>{name}</strong>. You cannot switch broker inside the app. If the wrong broker is linked, get a new key from Mintzy support.</p>
          {!linked && (
            <p>Your account currently has no broker linked. Contact Mintzy support and sign in again with a fresh API key before you try to connect {name}.</p>
          )}
          <p className="font-semibold text-slate-800">If sign-in fails</p>
          <Cases items={[
            { problem: 'Please enter your API key', fix: 'The field was empty. Paste the full key and try again.' },
            { problem: 'Invalid API key. Check your key and try again.', fix: 'Copy the key again from mintzy.in. Do not add spaces or quotes. Keys expire if they were rotated.' },
            { problem: 'Your Mintzy session has expired. Please re-enter your API key.', fix: 'The saved session is no longer valid. Paste the key again.' },
            { problem: 'Could not reach Mintzy. Check your internet connection and try again.', fix: 'You are offline, on a captive Wi-Fi page, or a firewall is blocking the app. Connect to the internet and retry.' },
            { problem: 'The login screen appears again after a restart', fix: 'The stored token could not be read. Sign in once more. Logging out from the sidebar also clears the key from this computer.' },
          ]} />
        </>
      ),
    },
    {
      id: 'sidebar',
      title: 'Sidebar and windows',
      body: (
        <>
          <p>The left rail has Dashboard, Launch Terminal, Documentation, and Settings. A green <strong>Live</strong> mark on Launch Terminal means a {name} session is trading.</p>
          <p>Pin the sidebar with the chevron, or leave it collapsed. Hover a collapsed rail to peek labels — the icons stay in place so nothing jumps.</p>
          <p>The title bar shows the current page. Logging out (sidebar footer) removes the Mintzy key from this computer. It does not close positions at {name}.</p>
        </>
      ),
    },
    {
      id: 'dashboard',
      title: 'Dashboard',
      body: (
        <>
          <p>Dashboard is the home screen after sign-in. Three tabs:</p>
          <ul>
            <li><strong>Overview</strong> — greeting, {name} cash in broker, equity, this month’s P&amp;L from the gateway, a live/ready session count, and the performance tiles.</li>
            <li><strong>Sessions</strong> — every {name} session on the account, 10 per page. Tap a row to open it in Launch Terminal. CSV on a row downloads that session’s logs or tradebook. Download latest uses the newest session.</li>
            <li><strong>Month over month</strong> — last 12 calendar months as tiles. A month with no trades shows —. Open this tab from Overview via the Month over month shortcut.</li>
          </ul>
          <p>Cash in broker is the free cash Mintzy last saw on the connected {name} session. After you stop, it keeps the last snapshot. Equity and This month come from the account aggregate, not from the tiles below.</p>
          <p>Refresh (top right of Overview) reloads cash, sessions, and performance. Figures also refresh when you open Dashboard or bring the window forward.</p>
          <p className="font-semibold text-slate-800">If Dashboard fails</p>
          <Cases items={[
            { problem: "Couldn't load trading data", fix: `The sessions request failed. Check the internet, then Retry. If it persists, the ${name} plugin service may be down — wait a minute and try again.` },
            { problem: 'Cash shows ₹0.00 or a stale amount', fix: `Connect a session in Launch Terminal so Mintzy can read ${name} free cash. After market close the last stored figure stays on screen.` },
            { problem: 'No live sessions / No trading sessions yet', fix: `Start one from Launch Terminal → New session. Ready means ${name} is connected but you have not pressed Start Trading.` },
            { problem: 'No tradebook or logs are available for this session yet.', fix: 'The session has not written a CSV. Wait until trades exist, or open the session and download from its header after logs appear.' },
            { problem: 'Could not download the CSV. Please try again.', fix: 'A network or server error. Retry. If the session is still starting, wait until the first logs appear.' },
          ]} />
        </>
      ),
    },
    {
      id: 'stats',
      title: 'Performance figures',
      body: (
        <>
          <p>Tiles are calculated on this computer from {name} session trades. Simulation rows are skipped. They recalculate whenever you open Dashboard, focus the window, or press Refresh — including today’s session so far. Last numbers stay on the tiles while trades reload.</p>
          <ul>
            <li><strong>Max profit script</strong> — ticker with the highest summed day P&amp;L (last snapshot per session / symbol / IST day).</li>
            <li><strong>Max losing script</strong> — ticker with the lowest summed day P&amp;L.</li>
            <li><strong>Max profit day / Max losing day</strong> — IST calendar day with the highest or lowest net P&amp;L.</li>
            <li><strong>Avg win rate</strong> — share of trading days that finished green. Flat days are ignored.</li>
            <li><strong>Max drawdown %</strong> — largest peak-to-trough drop on the cumulative P&amp;L path versus peak equity (starting capital when the logs have it).</li>
            <li><strong>Average risk : reward</strong> — mean winning day divided by mean losing day, shown as 1 : x.xx. A dash means there were no losing days.</li>
            <li><strong>Overall returns</strong> — total P&amp;L divided by the first capital reading in the logs. The hint shows net rupees.</li>
            <li><strong>Max winning / losing streak</strong> — longest run of consecutive green or red trading days. Days with no trades (weekends, holidays) are skipped and do not break a streak.</li>
            <li><strong>Month over month</strong> — net P&amp;L for each of the last 12 months. Empty months show —.</li>
          </ul>
          <p>If a tile is —, there is not enough live (non-simulation) history yet, or capital was missing so a percentage could not be formed.</p>
        </>
      ),
    },
    {
      id: 'terminal',
      title: 'Launch Terminal',
      body: (
        <>
          <p>This is the {name} trading workspace. The inner left rail lists live and past sessions.</p>
          <ul>
            <li><strong>New session</strong> (plus) — start {name} login.</li>
            <li><strong>Saved strategies</strong> (bookmark) — create, edit, delete, or apply a stored config.</li>
            <li><strong>Open a session</strong> — tap a row. Live and past sessions both open logs and P&amp;L. Past sessions are read-only (no Stop).</li>
            <li><strong>Delete</strong> — removes the session from the list. The tradebook CSV will no longer download from here. Confirm in the dialog.</li>
          </ul>
          <p>The panel collapses automatically when you enter a live dashboard so the chart has room. Re-open it with the sidebar toggle.</p>
          <p className="font-semibold text-slate-800">If the session list fails</p>
          <Cases items={[
            { problem: 'Could not load your sessions', fix: 'The list request failed. Check the internet. The rail may stay empty until it succeeds.' },
            { problem: 'This session has no ID and cannot be opened.', fix: 'The record is incomplete. Start a new session instead of opening that row.' },
            { problem: 'Could not delete the session. Please try again.', fix: 'Retry. If it is still trading, stop it first from the live dashboard.' },
          ]} />
        </>
      ),
    },
    {
      id: 'connect',
      title: `Connect ${name}`,
      body: (
        <>
          <p>Press New session. The form is locked to <strong>{name}</strong> because that is the broker on your Mintzy key.</p>
          {isBear && (
            <p>Bear Street authenticates in <strong>one step</strong>. Enter all four fields and Continue. You will go straight to Configure Session — there is no TOTP page.</p>
          )}
          {isTradex && (
            <p>TradeX authenticates in <strong>one step</strong>. Paste both tokens and Continue. You will go straight to Configure Session — there is no TOTP page.</p>
          )}
          {isAngel && (
            <p>Angel One is two steps: credentials first, then a 6-digit TOTP from your Angel authenticator.</p>
          )}
          <p>Fields:</p>
          <ul>
            {connectFields.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {isBear && (
            <p>The registered mobile number is the one on the Bear Street / ODIN account. It is sent as second-factor in the same request (source WEBAPI). Wrong number, or leaving it blank, is the usual reason login fails.</p>
          )}
          {isTradex && (
            <p>Do not wrap tokens in quotes. If a token was copied with line breaks or spaces, the app removes whitespace before sending.</p>
          )}
          <p>Cancel returns to the empty Launch Terminal screen without creating a session.</p>
          <p className="font-semibold text-slate-800">If connect fails</p>
          <Cases items={[
            { problem: 'No broker is linked to your Mintzy account. Contact support or re-login with your API key.', fix: `The Mintzy key has no broker claim. Sign out, get a key onboarded for ${name}, sign in again.` },
            { problem: 'Fill in all fields', fix: 'Every field on this form is required.' },
            ...(isBear
              ? [{ problem: 'Registered mobile number is required for Bear Street', fix: 'Enter the mobile number registered on the Bear Street account. This is not an OTP from SMS — it is the number itself.' }]
              : []),
            { problem: 'Broker rejected the credentials. Please check them and try again.', fix: `Recheck every ${name} field. Caps, extra spaces, and an old password are the usual causes.` },
            { problem: 'Could not verify your credentials. Please try again.', fix: `Mintzy could not complete the ${name} login. Retry. If it keeps failing, ${name} or the plugin engine may be down.` },
            { problem: 'This broker session expired. Go back and connect your credentials again.', fix: `The plugin session timed out or was discarded. Start a new session and log in to ${name} again.` },
            { problem: 'The trading engine is temporarily unavailable. Please try again in a moment.', fix: 'The plugin VM or gateway returned a server error. Wait and retry; do not keep submitting new sessions in a loop.' },
            { problem: 'Could not reach Mintzy. Check your internet connection and try again.', fix: 'No network path to the gateway. Fix connectivity, then Continue again.' },
            ...(isAngel
              ? [
                  { problem: 'Invalid Angel One API key. Check the key in the Angel SmartAPI portal and try again.', fix: 'Use the SmartAPI app key, not the Mintzy key and not the client code.' },
                  { problem: 'Broker rejected the credentials. Recheck client code and PIN, then try again.', fix: 'Angel returned an invalid client / password error (including AB1001–AB1003). Confirm client code and PIN in the Angel app, then retry.' },
                ]
              : []),
          ]} />
        </>
      ),
    },
  ];

  if (isAngel) {
    sections.push({
      id: 'totp',
      title: 'Angel One TOTP',
      body: (
        <>
          <p>After credentials are accepted you must enter the <strong>6-digit TOTP</strong> from the Angel One authenticator (SmartAPI / Angel One app). Codes rotate about every 30 seconds — always use a fresh one.</p>
          <p>On success, Mintzy reads free cash from the Angel account when the response includes it, then opens Configure Session. Back returns to the credentials form (you will need to connect again).</p>
          <p className="font-semibold text-slate-800">If TOTP fails</p>
          <Cases items={[
            { problem: 'Enter a 6-digit code', fix: 'Only numbers, exactly six digits. The field rejects letters automatically.' },
            { problem: 'Invalid or expired TOTP. Wait for a new code in your authenticator and try again.', fix: 'Wait for the next code. Do not reuse the previous one. Confirm you are using the Angel authenticator for this client, not another app’s TOTP.' },
            { problem: 'Broker rejected the login code. Enter a fresh 6-digit TOTP…', fix: 'Angel rejected the code or the earlier API key / client / PIN. Confirm those three, then use a brand-new TOTP.' },
            { problem: 'Broker authentication failed. Use a fresh TOTP and confirm your credentials.', fix: 'Start over from Connect Broker if a new TOTP still fails.' },
            { problem: 'This broker session expired. Go back and connect your credentials again.', fix: 'Too much time passed, or the plugin session was dropped. Back → connect again, then a new TOTP.' },
          ]} />
        </>
      ),
    });
  }

  sections.push(
    {
      id: 'configure',
      title: 'Configure and start',
      body: (
        <>
          <p>After {name} is connected{isAngel ? ' and TOTP is verified' : ''}, set the session:</p>
          <ul>
            <li><strong>Saved strategy</strong> — pick one to fill the form (and its leverage). Choose Configure manually to start from a blank form.</li>
            <li><strong>Candle</strong> — 1m, 5m, 15m, or 75m.</li>
            <li><strong>Strategy</strong> — Stoppage Reversal (A) or Exposure Expansion (B).</li>
            <li><strong>Use available broker cash</strong> — on by default. Trades draw from {name} balance; each symbol’s capital is a cap, not a second wallet.</li>
            <li><strong>Symbols</strong> — NSE cash names from the list (e.g. HDFCBANK). Capital in rupees must be greater than 0. Stop-loss is a percent (default 5). Each symbol once.</li>
            <li><strong>Leverage 1–5×</strong> — only on a saved strategy. Select the strategy, set the multiplier, press Apply, then Start. You cannot attach leverage to a one-off manual form until that layout is saved.</li>
          </ul>
          <p>The summary under the form shows how many symbols will start (manual + auto-generated alphas from a saved strategy) and total allocation. Auto-generated alpha rows are read-only extras that come with some saved strategies.</p>
          <p>{startLive}</p>
          <p><strong>Abandon session</strong> closes this {name} login without starting. You can connect again anytime. You cannot abandon a session that is already trading — stop it from the live dashboard instead.</p>
          <p>Back on this screen returns to {isAngel ? 'the TOTP step' : `Connect ${name}`}.</p>
          <p className="font-semibold text-slate-800">If start or configure fails</p>
          <Cases items={[
            { problem: 'Add at least one stock', fix: 'Add a symbol with capital, or pick a saved strategy that already has symbols / alphas.' },
            { problem: 'Fill all symbol and capital fields', fix: 'Every row needs a ticker and a capital amount.' },
            { problem: 'Capital must be > 0', fix: 'Use a positive rupee amount. Zero and blank are rejected.' },
            { problem: 'Stop loss must be > 0', fix: 'Enter a percent greater than 0.' },
            { problem: 'Each stock can only be added once', fix: 'Remove the duplicate ticker.' },
            { problem: 'Select a saved strategy to set leverage.', fix: 'Leverage is stored on a saved strategy. Save the layout first, or pick one from the dropdown, then Apply.' },
            { problem: 'Could not update leverage. Please try again.', fix: 'The 1–5× write failed. Retry Apply. If it still fails, open Saved strategies and set leverage there.' },
            { problem: 'Could not start trading. Please check your settings and try again.', fix: `Confirm symbols, capital, and that the ${name} session is still connected. If the engine is down, wait and retry.` },
            { problem: 'This strategy has no symbols to start with.', fix: 'Edit the saved strategy and add at least one symbol before using it.' },
            { problem: 'This session is already trading. Stop it from the live dashboard instead.', fix: 'Abandon is blocked on a live session. Use Stop or Force stop.' },
            { problem: 'Could not close this session. Please try again.', fix: 'Abandon failed. Retry, or leave the screen and delete the leftover session from the rail if it appears.' },
            { problem: 'This broker session expired. Go back and connect your credentials again.', fix: `The ${name} plugin session died before start. New session → connect again.` },
          ]} />
        </>
      ),
    },
    {
      id: 'saved',
      title: 'Saved strategies',
      body: (
        <>
          <p>Open Saved strategies from the Launch Terminal rail (bookmark). This list is per Mintzy account, used when you start a {name} session.</p>
          <ul>
            <li>Create — name, optional description, symbols, candle, strategy, broker-cash toggle, then Save.</li>
            <li>Edit — change fields and Save. Alphas attached to a strategy stay as extra auto symbols at start.</li>
            <li>Leverage — 1–5× Apply on that strategy.</li>
            <li>Use — only when a {name} session is already connected (you are on Configure). It starts trading immediately with that strategy.</li>
            <li>Delete — confirm; it cannot be undone.</li>
          </ul>
          <p className="font-semibold text-slate-800">If saved strategies fail</p>
          <Cases items={[
            { problem: 'The list shows an error / failed to load', fix: 'Retry from the screen. Check the internet.' },
            { problem: "You've reached the maximum number of saved strategies. Delete one to save another.", fix: 'Delete an unused strategy, then save again.' },
            { problem: 'Could not save the strategy. Please try again.', fix: 'Check name and that every symbol row is valid, then retry.' },
            { problem: 'Could not delete the strategy. Please try again.', fix: 'Retry. If it is selected on Configure, pick Configure manually first.' },
            { problem: 'Could not start trading from this strategy. Please try again.', fix: `You need a connected ${name} session. New session → connect → then Use, or start from Configure.` },
          ]} />
        </>
      ),
    },
    {
      id: 'live',
      title: 'Live session, stop, and force stop',
      body: (
        <>
          <p>A live {name} session shows free cash, status, last update time, CSV, and (only while live) Stop and Force.</p>
          <ul>
            <li><strong>Stop</strong> — graceful. The engine stops taking new positions and winds the session down. Confirm in the dialog.</li>
            <li><strong>Force stop</strong> — kills the engine immediately. Open positions are <strong>not</strong> closed automatically. Flatten them yourself in the {name} trading terminal if anything is still open.</li>
          </ul>
          <p>Status labels you may see: Trading, Simulating, Ready, Stopped, Completed, Abandoned, Expired, Error / Failed, Connecting. A Reconnecting badge means the app lost the plugin feed and is retrying — leave the window open.</p>
          <p>Past sessions stay readable: logs, P&amp;L, CSV. Stop buttons are hidden. After market close, last recorded P&amp;L stays on screen.</p>
          <p className="font-semibold text-slate-800">If the live session fails</p>
          <Cases items={[
            { problem: 'Reconnecting…', fix: 'Temporary network or plugin blip. Wait. If it never recovers, Stop (or Force stop) and start a new session.' },
            { problem: 'Could not stop the session. It may still be running.', fix: `Retry Stop. If it stays live, use Force stop. Then confirm in the ${name} terminal that nothing is still working.` },
            { problem: 'Status Error / Failed', fix: `The engine aborted. Read the last log rows, download CSV if present, and start a new session. Do not assume positions are flat — check ${name}.` },
            { problem: 'Session expired', fix: `The plugin session is gone. You cannot resume it. Connect a new session. Positions at ${name} are independent — check the broker book.` },
          ]} />
        </>
      ),
    },
    {
      id: 'logs',
      title: 'Trade logs',
      body: (
        <>
          <p>Each row is a fill or status update from the {name} session. Times are IST. Date is like 25/8/2026; time sits on the next line with am/pm.</p>
          <ul>
            <li><strong>Sim</strong> badge — simulation row. These stay in the table for history. Performance tiles ignore them.</li>
            <li>Untagged rows after the green <strong>Live trading</strong> divider are live {name} fills.</li>
            <li>Signal and action show as pills (including wait). Quantity is kept through the sim→live handoff — a zero from the engine is not treated as a fill.</li>
            <li>P&amp;L, capital, change, and return follow the log snapshot for that row.</li>
          </ul>
          {isTradex && (
            <p>TradeX has no simulation phase, so you should not see a Sim badge or Live trading divider unless older mixed data is present.</p>
          )}
          <p>Empty state: “No trades yet” until the engine prints the first row. CSV in the header downloads stored logs (live) or prefers Mongo logs for past sessions when the VM tradebook is gone.</p>
          <p className="font-semibold text-slate-800">If logs look wrong</p>
          <Cases items={[
            { problem: 'No trades yet for a long time', fix: `Confirm status is Trading or Simulating, the candle has elapsed, and ${name} can see the symbols. If status is Failed, stop and start again.` },
            { problem: 'Quantity shows — or 0 on a fill', fix: 'Wait rows and some engine zeros are not treated as fills. Check Signal / Action. After sim→live, quantity is carried forward on purpose.' },
            { problem: 'CSV says no tradebook or logs yet', fix: 'Nothing stored for that session. Wait for rows, or the session never wrote logs (abandoned before start).' },
          ]} />
        </>
      ),
    },
    {
      id: 'pnl',
      title: 'Live P&L chart',
      body: (
        <>
          <p>Line and candle views both plot <strong>session P&amp;L</strong>, not {name} market candles. Axis and hover use the same IST clock (12-hour). Zoom and pan stay inside the data you have.</p>
          <ul>
            <li>Ticker dropdown or tiles — one symbol, several, or all. Booked vs open cards follow that scope.</li>
            {isTradex
              ? <li>The series is live P&amp;L from the start of the session.</li>
              : <li>After simulation hands off to live, the chart can include the simulation path. The logs divider is the same moment.</li>}
            <li>Expand (maximize) opens the chart full window. Escape or minimize leaves it. After market close the last recorded figures stay.</li>
          </ul>
          <p>If the chart is empty, there is no P&amp;L sample yet — same as an empty log table.</p>
        </>
      ),
    },
    {
      id: 'settings',
      title: 'Settings and updates',
      body: (
        <>
          <p>These controls exist only in the installed Windows app (not in a browser preview).</p>
          <ul>
            <li><strong>Auto-launch on startup</strong> — open Mintzy when you log into Windows.</li>
            <li><strong>Minimize to tray</strong> — Close (X) hides in the tray. Click the tray icon to reopen. Turn this off so X fully quits.</li>
            <li><strong>Desktop notifications</strong> — system alerts for updates and important events.</li>
            <li><strong>Check for updates</strong> — asks GitHub for a newer installer. When a build is downloaded you get Restart and Install Now, or Install now in Settings.</li>
          </ul>
          <p>Billing stays on mintzy.in. The About line shows the installed version (this build’s guide matches that app).</p>
          <p className="font-semibold text-slate-800">If settings or updates fail</p>
          <Cases items={[
            { problem: 'Desktop settings are only available in the installed app.', fix: 'Install the Windows package. Settings toggles do nothing in a plain browser.' },
            { problem: 'Could not update the startup / tray / notification setting.', fix: 'Retry the toggle. Windows may have blocked the change; try again as the same Windows user who installed the app.' },
            { problem: 'Updates are only available in the installed app.', fix: 'Dev / unpackaged builds cannot auto-update. Use the released installer.' },
            { problem: 'Could not check for updates. Check your internet connection and try again.', fix: 'You need network access to GitHub releases. Retry later.' },
            { problem: 'No update package was found.', fix: 'The release assets are not up yet. Wait and check again, or download the installer from Mintzy.' },
            { problem: 'The update file could not be verified.', fix: 'Checksum failed. Retry later; do not install a partial download.' },
            { problem: 'Could not install the update. Please restart the app and try again.', fix: 'Quit fully (tray icon → quit if needed) and reopen, then Install now.' },
          ]} />
        </>
      ),
    },
    {
      id: 'errors',
      title: 'Errors that can appear anywhere',
      body: (
        <>
          <p>The app never shows stack traces or HTTP jargon. If something still fails, match the sentence on screen to this list.</p>
          <Cases items={[
            { problem: 'Your session expired. Please sign in again.', fix: `The Mintzy JWT expired (401). Log out if needed, paste the API key again, then reconnect ${name}.` },
            { problem: "You don’t have permission to do that.", fix: 'This action is not allowed for the account (403). Use the Mintzy key that owns the session.' },
            { problem: "We couldn't find what you were looking for.", fix: 'The session, tradebook, or resource is gone (404). Refresh the session list and open a current row.' },
            { problem: 'Our servers are temporarily unavailable. Please try again in a moment.', fix: 'Gateway or plugin returned 5xx. Wait, then retry the same action once.' },
            { problem: 'Could not reach Mintzy. Check your internet connection and try again.', fix: 'Offline, DNS, or firewall. Restore internet. The live dashboard will show Reconnecting… until the feed is back.' },
            { problem: 'Something went wrong. Please try again.', fix: `Generic fallback. Retry once. If it repeats on connect, the ${name} login payload is the first thing to recheck.` },
            { problem: 'Unable to connect to the Plugin terminal… (full-page error)', fix: `The desktop shell lost the renderer. Retry. Check internet. If it mentions a broker session expired, log into ${name} in this app again.` },
          ]} />
          <p>Still stuck: confirm in the {name} book whether orders are live, then contact Mintzy with the session id from the Dashboard sessions table (not your API key).</p>
        </>
      ),
    },
  );

  return sections;
}

export default function DocsPage() {
  const { user } = useAuth();
  const broker = brokerFromProfile(user?.broker);
  const name = BROKER_NAME[broker];
  const linked = Boolean(user?.broker);
  const sections = buildSections(broker, linked);

  return (
    <div className="page-stack">
      <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
        <p className="text-[12px] font-medium text-slate-400">Mintzy Plugin · {name}</p>
        <h2 className="mt-0.5 text-[17px] font-semibold tracking-tight text-slate-900">User guide</h2>
        <p className="mt-1 text-[13px] text-slate-500">
          {linked
            ? `This copy is only for ${name} — the broker on your Mintzy key. Other brokers’ login steps are hidden.`
            : 'Sign in with a Mintzy API key that has a broker linked to see the matching connect steps.'}
        </p>
      </div>

      <nav aria-label="Guide sections" className="flex flex-wrap gap-1.5">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
          >
            {s.title}
          </a>
        ))}
      </nav>

      {sections.map((s) => (
        <article
          key={s.id}
          id={s.id}
          className="scroll-mt-4 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm"
        >
          <h3 className="text-[14px] font-semibold text-slate-900">{s.title}</h3>
          <div className="mt-2 space-y-2 text-[13px] leading-relaxed text-slate-600 [&_li]:mt-1 [&_ol]:mt-1 [&_strong]:font-semibold [&_strong]:text-slate-800 [&_ul]:list-disc [&_ul]:pl-5">
            {s.body}
          </div>
        </article>
      ))}
    </div>
  );
}
