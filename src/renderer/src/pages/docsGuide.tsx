import type { ReactNode } from 'react';
import { AlertTriangle, Info, Lightbulb, OctagonAlert } from 'lucide-react';
import type { BrokerType } from '../components/plugin/ConnectBrokerForm';

export interface GuideSection {
  id: string;
  title: string;
  body: ReactNode;
}

const BROKER_NAME: Record<BrokerType, string> = {
  angel: 'Angel One',
  tradex: 'TradeX',
  bear_street: 'Bear Street',
};

const CALLOUT = {
  tip: {
    wrap: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50/95 to-white',
    well: 'bg-emerald-600 text-white',
    title: 'text-emerald-800',
    Icon: Lightbulb,
  },
  note: {
    wrap: 'border-sky-200/80 bg-gradient-to-br from-sky-50/95 to-white',
    well: 'bg-sky-600 text-white',
    title: 'text-sky-800',
    Icon: Info,
  },
  warn: {
    wrap: 'border-amber-200/80 bg-gradient-to-br from-amber-50/95 to-white',
    well: 'bg-amber-500 text-white',
    title: 'text-amber-900',
    Icon: AlertTriangle,
  },
  danger: {
    wrap: 'border-red-200/80 bg-gradient-to-br from-red-50/95 to-white',
    well: 'bg-red-600 text-white',
    title: 'text-red-800',
    Icon: OctagonAlert,
  },
} as const;

function Callout({
  tone,
  title,
  children,
}: {
  tone: keyof typeof CALLOUT;
  title: string;
  children: ReactNode;
}) {
  const { wrap, well, title: titleClass, Icon } = CALLOUT[tone];
  return (
    <aside className={`flex w-full gap-3.5 rounded-2xl border ${wrap} px-4 py-4 sm:px-5 sm:py-[18px]`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm ${well}`} aria-hidden="true">
        <Icon className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${titleClass}`}>
          {title}
        </p>
        <div className="mt-2 space-y-2.5 text-[13.5px] leading-[1.7] text-slate-700 [&_p]:m-0">
          {children}
        </div>
      </div>
    </aside>
  );
}

function Quote({ children }: { children: ReactNode }) {
  return (
    <p className="relative rounded-xl border border-slate-200/80 bg-slate-50/80 py-2.5 pl-4 pr-3.5 font-medium leading-relaxed text-slate-800">
      <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-emerald-500/80" aria-hidden="true" />
      {children}
    </p>
  );
}

function Tip({ title = 'Tip', children }: { title?: string; children: ReactNode }) {
  return <Callout tone="tip" title={title}>{children}</Callout>;
}

function Note({ title = 'Note', children }: { title?: string; children: ReactNode }) {
  return <Callout tone="note" title={title}>{children}</Callout>;
}

function Warn({ title = 'Warning', children }: { title?: string; children: ReactNode }) {
  return <Callout tone="warn" title={title}>{children}</Callout>;
}

