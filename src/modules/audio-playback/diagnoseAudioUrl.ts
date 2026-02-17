import type { AudioDiagnosticResult } from './types';

/**
 * Diagnose audio URL accessibility via a HEAD fetch request.
 *
 * Probes the URL with `mode: 'cors'` to surface HTTP errors and
 * missing CORS headers that Howler.js cannot report.
 *
 * Note: `Access-Control-Allow-Origin` and `Content-Length` are not
 * CORS-safelisted response headers, so they will only be readable if
 * the server sends `Access-Control-Expose-Headers`. These fields may
 * be null even when the headers are present on the server.
 */
export async function diagnoseAudioUrl(url: string): Promise<AudioDiagnosticResult> {
  try {
    const response = await fetch(url, { method: 'HEAD', mode: 'cors' });

    const corsOrigin = response.headers.get('access-control-allow-origin');
    const contentType = response.headers.get('content-type');
    const rawLength = response.headers.get('content-length');
    const parsedLength = rawLength !== null ? Number(rawLength) : null;
    const contentLength =
      typeof parsedLength === 'number' && Number.isFinite(parsedLength) && parsedLength >= 0
        ? parsedLength
        : null;

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
      // If fetch returned a Response, CORS has already allowed this origin.
      // Only the thrown/TypeError path in the catch block should be treated
      // as a likely CORS/network issue.
      likelyCorsIssue: false,
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
