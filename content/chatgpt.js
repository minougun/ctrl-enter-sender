// ChatGPT用 content script (モバイル対応)

(function () {
  const LOG = "[CtrlEnter]";

  function findEditor() {
    const selectors = [
      "#prompt-textarea",
      'div[contenteditable="true"][id="prompt-textarea"]',
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][role="textbox"]',
      'textarea[data-id="root"]',
      'textarea[placeholder]',
      'div[contenteditable="true"]',
      "textarea",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function attachHandler(editor) {
    if (!editor || editor.dataset.ctrlEnterAttached) return;
    editor.dataset.ctrlEnterAttached = "true";
    console.log(LOG, "Attached to:", editor.tagName, editor.id || editor.className);

    editor.addEventListener(
      "keydown",
      (e) => {
        console.log(LOG, "keydown:", e.key, "code:", e.code,
          "ctrl:", e.ctrlKey, "composing:", e.isComposing);
        handleKeyEvent(e, editor);
      },
      true
    );

    // モバイルキーボードは keydown を発火しない場合がある
    editor.addEventListener(
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
        insertNewline(editor, { targetRanges });
      },
      true
    );
  }

  const observer = new MutationObserver(() => {
    const el = findEditor();
    if (el) attachHandler(el);
  });

  function init() {
    console.log(LOG, "ChatGPT content script loaded, URL:", location.href);
    const el = findEditor();
    if (el) {
      attachHandler(el);
    } else {
      console.log(LOG, "Editor not found yet, waiting...");
    }
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
