// 初期状態: 有効
browser.runtime.onInstalled.addListener(() => {
  browser.storage.local.set({ enabled: true });
});

// content scriptからの状態問い合わせに応答
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getState") {
    browser.storage.local.get("enabled").then((result) => {
      sendResponse({ enabled: result.enabled !== false });
    });
    return true; // 非同期レスポンス
  }
  if (message.type === "toggle") {
    browser.storage.local.get("enabled").then((result) => {
      const newState = !(result.enabled !== false);
      browser.storage.local.set({ enabled: newState });
      sendResponse({ enabled: newState });
    });
    return true;
  }
});