function Danger({ title = 'Stop', children }: { title?: string; children: ReactNode }) {
  return <Callout tone="danger" title={title}>{children}</Callout>;
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="m-0 list-none space-y-4 p-0">
      {items.map((item, i) => (
        <li key={i} className="relative flex items-start gap-4">
          {i < items.length - 1 ? (
            <span
              className="absolute left-3 top-7 bottom-[-16px] w-px bg-slate-200"
              aria-hidden="true"
            />
          ) : null}
          <span className="relative z-[1] mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold tabular-nums text-white shadow-[0_1px_2px_rgba(15,23,42,0.2)]">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 rounded-xl bg-slate-50/70 px-3.5 py-2.5 text-[13.5px] leading-[1.7] text-slate-600">
            {item}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Grid({ headers, rows }: { headers: string[]; rows: string[][] }) {
  const twoCol = headers.length === 2;
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <table className={`w-full border-collapse text-left text-[13.5px] ${twoCol ? 'table-fixed' : ''}`}>
        {twoCol ? (
          <colgroup>
            <col className="w-[36%]" />
            <col />
          </colgroup>
        ) : null}
        <thead>
          <tr className="border-b border-slate-200 bg-[#f8fafb]">
            {headers.map((h) => (
              <th
                key={h}
                className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:px-6"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100 last:border-0 even:bg-slate-50/50">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`px-5 py-3.5 align-top leading-[1.65] break-words sm:px-6 ${
                    j === 0 ? 'font-semibold text-slate-800' : 'text-slate-600'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Sub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5">
      <h4 className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-slate-900">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
        {title}
      </h4>
      <div className="flex flex-col gap-3.5 text-[13.5px] leading-[1.7] text-slate-600">{children}</div>
    </div>
  );
}

export function buildGuide(broker: BrokerType, linked: boolean): { name: string; sections: GuideSection[] } {
  const name = BROKER_NAME[broker];
  const isAngel = broker === 'angel';
  const isTradex = broker === 'tradex';
  const isBear = broker === 'bear_street';

  const connectFields = isBear
    ? [
        ['API Key', 'Bear Street / ODIN API key. Not your Mintzy key.'],
        ['User ID', 'Bear Street login user id.'],
        ['Password', 'Bear Street password. Use the eye icon to check it.'],
        ['Registered mobile number', 'The number on the Bear Street account. Required. This is the number itself, not an SMS OTP.'],
      ]
    : isTradex
      ? [
          ['Access Key / App Key / JWT 1', 'First TradeX token. Spaces and line breaks are stripped on paste.'],
          ['Client ID / User ID', 'Your TradeX client id.'],
          ['Access Secret / Secret Key / JWT 2', 'Second TradeX token. Do not wrap it in quotes.'],
        ]
      : [
          ['API Key', 'Angel SmartAPI app key from the Angel developer portal. Not your Mintzy key.'],
          ['Client Code', 'Your Angel One client code.'],
          ['Password / PIN', 'The PIN you use with SmartAPI.'],
        ];

  const startLive = isTradex
    ? 'TradeX starts live the moment you press Start Trading. There is no simulation phase and no later switch.'
    : `${name} always starts in simulation. The engine then switches itself to live — you do not press a second button. While it is simulating, status shows Simulating and a Simulation badge. After the switch, a green Live trading divider appears in the logs and new rows are untagged.`;

  const sections: GuideSection[] = [
    {
      id: 'intro',
      title: 'What this app is',
      body: (
        <>
          <p>
            <strong>Mintzy Plugin</strong> is the Windows desktop terminal for automated equity trading through <strong>{name}</strong>.
            You sign in with a Mintzy API key. The key already knows your broker — you never pick Angel One, TradeX, or Bear Street in a dropdown.
          </p>
          <p>Once connected, the app can:</p>
          <ul>
            <li>Run a saved or one-off strategy against NSE cash symbols.</li>
            <li>Show live P&amp;L, a session chart, and a full trade log.</li>
            <li>Keep every session so you can reopen logs, download CSV, and compute performance on this computer.</li>
            <li>Save strategies (symbols, capital, stop-loss, candle, leverage) and reuse them.</li>
          </ul>
          <p>
            This guide is written only for <strong>{name}</strong>. Steps and errors that belong to other brokers are hidden.
          </p>
          {!linked && (
            <Warn>
              <p>Your Mintzy account currently has no broker linked. Sign out, get a key onboarded for {name} from mintzy.in, and sign in again before you try to connect.</p>
            </Warn>
          )}
        </>
      ),
    },
    {
      id: 'need',
      title: 'What you need',
      body: (
        <>
          <ul>
            <li>Mintzy Plugin installed on Windows (updates only work in the installed app, not a browser preview).</li>
            <li>A <strong>Mintzy API key</strong> from mintzy.in — this signs you into the app.</li>
            <li>Your <strong>{name} credentials</strong> (below) when you start a session.</li>
            <li>Internet access to Mintzy and to {name}.</li>
          </ul>
          <Danger>
            <p>The Mintzy key and {name} password are secrets. Do not share them. Logging out removes the Mintzy key from this computer. It does not flatten open positions at {name}.</p>
          </Danger>
        </>
      ),
    },
    {
      id: 'signin',
      title: 'Sign in',
      body: (
        <>
          <p>This is the first screen. There is only one field.</p>
          <Steps
            items={[
              'Open Mintzy Plugin.',
              'Click API Key and paste the key from mintzy.in. Characters show as dots.',
              'Use the eye icon if you need to confirm the paste. Click it again to hide the key.',
              'Click Continue. The button shows Verifying… while Mintzy checks the key.',
              'On success you land on Dashboard. The key stays on this computer until you log out.',
            ]}
          />
          <Tip>
            <p>If you do not have a key, use “Get one from your Mintzy account” under Continue. That opens mintzy.in.</p>
          </Tip>
          <Sub title="If sign-in fails">
            <Grid
              headers={['What you see', 'What to do']}
              rows={[
                ['Please enter your API key', 'The field was empty. Paste the full key.'],
                ['Invalid API key. Check your key and try again.', 'Copy again from mintzy.in. No spaces, no quotes. Keys fail after they are rotated.'],
                ['Your Mintzy session has expired. Please re-enter your API key.', 'The saved session is dead. Paste the key again.'],
                ['Could not reach Mintzy. Check your internet connection and try again.', 'Offline, captive Wi-Fi, or a firewall. Connect and retry.'],
                ['Login screen after a restart', 'The stored token could not be read. Sign in once more.'],
              ]}
            />
          </Sub>
        </>
      ),
    },
    {
      id: 'shell',
      title: 'The window',
      body: (
        <>
          <p>After sign-in every page shares the same shell.</p>
          <Grid
            headers={['Area', 'What it is']}
            rows={[
              ['Sidebar', 'Mintzy mark, Dashboard, Launch Terminal, Documentation, Settings. Your name, email, and Log out at the bottom.'],
              ['Title bar', 'Name of the current page and a one-line description.'],
              ['Main pane', 'The page itself. Dashboard, docs, and settings scroll here. Launch Terminal has its own inner session rail.'],
            ]}
          />
          <Sub title="Sidebar">
            <ul>
              <li>The open page is green, with a short bar on the left edge.</li>
              <li>Pin it open with the chevron, or collapse it to icons. Hover a collapsed rail to peek labels — icons do not jump.</li>
              <li>A green <strong>Live</strong> mark on Launch Terminal means a {name} session is trading, even when you are on another page.</li>
              <li>Log out is the door-arrow next to your name. When the rail is collapsed, the same icon sits under your avatar.</li>
            </ul>
          </Sub>
          <Note>
            <p>Logging out does not stop a live session at {name}. Stop the session in Launch Terminal first if you mean to flatten risk in this app — then still check the {name} book.</p>
          </Note>
        </>
      ),
    },
    {
      id: 'overview',
      title: 'Dashboard · Overview',
      body: (
        <>
          <p>Home screen after sign-in. Use it to answer “how is trading doing?” Tabs at the top: Overview, Sessions, Month over month.</p>
          <Sub title="Account card">
            <p>Greeting (Good morning / afternoon / evening in IST), your first name, email, and a {name} pill. <strong>Updated …</strong> is a refresh button — click it to reload cash, sessions, and performance immediately. The app also refreshes about every 20 seconds and when you bring the window forward.</p>
          </Sub>
          <Sub title="Three metric cards">
            <Grid
              headers={['Card', 'Meaning']}
              rows={[
                ['Cash in broker', `Free cash Mintzy last read from ${name}. After you stop a session it keeps the last snapshot.`],
                ['Equity', 'Account value including open positions, from the monthly aggregate — not from the performance tiles below.'],
                ['This month', 'Net P&L for the calendar month from the gateway aggregate. Green is profit, red is loss.'],
              ]}
            />
          </Sub>
          <Sub title="Live session row">
            <p>
              A green dot and “N live trading session(s)” when something is running. “N ready” means {name} is connected but you have not pressed Start Trading.
              “No live sessions” means nothing is connected. <strong>View all</strong> opens the Sessions tab.
            </p>
          </Sub>
          <Sub title="If Overview fails">
            <Grid
              headers={['What you see', 'What to do']}
              rows={[
                ["Couldn't load trading data", 'Sessions request failed. Check internet, then Retry. If it persists, wait a minute — the plugin service may be down.'],
                ['Cash is ₹0.00 or looks stale', `Connect a session in Launch Terminal so Mintzy can read ${name} free cash. After market close the last stored figure stays.`],
                ['No live sessions / No trading sessions yet', 'Start one from Launch Terminal → New session.'],
              ]}
            />
          </Sub>
        </>
      ),
    },
    {
      id: 'sessions-tab',
      title: 'Dashboard · Sessions',
      body: (
        <>
          <p>Every {name} session on the account, newest first, 10 per page.</p>
          <Steps
            items={[
              'Open the Sessions tab (or View all on Overview).',
              'Each row: short session id, date/time in IST, status pill, CSV button.',
              'Click a row to open that session in Launch Terminal (logs and P&L). Past sessions are read-only.',
              'Click the download icon on a row for that session’s logs or tradebook CSV. The table header Download latest uses the newest session.',
              'Use previous / next and page numbers when there are more than 10 sessions.',
            ]}
          />
          <Grid
            headers={['Status you may see', 'Meaning']}
            rows={[
              ['Trading', 'Engine is running (live).'],
              ['Ready', `${name} is connected; you have not started yet. Opens Configure.`],
              ['Connecting / Awaiting 2FA', 'Login was not finished. Reconnect or delete from History.'],
              ['Stopped / Completed', 'Finished. Open read-only.'],
              ['Abandoned', 'Closed before start. Safe to delete.'],
              ['Expired / Error / Failed', `Dead session. Check logs if any, then start a new one. Confirm positions in the ${name} book.`],
            ]}
          />
          <Sub title="CSV errors">
            <Grid
              headers={['What you see', 'What to do']}
              rows={[
                ['No tradebook or logs are available for this session yet.', 'Nothing stored yet. Wait for the first logs, or the session never traded (abandoned).'],
                ['Could not download the CSV. Please try again.', 'Network or server error. Retry.'],
              ]}
            />
          </Sub>
        </>
      ),
    },
    {
      id: 'mom',
      title: 'Dashboard · Month over month',
      body: (
        <>
          <p>Last 12 calendar months as tiles. Open the tab, or the Month over month shortcut in Performance.</p>
          <ul>
            <li>Green — that month’s net P&amp;L was positive.</li>
            <li>Red — negative.</li>
            <li>— — no live (non-simulation) trades that month.</li>
          </ul>
          <p>These tiles are computed on this computer from session trades, same source as the Performance grid. They can differ slightly from “This month” on Overview, which comes from the gateway aggregate.</p>
        </>
      ),
    },
    {
      id: 'stats',
      title: 'Performance figures',
      body: (
        <>
          <p>
            Tiles under Overview are calculated on this computer from <strong>live</strong> {name} session trades. Simulation rows are skipped.
            Finished sessions are remembered on this device after the first load, so opening Dashboard again should be quick. Live sessions are fetched fresh.
            Last numbers stay on screen while anything new loads.
          </p>
          <p>A dash means there is not enough live history, or capital was missing so a percentage could not be formed.</p>
          <Grid
            headers={['Tile', 'How it is calculated']}
            rows={[
              ['Max profit script', 'Ticker with the highest summed day P&L. P&L in logs is a snapshot, so we take the last row per session / symbol / IST day, then sum those days.'],
              ['Max losing script', 'Same method, lowest (most negative) sum.'],
              ['Max profit day', 'IST calendar day with the highest net P&L across all scripts that day.'],
              ['Max losing day', 'IST calendar day with the lowest net P&L.'],
              ['Avg win rate', 'Share of trading days that finished green. Flat (zero) days are ignored.'],
              ['Max drawdown', 'Largest peak-to-trough drop on the cumulative P&L path, as a percent of peak equity (starting capital when logs have it).'],
              ['Average risk : reward', 'Mean winning day ÷ mean losing day, shown as 1 : x.xx. Dash if there were no losing days.'],
              ['Overall returns', 'Total P&L ÷ first capital reading in the logs. Hint shows net rupees.'],
              ['Max winning / losing streak', 'Longest run of consecutive green or red trading days. Days with no trades (weekends, holidays) are skipped and do not break a streak.'],
            ]}
          />
          <Sub title="Worked example">
            <p>Suppose three live days: Monday +₹2,000, Tuesday −₹500, Wednesday +₹1,000. Win rate is 2/3. Streaks are 1 win, 1 loss, then 1 win (max win 1, max lose 1). Overall rupees +₹2,500. If first capital in the logs was ₹1,00,000, overall return is 2.5%.</p>
          </Sub>
          <Tip>
            <p>Click Refresh on the account card (or leave Dashboard and open it again) after a session stops if you want the tiles to include that day immediately.</p>
          </Tip>
        </>
      ),
    },
    {
      id: 'terminal',
      title: 'Launch Terminal',
      body: (
        <>
          <p>The {name} trading workspace. Left: session rail. Centre: connect, configure, live dashboard, or saved strategies.</p>
          <Sub title="Session rail">
            <ul>
              <li><strong>New session</strong> (plus) — start {name} login.</li>
              <li><strong>Saved strategies</strong> (bookmark) — create, edit, delete, or quick-start a stored config.</li>
              <li><strong>Live</strong> — trading or simulating now (green Live or amber Sim).</li>
              <li><strong>History</strong> — finished sessions. Click to open read-only. Hover a row for the trash icon.</li>
              <li>The rail collapses automatically when you enter a live dashboard. Re-open it with the panel icon.</li>
            </ul>
          </Sub>
          <Sub title="Empty state">
            <p>“Ready to trade” with a New session button appears when nothing is selected. That button and the plus in the rail do the same thing.</p>
          </Sub>
          <Warn>
            <p>A Live session is working right now. Deleting it or Force stop is a trading action. Only delete History you no longer need — CSV for that session will no longer download from here.</p>
          </Warn>
          <Sub title="If the list fails">
            <Grid
              headers={['What you see', 'What to do']}
              rows={[
                ['Could not load your sessions', 'List request failed. Check internet. The rail may stay empty until it succeeds.'],
                ['This session has no ID and cannot be opened.', 'Broken record. Start a new session instead of that row.'],
                ['Could not delete the session. Please try again.', 'Retry. If it is still trading, Stop it from the live dashboard first.'],
              ]}
            />
          </Sub>
        </>
      ),
    },
    {
      id: 'connect',
      title: `Connect ${name}`,
      body: (
        <>
          <p>
            Press New session. The form is locked to <strong>{name}</strong> because that is the broker on your Mintzy key.
          </p>
          {isBear && (
            <p>
              Bear Street authenticates in <strong>one step</strong>. Fill all four fields and Continue. You go straight to Configure Session — there is no TOTP page.
            </p>
          )}
          {isTradex && (
            <p>
              TradeX authenticates in <strong>one step</strong>. Paste both tokens and Continue. You go straight to Configure Session — there is no TOTP page.
            </p>
          )}
          {isAngel && (
            <p>
              Angel One is two steps: these credentials, then a 6-digit TOTP from your Angel authenticator.
            </p>
          )}
          <Grid headers={['Field', 'What to enter']} rows={connectFields} />
          {isBear && (
            <Note>
              <p>The registered mobile number is sent as second-factor in the same request (source WEBAPI). A wrong number, or leaving it blank, is the usual reason login fails. This is not an SMS one-time code.</p>
            </Note>
          )}
          {isTradex && (
            <Note>
              <p>Do not wrap tokens in quotes. If a copy includes line breaks, the app removes whitespace before sending.</p>
            </Note>
          )}
          <p>Cancel returns to Ready to trade without keeping a finished login. A rejected attempt may still leave a Connecting row in History — delete it if you do not need it.</p>
          <Sub title="If connect fails">
            <Grid
              headers={['What you see', 'What to do']}
              rows={[
                ['No broker is linked to your Mintzy account…', `The Mintzy key has no broker claim. Sign out, get a key onboarded for ${name}, sign in again.`],
                ['Fill in all fields', 'Every field on this form is required.'],
                ...(isBear
                  ? [['Registered mobile number is required for Bear Street', 'Enter the mobile number registered on the Bear Street account.']]
                  : []),
                [`Broker rejected the credentials…`, `Recheck every ${name} field. Caps, extra spaces, and an old password are the usual causes.`],
                ['Could not verify your credentials. Please try again.', `Mintzy could not complete the ${name} login. Retry. If it keeps failing, ${name} or the plugin engine may be down.`],
                ['This broker session expired. Go back and connect your credentials again.', `The plugin session timed out. New session → log in to ${name} again.`],
                ['The trading engine is temporarily unavailable…', 'Plugin VM or gateway returned a server error. Wait, then retry once — do not spam New session.'],
                ['Could not reach Mintzy…', 'No network path to the gateway. Fix connectivity, then Continue again.'],
                ...(isAngel
                  ? [
                      ['Invalid Angel One API key…', 'Use the SmartAPI app key, not the Mintzy key and not the client code.'],
                      ['Broker rejected the credentials. Recheck client code and PIN…', 'Angel invalid client/password (including AB1001–AB1003). Confirm in the Angel app, then retry.'],
                    ]
                  : []),
              ]}
            />
          </Sub>
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
          <p>
            After credentials are accepted you must enter the <strong>6-digit TOTP</strong> from the Angel One / SmartAPI authenticator.
            Codes rotate about every 30 seconds — always use a fresh one. Verify stays disabled until six digits are entered.
          </p>
          <Steps
            items={[
              'Open the Angel authenticator for this client (not some other app’s TOTP).',
              'Type the six digits into the large field. Letters are rejected automatically.',
              'Click Verify. On success, Mintzy may show free cash, then Configure Session opens.',
              'Back returns to Connect Broker. You will need to connect again.',
            ]}
          />
          <Danger>
            <p>If the code is wrong or expired you see:</p>
            <Quote>Invalid or expired TOTP. Wait for a new code in your authenticator and try again.</Quote>
            <p>The field clears so you cannot resubmit a used code. Wait for the next code and type it immediately.</p>
          </Danger>
          <Grid
            headers={['What you see', 'What to do']}
            rows={[
              ['Enter a 6-digit code', 'Exactly six numbers.'],
              ['Invalid or expired TOTP…', 'Wait for the next code. Confirm you are on the Angel authenticator for this client.'],
              ['Broker rejected the login code…', 'Angel rejected the TOTP or the earlier API key / client / PIN. Confirm those three, then a brand-new TOTP.'],
              ['Broker authentication failed…', 'Start over from Connect Broker if a new TOTP still fails.'],
              ['This broker session expired…', 'Too much time passed. Back → connect again → new TOTP.'],
            ]}
          />
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
          <p>After {name} is connected{isAngel ? ' and TOTP is verified' : ''}, set the session then start.</p>
          <Grid
            headers={['Control', 'What it does']}
            rows={[
              ['Saved strategy', 'Pick one to fill the form and its leverage. “Configure manually” starts blank.'],
              ['Candle interval', '1m, 5m, 15m, or 75m. This is the bar the strategy reads.'],
              ['Strategy', 'Stoppage Reversal (A) or Exposure Expansion (B).'],
              ['Use available broker cash', `On by default. Trades draw from ${name} balance. Each symbol’s capital is a cap, not a second wallet.`],
              ['Symbols', 'NSE cash names from the list (e.g. HDFCBANK). Capital in rupees must be > 0. Stop-loss is a percent (default 5). Each symbol once.'],
              ['Leverage 1–5×', 'Only on a saved strategy. Select it, set the multiplier, press Apply, then Start. You cannot attach leverage to a one-off form until that layout is saved.'],
              ['Start summary', 'Shows how many symbols will start (manual + auto alphas from some saved strategies) and total allocation.'],
              ['Start Trading', 'Sends the session to the engine.'],
              ['Abandon session', `Closes this ${name} login without starting. Confirm in the dialog.`],
            ]}
          />
          <p>{startLive}</p>
          <p>Back on this screen returns to {isAngel ? 'the TOTP step' : `Connect ${name}`}.</p>
          <Warn>
            <p>You cannot abandon a session that is already trading. Use Stop or Force stop on the live dashboard.</p>
          </Warn>
          <Sub title="If start fails">
            <Grid
              headers={['What you see', 'What to do']}
              rows={[
                ['Add at least one stock', 'Add a symbol with capital, or pick a saved strategy that already has symbols / alphas.'],
                ['Fill all symbol and capital fields', 'Every row needs a ticker and a capital amount.'],
                ['Capital must be > 0', 'Positive rupees. Zero and blank are rejected.'],
                ['Stop loss must be > 0', 'Percent greater than 0.'],
                ['Each stock can only be added once', 'Remove the duplicate ticker.'],
                ['Select a saved strategy to set leverage.', 'Save the layout first, or pick one from the dropdown, then Apply.'],
                ['Could not update leverage…', 'Retry Apply, or set leverage under Saved strategies.'],
                ['Could not start trading…', `Confirm symbols, capital, and that the ${name} session is still connected.`],
                ['This strategy has no symbols to start with.', 'Edit the saved strategy and add at least one symbol.'],
                ['This session is already trading…', 'Abandon is blocked. Use Stop / Force stop.'],
                ['Could not close this session…', 'Retry Abandon, or delete a leftover row from History.'],
                ['This broker session expired…', `Plugin session died before start. New session → connect ${name} again.`],
                ['Search produces no symbol', 'Only the supported NSE cash list is searchable. Use the exchange code (HCLTECH, not “HCL”).'],
              ]}
            />
          </Sub>
        </>
      ),
    },
    {
      id: 'saved',
      title: 'Saved strategies',
      body: (
        <>
          <p>Launch Terminal → bookmark. Strategies belong to your Mintzy account and are reused when you start a {name} session.</p>
          <Sub title="List cards">
            <ul>
              <li>Name, description, badges (manual symbols, auto alphas, strategy, candle, leverage).</li>
              <li><strong>View / Edit</strong> — open the editor, then Update strategy.</li>
              <li><strong>Quick Start</strong> — only when a {name} session is already connected (you are on Configure). Starts immediately.</li>
              <li><strong>Delete</strong> — confirm; it cannot be undone.</li>
            </ul>
          </Sub>
          <Sub title="Create one">
            <Steps
              items={[
                'Launch Terminal → Saved strategies → New strategy.',
                'Name (required), optional description.',
                'Candle, strategy, broker-cash toggle.',
                'Manual allocation: Add, pick a symbol from search, capital, stop-loss %. Repeat as needed.',
                'Save strategy. Toast: “Strategy saved”. The editor stays open so you can Apply leverage 1–5×.',
              ]}
            />
          </Sub>
          <Note>
            <p>Accounts have a maximum number of saved strategies. If you hit it, delete one you do not need, then save again.</p>
          </Note>
          <Grid
            headers={['What you see', 'What to do']}
            rows={[
              ['List failed to load', 'Retry on the screen. Check internet.'],
              ["You've reached the maximum number of saved strategies…", 'Delete an unused strategy, then save.'],
              ['Could not save the strategy…', 'Check name and that every symbol row is valid, then retry.'],
              ['Could not delete the strategy…', 'Retry. If it is selected on Configure, pick Configure manually first.'],
              ['Could not start trading from this strategy…', `Connect a ${name} session first, then Quick Start — or start from Configure.`],
              ['Quick Start is missing', 'No session is connected. New session → connect → then the button appears.'],
            ]}
          />
        </>
      ),
    },
    {
      id: 'live',
      title: 'Live session, Stop, Force',
      body: (
        <>
          <p>After Start Trading you get free cash, status, last update time, CSV, and — only while live — Stop and Force.</p>
          <Grid
            headers={['Control', 'What it does']}
            rows={[
              ['Stop', 'Graceful. The engine stops taking new positions and winds the session down. Confirm in the dialog. Toast: “Session stopped”.'],
              ['Force', `Kills the engine immediately. Open positions are not closed automatically. Flatten them in the ${name} terminal if anything is still open. Toast: “Session force-stopped”.`],
              ['CSV', 'Downloads stored logs (live) or prefers Mongo logs for past sessions when the VM tradebook is gone.'],
            ]}
          />
          <p>Status you may see: Trading, Simulating, Ready, Stopped, Completed, Abandoned, Expired, Error / Failed, Connecting. <strong>Reconnecting…</strong> means the app lost the plugin feed and is retrying — leave the window open.</p>
          <p>Past sessions stay readable (logs, P&amp;L, CSV). Stop buttons are hidden. After market close, last recorded P&amp;L stays on screen.</p>
          <Danger>
            <p>Force stop is an emergency. Always open {name} afterwards and confirm there is no leftover position.</p>
          </Danger>
          <Grid
            headers={['What you see', 'What to do']}
            rows={[
              ['Reconnecting…', `Wait. If it never recovers, Stop (or Force), then check ${name}.`],
              ['Could not stop the session. It may still be running.', `Retry Stop. If it stays live, Force stop, then confirm in ${name}.`],
              ['Status Error / Failed', `Engine aborted. Read the last log rows, download CSV if present, start a new session. Do not assume positions are flat — check ${name}.`],
              ['Session expired', `Plugin session is gone. You cannot resume it. Connect a new session. Positions at ${name} are independent.`],
            ]}
          />
        </>
      ),
    },
    {
      id: 'logs',
      title: 'Trade logs',
      body: (
        <>
          <p>Each row is a fill or status update from the {name} session. Times are IST. Date looks like 25/8/2026; time sits on the next line with am/pm.</p>
          <ul>
            <li><strong>Sim</strong> badge — simulation row. Kept for history. Performance tiles ignore them.</li>
            <li>Untagged rows after the green <strong>Live trading</strong> divider are live {name} fills.</li>
            <li>Signal and action are pills (including wait). Quantity is kept through the sim→live handoff — a zero from the engine is not treated as a fill.</li>
            <li>P&amp;L, capital, change, and return follow that row’s snapshot.</li>
          </ul>
          {isTradex && (
            <p>TradeX has no simulation phase, so you should not see a Sim badge or Live trading divider unless older mixed data is present.</p>
          )}
          <p>Empty state: “No trades yet” / “Executed trades will appear here as the engine runs.”</p>
          <Grid
            headers={['What you see', 'What to do']}
            rows={[
              ['No trades yet for a long time', `Confirm status is Trading or Simulating, the candle has elapsed, and ${name} can see the symbols. If Failed, stop and start again.`],
              ['Quantity is — or 0 on a fill', 'Wait rows and some engine zeros are not fills. Check Signal / Action. After sim→live, quantity is carried forward on purpose.'],
              ['CSV says no tradebook or logs yet', 'Nothing stored. Wait for rows, or the session was abandoned before start.'],
            ]}
          />
        </>
      ),
    },
    {
      id: 'pnl',
      title: 'Live P&L chart',
      body: (
        <>
          <p>Line and candle views both plot <strong>session P&amp;L</strong>, not {name} market candles. Axis and hover use the same IST 12-hour clock. Zoom and pan stay inside the data you have.</p>
          <ul>
            <li>Ticker dropdown or tiles — one symbol, several, or all. Booked vs open cards follow that scope.</li>
            {isTradex
              ? <li>The series is live P&amp;L from the start of the session.</li>
              : <li>After simulation hands off to live, the chart can include the simulation path. The log divider is the same moment.</li>}
            <li>Expand (maximize) opens the chart full window. Escape or minimize leaves it.</li>
            <li>After market close the last recorded figures stay.</li>
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
          <p>Only in the installed Windows app. A browser preview shows “Desktop settings are only available in the installed app.”</p>
          <Grid
            headers={['Setting', 'What it does']}
            rows={[
              ['Auto-launch on startup', 'Open Mintzy when you log into Windows. Toast confirms the change.'],
              ['Minimize to tray', 'Close (X) hides in the tray. Click the tray icon to reopen. Off: X fully quits.'],
              ['Desktop notifications', 'System alerts for updates and important events.'],
              ['Check for updates', 'Asks GitHub for a newer installer. When downloaded: Restart and Install Now, or Install now here.'],
              ['About', 'Installed version and a link to billing on mintzy.in.'],
            ]}
          />
          <Grid
            headers={['What you see', 'What to do']}
            rows={[
              ['Could not update the startup / tray / notification setting.', 'Retry the toggle as the Windows user who installed the app.'],
              ['Updates are only available in the installed app.', 'Dev / unpackaged builds cannot auto-update. Use the released installer.'],
              ['Could not check for updates…', 'Need network access to GitHub releases. Retry later.'],
              ['No update package was found.', 'Release assets are not up yet. Wait, or download the installer from Mintzy.'],
              ['The update file could not be verified.', 'Checksum failed. Retry later; do not install a partial download.'],
              ['Could not install the update…', 'Quit fully (tray → quit if needed), reopen, then Install now.'],
            ]}
          />
        </>
      ),
    },
    {
      id: 'flows',
      title: 'Common flows',
      body: (
        <>
          <Sub title="From zero to a live session">
            <Steps
              items={[
                'Sign in with the Mintzy API key.',
                'Optional: Launch Terminal → Saved strategies → New strategy → Save, then Apply leverage.',
                `New session → enter ${name} credentials → Continue.` + (isAngel ? ' Enter TOTP → Verify.' : ''),
                'Configure (or pick the saved strategy) → Start Trading.',
                'Watch logs and P&L. Stop when you are done. Check the ' + name + ' book if you used Force stop.',
              ]}
            />
          </Sub>
          <Sub title="Reopen a past session">
            <p>Dashboard → Sessions → click the row, or Launch Terminal History → click the row. Read-only: logs, chart, CSV. No Stop.</p>
          </Sub>
          <Sub title="Log out">
            <p>Sidebar footer → log out icon. Sign-in screen returns. Live {name} positions are not closed by this.</p>
          </Sub>
        </>
      ),
    },
    {
      id: 'errors',
      title: 'Errors anywhere',
      body: (
        <>
          <p>The app never shows stack traces or HTTP status jargon. If something still fails, match the sentence on screen.</p>
          <Grid
            headers={['What you see', 'What to do']}
            rows={[
              ['Your session expired. Please sign in again.', `Mintzy JWT expired. Paste the API key again, then reconnect ${name}.`],
              ["You don’t have permission to do that.", 'This action is not allowed for the account. Use the Mintzy key that owns the session.'],
              ["We couldn't find what you were looking for.", 'Session, tradebook, or resource is gone. Refresh the session list.'],
              ['Our servers are temporarily unavailable…', 'Gateway or plugin returned 5xx. Wait, then retry the same action once.'],
              ['Could not reach Mintzy…', 'Offline, DNS, or firewall. Live dashboard shows Reconnecting… until the feed is back.'],
              ['Something went wrong. Please try again.', `Generic fallback. Retry once. If it repeats on connect, recheck the ${name} fields.`],
              ['Unable to connect to the Plugin terminal…', `Desktop shell lost the page. Retry. If it mentions a broker session expired, log into ${name} here again.`],
              ["You're sent back to login suddenly", 'Mintzy session expired. Sign in again. A fresh session lasts up to 24 hours.'],
            ]}
          />
          <p>
            Still stuck: confirm in the {name} book whether orders are live, then contact Mintzy with the session id from Dashboard → Sessions (never send your API key).
          </p>
        </>
      ),
    },
    {
      id: 'faq',
      title: 'Questions',
      body: (
        <>
          <Sub title="Where do I get an API key?">
            <p>mintzy.in. The sign-in screen links there. The key decides that this install talks to {name}.</p>
          </Sub>
          <Sub title="Can I switch broker in the app?">
            <p>No. Get a different Mintzy key onboarded for the other broker.</p>
          </Sub>
          <Sub title="Why is performance a dash?">
            <p>No live (non-simulation) trades yet, or the first load of history is still running. Open Dashboard again after a finished session; later visits use the local cache.</p>
          </Sub>
          <Sub title="Why don’t Month over month and This month match?">
            <p>This month is the gateway aggregate. Month tiles are summed from live session logs on this computer (simulation skipped). They can disagree.</p>
          </Sub>
          <Sub title="Does logging out stop trading?">
            <p>No. Stop or Force stop in Launch Terminal, then confirm in {name}.</p>
          </Sub>
        </>
      ),
    },
    {
      id: 'glossary',
      title: 'Glossary',
      body: (
        <Grid
          headers={['Term', 'Meaning']}
          rows={[
            ['Mintzy API key', 'Signs you into this app. Also locks the broker to ' + name + '.'],
            ['Session', 'One run: connect ' + name + ', start a strategy, record trades and P&L.'],
            ['Live session', 'Trading right now.'],
            ['Simulation', isTradex ? 'Not used on TradeX start. Other brokers may still show older Sim rows.' : 'Practice path before live. Sim rows are tagged Sim and ignored by performance tiles.'],
            ['TOTP', isAngel ? '6-digit Angel authenticator code, second login step.' : 'Not used for ' + name + ' login in this app.'],
            ['P&L', 'Profit and loss for the session or the row.'],
            ['Equity', 'Account value including open positions.'],
            ['Free cash', 'Cash available at ' + name + ' for trading.'],
            ['Saved strategy', 'Reusable symbols, capital, stop-loss, candle, strategy, leverage.'],
            ['Leverage', '1×–5× scale stored on a saved strategy.'],
            ['Candle', 'Bar length the strategy reads: 1m, 5m, 15m, 75m.'],
            ['Stop-loss', 'Percent move that should close a trade to limit a loss.'],
            ['Tradebook / CSV', 'Downloadable record of the session.'],
            ['Drawdown', 'Largest drop from a peak on the equity path.'],
            ['Win rate', 'Share of trading days that finished green.'],
          ]}
        />
      ),
    },
  );

  return { name, sections };
}
