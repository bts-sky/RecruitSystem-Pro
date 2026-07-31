const SYSTEM = {
  ROOT_FOLDER_NAME: "하늘컴퍼니_지원자관리",
  SPREADSHEET_NAME: "하늘컴퍼니_지원자목록",
  SHEET_NAME: "지원자목록",
  VERSION: "v2.2.1"
};

const SHEET_HEADERS = [
  "접수번호", "접수일시", "성명", "휴대전화", "생년월일", "만 나이",
  "성별", "주소", "비상연락처", "건강상태", "병력및특이사항", "교정시력", "졸업년도", "학교명",
  "경력1", "경력2", "경력3", "희망근무형태", "근무형태", "잔업가능", "특근가능", "출퇴근방법", "통근버스탑승위치",
  "희망고용방식", "출근가능일", "추가요청사항", "개인정보동의", "지원자폴더",
  "사진파일", "이력서파일", "서명파일", "지원서PDF", "상태", "버전", "국적", "병역사항"
];

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
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  let sheet = spreadsheet.getSheetByName(SYSTEM.SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.getSheets()[0];
    sheet.setName(SYSTEM.SHEET_NAME);
  }
  ensureSheetHeaders_(sheet);

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
    version: SYSTEM.VERSION,
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
    let signatureFile = null;
    let pdfFile = null;

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

    if (cleanText_(form.signatureData)) {
      signatureFile = saveDataUrlFile_(
        applicantFolder,
        form.signatureData,
        applicationId + "_" + safeName + "_서명.png"
      );
    }

    pdfFile = createApplicationPdf_(applicantFolder, applicationId, form, photoFile, signatureFile);

    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(SYSTEM.SHEET_NAME);
    if (!sheet) throw new Error("지원자목록 시트를 찾을 수 없습니다.");
    ensureSheetHeaders_(sheet);

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
      signatureFile ? signatureFile.getUrl() : "",
      pdfFile ? pdfFile.getUrl() : "",
      "신규지원",
      cleanText_(data.version || SYSTEM.VERSION),
      nationalityText_(form),
      cleanText_(form.militaryStatus)
    ]);

    return jsonResponse_({
      ok: true,
      applicationId: applicationId,
      folderUrl: applicantFolder.getUrl(),
      pdfUrl: pdfFile ? pdfFile.getUrl() : "",
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

function createApplicationPdf_(folder, applicationId, form, photoFile, signatureFile) {
  const safeName = safeFileName_(form.koreanName || "지원자");
  const timezone = Session.getScriptTimeZone() || "Asia/Seoul";
  const submittedAt = new Date();
  const document = DocumentApp.create(applicationId + "_" + safeName + "_지원서_임시");
  const body = document.getBody();

  // A4 1페이지 고정에 가깝게 여백과 표 높이를 압축한다.
  body.setPageWidth(595.28);
  body.setPageHeight(841.89);
  body.setMarginTop(7);
  body.setMarginBottom(7);
  body.setMarginLeft(8);
  body.setMarginRight(8);

  const title = body.appendParagraph("입 사 지 원 서");
  title.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  title.setSpacingBefore(0).setSpacingAfter(1);
  title.editAsText().setFontFamily("Malgun Gothic").setFontSize(21).setBold(true);

  const meta = body.appendParagraph(
    "접수번호 " + applicationId + "  |  접수일시 " +
    Utilities.formatDate(submittedAt, timezone, "yyyy-MM-dd HH:mm:ss")
  );
  meta.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  meta.setSpacingBefore(0).setSpacingAfter(1);
  meta.editAsText().setFontFamily("Malgun Gothic").setFontSize(6.5);

  const top = body.appendTable([["", ""]]);
  styleTable_(top, 1);
  const left = top.getRow(0).getCell(0);
  const photoCell = top.getRow(0).getCell(1);
  left.setWidth(405);
  photoCell.setWidth(140);
  clearCell_(left);
  clearCell_(photoCell);

  const personal = left.appendTable([
    ["성명", cleanText_(form.koreanName), "생년월일", cleanText_(form.birthDate)],
    ["연락처", cleanText_(form.phone), "성별 / 나이", joinValues_([form.gender, form.age ? form.age + "세" : ""])],
    ["국적 / 비자", joinValues_([nationalityText_(form), form.visa]), "병역사항", cleanText_(form.militaryStatus)],
    ["현 주소", cleanText_(form.address), "", ""]
  ]);
  styleTable_(personal, 0.9);
  setTableColumnWidths_(personal, [54, 164, 70, 108]);
  mergeCellsInRow_(personal.getRow(3), 3);
  formatGrid_(personal, {fontSize: 8.2, labelColumns: [0, 2], minHeight: 25});
  personal.getRow(3).setMinimumHeight(44);

  photoCell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
  photoCell.setBackgroundColor("#ffffff");
  const photoParagraph = photoCell.appendParagraph("");
  photoParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  photoParagraph.setSpacingBefore(0).setSpacingAfter(0);
  if (photoFile) {
    try {
      photoParagraph.appendInlineImage(docImageBlob_(photoFile, MimeType.JPEG)).setWidth(108).setHeight(144);
    } catch (error) {
      setCellText_(photoCell, "사진 삽입 오류", {fontSize: 8, bold: true, align: "CENTER"});
      console.warn("사진 삽입 실패", error);
    }
  } else {
    setCellText_(photoCell, "증명사진\n(3:4)", {fontSize: 9, bold: true, align: "CENTER"});
  }
  top.getRow(0).setMinimumHeight(150);

  appendGap_(body, 1);
  const education = body.appendTable([
    ["최종학력\n사항", "졸업년도", "학교명", "전공", "구분", "지역"],
    ["", cleanText_(form.graduationYear), cleanText_(form.schoolName), valueOrBlank_(form.major), valueOrBlank_(form.educationStatus), valueOrBlank_(form.schoolRegion)]
  ]);
  styleTable_(education, 0.9);
  setTableColumnWidths_(education, [55, 72, 145, 80, 100, 82]);
  mergeVerticalLabel_(education, 0);
  formatGrid_(education, {fontSize: 7.6, headerRows: [0], labelColumns: [0], minHeight: 20});

  appendGap_(body, 1);
  const career = body.appendTable([
    ["경력\n사항", "회사명(근무지)", "근무 기간", "담당업무(상세기재)", "근무 형태", "퇴사 사유"],
    ["", careerValue_(form, 1, "company"), careerValue_(form, 1, "period"), careerValue_(form, 1, "job"), careerValue_(form, 1, "employmentType"), careerValue_(form, 1, "reason")],
    ["", careerValue_(form, 2, "company"), careerValue_(form, 2, "period"), careerValue_(form, 2, "job"), careerValue_(form, 2, "employmentType"), careerValue_(form, 2, "reason")],
    ["", careerValue_(form, 3, "company"), careerValue_(form, 3, "period"), careerValue_(form, 3, "job"), careerValue_(form, 3, "employmentType"), careerValue_(form, 3, "reason")]
  ]);
  styleTable_(career, 0.9);
  setTableColumnWidths_(career, [55, 92, 105, 130, 76, 76]);
  mergeVerticalLabel_(career, 0);
  formatGrid_(career, {fontSize: 7.1, headerRows: [0], labelColumns: [0], minHeight: 19});

  appendGap_(body, 1);
  const privacy = body.appendTable([["개인정보\n수집 및\n이용동의", ""]]);
  styleTable_(privacy, 0.9);
  privacy.getRow(0).getCell(0).setWidth(62);
  privacy.getRow(0).getCell(1).setWidth(472);
  setCellText_(privacy.getRow(0).getCell(0), "개인정보\n수집 및\n이용동의", {fontSize: 8.5, bold: true, align: "CENTER"});
  const privacyText =
    "1. 입사지원서의 개인정보는 채용 및 취업정보 제공을 위해 이용하며 다른 목적으로 이용하거나 제3자에게 제공하지 않습니다.\n" +
    "2. 관계 법령에 따른 수사기관의 적법한 요구가 있는 경우 개인정보를 제공할 수 있습니다.\n" +
    "3. 수집한 개인정보는 채용·인사관리 목적으로 활용하며 보관기간 종료 후 안전하게 폐기합니다.\n" +
    "4. 개인정보 수집 및 이용 동의: " + checkText_(form.privacyConsent) + "    " +
    Utilities.formatDate(submittedAt, timezone, "yyyy년 MM월 dd일") + "    성명: " + cleanText_(form.koreanName);
  setCellText_(privacy.getRow(0).getCell(1), privacyText, {fontSize: 6.5, align: "LEFT"});
  privacy.getRow(0).setMinimumHeight(78);

  appendGap_(body, 1);
  const other = body.appendTable([
    ["기타", "장애", valueOrBlank_(form.disability), "병역 사항", cleanText_(form.militaryStatus), "혈액형", valueOrBlank_(form.bloodType)],
    ["", "잔업", yesNoText_(form.overtimeAvailable), "특근", yesNoText_(form.weekendAvailable), "교정시력", cleanText_(form.correctedVision)],
    ["", "흡연", valueOrBlank_(form.smoking), "비상연락처", cleanText_(form.emergencyPhone), "출퇴근", cleanText_(form.commuteType)]
  ]);
  styleTable_(other, 0.9);
  setTableColumnWidths_(other, [50, 55, 92, 70, 100, 65, 102]);
  mergeVerticalLabel_(other, 0);
  formatGrid_(other, {fontSize: 7.1, labelColumns: [0,1,3,5], minHeight: 19});

  appendGap_(body, 1);
  // 희망고용방식은 스프레드시트/관리자에서만 확인하고 PDF에는 출력하지 않는다.
  const work = body.appendTable([
    ["근무 형태", joinValues_([form.workType, form.employmentType]), "출근가능일", cleanText_(form.availableStartDate), "통근버스 탑승위치", cleanText_(form.shuttleLocation)],
    ["잔업 / 특근", joinValues_([yesNoText_(form.overtimeAvailable), yesNoText_(form.weekendAvailable)]), "추가 요청사항", cleanText_(form.workConditionNote), "국적", nationalityText_(form)],
    ["특이사항", "", "", "", "", ""]
  ]);
  styleTable_(work, 0.9);
  setTableColumnWidths_(work, [68, 115, 75, 90, 95, 92]);
  formatGrid_(work, {fontSize: 7.1, labelColumns: [0,2,4], minHeight: 20});
  mergeCellsInRow_(work.getRow(2), 5);
  const special = "건강상태: " + cleanText_(form.healthStatus) +
    "\n비양호 시 상세기재: " + cleanText_(form.medicalHistory);
  setCellText_(work.getRow(2).getCell(1), special, {fontSize: 7.5, bold: false, align: "LEFT"});
  work.getRow(2).getCell(1).setBackgroundColor("#92d050");
  work.getRow(2).setMinimumHeight(42);

  appendGap_(body, 1);
  const finalBox = body.appendTable([[""]]);
  styleTable_(finalBox, 0.9);
  const finalCell = finalBox.getRow(0).getCell(0);
  clearCell_(finalCell);

  const declaration = finalCell.appendParagraph("상기 내용은 사실과 다름 없으며 허위 기재 시 어떠한 처벌도 감수할 것입니다.");
  declaration.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  declaration.setSpacingBefore(0).setSpacingAfter(1);
  declaration.editAsText().setFontFamily("Malgun Gothic").setFontSize(8.5).setBold(true);

  const signLine = finalCell.appendParagraph("");
  signLine.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  signLine.setSpacingBefore(0).setSpacingAfter(0);
  signLine.appendText(Utilities.formatDate(submittedAt, timezone, "yyyy년 MM월 dd일") + "    성명: " + cleanText_(form.koreanName) + "    서명: ")
    .setFontFamily("Malgun Gothic").setFontSize(8).setBold(false);
  if (signatureFile) {
    try {
      signLine.appendInlineImage(docImageBlob_(signatureFile, MimeType.PNG)).setWidth(76).setHeight(24);
    } catch (error) {
      signLine.appendText("(서명 파일 오류)").setFontSize(7);
      console.warn("서명 삽입 실패", error);
    }
  }

  const company = finalCell.appendParagraph("(주) 하늘컴퍼니");
  company.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  company.setSpacingBefore(0).setSpacingAfter(0);
  company.editAsText().setFontFamily("Malgun Gothic").setFontSize(15).setBold(true);
  finalBox.getRow(0).setMinimumHeight(62);

  document.saveAndClose();

  const tempFile = DriveApp.getFileById(document.getId());
  const pdfBlob = tempFile.getAs(MimeType.PDF)
    .setName(applicationId + "_" + safeName + "_지원서.pdf");
  const pdfFile = folder.createFile(pdfBlob);
  tempFile.setTrashed(true);
  return pdfFile;
}

function docImageBlob_(file, preferredType) {
  const blob = file.getBlob();
  const type = cleanText_(blob.getContentType());
  if (type.indexOf("image/") === 0) return blob.copyBlob().setName(file.getName());
  return blob.getAs(preferredType || MimeType.PNG).setName(file.getName());
}

function nationalityText_(form) {
  const nationality = cleanText_(form.nationality);
  if (nationality === "기타") return cleanText_(form.nationalityOther) || "기타";
  return nationality;
}

function styleTable_(table, borderWidth) {
  table.setBorderColor("#000000");
  table.setBorderWidth(borderWidth || 0.8);
}

function formatGrid_(table, options) {
  const opts = options || {};
  const headerRows = opts.headerRows || [];
  const labelColumns = opts.labelColumns || [];
  for (let r = 0; r < table.getNumRows(); r++) {
    const row = table.getRow(r);
    if (opts.minHeight) row.setMinimumHeight(opts.minHeight);
    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);
      const isHeader = headerRows.indexOf(r) >= 0;
      const isLabel = labelColumns.indexOf(c) >= 0;
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      cell.setPaddingTop(1.5).setPaddingBottom(1.5).setPaddingLeft(2).setPaddingRight(2);
      if (isHeader || isLabel) cell.setBackgroundColor("#fce4d6");
      styleCellText_(cell, {
        fontSize: opts.fontSize || 8,
        bold: isHeader || isLabel,
        align: (isHeader || isLabel) ? "CENTER" : "CENTER"
      });
    }
  }
}

