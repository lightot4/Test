const webhookInput = document.getElementById("webhookUrl");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("saveBtn");
const crawlBtn = document.getElementById("crawlBtn");
const scopeModeEl = document.getElementById("scopeMode");

function setStatus(message) {
  statusEl.textContent = message;
}

async function loadSettings() {
  const { webhookUrl = "", scopeMode = "visible" } = await chrome.storage.sync.get([
    "webhookUrl",
    "scopeMode"
  ]);
  webhookInput.value = webhookUrl;
  scopeModeEl.value = scopeMode;
}

async function saveSettings() {
  const webhookUrl = webhookInput.value.trim();
  const scopeMode = scopeModeEl.value;
  if (!webhookUrl) {
    setStatus("Web App URL을 입력하세요.");
    return;
  }

  await chrome.storage.sync.set({ webhookUrl, scopeMode });
  setStatus("설정 저장 완료");
}

async function startCrawl() {
  const webhookUrl = webhookInput.value.trim();
  const scopeMode = scopeModeEl.value;
  if (!webhookUrl) {
    setStatus("Web App URL이 필요합니다.");
    return;
  }

  crawlBtn.disabled = true;
  setStatus("수집 요청 중...");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus("활성 탭을 찾을 수 없습니다.");
    crawlBtn.disabled = false;
    return;
  }

  chrome.runtime.sendMessage(
    {
      type: "START_CRAWL",
      tabId: tab.id,
      webhookUrl,
      scopeMode
    },
    (response) => {
      if (chrome.runtime.lastError) {
        setStatus(`오류: ${chrome.runtime.lastError.message}`);
        crawlBtn.disabled = false;
        return;
      }

      if (!response) {
        setStatus("응답 없음");
        crawlBtn.disabled = false;
        return;
      }

      if (response.ok) {
        setStatus(
          `완료\n수집: ${response.totalCount}건\n전송: ${response.sentCount}건\n중복제거 후: ${response.uniqueCount}건`
        );
      } else {
        setStatus(`실패: ${response.error}`);
      }
      crawlBtn.disabled = false;
    }
  );
}

saveBtn.addEventListener("click", saveSettings);
crawlBtn.addEventListener("click", startCrawl);

loadSettings().catch((error) => {
  setStatus(`초기화 오류: ${error.message}`);
});
