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


  function encodeContractData(data) {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    let binary = ""; bytes.forEach((b)=>{ binary += String.fromCharCode(b); });
    return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
  }
  function buildContractLink(applicant) {
    const url = new URL("../employment-contract.html", window.location.href);
    url.searchParams.set("mode","sign");
    url.hash = "contract=" + encodeContractData({receipt:applicant["접수번호"]||"",name:applicant["성명"]||"",phone:applicant["연락처"]||"",address:applicant["주소"]||"",startDate:applicant["출근 가능일"]||""});
    return url.toString();
  }
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const area=document.createElement("textarea"); area.value=text; area.style.position="fixed"; area.style.opacity="0"; document.body.appendChild(area); area.select(); document.execCommand("copy"); area.remove();
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
        <div class="card-actions">
          ${a["지원서PDF"]
            ? `<a class="pdf-button" href="${escapeHtml(a["지원서PDF"])}" target="_blank" rel="noopener noreferrer">PDF 보기</a>`
            : `<span class="pdf-button disabled" aria-disabled="true">PDF 없음</span>`}
          <button type="button" class="secondary edit-button" data-uuid="${escapeHtml(a["UUID"] || "")}" data-receipt="${escapeHtml(a["접수번호"] || "")}">내용 수정</button>
          <button type="button" class="danger delete-button" data-uuid="${escapeHtml(a["UUID"] || "")}" data-receipt="${escapeHtml(a["접수번호"] || "")}" data-name="${escapeHtml(a["성명"] || "지원자")}">삭제</button>
        </div>
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


  async function deleteApplicant(applicant) {
    const name = applicant["성명"] || "지원자";
    const receipt = applicant["접수번호"] || "접수번호 없음";

    if (!window.confirm(`${name} (${receipt}) 지원자를 삭제하시겠습니까?\n\n스프레드시트 행이 삭제되고 지원자 폴더는 Drive 휴지통으로 이동합니다.`)) return;
    if (!window.confirm("정말 삭제하시겠습니까? 이 작업은 관리자 목록에서 즉시 제거됩니다.")) return;

    dashboardMessage.textContent = `${name} 지원자를 삭제하는 중입니다...`;
    try {
      const data = await jsonp({
        action: "adminDelete",
        password: activePassword,
        uuid: applicant["UUID"] || "",
        receipt: applicant["접수번호"] || ""
      });
      if (!data.ok) throw new Error(data.message || "삭제에 실패했습니다.");
      await loadApplicants(activePassword);
      dashboardMessage.textContent = data.message || "지원자가 삭제되었습니다.";
    } catch (error) {
      dashboardMessage.textContent = error.message;
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
    const button = event.target.closest(".edit-button, .delete-button");
    if (!button) return;
    const applicant = applicants.find((item) =>
      (button.dataset.uuid && item["UUID"] === button.dataset.uuid) ||
      (!button.dataset.uuid && item["접수번호"] === button.dataset.receipt)
    );
    if (!applicant) return;
    if (button.classList.contains("delete-button")) deleteApplicant(applicant);
    else openEditModal(applicant);
  });
  editForm.addEventListener("submit", (event) => { event.preventDefault(); saveApplicantEdit(); });
  document.getElementById("editCloseButton").addEventListener("click", closeEditModal);
  document.getElementById("editCancelButton").addEventListener("click", closeEditModal);
  editModal.addEventListener("click", (event) => { if (event.target.matches("[data-close-edit]")) closeEditModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !editModal.hidden) closeEditModal(); });
  if (activePassword) loadApplicants(activePassword); else showLogin();

  list.addEventListener("click", async (event) => {
    const b=event.target.closest(".contract-link-button"); if(!b) return;
    const a=applicants.find(x=>String(x["접수번호"]||"")===String(b.dataset.receipt||"")); if(!a) return;
    try { await copyText(buildContractLink(a)); dashboardMessage.textContent=`${a["성명"]||"지원자"}님의 입사자용 근로계약 링크를 복사했습니다.`; b.textContent="복사 완료"; setTimeout(()=>b.textContent="계약링크 복사",1400); }
    catch(e){ dashboardMessage.textContent="링크 복사에 실패했습니다."; }
  });
})();
