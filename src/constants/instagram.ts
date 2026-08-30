export const INBOX_URL = 'https://www.instagram.com/direct/inbox/';

export const INSTAGRAM_ROOT_HOSTS = [
  'instagram.com',
  'cdninstagram.com',
] as const;

export const FACEBOOK_AUTH_ROOT_HOSTS = [
  'facebook.com',
  'fb.com',
  'accountscenter.com',
] as const;

export const MEDIA_CDN_ROOT_HOSTS = ['fbcdn.net', 'akamaihd.net'] as const;

/** Top-frame path prefixes used for login, 2FA, checkpoints, and consent. */
export const AUTH_PATH_PREFIXES = [
  'accounts',
  'challenge',
  'consent',
  'session',
  'auth_platform',
  'two_factor',
  'cdn-cgi',
] as const;

/** Legal pages Instagram may open during login or cookie consent. */
export const LEGAL_PATH_PREFIXES = ['legal'] as const;

export const BLOCKED_SCHEMES = [
  'instagram',
  'intent',
  'fb',
  'fb-messenger',
  'fbapi',
  'fb-messenger-api',
  'fb-messenger-public',
  'fb-messenger-share-api',
  'instagram-stories',
  'itms',
  'itms-apps',
  'market',
  'mailto',
  'tel',
  'sms',
] as const;
