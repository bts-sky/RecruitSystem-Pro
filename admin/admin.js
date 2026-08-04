(() => {
  const SESSION_KEY = "recruitAdminPasswordV10161";
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
  const editModal = document.getElementById("editModal");
  const editForm = document.getElementById("editForm");
  const editMessage = document.getElementById("editMessage");
  const editSaveButton = document.getElementById("editSaveButton");
  let applicants = [];
  let activePassword = sessionStorage.getItem(SESSION_KEY) || "";

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      if (!endpoint) return reject(new Error("Apps Script 주소가 설정되지 않았습니다."));
      const callback = `recruitAdminCallback_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const script = document.createElement("script");
      const timeout = setTimeout(() => cleanup(new Error("서버 응답 시간이 초과되었습니다.")), 15000);
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
    document.getElementById("newCount").textContent = data.filter(x => x["처리상태"] === "신규").length;
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
          <span class="status" data-status="${escapeHtml(a["처리상태"])}">${escapeHtml(a["처리상태"] || "신규")}</span>
        </div>
        <div class="date">접수 ${escapeHtml(a["접수일시"])}</div>
        <div class="details">
          <div class="detail"><span>연락처</span><a href="tel:${escapeHtml(a["연락처"].replace(/[^0-9+]/g,""))}">${escapeHtml(a["연락처"] || "-")}</a></div>
          <div class="detail"><span>나이 / 성별</span><strong>${escapeHtml(a["나이"] || "-")} / ${escapeHtml(a["성별"] || "-")}</strong></div>
          <div class="detail"><span>국적 / 비자</span><strong>${escapeHtml(a["국적"] || "-")} / ${escapeHtml(a["비자"] || "-")}</strong></div>
          <div class="detail"><span>출근 가능일</span><strong>${escapeHtml(a["출근 가능일"] || "-")}</strong></div>
          <div class="detail"><span>근무형태</span><strong>${escapeHtml(a["가능 근무형태"] || "-")}</strong></div>
          <div class="detail"><span>고용 방식</span><strong>${escapeHtml(a["희망 고용 방식"] || "-")}</strong></div>
        </div>
        <div class="memo"><strong>주소</strong> ${escapeHtml(a["주소"] || "-")}<br><strong>메모</strong> ${escapeHtml(a["담당자 메모"] || "없음")}</div>
        <div class="card-actions"><button type="button" class="secondary edit-button" data-uuid="${escapeHtml(a["UUID"] || "")}" data-receipt="${escapeHtml(a["접수번호"] || "")}">내용 수정</button></div>
      </article>`).join("");
    emptyState.hidden = filtered.length !== 0;
  }

  function setEditValue(id, value) {
    const element = document.getElementById(id);
    if (element) element.value = value || "";
  }

  function openEditModal(applicant) {
    setEditValue("editUuid", applicant["UUID"]);
    setEditValue("editReceipt", applicant["접수번호"]);
    setEditValue("editName", applicant["성명"]);
    setEditValue("editPhone", applicant["연락처"]);
    setEditValue("editBirthDate", applicant["생년월일"]);
    setEditValue("editAge", applicant["나이"]);
    setEditValue("editGender", applicant["성별"]);
    setEditValue("editAddress", applicant["주소"]);
    setEditValue("editEmergencyPhone", applicant["비상연락처"]);
    setEditValue("editHealthStatus", applicant["건강상태"]);
    setEditValue("editMedicalHistory", applicant["병력및특이사항"]);
    setEditValue("editWorkType", applicant["가능 근무형태"]);
    setEditValue("editCommuteType", applicant["출퇴근방법"]);
    setEditValue("editShuttleLocation", applicant["통근버스탑승위치"]);
    setEditValue("editAvailableStartDate", applicant["출근 가능일"]);
    setEditValue("editWorkConditionNote", applicant["추가요청사항"]);
    editMessage.textContent = "";
    editModal.hidden = false;
    editModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    document.getElementById("editName").focus();
  }

  function closeEditModal() {
    editModal.hidden = true;
    editModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
  }

  function editPayload() {
    return {
      action: "adminUpdate",
      password: activePassword,
      uuid: document.getElementById("editUuid").value,
      receipt: document.getElementById("editReceipt").value,
      name: document.getElementById("editName").value.trim(),
      phone: document.getElementById("editPhone").value.trim(),
      birthDate: document.getElementById("editBirthDate").value,
      age: document.getElementById("editAge").value.trim(),
      gender: document.getElementById("editGender").value,
      address: document.getElementById("editAddress").value.trim(),
      emergencyPhone: document.getElementById("editEmergencyPhone").value.trim(),
      healthStatus: document.getElementById("editHealthStatus").value,
      medicalHistory: document.getElementById("editMedicalHistory").value.trim(),
      workType: document.getElementById("editWorkType").value,
      commuteType: document.getElementById("editCommuteType").value,
      shuttleLocation: document.getElementById("editShuttleLocation").value.trim(),
      availableStartDate: document.getElementById("editAvailableStartDate").value,
      workConditionNote: document.getElementById("editWorkConditionNote").value.trim()
    };
  }

  async function saveApplicantEdit() {
    editSaveButton.disabled = true;
    editMessage.textContent = "수정 내용을 저장하는 중입니다...";
    try {
      const data = await jsonp(editPayload());
      if (!data.ok) throw new Error(data.message || "수정 저장에 실패했습니다.");
      editMessage.textContent = data.message || "수정되었습니다.";
      await loadApplicants(activePassword);
      closeEditModal();
      dashboardMessage.textContent = "지원자 내용이 수정되었습니다.";
    } catch (error) {
      editMessage.textContent = error.message;
    } finally {
      editSaveButton.disabled = false;
    }
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
  searchInput.addEventListener("input", render); statusFilter.addEventListener("change", render);
  list.addEventListener("click", (event) => {
    const button = event.target.closest(".edit-button");
    if (!button) return;
    const applicant = applicants.find((item) =>
      (button.dataset.uuid && item["UUID"] === button.dataset.uuid) ||
      (!button.dataset.uuid && item["접수번호"] === button.dataset.receipt)
    );
    if (applicant) openEditModal(applicant);
  });
  editForm.addEventListener("submit", (event) => { event.preventDefault(); saveApplicantEdit(); });
  document.getElementById("editCloseButton").addEventListener("click", closeEditModal);
  document.getElementById("editCancelButton").addEventListener("click", closeEditModal);
  editModal.addEventListener("click", (event) => { if (event.target.matches("[data-close-edit]")) closeEditModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !editModal.hidden) closeEditModal(); });
  if (activePassword) loadApplicants(activePassword); else showLogin();
})();
