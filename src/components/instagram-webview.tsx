import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  WebView,
  type WebViewMessageEvent,
  type WebViewNavigation,
} from 'react-native-webview';
import { INBOX_URL } from '../constants/instagram';
import {
  HIDE_APP_INTERSTITIAL_SCRIPT,
  KEYBOARD_GUARD_SCRIPT,
  SPA_NAV_WATCHER_SCRIPT,
} from '../constants/injected-scripts';
import {
  classifyNavigation,
  inboxRedirectScript,
  isAuthUrl,
  isInboxListUrl,
  isInboxUrl,
  isSharedMediaPath,
  shouldShowInboxButton,
} from '../utils/is-allowed-url';

const INJECTED_BEFORE_LOAD = `${SPA_NAV_WATCHER_SCRIPT}\n${HIDE_APP_INTERSTITIAL_SCRIPT}\n${KEYBOARD_GUARD_SCRIPT}`;
const INJECTED_AFTER_LOAD = `${HIDE_APP_INTERSTITIAL_SCRIPT}\n${KEYBOARD_GUARD_SCRIPT}`;

const DISCLAIMER =
  'Quiet DMs is an independent app and is not affiliated with, endorsed by, or sponsored by Instagram or Meta.';

export function InstagramWebView() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [currentUrl, setCurrentUrl] = useState(INBOX_URL);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const goToInbox = useCallback(() => {
    setHasError(false);
    setCurrentUrl(INBOX_URL);
    webViewRef.current?.injectJavaScript(inboxRedirectScript());
  }, []);

  const reload = useCallback(() => {
    setHasError(false);
    webViewRef.current?.reload();
  }, []);

  const handleUrl = useCallback(
    (url: string, isTopFrame: boolean): boolean => {
      const action = classifyNavigation(url, isTopFrame);
      if (action === 'allow') {
        return true;
      }
      if (action === 'block-to-inbox') {
        setTimeout(() => goToInbox(), 0);
      }
      return false;
    },
    [goToInbox],
  );

  const onShouldStartLoadWithRequest = useCallback(
    (request: WebViewNavigation & { isTopFrame?: boolean }) => {
      const isTopFrame = request.isTopFrame !== false;
      return handleUrl(request.url, isTopFrame);
    },
    [handleUrl],
  );

  const onNavigationStateChange = useCallback(
    (nav: WebViewNavigation) => {
      setCurrentUrl(nav.url);
      setCanGoBack(nav.canGoBack);
      try {
        if (isSharedMediaPath(new URL(nav.url).pathname)) {
          Keyboard.dismiss();
        }
      } catch {
        // Ignore malformed navigation URLs.
      }
      if (classifyNavigation(nav.url, true) === 'block-to-inbox') {
        goToInbox();
      }
    },
    [goToInbox],
  );

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as { type?: string; url?: string };
        if (data.type === 'dismiss-keyboard') {
          Keyboard.dismiss();
          return;
        }
        if (data.type === 'nav' && typeof data.url === 'string') {
          setCurrentUrl(data.url);
          try {
            if (isSharedMediaPath(new URL(data.url).pathname)) {
              Keyboard.dismiss();
            }
          } catch {
            // Ignore malformed URLs from the page.
          }
          if (classifyNavigation(data.url, true) === 'block-to-inbox') {
            goToInbox();
          }
        }
      } catch {
        // Ignore non-JSON messages from the page.
      }
    },
    [goToInbox],
  );

  const onOpenWindow = useCallback(
    (event: { nativeEvent: { targetUrl: string } }) => {
      const targetUrl = event.nativeEvent.targetUrl;
      if (classifyNavigation(targetUrl, true) === 'allow') {
        webViewRef.current?.injectJavaScript(
          `try { window.location.href = ${JSON.stringify(targetUrl)}; } catch (e) {} true;`,
        );
      } else if (classifyNavigation(targetUrl, true) === 'block-to-inbox') {
        goToInbox();
      }
    },
    [goToInbox],
  );

  const showInbox = shouldShowInboxButton(currentUrl);
  const title = useMemo(() => {
    if (isAuthUrl(currentUrl)) {
      return 'Sign in';
    }
    if (isInboxUrl(currentUrl)) {
      return 'Messages';
    }
    return 'Media';
  }, [currentUrl]);

  return (
    <View style={styles.root}>
      <View style={[styles.bar, { paddingTop: insets.top }]}>
        <View style={styles.barRow}>
          {canGoBack && !isInboxListUrl(currentUrl) ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              onPress={() => webViewRef.current?.goBack()}
              style={styles.barButton}
            >
              <Text style={styles.barButtonText}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.barButton} />
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="About Quiet DMs"
            onPress={() => setAboutOpen(true)}
            style={styles.titleButton}
          >
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.aboutHint}>About</Text>
          </Pressable>
          <View style={styles.barRight}>
            {showInbox ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go to inbox"
                hitSlop={8}
                onPress={goToInbox}
                style={styles.barButton}
              >
                <Text style={styles.barButtonTextAccent}>Inbox</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reload"
              hitSlop={8}
              onPress={reload}
              style={styles.barButton}
            >
              <Text style={styles.barButtonText}>Reload</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {isAuthUrl(currentUrl) ? (
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>{DISCLAIMER}</Text>
        </View>
      ) : null}

      <View style={styles.webWrap}>
        <WebView
          ref={webViewRef}
          source={{ uri: INBOX_URL }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          incognito={false}
          startInLoadingState
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          keyboardDisplayRequiresUserAction
          allowsFullscreenVideo
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          originWhitelist={['*']}
          injectedJavaScriptBeforeContentLoaded={INJECTED_BEFORE_LOAD}
          injectedJavaScript={INJECTED_AFTER_LOAD}
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          onNavigationStateChange={onNavigationStateChange}
          onMessage={onMessage}
          onOpenWindow={onOpenWindow}
          onLoadStart={() => {
            setLoading(true);
            setHasError(false);
          }}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setHasError(true);
          }}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 500) {
              setHasError(true);
            }
          }}
          onContentProcessDidTerminate={reload}
          onRenderProcessGone={reload}
        />

        {loading && !hasError ? (
          <View pointerEvents="none" style={styles.loading}>
            <ActivityIndicator color="#A9CBBC" size="large" />
          </View>
        ) : null}

        {hasError ? (
          <View style={styles.error}>
            <Text style={styles.errorTitle}>Could not load messages</Text>
            <Text style={styles.errorBody}>
              Check your connection, then try again. The site may block this browser session.
              If one sign-in option fails, try your username and password.
            </Text>
            <Pressable accessibilityRole="button" onPress={reload} style={styles.retry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={goToInbox} style={styles.retrySecondary}>
              <Text style={styles.barButtonTextAccent}>Open inbox</Text>
            </Pressable>
            <Text style={styles.errorDisclaimer}>{DISCLAIMER}</Text>
          </View>
        ) : null}
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={aboutOpen}
        onRequestClose={() => setAboutOpen(false)}
      >
        <Pressable
          accessibilityLabel="Dismiss about"
          accessibilityRole="button"
          onPress={() => setAboutOpen(false)}
          style={styles.modalBackdrop}
        >
          <Pressable accessibilityRole="none" onPress={() => {}} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Quiet DMs</Text>
            <Text style={styles.modalBody}>{DISCLAIMER}</Text>
            <Pressable
              accessibilityLabel="Close about"
              accessibilityRole="button"
              onPress={() => setAboutOpen(false)}
              style={styles.modalClose}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  bar: {
    backgroundColor: '#000',
    borderBottomColor: '#262626',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  barButton: {
    minWidth: 56,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  barRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barButtonText: {
    color: '#f5f5f5',
    fontSize: 16,
    fontWeight: '600',
  },
  barButtonTextAccent: {
    color: '#A9CBBC',
    fontSize: 16,
    fontWeight: '700',
  },
  titleButton: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 2,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  aboutHint: {
    color: '#A9CBBC',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  disclaimer: {
    backgroundColor: '#1B2830',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disclaimerText: {
    color: '#E4E0D6',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  webWrap: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  error: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBody: {
    color: '#a8a8a8',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retry: {
    backgroundColor: '#2F6F62',
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  retrySecondary: {
    paddingVertical: 8,
  },
  errorDisclaimer: {
    color: '#A8A8A8',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    textAlign: 'center',
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    flex: 1,
    justifyContent: 'center',
    padding: 28,
  },
  modalCard: {
    backgroundColor: '#1B2830',
    borderRadius: 16,
    gap: 12,
    maxWidth: 420,
    paddingHorizontal: 22,
    paddingVertical: 22,
    width: '100%',
  },
  modalTitle: {
    color: '#F4F0E6',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalBody: {
    color: '#E4E0D6',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  modalClose: {
    alignSelf: 'center',
    backgroundColor: '#2F6F62',
    borderRadius: 8,
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