function styleCellText_(cell, options) {
  const opts = options || {};
  for (let i = 0; i < cell.getNumChildren(); i++) {
    const child = cell.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) continue;
    const paragraph = child.asParagraph();
    paragraph.setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1);
    paragraph.setAlignment(alignmentFromText_(opts.align));
    const text = paragraph.editAsText();
    if (text.getText().length) {
      text.setFontFamily("Malgun Gothic");
      text.setFontSize(opts.fontSize || 8);
      text.setBold(Boolean(opts.bold));
    }
  }
}

function setCellText_(cell, text, options) {
  clearCell_(cell);
  const paragraph = cell.appendParagraph(cleanText_(text));
  paragraph.setSpacingBefore(0).setSpacingAfter(0).setLineSpacing(1);
  paragraph.setAlignment(alignmentFromText_((options || {}).align));
  const styled = paragraph.editAsText();
  if (styled.getText().length) {
    styled.setFontFamily("Malgun Gothic");
    styled.setFontSize((options || {}).fontSize || 8);
    styled.setBold(Boolean((options || {}).bold));
  }
  cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
}

function clearCell_(cell) {
  while (cell.getNumChildren() > 0) cell.removeChild(cell.getChild(0));
}

function setTableColumnWidths_(table, widths) {
  if (!table.getNumRows()) return;
  const row = table.getRow(0);
  for (let i = 0; i < widths.length && i < row.getNumCells(); i++) {
    row.getCell(i).setWidth(widths[i]);
  }
}

