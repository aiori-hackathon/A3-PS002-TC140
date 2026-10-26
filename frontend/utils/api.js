/**
 * Dynamically resolves the backend API base URL.
 * 
 * - If NEXT_PUBLIC_API_URL is configured, uses that.
 * - In browser environment (e.g. mobile phone connected via local Wi-Fi IP),
 *   automatically uses `http://${window.location.hostname}:4000` so mobile phones
 *   send API requests to your Mac's network IP instead of failing on phone's localhost.
 * - Defaults to `http://localhost:4000` for SSR.
 */
export function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    return `http://${window.location.hostname}:4000`;
  }
  return 'http://localhost:4000';
}
