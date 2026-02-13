// Claude, Gemini, Perplexity, DeepSeek, Grok, GitHub Copilot, Phind 等
// contenteditable な入力欄を使うサイト用 (モバイル対応)

(function () {
  const LOG = "[CtrlEnter]";

  function getInputElement() {
    const selectors = [
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][aria-label]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea[placeholder]',
      'textarea#chat-input',
      'textarea[name="q"]',
      'textarea',
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

  const observer = new MutationObserver(() => {
    const el = getInputElement();
    if (el) attachHandler(el);
  });

  function init() {
    console.log(LOG, "contenteditable script loaded, URL:", location.href);
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