function mergeCellsInRow_(row, lastIndex) {
  for (let i = lastIndex; i >= 2; i--) row.getCell(i).merge();
}

function mergeVerticalLabel_(table, columnIndex) {
  // Google Docs Apps Script는 행 세로 병합을 직접 지원하지 않아,
  // 첫 번째 셀만 라벨로 사용하고 아래 셀의 텍스트/테두리를 최소화한다.
  for (let r = 1; r < table.getNumRows(); r++) {
    const cell = table.getRow(r).getCell(columnIndex);
    setCellText_(cell, "", {fontSize: 7, align: "CENTER"});
    cell.setBackgroundColor("#fce4d6");
  }
}

function appendGap_(body, points) {
  const gap = body.appendParagraph("");
  gap.setSpacingBefore(0).setSpacingAfter(points || 1);
  gap.editAsText().setFontSize(1);
}

function alignmentFromText_(value) {
  if (value === "LEFT") return DocumentApp.HorizontalAlignment.LEFT;
  if (value === "RIGHT") return DocumentApp.HorizontalAlignment.RIGHT;
  return DocumentApp.HorizontalAlignment.CENTER;
}

function valueOrBlank_(value) {
  return cleanText_(value) || " ";
}

function joinValues_(values) {
  return (values || []).map(cleanText_).filter(Boolean).join(" / ");
}

