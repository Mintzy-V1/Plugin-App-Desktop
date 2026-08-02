import { pluginApi } from './pluginApi';

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the browser has a chance to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function assertCsvBlob(res: { data: Blob; headers?: Record<string, unknown> }) {
  const blob = res.data;
  const ct = String(res.headers?.['content-type'] ?? res.headers?.['Content-Type'] ?? '');
  // Axios + responseType:blob can surface API error JSON as a successful Blob.
  if (ct.includes('application/json') || ct.includes('text/json')) {
    const text = await blob.text();
    let message = 'Download failed';
    try {
      const parsed = JSON.parse(text);
      message = parsed?.message || parsed?.error || message;
    } catch {
      if (text.trim()) message = text.trim().slice(0, 160);
    }
    const err: any = new Error(message);
    err.response = { status: 404, data: { message } };
    throw err;
  }
  if (!blob || blob.size === 0) {
    const err: any = new Error('Empty download');
    err.response = { status: 404, data: { message: 'No CSV available for this session.' } };
    throw err;
  }
  return blob;
}

/**
 * Download a session CSV.
 * Past sessions: prefer Mongo trading-logs (`/sessions/:id/download`) — final-tradebook
 * needs the plugin VM and usually 404s/times out after stop.
 * Live sessions: prefer final-tradebook, then fall back to stored logs.
 */
export async function downloadSessionCsv(
  sessionId: string,
  options?: { preferLogs?: boolean }
): Promise<'tradebook' | 'logs'> {
  const preferLogs = options?.preferLogs ?? false;

  const tryTradebook = async () => {
    const res = await pluginApi.downloadTradebook(sessionId);
    const blob = await assertCsvBlob(res);
    triggerBrowserDownload(blob, `tradebook-${sessionId}.csv`);
    return 'tradebook' as const;
  };

  const tryLogs = async () => {
    const res = await pluginApi.downloadSessionLogs(sessionId);
    const blob = await assertCsvBlob(res);
    triggerBrowserDownload(blob, `session-logs-${sessionId}.csv`);
    return 'logs' as const;
  };

  if (preferLogs) {
    try {
      return await tryLogs();
    } catch {
      return await tryTradebook();
    }
  }

  try {
    return await tryTradebook();
  } catch {
    return await tryLogs();
  }
}
