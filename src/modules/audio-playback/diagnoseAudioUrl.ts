import type { AudioDiagnosticResult } from './types';

/**
 * Diagnose audio URL accessibility via a HEAD fetch request.
 *
 * Probes the URL with `mode: 'cors'` to surface HTTP errors and
 * missing CORS headers that Howler.js cannot report.
 */
export async function diagnoseAudioUrl(url: string): Promise<AudioDiagnosticResult> {
  try {
    const response = await fetch(url, { method: 'HEAD', mode: 'cors' });

    const corsOrigin = response.headers.get('access-control-allow-origin');
    const contentType = response.headers.get('content-type');
    const rawLength = response.headers.get('content-length');
    const contentLength = rawLength ? Number(rawLength) : null;

    if (response.ok) {
      return {
        httpStatus: response.status,
        corsOrigin,
        contentType,
        contentLength,
        likelyCorsIssue: false,
        message: `OK (${response.status}). Content-Type: ${contentType ?? 'unknown'}.`,
      };
    }

    const statusText = response.statusText || String(response.status);
    const corsHint = !corsOrigin ? ' No CORS origin header found.' : '';

    return {
      httpStatus: response.status,
      corsOrigin,
      contentType,
      contentLength,
      likelyCorsIssue: response.status === 403 && !corsOrigin,
      message: `Server returned ${statusText}.${corsHint}`,
    };
  } catch {
    // fetch() throws TypeError when the request is blocked by CORS or
    // the network is unreachable. We cannot distinguish these two cases
    // from the error alone, but a CORS block is far more common for
    // cross-origin audio URLs.
    return {
      httpStatus: null,
      corsOrigin: null,
      contentType: null,
      contentLength: null,
      likelyCorsIssue: true,
      message:
        'Network request failed. Likely a CORS origin mismatch or the server is unreachable.',
    };
  }
}
