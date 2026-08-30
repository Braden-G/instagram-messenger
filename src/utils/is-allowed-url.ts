import {
  AUTH_PATH_PREFIXES,
  BLOCKED_SCHEMES,
  FACEBOOK_AUTH_ROOT_HOSTS,
  INBOX_URL,
  INSTAGRAM_ROOT_HOSTS,
  LEGAL_PATH_PREFIXES,
  MEDIA_CDN_ROOT_HOSTS,
} from '../constants/instagram';

export type NavigationAction = 'allow' | 'block-to-inbox' | 'cancel';

function isHostOrSubdomain(hostname: string, root: string): boolean {
  const host = hostname.toLowerCase();
  const base = root.toLowerCase();
  return host === base || host.endsWith(`.${base}`);
}

function isOneOfRoots(hostname: string, roots: readonly string[]): boolean {
  return roots.some((root) => isHostOrSubdomain(hostname, root));
}

export function isInstagramHost(hostname: string): boolean {
  return isOneOfRoots(hostname, INSTAGRAM_ROOT_HOSTS);
}

export function isFacebookAuthHost(hostname: string): boolean {
  return isOneOfRoots(hostname, FACEBOOK_AUTH_ROOT_HOSTS);
}

export function isMediaCdnHost(hostname: string): boolean {
  return isOneOfRoots(hostname, MEDIA_CDN_ROOT_HOSTS);
}

function pathSegments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

function hasPrefix(segments: string[], prefixes: readonly string[]): boolean {
  return segments.length > 0 && prefixes.includes(segments[0]);
}

/** True for /direct and /direct/... (inbox, threads, requests). */
export function isDirectPath(pathname: string): boolean {
  const segments = pathSegments(pathname);
  return segments[0] === 'direct';
}

export function isAuthPath(pathname: string): boolean {
  return hasPrefix(pathSegments(pathname), AUTH_PATH_PREFIXES);
}

/**
 * Reels, posts, IGTV, and story permalinks that appear when someone sends
 * media in a chat. The Reels *tab* (`/reels` with no id) is not included.
 */
export function isSharedMediaPath(pathname: string): boolean {
  const segments = pathSegments(pathname);
  const [root, id] = segments;

  if (!root || !id) {
    return false;
  }

  if (root === 'reel' || root === 'p' || root === 'tv') {
    return true;
  }

  // /reels/{shortcode} is a specific reel; /reels is the explore-style tab.
  if (root === 'reels') {
    return id !== 'audio';
  }

  // /stories/{user}/{id} or /stories/highlights/{id}
  if (root === 'stories') {
    return true;
  }

  return false;
}

export function isAllowedInstagramPath(pathname: string): boolean {
  const segments = pathSegments(pathname);

  if (isDirectPath(pathname) || isAuthPath(pathname) || isSharedMediaPath(pathname)) {
    return true;
  }

  if (hasPrefix(segments, LEGAL_PATH_PREFIXES)) {
    return true;
  }

  // Help / error surfaces that can appear mid-login or after a failed load.
  if (segments[0] === 'help' || segments[0] === 'error') {
    return true;
  }

  return false;
}

function parseUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isInboxUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed || !isInstagramHost(parsed.hostname)) {
    return false;
  }
  return isDirectPath(parsed.pathname);
}

/** The inbox list itself (`/direct` or `/direct/inbox`), not a thread. */
export function isInboxListUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed || !isInstagramHost(parsed.hostname)) {
    return false;
  }
  const segments = pathSegments(parsed.pathname);
  return segments[0] === 'direct' && (segments.length === 1 || segments[1] === 'inbox');
}

export function isAuthUrl(url: string): boolean {
  const parsed = parseUrl(url);
  if (!parsed) {
    return false;
  }
  if (isFacebookAuthHost(parsed.hostname)) {
    return true;
  }
  return isInstagramHost(parsed.hostname) && isAuthPath(parsed.pathname);
}

export function shouldShowInboxButton(url: string): boolean {
  if (!url) {
    return false;
  }
  if (isAuthUrl(url)) {
    return false;
  }
  return !isInboxListUrl(url);
}

/**
 * Decide what to do with a WebView navigation.
 * Subframes and CDN/media hosts are always allowed so Reels can play.
 * Only the top-frame document is gated to DMs, auth, and shared media.
 */
export function classifyNavigation(url: string, isTopFrame: boolean): NavigationAction {
  const trimmed = url?.trim() ?? '';
  if (!trimmed) {
    return 'cancel';
  }

  const parsed = parseUrl(trimmed);
  if (!parsed) {
    return 'cancel';
  }

  const scheme = parsed.protocol.replace(':', '').toLowerCase();

  if (scheme === 'about') {
    return 'allow';
  }

  if (scheme === 'blob' || scheme === 'data') {
    return 'allow';
  }

  if (BLOCKED_SCHEMES.includes(scheme as (typeof BLOCKED_SCHEMES)[number])) {
    return 'cancel';
  }

  if (scheme !== 'https' && scheme !== 'http') {
    return 'cancel';
  }

  // Let images, video, XHR, and iframes load — blocking those breaks Reels.
  if (!isTopFrame) {
    return 'allow';
  }

  const { hostname, pathname } = parsed;

  if (
    isFacebookAuthHost(hostname) ||
    isMediaCdnHost(hostname) ||
    isHostOrSubdomain(hostname, 'cdninstagram.com')
  ) {
    return 'allow';
  }

  // Link shims and help.instagram.com (password recovery) stay on IG's domains.
  if (isHostOrSubdomain(hostname, 'instagram.com')) {
    if (hostname.startsWith('l.') || hostname.startsWith('lm.') || hostname.startsWith('help.')) {
      return 'allow';
    }
    return isAllowedInstagramPath(pathname) ? 'allow' : 'block-to-inbox';
  }

  if (isInstagramHost(hostname)) {
    return isAllowedInstagramPath(pathname) ? 'allow' : 'block-to-inbox';
  }

  return 'block-to-inbox';
}

export function inboxRedirectScript(): string {
  return `try { window.location.replace(${JSON.stringify(INBOX_URL)}); } catch (e) {} true;`;
}
