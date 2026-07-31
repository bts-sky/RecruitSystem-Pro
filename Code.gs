const SYSTEM = {
  ROOT_FOLDER_NAME: "하늘컴퍼니_지원자관리",
  SPREADSHEET_NAME: "하늘컴퍼니_지원자목록",
  SHEET_NAME: "지원자목록"
};

function setupSystem() {
  const props = PropertiesService.getScriptProperties();

  let rootFolderId = props.getProperty("ROOT_FOLDER_ID");
  if (!rootFolderId) {
    const rootFolder = DriveApp.createFolder(SYSTEM.ROOT_FOLDER_NAME);
    rootFolderId = rootFolder.getId();
    props.setProperty("ROOT_FOLDER_ID", rootFolderId);
  }

  let spreadsheetId = props.getProperty("SPREADSHEET_ID");
  if (!spreadsheetId) {
    const spreadsheet = SpreadsheetApp.create(SYSTEM.SPREADSHEET_NAME);
    spreadsheetId = spreadsheet.getId();
    props.setProperty("SPREADSHEET_ID", spreadsheetId);

    const sheet = spreadsheet.getSheets()[0];
    sheet.setName(SYSTEM.SHEET_NAME);
    sheet.getRange(1, 1, 1, 32).setValues([[
      "접수번호", "접수일시", "성명", "휴대전화", "생년월일", "만 나이",
      "성별", "주소", "비상연락처", "건강상태", "병력및특이사항", "교정시력", "졸업년도", "학교명",
      "경력1", "경력2", "경력3", "희망근무형태", "근무형태", "잔업가능", "특근가능", "출퇴근방법", "통근버스탑승위치",
      "희망고용방식", "출근가능일", "추가요청사항", "개인정보동의", "지원자폴더",
      "사진파일", "이력서파일", "상태", "버전"
    ]]);
    sheet.setFrozenRows(1);
  }

  return {
    ok: true,
    rootFolderUrl: "https://drive.google.com/drive/folders/" + rootFolderId,
    spreadsheetUrl: "https://docs.google.com/spreadsheets/d/" + spreadsheetId
  };
}

function doGet() {
  return jsonResponse_({
    ok: true,
    service: "RecruitSystem-Pro",
    version: "v2.0.1",
    message: "Backend is running."
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("전송된 데이터가 없습니다.");
    }

    const data = JSON.parse(e.postData.contents);
    validatePayload_(data);

    const props = PropertiesService.getScriptProperties();
    const rootFolderId = props.getProperty("ROOT_FOLDER_ID");
    const spreadsheetId = props.getProperty("SPREADSHEET_ID");

    if (!rootFolderId || !spreadsheetId) {
      throw new Error("Apps Script에서 setupSystem()을 먼저 실행해 주세요.");
    }

    const applicationId = createApplicationId_();
    const form = data.form || {};
    const applicantName = cleanText_(data.applicantName || form.koreanName || "지원자");
    const phone = cleanText_(data.phone || form.phone || "");
    const safeName = safeFileName_(applicantName);
    const safePhone = phone.replace(/\D/g, "") || "전화번호없음";

    const rootFolder = DriveApp.getFolderById(rootFolderId);
    const applicantFolder = rootFolder.createFolder(
      applicationId + "_" + safeName + "_" + safePhone
    );

    let photoFile = null;
    let resumeFile = null;

    if (data.uploads && data.uploads.profilePhoto && data.uploads.profilePhoto.base64) {
      photoFile = saveBase64File_(
        applicantFolder,
        data.uploads.profilePhoto,
        applicationId + "_" + safeName + "_사진.jpg"
      );
    }

    if (data.uploads && data.uploads.resume && data.uploads.resume.base64) {
      const originalName = safeFileName_(data.uploads.resume.name || "이력서");
      resumeFile = saveBase64File_(
        applicantFolder,
        data.uploads.resume,
        applicationId + "_" + safeName + "_" + originalName
      );
    }

    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(SYSTEM.SHEET_NAME);
    if (!sheet) throw new Error("지원자목록 시트를 찾을 수 없습니다.");

    sheet.appendRow([
      applicationId,
      new Date(),
      cleanText_(form.koreanName),
      cleanText_(form.phone),
      cleanText_(form.birthDate),
      cleanText_(form.age),
      cleanText_(form.gender),
      cleanText_(form.address),
      cleanText_(form.emergencyPhone),
      cleanText_(form.healthStatus),
      cleanText_(form.medicalHistory),
      cleanText_(form.correctedVision),
      cleanText_(form.graduationYear),
      cleanText_(form.schoolName),
      careerText_(form, 1),
      careerText_(form, 2),
      careerText_(form, 3),
      cleanText_(form.workType),
      cleanText_(form.employmentType),
      cleanText_(form.overtimeAvailable),
      cleanText_(form.weekendAvailable),
      cleanText_(form.commuteType),
      cleanText_(form.shuttleLocation),
      cleanText_(form.insurancePreference),
      cleanText_(form.availableStartDate),
      cleanText_(form.workConditionNote),
      cleanText_(form.privacyConsent),
      applicantFolder.getUrl(),
      photoFile ? photoFile.getUrl() : "",
      resumeFile ? resumeFile.getUrl() : "",
      "신규지원",
      cleanText_(data.version || "v2.0.1")
    ]);

    return jsonResponse_({
      ok: true,
      applicationId: applicationId,
      folderUrl: applicantFolder.getUrl(),
      message: "지원서가 정상적으로 저장되었습니다."
    });

  } catch (error) {
    console.error(error);
    return jsonResponse_({
      ok: false,
      message: error && error.message ? error.message : "알 수 없는 오류가 발생했습니다."
    });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function validatePayload_(data) {
  if (!data || typeof data !== "object") throw new Error("지원서 데이터 형식이 올바르지 않습니다.");
  const form = data.form || {};
  if (!cleanText_(data.applicantName || form.koreanName)) throw new Error("성명이 없습니다.");
  if (!cleanText_(data.phone || form.phone)) throw new Error("휴대전화 번호가 없습니다.");
  if (!data.uploads || !data.uploads.profilePhoto || !data.uploads.profilePhoto.base64) {
    throw new Error("확정된 지원자 사진이 없습니다.");
  }
}

function saveBase64File_(folder, fileData, fileName) {
  const bytes = Utilities.base64Decode(fileData.base64);
  const contentType = fileData.type || "application/octet-stream";
  const blob = Utilities.newBlob(bytes, contentType, fileName);
  return folder.createFile(blob);
}

function careerText_(form, index) {
  const company = cleanText_(form["careerCompany" + index]);
  const period = cleanText_(form["careerPeriod" + index]);
  const job = cleanText_(form["careerJob" + index]);
  const employmentType = cleanText_(form["careerEmploymentType" + index]);
  const reason = cleanText_(form["careerReason" + index]);
  if (!company && !period && !job && !employmentType && !reason) return "";
  return [company, period, job, employmentType, reason].filter(Boolean).join(" / ");
}

function createApplicationId_() {
  const timezone = Session.getScriptTimeZone() || "Asia/Seoul";
  const time = Utilities.formatDate(new Date(), timezone, "yyyyMMdd-HHmmss");
  const random = Math.floor(1000 + Math.random() * 9000);
  return "HC-" + time + "-" + random;
}

function safeFileName_(value) {
  return cleanText_(value)
    .replace(/[\\/:*?"<>|#%{}\[\]~]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80) || "파일";
}

function cleanText_(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
