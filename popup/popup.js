const toggle = document.getElementById("toggle");
const statusText = document.getElementById("status-text");

// 初期状態を読み込み
browser.storage.local.get("enabled").then((result) => {
  const enabled = result.enabled !== false;
  toggle.checked = enabled;
  statusText.textContent = enabled ? "有効" : "無効";
});

// トグル変更
toggle.addEventListener("change", () => {
  const enabled = toggle.checked;
  browser.storage.local.set({ enabled });
  statusText.textContent = enabled ? "有効" : "無効";
});
