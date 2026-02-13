// 汎用サイト向け (contenteditable / textarea, モバイル対応)

(function () {
  const LOG = "[CtrlEnter]";

  function getInputElement() {
    const selectors = [
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][aria-label]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea[class*="chat"]',
      'textarea[class*="input"]',
      'textarea[placeholder]',
      'textarea#chat-input',
      'textarea[name="q"]',
      "textarea",
      'div[contenteditable="true"]',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function attachHandler(el) {
    if (!el || el.dataset.ctrlEnterAttached) return;
    el.dataset.ctrlEnterAttached = "true";
    console.log(LOG, "Attached to:", el.tagName, el.id || el.className);

    el.addEventListener(
      "keydown",
      (e) => { handleKeyEvent(e, el); },
      true
    );

    el.addEventListener(
      "beforeinput",
      (e) => {
        if (!isCtrlEnterEnabled()) return;
        if (e.inputType !== "insertParagraph") return;
        if (e.isComposing) return;
        if (!e.cancelable) return;

        console.log(LOG, "beforeinput: insertParagraph intercepted");
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const targetRanges = getTargetRangesSafe(e);
        insertNewline(el, { targetRanges });
      },
      true
    );
  }

  let debounceTimer = null;
  const observer = new MutationObserver(() => {
    if (debounceTimer) return;
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      const el = getInputElement();
      if (el) attachHandler(el);
    }, 200);
  });

  function init() {
    console.log(LOG, "universal script loaded, URL:", location.href);
    const el = getInputElement();
    if (el) attachHandler(el);
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
