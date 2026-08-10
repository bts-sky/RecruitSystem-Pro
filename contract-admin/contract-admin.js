(() => {
  const SESSION_KEY = "contractAdminPasswordV1";
  const endpoint = String(window.RECRUIT_SYSTEM_CONFIG?.contractAppsScriptUrl || "").trim();
  const loginView = document.getElementById("loginView");
  const dashboardView = document.getElementById("dashboardView");
  const loginForm = document.getElementById("loginForm");
  const passwordInput = document.getElementById("password");
  const loginMessage = document.getElementById("loginMessage");
  const dashboardMessage = document.getElementById("dashboardMessage");
  const list = document.getElementById("contractList");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  let records = [];
  let activePassword = sessionStorage.getItem(SESSION_KEY) || "";

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!endpoint) return reject(new Error("근로계약 Apps Script 주소가 설정되지 않았습니다."));
      const callback = `contractAdmin_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timeout = setTimeout(() => cleanup(new Error("서버 응답 시간이 초과되었습니다.")), 15000);
      function cleanup(error, data) {
        clearTimeout(timeout);
        delete window[callback];
        script.remove();
        error ? reject(error) : resolve(data);
      }
      window[callback] = data => cleanup(null, data);
      script.onerror = () => cleanup(new Error("근로계약 서버에 연결하지 못했습니다."));
      const query = new URLSearchParams({...params, callback});
      script.src = `${endpoint}${endpoint.includes("?") ? "&" : "?"}${query}`;
      document.head.appendChild(script);
    });
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  }

  function showLogin() {
    loginView.hidden = false;
    dashboardView.hidden = true;
  }

  function showDashboard() {
    loginView.hidden = true;
    dashboardView.hidden = false;
  }

  function updateStats() {
    document.getElementById("totalCount").textContent = records.length;
    document.getElementById("waitingCount").textContent = records.filter(r => r.status !== "완료").length;
    document.getElementById("completedCount").textContent = records.filter(r => r.status === "완료").length;
    document.getElementById("pdfCount").textContent = records.filter(r => r.pdfUrl).length;
  }

  function filteredRecords() {
    const q = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    return records.filter(r => {
      const hay = `${r.name || ""} ${r.adminMemo || ""} ${r.phone || ""} ${r.receipt || ""}`.toLowerCase();
      return (!q || hay.includes(q)) && (!status || r.status === status);
    });
  }

  function formatDate(value) {
    if (!value) return "-";
    return esc(value);
  }

  function render() {
    const rows = filteredRecords();
    emptyState.hidden = rows.length > 0;
    list.innerHTML = rows.map(r => {
      const completed = r.status === "완료";
      const pdfButton = r.pdfUrl
        ? `<a class="pdf-button" href="${esc(r.pdfUrl)}" target="_blank" rel="noopener">계약 PDF 보기</a>`
        : `<span class="pdf-button disabled">PDF 없음</span>`;
      return `
        <article class="contract-card">
          <div class="card-head">
            <div>
              <div class="name-row">
                <div class="name">${esc(r.name || "이름 없음")}</div>
                <div class="memo-editor">
                  <span class="memo-paren">(</span>
                  <input class="memo-input" data-receipt="${esc(r.receipt || "")}" value="${esc(r.adminMemo || "")}" maxlength="120" placeholder="관리자 메모">
                  <span class="memo-paren">)</span>
                  <button type="button" class="memo-save" data-receipt="${esc(r.receipt || "")}">저장</button>
                </div>
              </div>
              <div class="receipt">${esc(r.receipt || "접수번호 없음")}</div>
            </div>
            <span class="status" data-status="${esc(r.status || "대기")}">${esc(r.status || "대기")}</span>
          </div>
          <div class="details">
            <div class="detail"><span>연락처</span><strong>${esc(r.phone || "-")}</strong></div>
            <div class="detail"><span>입사일</span><strong>${formatDate(r.startDate)}</strong></div>
            <div class="detail"><span>작성일</span><strong>${formatDate(r.writtenDate)}</strong></div>
            <div class="detail"><span>완료일시</span><strong>${formatDate(r.completedAt)}</strong></div>
          </div>
          <div class="card-actions">
            ${pdfButton}
            <span class="completion ${completed ? "done" : "waiting"}">${completed ? "계약 작성 완료" : "계약 작성 대기"}</span>
          </div>
        </article>`;
    }).join("");
  }

  async function saveMemo(receipt, input, button) {
    if (!receipt || !input || !button) return;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = "저장중";
    try {
      const data = await jsonp({action:"adminContractMemoSave", password:activePassword, receipt, memo:input.value.trim()});
      if (!data.ok) throw new Error(data.message || "메모 저장에 실패했습니다.");
      const record = records.find(r => r.receipt === receipt);
      if (record) record.adminMemo = data.memo || "";
      button.textContent = "저장됨";
      dashboardMessage.textContent = `${record?.name || receipt} 관리자 메모를 저장했습니다.`;
      setTimeout(() => { if (button.isConnected) button.textContent = original; }, 1200);
    } catch (error) {
      button.textContent = "재시도";
      dashboardMessage.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  async function loadContracts(password, isLogin = false) {
    dashboardMessage.textContent = "근로계약 목록을 불러오는 중입니다...";
    try {
      const data = await jsonp({action:"adminContractList", password});
      if (!data.ok) throw new Error(data.message || "근로계약 목록 조회에 실패했습니다.");
      activePassword = password;
      sessionStorage.setItem(SESSION_KEY, password);
      records = Array.isArray(data.contracts) ? data.contracts : [];
      updateStats();
      render();
      showDashboard();
      dashboardMessage.textContent = `총 ${records.length}건의 근로계약을 불러왔습니다.`;
      loginMessage.textContent = "";
    } catch (error) {
      if (isLogin) {
        loginMessage.textContent = error.message;
      } else {
        dashboardMessage.textContent = error.message;
        sessionStorage.removeItem(SESSION_KEY);
        activePassword = "";
        showLogin();
      }
    }
  }

  list.addEventListener("click", e => {
    const button = e.target.closest(".memo-save");
    if (!button) return;
    const receipt = button.dataset.receipt || "";
    const input = list.querySelector(`.memo-input[data-receipt="${CSS.escape(receipt)}"]`);
    saveMemo(receipt, input, button);
  });
  list.addEventListener("keydown", e => {
    if (e.key !== "Enter" || !e.target.classList.contains("memo-input")) return;
    e.preventDefault();
    const receipt = e.target.dataset.receipt || "";
    const button = list.querySelector(`.memo-save[data-receipt="${CSS.escape(receipt)}"]`);
    saveMemo(receipt, e.target, button);
  });

  loginForm.addEventListener("submit", e => {
    e.preventDefault();
    loginMessage.textContent = "확인 중...";
    loadContracts(passwordInput.value, true);
  });
  document.getElementById("togglePassword").addEventListener("click", () => {
    passwordInput.type = passwordInput.type === "password" ? "text" : "password";
  });
  document.getElementById("logoutButton").addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    activePassword = "";
    passwordInput.value = "";
    showLogin();
  });
  document.getElementById("refreshButton").addEventListener("click", () => loadContracts(activePassword));
  searchInput.addEventListener("input", render);
  statusFilter.addEventListener("change", render);

  if (activePassword) loadContracts(activePassword);
  else showLogin();
})();