function yesNoText_(value) {
  const v = cleanText_(value);
  if (!v) return " ";
  return v;
}

function checkText_(value) {
  const v = cleanText_(value).toLowerCase();
  return (v === "동의" || v === "yes" || v === "true" || v === "y") ? "동의" : cleanText_(value);
}

function careerValue_(form, index, field) {
  const suffix = String(index);
  const keys = {
    company: "careerCompany" + suffix,
    period: "careerPeriod" + suffix,
    job: "careerJob" + suffix,
    employmentType: "careerEmploymentType" + suffix,
    reason: "careerReason" + suffix
  };
  return cleanText_(form[keys[field]]);
}

function ensureSheetHeaders_(sheet) {
  if (sheet.getMaxColumns() < SHEET_HEADERS.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), SHEET_HEADERS.length - sheet.getMaxColumns());
  }
  sheet.getRange(1, 1, 1, SHEET_HEADERS.length).setValues([SHEET_HEADERS]);
  sheet.setFrozenRows(1);
}

function validatePayload_(data) {
  if (!data || typeof data !== "object") throw new Error("지원서 데이터 형식이 올바르지 않습니다.");
  const form = data.form || {};
  if (!cleanText_(data.applicantName || form.koreanName)) throw new Error("성명이 없습니다.");
  if (!cleanText_(data.phone || form.phone)) throw new Error("휴대전화 번호가 없습니다.");
  if (!data.uploads || !data.uploads.profilePhoto || !data.uploads.profilePhoto.base64) {
    throw new Error("확정된 지원자 사진이 없습니다.");
  }
  if (!cleanText_(form.signatureData)) throw new Error("전자서명이 없습니다.");
}

function saveBase64File_(folder, fileData, fileName) {
  const bytes = Utilities.base64Decode(fileData.base64);
  const contentType = fileData.type || "application/octet-stream";
  const blob = Utilities.newBlob(bytes, contentType, fileName);
  return folder.createFile(blob);
}

function saveDataUrlFile_(folder, dataUrl, fileName) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("전자서명 데이터 형식이 올바르지 않습니다.");
  const blob = Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], fileName);
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
