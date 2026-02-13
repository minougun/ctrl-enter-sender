// 拡張機能の有効/無効状態を管理
let _ctrlEnterEnabled = true;

// 初期状態を取得
browser.runtime.sendMessage({ type: "getState" }).then((response) => {
  if (response) _ctrlEnterEnabled = response.enabled;
}).catch(() => {});

// 状態変更を監視
browser.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    _ctrlEnterEnabled = changes.enabled.newValue;
  }
});

function isCtrlEnterEnabled() {
  return _ctrlEnterEnabled;
}

// 送信ボタンを探してクリック
function clickSendButton(inputElement) {
  const form = inputElement.closest("form");
  if (form) {
    const btn = form.querySelector(
      'button[data-testid="send-button"], button[type="submit"], button[aria-label="Send"], button[aria-label="送信"]'
    );
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
  }
  const parent = inputElement.closest('[role="presentation"], [class*="chat"], [class*="composer"], main, [class*="input"]');
  if (parent) {
    const btn = parent.querySelector(
      'button[data-testid="send-button"], button[type="submit"], button[aria-label="Send"], button[aria-label="送信"], button[class*="send"], button[class*="submit"]'
    );
    if (btn && !btn.disabled) {
      btn.click();
      return true;
    }
  }
  return false;
}

// Enterイベントを模倣して送信
function simulateEnterSubmit(element) {
  const enterDown = new KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    which: 13,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(enterDown);
}

// キー操作のハンドリング共通ロジック
// fail-closed: Enter単体は常にブロックし、改行挿入を試みる
function handleKeyEvent(e, element) {
  if (!isCtrlEnterEnabled()) return;

  if (e.key === "Enter") {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Enter / Cmd+Enter → 送信
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (!clickSendButton(element)) {
        _ctrlEnterEnabled = false;
        simulateEnterSubmit(element);
        setTimeout(() => {
          browser.runtime.sendMessage({ type: "getState" }).then((r) => {
            _ctrlEnterEnabled = r ? r.enabled : true;
          }).catch(() => { _ctrlEnterEnabled = true; });
        }, 100);
      }
    } else if (!e.shiftKey && !e.isComposing) {
      // Enter単体 → 常にブロック (fail-closed: 誤送信防止を優先)
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      insertNewline(element);
    }
    // Shift+Enter → デフォルト動作 (改行)
  }
}

// --- Selection / Range ヘルパー ---

function getTargetRangesSafe(e) {
  if (typeof e.getTargetRanges !== "function") return null;
  try {
    const ranges = e.getTargetRanges();
    return ranges && ranges.length ? ranges : null;
  } catch (_) {
    return null;
  }
}

function getRangeFromTargetRanges(element, targetRanges) {
  if (!targetRanges || !targetRanges.length) return null;
  try {
    const staticRange = targetRanges[0];
    if (!staticRange) return null;
    const range = document.createRange();
    range.setStart(staticRange.startContainer, staticRange.startOffset);
    range.setEnd(staticRange.endContainer, staticRange.endOffset);
    if (element.contains(range.commonAncestorContainer)) {
      return range;
    }
  } catch (_) {}
  return null;
}

function getRangeFromSelection(element) {
  const selection = window.getSelection ? window.getSelection() : null;
  if (!selection || selection.rangeCount === 0) return null;
  try {
    const range = selection.getRangeAt(0).cloneRange();
    if (element.contains(range.commonAncestorContainer)) {
      return range;
    }
  } catch (_) {}
  return null;
}

function getEditableRange(element, targetRanges) {
  return getRangeFromTargetRanges(element, targetRanges)
    || getRangeFromSelection(element);
  // フォールバックで末尾に挿入するのはやめる (意図しない位置への挿入防止)
}

// --- 改行挿入 ---

function insertNewline(element, options) {
  if (!element) return false;
  const opts = options || {};

  // textarea / input
  if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
    const start = element.selectionStart;
    const end = element.selectionEnd;
    if (typeof start !== "number" || typeof end !== "number") return false;
    const value = element.value;
    element.value = value.substring(0, start) + "\n" + value.substring(end);
    element.selectionStart = element.selectionEnd = start + 1;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  // contenteditable
  if (!element.isContentEditable) return false;

  const isProseMirror = element.classList && element.classList.contains("ProseMirror");

  // ProseMirror: DOM直接操作ではなくイベント方式のみ
  if (isProseMirror) {
    return insertNewlineProseMirror(element);
  }

  // 通常のcontenteditable: Range API で <br> を挿入
  const range = getEditableRange(element, opts.targetRanges);
  if (!range) return false;

  try {
    if (document.activeElement !== element) element.focus();
  } catch (_) {}

  try {
    range.deleteContents();
    const br = document.createElement("br");
    range.insertNode(br);

    // Firefox Android で末尾 <br> 直後にキャレットを維持するためゼロ幅スペースを追加
    const nextSibling = br.nextSibling;
    if (!nextSibling || (nextSibling.nodeType === 1 && nextSibling.tagName === "BR") || !nextSibling.textContent) {
      const zws = document.createTextNode("\u200B");
      br.parentNode.insertBefore(zws, br.nextSibling);
    }

    // カーソルを br の直後へ移動
    const selection = window.getSelection();
    if (selection) {
      const caretRange = document.createRange();
      caretRange.setStartAfter(br);
      caretRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(caretRange);
    }

    // input イベントで状態同期
    element.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    return true;
  } catch (_) {
    return false;
  }
}

// ProseMirror 向け: Shift+Enter のキーイベントを模倣して改行を挿入させる
function insertNewlineProseMirror(element) {
  try {
    if (document.activeElement !== element) element.focus();
  } catch (_) {}

  try {
    // ProseMirror は Shift+Enter で改行(hard_break)を挿入するのがデフォルト
    const shiftEnter = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
    element.dispatchEvent(shiftEnter);
    return true;
  } catch (_) {
    return false;
  }
}
