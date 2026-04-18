const webhookInput = document.getElementById("webhookUrl");
const scopeModeEl = document.getElementById("scopeMode");
const saveBtn = document.getElementById("saveBtn");
const crawlBtn = document.getElementById("crawlBtn");
const summaryEl = document.getElementById("summary");
const logBody = document.getElementById("logBody");

function setSummary(message, className = "") {
  summaryEl.textContent = message;
  summaryEl.className = className;
}

function appendLog({ pageNumber, validCount, uniqueCount, status }) {
  const row = document.createElement("tr");
  row.innerHTML = `
    <td>${pageNumber ?? "-"}</td>
    <td>${validCount ?? 0}</td>
    <td>${uniqueCount ?? 0}</td>
    <td>${status || ""}</td>
  `;
  logBody.appendChild(row);
}

function clearLogs() {
  logBody.innerHTML = "";
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
    setSummary("Web App URL을 입력하세요.", "warn");
    return;
  }

  await chrome.storage.sync.set({ webhookUrl, scopeMode });
  setSummary("설정 저장 완료", "ok");
}

async function getActiveTabId() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error("활성 탭을 찾을 수 없습니다.");
  }
  return tab.id;
}

async function startCrawl() {
  const webhookUrl = webhookInput.value.trim();
  const scopeMode = scopeModeEl.value;

  if (!webhookUrl) {
    setSummary("Web App URL이 필요합니다.", "warn");
    return;
  }

  clearLogs();
  crawlBtn.disabled = true;
  setSummary("수집 시작...", "");

  try {
    const tabId = await getActiveTabId();

    chrome.runtime.sendMessage(
      {
        type: "START_CRAWL",
        tabId,
        webhookUrl,
        scopeMode
      },
      (response) => {
        crawlBtn.disabled = false;

        if (chrome.runtime.lastError) {
          setSummary(`실패: ${chrome.runtime.lastError.message}`, "error");
          return;
        }

        if (!response?.ok) {
          setSummary(`실패: ${response?.error || "응답 없음"}`, "error");
          return;
        }

        setSummary(
          `완료 · 총 ${response.totalCount}건 / 유니크 ${response.uniqueCount}건 / 전송 ${response.sentCount}건`,
          "ok"
        );
      }
    );
  } catch (error) {
    crawlBtn.disabled = false;
    setSummary(`실패: ${error.message}`, "error");
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type !== "CRAWL_PROGRESS") {
    return;
  }

  appendLog({
    pageNumber: message.pageNumber,
    validCount: message.validCount,
    uniqueCount: message.uniqueCount,
    status: message.status
  });

  setSummary(
    `진행중 · 페이지 ${message.pageNumber ?? "-"} / 현재 ${message.validCount}건 / 누적 유니크 ${message.uniqueCount}건`,
    ""
  );
});

saveBtn.addEventListener("click", saveSettings);
crawlBtn.addEventListener("click", startCrawl);
loadSettings().catch((error) => setSummary(`초기화 오류: ${error.message}`, "error"));
