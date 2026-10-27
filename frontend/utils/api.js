/**
 * Dynamically resolves the backend API base URL.
 * 
 * - In production (e.g. Vercel), uses NEXT_PUBLIC_API_URL pointing to the Render backend URL.
 * - Automatically strips any trailing slash so paths like `${getApiBase()}/api/...` format cleanly.
 * - In local development or local Wi-Fi testing, falls back to port 4000.
 */
export function getApiBase() {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    if (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      /^192\.168\./.test(window.location.hostname) ||
      /^10\./.test(window.location.hostname)
    ) {
      return `http://${window.location.hostname}:4000`;
    }
  }
  return 'http://localhost:4000';
}
