// Domain Guard - Catches proxy CONNECT failures and redirects to a branded error page
const PROXY_ERRORS = [
  "net::ERR_TUNNEL_CONNECTION_FAILED",
  "net::ERR_PROXY_CONNECTION_FAILED",
  "net::ERR_CONNECTION_REFUSED",
  "net::ERR_CONNECTION_RESET",
  "net::ERR_CONNECTION_CLOSED",
];

chrome.webNavigation.onErrorOccurred.addListener((details) => {
  // Only intercept main frame navigations (not subresources)
  if (details.frameId !== 0) return;

  if (PROXY_ERRORS.includes(details.error)) {
    let domain;
    try {
      domain = new URL(details.url).hostname;
    } catch {
      domain = details.url;
    }
    const blockedPage =
      chrome.runtime.getURL("blocked.html") +
      "?domain=" + encodeURIComponent(domain) +
      "&url=" + encodeURIComponent(details.url);

    chrome.tabs.update(details.tabId, { url: blockedPage });
  }
});
