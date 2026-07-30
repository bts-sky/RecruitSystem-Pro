document.addEventListener("DOMContentLoaded", () => {
  const STORAGE_KEY = "recruitSystemProDraftV109";
  const form = document.getElementById("applicationForm");
  const steps = [...document.querySelectorAll(".form-step")];

  const currentStepText = document.getElementById("currentStepText");
  const currentStepNumber = document.getElementById("currentStepNumber");
  const totalStepNumber = document.getElementById("totalStepNumber");
  const progressBarFill = document.getElementById("progressBarFill");

  const birthDate = document.getElementById("birthDate");
  const age = document.getElementById("age");
  const phone = document.getElementById("phone");
  const emergencyPhone = document.getElementById("emergencyPhone");
  const nationality = document.getElementById("nationality");
  const otherNationalityGroup = document.getElementById("otherNationalityGroup");
  const otherNationality = document.getElementById("otherNationality");
  const visaGroup = document.getElementById("visaGroup");
  const visa = document.getElementById("visa");
  const otherCommuteGroup = document.getElementById("otherCommuteGroup");
  const otherCommute = document.getElementById("otherCommute");
  const shuttleBoardingGroup = document.getElementById("shuttleBoardingGroup");
  const shuttleBoardingPlace = document.getElementById("shuttleBoardingPlace");
  const desiredSalaryGroup = document.getElementById("desiredSalaryGroup");
  const desiredSalary = document.getElementById("desiredSalary");
  const privacyConsent = document.getElementById("privacyConsent");
  const consentDetailButton = document.getElementById("consentDetailButton");
  const consentDetails = document.getElementById("consentDetails");
  const signatureCanvas = document.getElementById("signatureCanvas");
  const signaturePlaceholder = document.getElementById("signaturePlaceholder");
  const signatureData = document.getElementById("signatureData");
  const clearSignatureButton = document.getElementById("clearSignatureButton");
  const confirmApplicantName = document.getElementById("confirmApplicantName");
  const confirmApplicantPhone = document.getElementById("confirmApplicantPhone");
  const confirmApplicationDate = document.getElementById("confirmApplicationDate");
  const finalPreview = document.getElementById("finalPreview");
  const previewSignatureImage = document.getElementById("previewSignatureImage");
  const previewConsentStatus = document.getElementById("previewConsentStatus");
  const previewSignedAt = document.getElementById("previewSignedAt");
  const finalSubmitButton = document.getElementById("finalSubmitButton");

  let currentStep = 1;
  let saveTimer = null;
  let signatureContext = null;
  let isDrawingSignature = false;
  let hasSignature = false;
  let pendingSignatureRestore = "";

  const stepNames = {
    1: "기본정보",
    2: "학력 및 경력사항",
    3: "근무조건",
    4: "건강 및 추가정보",
    5: "개인정보 동의 및 서명",
    6: "최종 확인"
  };

  totalStepNumber.textContent = String(steps.length);

  function createCareerCards() {
    const container = document.getElementById("careerContainer");
    if (!container || container.children.length > 0) return;

    for (let i = 1; i <= 3; i += 1) {
      container.insertAdjacentHTML("beforeend", `
        <div class="career-card">
          <div class="career-card-header">
            <strong>경력 ${i}</strong>
            <span>${i === 1 ? "최근 경력" : "선택사항"}</span>
          </div>

          <div class="form-group">
            <label for="careerCompany${i}">회사명 또는 근무지</label>
            <input type="text" id="careerCompany${i}" name="careerCompany${i}"
                   placeholder="회사명 또는 근무지를 입력해 주세요" maxlength="50">
          </div>

          <div class="form-group">
            <label for="careerPeriod${i}">근무기간</label>
            <input type="text" id="careerPeriod${i}" name="careerPeriod${i}"
                   placeholder="예: 2024.01 ~ 2025.06" maxlength="30">
          </div>

          <div class="form-group">
            <label for="careerJob${i}">담당업무</label>
            <input type="text" id="careerJob${i}" name="careerJob${i}"
                   placeholder="예: 생산, 검사, 포장" maxlength="50">
          </div>

          <fieldset class="form-group">
            <legend>근무형태</legend>
            <div class="choice-grid two-columns">
              <label class="choice-card">
                <input type="radio" name="careerType${i}" value="아르바이트">
                <span>아르바이트</span>
              </label>
              <label class="choice-card">
                <input type="radio" name="careerType${i}" value="도급">
                <span>도급</span>
              </label>
              <label class="choice-card">
                <input type="radio" name="careerType${i}" value="계약직">
                <span>계약직</span>
              </label>
              <label class="choice-card">
                <input type="radio" name="careerType${i}" value="정규직">
                <span>정규직</span>
              </label>
            </div>
          </fieldset>

          <div class="form-group">
            <label for="careerReason${i}">퇴사사유</label>
            <input type="text" id="careerReason${i}" name="careerReason${i}"
                   placeholder="퇴사사유를 입력해 주세요" maxlength="50">
          </div>
        </div>
      `);
    }
  }

  function formatPhoneNumber(value) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  function formatDateInput(value) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
    return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  }

  function isValidDateValue(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  function calculateAge() {
    if (!birthDate.value) {
      age.value = "";
      return;
    }

    if (!isValidDateValue(birthDate.value)) {
      age.value = "";
      return;
    }

    const [birthYear, birthMonth, birthDay] = birthDate.value.split("-").map(Number);
    const birth = new Date(birthYear, birthMonth - 1, birthDay);
    const today = new Date();
    let calculatedAge = today.getFullYear() - birth.getFullYear();

    if (
      today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
    ) {
      calculatedAge -= 1;
    }

    age.value = Number.isFinite(calculatedAge) && calculatedAge >= 0 ? calculatedAge : "";
  }

  function updateNationalityFields() {
    if (nationality.value === "대한민국") {
      visaGroup.classList.add("hidden");
      visa.value = "";
    } else {
      visaGroup.classList.remove("hidden");
    }

    if (nationality.value === "기타") {
      otherNationalityGroup.classList.remove("hidden");
      otherNationality.required = true;
    } else {
      otherNationalityGroup.classList.add("hidden");
      otherNationality.required = false;
      otherNationality.value = "";
    }
  }

  function updateConditionalFields() {
    const commute = form.querySelector('input[name="commuteType"]:checked')?.value;
    const salary = form.querySelector('input[name="salaryType"]:checked')?.value;

    if (commute === "기타") {
      otherCommuteGroup.classList.remove("hidden");
    } else {
      otherCommuteGroup.classList.add("hidden");
      otherCommute.value = "";
    }

    if (commute === "통근버스") {
      shuttleBoardingGroup.classList.remove("hidden");
      shuttleBoardingPlace.required = true;
    } else {
      shuttleBoardingGroup.classList.add("hidden");
      shuttleBoardingPlace.required = false;
      shuttleBoardingPlace.value = "";
      setError("shuttleBoardingPlaceError");
    }

    if (salary === "직접 입력") {
      desiredSalaryGroup.classList.remove("hidden");
    } else {
      desiredSalaryGroup.classList.add("hidden");
      desiredSalary.value = "";
    }
  }

  function formatApplicationDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function updateApplicantConfirmation() {
    confirmApplicantName.textContent = document.getElementById("koreanName").value.trim() || "-";
    confirmApplicantPhone.textContent = phone.value.trim() || "-";
    confirmApplicationDate.textContent = formatApplicationDate();
  }

  function setSignatureState(signed) {
    hasSignature = signed;
    signaturePlaceholder.classList.toggle("hidden", signed);
    if (!signed) signatureData.value = "";
  }

  function resizeSignatureCanvas(preserve = true) {
    if (!signatureCanvas) return;

    const oldImage = preserve && hasSignature ? signatureCanvas.toDataURL("image/png") : "";
    const rect = signatureCanvas.getBoundingClientRect();
    const ratio = Math.max(window.devicePixelRatio || 1, 1);

    signatureCanvas.width = Math.max(Math.floor(rect.width * ratio), 1);
    signatureCanvas.height = Math.max(Math.floor(rect.height * ratio), 1);

    signatureContext = signatureCanvas.getContext("2d");
    signatureContext.setTransform(ratio, 0, 0, ratio, 0, 0);
    signatureContext.lineWidth = 2.4;
    signatureContext.lineCap = "round";
    signatureContext.lineJoin = "round";
    signatureContext.strokeStyle = "#172033";

    const imageToRestore = pendingSignatureRestore || oldImage;
    if (imageToRestore) {
      const image = new Image();
      image.onload = () => {
        signatureContext.drawImage(image, 0, 0, rect.width, rect.height);
        setSignatureState(true);
        signatureData.value = imageToRestore;
        pendingSignatureRestore = "";
      };
      image.src = imageToRestore;
    }
  }

  function signaturePoint(event) {
    const rect = signatureCanvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function beginSignature(event) {
    event.preventDefault();
    if (!signatureContext) resizeSignatureCanvas(false);
    isDrawingSignature = true;
    const point = signaturePoint(event);
    signatureContext.beginPath();
    signatureContext.moveTo(point.x, point.y);
    signatureCanvas.setPointerCapture?.(event.pointerId);
    setError("signatureError");
  }

  function drawSignature(event) {
    if (!isDrawingSignature || !signatureContext) return;
    event.preventDefault();
    const point = signaturePoint(event);
    signatureContext.lineTo(point.x, point.y);
    signatureContext.stroke();
    setSignatureState(true);
  }

  function endSignature(event) {
    if (!isDrawingSignature) return;
    event.preventDefault();
    isDrawingSignature = false;
    signatureContext?.closePath();
    if (hasSignature) {
      signatureData.value = signatureCanvas.toDataURL("image/png");
      scheduleSave();
    }
  }

  function clearSignature() {
    if (!signatureContext) resizeSignatureCanvas(false);
    const rect = signatureCanvas.getBoundingClientRect();
    signatureContext.clearRect(0, 0, rect.width, rect.height);
    setSignatureState(false);
    setError("signatureError");
    scheduleSave();
  }

  function fieldValue(id, fallback = "미입력") {
    const element = document.getElementById(id);
    const value = element?.value?.trim();
    return value || fallback;
  }

  function selectedValue(name, fallback = "미선택") {
    return form.querySelector(`[name="${name}"]:checked`)?.value || fallback;
  }

  function selectedValues(name, fallback = "미선택") {
    const values = [...form.querySelectorAll(`[name="${name}"]:checked`)].map((item) => item.value);
    return values.length ? values.join(", ") : fallback;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function previewRow(label, value) {
    const safeValue = escapeHtml(value || "미입력");
    const emptyClass = value === "미입력" || value === "미선택" || !value ? " preview-empty" : "";
    return `<div class="preview-row"><dt>${escapeHtml(label)}</dt><dd class="${emptyClass.trim()}">${safeValue}</dd></div>`;
  }

  function previewSection(title, rows) {
    return `
      <section class="preview-section">
        <div class="preview-card-heading"><h3>${escapeHtml(title)}</h3></div>
        <dl class="preview-list">${rows.join("")}</dl>
      </section>`;
  }

  function renderFinalPreview() {
    if (!finalPreview) return;

    const nationalityText = nationality.value === "기타"
      ? fieldValue("otherNationality")
      : fieldValue("nationality", "미선택");
    const commuteType = selectedValue("commuteType");
    let commuteDetail = commuteType;
    if (commuteType === "통근버스") commuteDetail += ` / 탑승 희망 장소: ${fieldValue("shuttleBoardingPlace")}`;
    if (commuteType === "기타") commuteDetail += ` / ${fieldValue("otherCommute")}`;

    const salaryType = selectedValue("salaryType");
    const salaryText = salaryType === "직접 입력"
      ? `${Number(fieldValue("desiredSalary", "0")).toLocaleString("ko-KR")}원`
      : salaryType;

    const sections = [];
    sections.push(previewSection("기본정보", [
      previewRow("성명", fieldValue("koreanName")),
      previewRow("영문 성명", fieldValue("englishName")),
      previewRow("휴대전화", fieldValue("phone")),
      previewRow("생년월일", fieldValue("birthDate")),
      previewRow("나이", age.value ? `만 ${age.value}세` : "미입력"),
      previewRow("성별", selectedValue("gender")),
      previewRow("국적", nationalityText),
      previewRow("비자", nationality.value && nationality.value !== "대한민국" ? fieldValue("visa", "미선택") : "해당 없음"),
      previewRow("결혼 여부", selectedValue("maritalStatus")),
      previewRow("현재 주소", fieldValue("address")),
      previewRow("비상연락처", fieldValue("emergencyPhone")),
      previewRow("비상연락처 관계", fieldValue("emergencyRelation"))
    ]));

    sections.push(previewSection("학력사항", [
      previewRow("졸업년도", fieldValue("graduationYear")),
      previewRow("학교명", fieldValue("schoolName"))
    ]));

    const careerItems = [];
    for (let i = 1; i <= 3; i += 1) {
      const company = fieldValue(`careerCompany${i}`, "");
      const period = fieldValue(`careerPeriod${i}`, "");
      const job = fieldValue(`careerJob${i}`, "");
      const type = selectedValue(`careerType${i}`, "");
      const reason = fieldValue(`careerReason${i}`, "");
      if (![company, period, job, type, reason].some(Boolean)) continue;
      const lines = [
        company && `회사명 또는 근무지: ${company}`,
        period && `근무기간: ${period}`,
        job && `담당업무: ${job}`,
        type && `근무형태: ${type}`,
        reason && `퇴사사유: ${reason}`
      ].filter(Boolean);
      careerItems.push(`<div class="preview-career-item"><strong>경력 ${i}</strong><p class="preview-career-summary">${escapeHtml(lines.join("\n"))}</p></div>`);
    }
    sections.push(`
      <section class="preview-section">
        <div class="preview-card-heading"><h3>경력사항</h3></div>
        ${careerItems.length ? careerItems.join("") : '<div class="preview-career-item"><p class="preview-career-summary preview-empty">입력된 경력사항이 없습니다.</p></div>'}
      </section>`);

    sections.push(previewSection("근무조건", [
      previewRow("가능 근무형태", selectedValues("workShift")),
      previewRow("잔업 가능", selectedValue("overtimeAvailable")),
      previewRow("특근 가능", selectedValue("holidayWorkAvailable")),
      previewRow("출퇴근 방법", commuteDetail),
      previewRow("희망 급여", salaryText),
      previewRow("출근 가능일", fieldValue("availableStartDate")),
      previewRow("추가 요청사항", fieldValue("workConditionNote"))
    ]));

    sections.push(previewSection("건강 및 추가정보", [
      previewRow("건강상태", selectedValue("healthStatus")),
      previewRow("기존 병력", fieldValue("medicalHistory")),
      previewRow("시력", `좌안 ${fieldValue("leftVision")} / 우안 ${fieldValue("rightVision")}`),
      previewRow("안경·렌즈 착용", selectedValue("visionCorrection")),
      previewRow("흡연 여부", selectedValue("smokingStatus")),
      previewRow("특이사항", fieldValue("specialNotes")),
      previewRow("희망 고용 방식", selectedValue("insurancePreference"))
    ]));

    finalPreview.innerHTML = sections.join("");
    previewSignatureImage.src = signatureData.value;
    previewSignatureImage.hidden = !signatureData.value;
    previewConsentStatus.textContent = privacyConsent.checked ? "동의 완료" : "동의 필요";
    previewSignedAt.textContent = `${fieldValue("koreanName")} / ${formatApplicationDate()} 작성`;
  }

  function generateReceiptNumber() {
    const now = new Date();
    const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const random = String(Math.floor(Math.random() * 9000) + 1000);
    return `${date}-${random}`;
  }

  function getGoogleAppsScriptUrl() {
    return String(window.RECRUIT_SYSTEM_CONFIG?.googleAppsScriptUrl || "").trim();
  }

  async function sendToGoogleSheets(submission) {
    const endpoint = getGoogleAppsScriptUrl();
    if (!endpoint) return { attempted: false, sent: false };

    await fetch(endpoint, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(submission)
    });

    return { attempted: true, sent: true };
  }

  async function submitApplication() {
    if (!validateStep5()) {
      showStep(5);
      return;
    }

    setError("finalSubmitError");
    finalSubmitButton.classList.add("is-loading");
    finalSubmitButton.disabled = true;
    finalSubmitButton.textContent = "제출 중...";

    const submission = {
      receiptNumber: generateReceiptNumber(),
      submittedAt: new Date().toISOString(),
      applicantName: fieldValue("koreanName"),
      phone: fieldValue("phone"),
      userAgent: navigator.userAgent,
      data: collectFormData()
    };

    try {
      const sheetResult = await sendToGoogleSheets(submission);
      submission.googleSheetsConfigured = sheetResult.attempted;
      submission.googleSheetsSent = sheetResult.sent;
      sessionStorage.setItem("recruitSystemLastSubmission", JSON.stringify(submission));
      localStorage.removeItem(STORAGE_KEY);
      window.location.href = "./complete.html";
    } catch (error) {
      console.error("지원서 전송 실패", error);
      setError("finalSubmitError", "제출 중 오류가 발생했습니다. 인터넷 연결을 확인한 뒤 다시 눌러 주세요.");
      finalSubmitButton.classList.remove("is-loading");
      finalSubmitButton.disabled = false;
      finalSubmitButton.textContent = "최종 제출";
    }
  }

  function showStep(stepNumber) {
    currentStep = Math.min(Math.max(stepNumber, 1), steps.length);

    steps.forEach((step) => {
      step.classList.toggle("active", Number(step.dataset.step) === currentStep);
    });

    currentStepNumber.textContent = String(currentStep);
    currentStepText.textContent = stepNames[currentStep];
    progressBarFill.style.width = `${(currentStep / steps.length) * 100}%`;

    if (currentStep === 5) {
      updateApplicantConfirmation();
      window.requestAnimationFrame(() => resizeSignatureCanvas(true));
    }

    if (currentStep === 6) {
      renderFinalPreview();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
    scheduleSave();
  }

  function setError(id, message = "") {
    const element = document.getElementById(id);
    if (element) element.textContent = message;
  }

  function validateStep1() {
    [
      "koreanNameError",
      "phoneError",
      "birthDateError",
      "genderError",
      "nationalityError",
      "addressError"
    ].forEach((id) => setError(id));

    let valid = true;

    if (!document.getElementById("koreanName").value.trim()) {
      setError("koreanNameError", "성명을 입력해 주세요.");
      valid = false;
    }

    if (!/^010-\d{4}-\d{4}$/.test(phone.value)) {
      setError("phoneError", "휴대전화 번호를 정확히 입력해 주세요.");
      valid = false;
    }

    if (!birthDate.value) {
      setError("birthDateError", "생년월일을 입력해 주세요.");
      valid = false;
    } else if (!isValidDateValue(birthDate.value)) {
      setError("birthDateError", "생년월일을 YYYY-MM-DD 형식으로 정확히 입력해 주세요.");
      valid = false;
    }

    if (!form.querySelector('input[name="gender"]:checked')) {
      setError("genderError", "성별을 선택해 주세요.");
      valid = false;
    }

    if (!nationality.value) {
      setError("nationalityError", "국적을 선택해 주세요.");
      valid = false;
    }

    if (!document.getElementById("address").value.trim()) {
      setError("addressError", "현재 주소를 입력해 주세요.");
      valid = false;
    }

    if (nationality.value === "기타" && !otherNationality.value.trim()) {
      alert("국적을 직접 입력해 주세요.");
      otherNationality.focus();
      valid = false;
    }

    return valid;
  }

  function validateStep3() {
    setError("shuttleBoardingPlaceError");

    const commute = form.querySelector('input[name="commuteType"]:checked')?.value;

    if (commute === "통근버스" && !shuttleBoardingPlace.value.trim()) {
      setError("shuttleBoardingPlaceError", "통근버스 탑승 희망 장소를 입력해 주세요.");
      shuttleBoardingPlace.scrollIntoView({ behavior: "smooth", block: "center" });
      shuttleBoardingPlace.focus();
      return false;
    }

    return true;
  }

  function validateStep4() {
    setError("healthStatusError");
    setError("insurancePreferenceError");

    let valid = true;

    if (!form.querySelector('input[name="healthStatus"]:checked')) {
      setError("healthStatusError", "건강상태를 선택해 주세요.");
      valid = false;
    }

    if (!form.querySelector('input[name="insurancePreference"]:checked')) {
      setError("insurancePreferenceError", "희망 고용 방식을 선택해 주세요.");
      valid = false;
    }

    if (!valid) {
      const firstError = document.querySelector(".field-error:not(:empty)");
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    return valid;
  }

  function validateStep5() {
    setError("privacyConsentError");
    setError("signatureError");

    let valid = true;

    if (!privacyConsent.checked) {
      setError("privacyConsentError", "개인정보 수집 및 이용에 동의해 주세요.");
      valid = false;
    }

    if (!hasSignature || !signatureData.value) {
      setError("signatureError", "전자서명을 입력해 주세요.");
      valid = false;
    }

    if (!valid) {
      const firstError = document.querySelector('.form-step[data-step="5"] .field-error:not(:empty)');
      firstError?.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return valid;
  }

  function collectFormData() {
    const data = {
      currentStep,
      fields: {},
      checked: {}
    };

    [...form.elements].forEach((element) => {
      if (!element.id && !element.name) return;

      if (element.type === "radio" || element.type === "checkbox") {
        const key = element.name;
        if (!data.checked[key]) data.checked[key] = [];
        if (element.checked) data.checked[key].push(element.value);
      } else if (element.id) {
        data.fields[element.id] = element.value;
      }
    });

    return data;
  }

  function updateSaveStatus(message, saved = false) {
    const boxes = [
      document.getElementById("saveStatus"),
      document.getElementById("saveStatusStep4"),
      document.getElementById("saveStatusStep5")
    ].filter(Boolean);

    boxes.forEach((box) => {
      box.textContent = message;
      box.classList.toggle("saved", saved);
    });
  }

  function saveDraft() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collectFormData()));
    updateSaveStatus("입력 내용이 임시 저장되었습니다.", true);

    window.setTimeout(() => {
      updateSaveStatus("입력 내용이 자동으로 임시 저장됩니다.", false);
    }, 1600);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDraft, 350);
  }

  function restoreDraft() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;

    try {
      const data = JSON.parse(raw);

      Object.entries(data.fields || {}).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.value = value;
      });

      Object.entries(data.checked || {}).forEach(([name, values]) => {
        form.querySelectorAll(`[name="${CSS.escape(name)}"]`).forEach((element) => {
          element.checked = values.includes(element.value);
        });
      });

      calculateAge();
      updateNationalityFields();
      updateConditionalFields();
      updateApplicantConfirmation();

      if (data.fields?.signatureData) {
        pendingSignatureRestore = data.fields.signatureData;
        signatureData.value = data.fields.signatureData;
        setSignatureState(true);
      }

      showStep(1);
      return true;
    } catch (error) {
      console.warn("임시 저장 데이터를 불러오지 못했습니다.", error);
      return false;
    }
  }

  createCareerCards();

  phone.addEventListener("input", (event) => {
    event.target.value = formatPhoneNumber(event.target.value);
  });

  emergencyPhone.addEventListener("input", (event) => {
    event.target.value = formatPhoneNumber(event.target.value);
  });

  [birthDate, document.getElementById("availableStartDate")].forEach((dateInput) => {
    dateInput.addEventListener("input", (event) => {
      event.target.value = formatDateInput(event.target.value);
      if (event.target === birthDate) calculateAge();
    });
  });

  birthDate.addEventListener("change", calculateAge);
  nationality.addEventListener("change", updateNationalityFields);

  form.addEventListener("change", (event) => {
    if (event.target.name === "commuteType" || event.target.name === "salaryType") {
      updateConditionalFields();
    }
    scheduleSave();
  });

  form.addEventListener("input", (event) => {
    if (event.target.id === "shuttleBoardingPlace" && event.target.value.trim()) {
      setError("shuttleBoardingPlaceError");
    }
    scheduleSave();
  });

  consentDetailButton.addEventListener("click", () => {
    const willOpen = consentDetails.classList.contains("hidden");
    consentDetails.classList.toggle("hidden", !willOpen);
    consentDetailButton.setAttribute("aria-expanded", String(willOpen));
    consentDetailButton.textContent = willOpen ? "동의 내용 접기" : "동의 내용 자세히 보기";
  });

  privacyConsent.addEventListener("change", () => {
    if (privacyConsent.checked) setError("privacyConsentError");
  });

  signatureCanvas.addEventListener("pointerdown", beginSignature);
  signatureCanvas.addEventListener("pointermove", drawSignature);
  signatureCanvas.addEventListener("pointerup", endSignature);
  signatureCanvas.addEventListener("pointercancel", endSignature);
  signatureCanvas.addEventListener("pointerleave", (event) => {
    if (isDrawingSignature && event.buttons === 0) endSignature(event);
  });
  clearSignatureButton.addEventListener("click", clearSignature);
  window.addEventListener("resize", () => {
    if (currentStep === 5) resizeSignatureCanvas(true);
  });

  document.getElementById("step1NextButton").addEventListener("click", () => {
    if (validateStep1()) showStep(2);
  });

  document.getElementById("step2PrevButton").addEventListener("click", () => showStep(1));
  document.getElementById("step2NextButton").addEventListener("click", () => showStep(3));
  document.getElementById("step3PrevButton").addEventListener("click", () => showStep(2));
  document.getElementById("step3NextButton").addEventListener("click", () => {
    if (validateStep3()) showStep(4);
  });
  document.getElementById("step4PrevButton").addEventListener("click", () => showStep(3));
  document.getElementById("step4NextButton").addEventListener("click", () => {
    if (validateStep4()) showStep(5);
  });
  document.getElementById("step5PrevButton").addEventListener("click", () => showStep(4));
  document.getElementById("step5NextButton").addEventListener("click", () => {
    if (validateStep5()) showStep(6);
  });
  document.getElementById("step6EditButton").addEventListener("click", () => showStep(1));
  finalSubmitButton.addEventListener("click", submitApplication);

  updateNationalityFields();
  updateApplicantConfirmation();
  updateConditionalFields();

  if (!restoreDraft()) {
    showStep(1);
  }
});
