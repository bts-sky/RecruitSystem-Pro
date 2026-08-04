(() => {
  const SESSION_KEY = "recruitAdminPasswordV300";
  const endpoint = String(window.RECRUIT_SYSTEM_CONFIG?.googleAppsScriptUrl || "").trim();
  const loginView = document.getElementById("loginView");
  const dashboardView = document.getElementById("dashboardView");
  const loginForm = document.getElementById("loginForm");
  const passwordInput = document.getElementById("password");
  const loginMessage = document.getElementById("loginMessage");
  const dashboardMessage = document.getElementById("dashboardMessage");
  const list = document.getElementById("applicantList");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const statusFilter = document.getElementById("statusFilter");
  const editDialog = document.getElementById("editDialog");
  const editForm = document.getElementById("editForm");
  let applicants = [];
  let activePassword = sessionStorage.getItem(SESSION_KEY) || "";
  let editingId = "";

  const EDIT_FIELDS = [
    ["성명", "성명"], ["휴대전화", "휴대전화"], ["생년월일", "생년월일"], ["만 나이", "만 나이"],
    ["성별", "성별"], ["국적", "국적"], ["비자", "비자"], ["주소", "주소"],
    ["비상연락처", "비상연락처"], ["희망근무형태", "희망근무형태"], ["근무형태", "근무형태"],
    ["잔업가능", "잔업가능"], ["특근가능", "특근가능"], ["출퇴근방법", "출퇴근방법"],
    ["통근버스탑승위치", "통근버스 탑승위치"], ["희망고용방식", "희망고용방식"],
    ["출근가능일", "출근가능일"], ["건강상태", "건강상태"], ["병력및특이사항", "병력 및 특이사항"],
    ["학교명", "학교명"], ["졸업년도", "졸업년도"], ["키", "키"], ["몸무게", "몸무게"],
    ["은행", "은행"], ["계좌번호", "계좌번호"], ["예금주", "예금주"],
    ["상태", "처리상태"], ["담당자 메모", "담당자 메모"]
  ];

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!endpoint) return reject(new Error("Apps Script 주소가 설정되지 않았습니다."));
      const callback = `recruitAdminCallback_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const script = document.createElement("script");
      const timeout = setTimeout(() => cleanup(new Error("서버 응답 시간이 초과되었습니다.")), 20000);
      function cleanup(error, data) {
        clearTimeout(timeout); delete window[callback]; script.remove();
        error ? reject(error) : resolve(data);
      }
      window[callback] = (data) => cleanup(null, data);
      script.onerror = () => cleanup(new Error("서버 연결에 실패했습니다."));
      script.src = `${endpoint}?${new URLSearchParams({...params, callback})}`;
      document.head.appendChild(script);
    });
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (ch) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  }

  function showDashboard() { loginView.hidden = true; dashboardView.hidden = false; }
  function showLogin() { dashboardView.hidden = true; loginView.hidden = false; passwordInput.focus(); }

  function updateStats(data) {
    document.getElementById("totalCount").textContent = data.length;
    document.getElementById("newCount").textContent = data.filter(x => ["신규", "신규지원"].includes(x["처리상태"])).length;
    document.getElementById("interviewCount").textContent = data.filter(x => x["처리상태"] === "면접예정").length;
    document.getElementById("passCount").textContent = data.filter(x => x["처리상태"] === "합격").length;
  }

  function render() {
    const q = searchInput.value.trim().toLowerCase();
    const status = statusFilter.value;
    const filtered = applicants.filter((item) => {
      const haystack = [item["성명"], item["연락처"], item["접수번호"], item["주소"]].join(" ").toLowerCase();
      return (!q || haystack.includes(q)) && (!status || item["처리상태"] === status);
    });
    list.innerHTML = filtered.map((a) => `
      <article class="applicant-card">
        <div class="card-head">
          <div><div class="name">${escapeHtml(a["성명"] || "이름 없음")}</div><div class="receipt">${escapeHtml(a["접수번호"])}</div></div>
          <span class="status" data-status="${escapeHtml(a["처리상태"])}">${escapeHtml(a["처리상태"] || "신규지원")}</span>
        </div>
        <div class="date">접수 ${escapeHtml(a["접수일시"])}</div>
        <div class="details">
          <div class="detail"><span>연락처</span><a href="tel:${escapeHtml((a["연락처"] || "").replace(/[^0-9+]/g,""))}">${escapeHtml(a["연락처"] || "-")}</a></div>
          <div class="detail"><span>나이 / 성별</span><strong>${escapeHtml(a["나이"] || "-")} / ${escapeHtml(a["성별"] || "-")}</strong></div>
          <div class="detail"><span>국적 / 비자</span><strong>${escapeHtml(a["국적"] || "-")} / ${escapeHtml(a["비자"] || "-")}</strong></div>
          <div class="detail"><span>출근 가능일</span><strong>${escapeHtml(a["출근 가능일"] || "-")}</strong></div>
          <div class="detail"><span>근무형태</span><strong>${escapeHtml(a["가능 근무형태"] || "-")}</strong></div>
          <div class="detail"><span>고용 방식</span><strong>${escapeHtml(a["희망 고용 방식"] || "-")}</strong></div>
        </div>
        <div class="memo"><strong>주소</strong> ${escapeHtml(a["주소"] || "-")}<br><strong>메모</strong> ${escapeHtml(a["담당자 메모"] || "없음")}</div>
        <div class="card-actions">
          <button class="secondary edit-button" data-id="${escapeHtml(a["접수번호"])}">내용 수정</button>
          ${a["지원서PDF"] ? `<a class="secondary link-button" target="_blank" rel="noopener" href="${escapeHtml(a["지원서PDF"])}">PDF 열기</a>` : ""}
        </div>
      </article>`).join("");
    emptyState.hidden = filtered.length !== 0;
    list.querySelectorAll(".edit-button").forEach(btn => btn.addEventListener("click", () => openEdit(btn.dataset.id)));
  }

  function openEdit(id) {
    const a = applicants.find(x => x["접수번호"] === id);
    if (!a) return;
    editingId = id;
    document.getElementById("editTitle").textContent = `${a["성명"] || "지원자"} · ${id}`;
    const fields = document.getElementById("editFields");
    fields.innerHTML = EDIT_FIELDS.map(([key, label]) => {
      const long = ["주소", "병력및특이사항", "담당자 메모"].includes(key);
      return `<label class="edit-field ${long ? "wide" : ""}"><span>${escapeHtml(label)}</span>${long
        ? `<textarea name="${escapeHtml(key)}" rows="3">${escapeHtml(a[key] || "")}</textarea>`
        : `<input name="${escapeHtml(key)}" value="${escapeHtml(a[key] || "")}">`}</label>`;
    }).join("");
    editDialog.showModal();
  }

  async function loadApplicants(password, isLogin = false) {
    dashboardMessage.textContent = "지원자 목록을 불러오는 중입니다...";
    try {
      const data = await jsonp({action:"adminList", password});
      if (!data.ok) throw new Error(data.message || "조회에 실패했습니다.");
      activePassword = password; sessionStorage.setItem(SESSION_KEY, password);
      applicants = Array.isArray(data.applicants) ? data.applicants : [];
      showDashboard(); updateStats(applicants); render();
      dashboardMessage.textContent = `총 ${applicants.length}명의 지원자를 불러왔습니다.`;
      loginMessage.textContent = "";
    } catch (error) {
      sessionStorage.removeItem(SESSION_KEY); activePassword = "";
      if (isLogin) loginMessage.textContent = error.message;
      else { dashboardMessage.textContent = error.message; showLogin(); }
    }
  }

  loginForm.addEventListener("submit", (e) => { e.preventDefault(); loginMessage.textContent="확인 중..."; loadApplicants(passwordInput.value, true); });
  document.getElementById("togglePassword").addEventListener("click", () => { passwordInput.type = passwordInput.type === "password" ? "text" : "password"; });
  document.getElementById("logoutButton").addEventListener("click", () => { sessionStorage.removeItem(SESSION_KEY); activePassword=""; passwordInput.value=""; showLogin(); });
  document.getElementById("refreshButton").addEventListener("click", () => loadApplicants(activePassword));
  document.getElementById("cancelEdit").addEventListener("click", () => editDialog.close());
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const saveButton = document.getElementById("saveEdit");
    saveButton.disabled = true; saveButton.textContent = "저장 중...";
    try {
      const updates = Object.fromEntries(new FormData(editForm).entries());
      const data = await jsonp({action:"adminUpdate", password:activePassword, applicationId:editingId, updates:JSON.stringify(updates)});
      if (!data.ok) throw new Error(data.message || "수정에 실패했습니다.");
      applicants = Array.isArray(data.applicants) ? data.applicants : applicants;
      updateStats(applicants); render(); editDialog.close();
      dashboardMessage.textContent = data.message || "수정되었습니다.";
    } catch (error) {
      alert(error.message);
    } finally {
      saveButton.disabled = false; saveButton.textContent = "수정 내용 저장";
    }
  });
  searchInput.addEventListener("input", render); statusFilter.addEventListener("change", render);
  if (activePassword) loadApplicants(activePassword); else showLogin();
})();
