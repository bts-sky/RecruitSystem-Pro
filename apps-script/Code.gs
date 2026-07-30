const LEGACY_SHEET_NAME = '지원자목록';
const MANAGEMENT_SHEET_NAME = '지원자관리';
const TIME_ZONE = 'Asia/Seoul';

const HEADERS = [
  '접수번호', '접수일시', '처리상태', '담당자 메모',
  '성명', '영문 성명', '연락처', '생년월일', '나이', '성별',
  '국적', '기타 국적', '비자', '결혼 여부', '주소',
  '비상연락처', '비상연락처 관계', '졸업년도', '학교명',
  '경력1 회사명', '경력1 근무기간', '경력1 담당업무', '경력1 근무형태', '경력1 퇴사사유',
  '경력2 회사명', '경력2 근무기간', '경력2 담당업무', '경력2 근무형태', '경력2 퇴사사유',
  '경력3 회사명', '경력3 근무기간', '경력3 담당업무', '경력3 근무형태', '경력3 퇴사사유',
  '가능 근무형태', '잔업 가능', '특근 가능', '출퇴근 방법', '기타 출퇴근 방법',
  '통근버스 탑승 희망 장소', '희망 급여 방식', '희망 급여', '출근 가능일', '근무조건 요청사항',
  '건강상태', '기존 병력', '좌안 시력', '우안 시력', '안경·렌즈 착용',
  '흡연 여부', '특이사항', '희망 고용 방식', '개인정보 동의', '전자서명', '브라우저정보'
];

function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'RecruitSystem-Pro',
    version: '1.0.15'
  });
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateManagementSheet_(spreadsheet);
    const record = flattenSubmission_(payload);

    sheet.appendRow(HEADERS.map((header) => record[header] ?? ''));
    applyRowFormatting_(sheet, sheet.getLastRow());

    return jsonResponse_({
      ok: true,
      receiptNumber: record['접수번호'] || ''
    });
  } catch (error) {
    return jsonResponse_({ ok: false, message: String(error) });
  }
}

// Code.gs 교체 후 Apps Script 편집기에서 한 번 실행하면
// 기존 '지원자목록' 자료를 '지원자관리'로 옮기고 관리용 시트를 준비합니다.
function initializeV1015() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = getOrCreateManagementSheet_(spreadsheet);
  setupManagementSheet_(sheet);
  return 'V1.0.15 지원자관리 시트 준비 완료';
}

function getOrCreateManagementSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(MANAGEMENT_SHEET_NAME);
  if (sheet) {
    setupManagementSheet_(sheet);
    return sheet;
  }

  sheet = spreadsheet.insertSheet(MANAGEMENT_SHEET_NAME);
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  setupManagementSheet_(sheet);
  migrateLegacyApplicants_(spreadsheet, sheet);
  return sheet;
}

function setupManagementSheet_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), HEADERS.length)).getValues()[0];
    HEADERS.forEach((header, index) => {
      if (currentHeaders[index] !== header) sheet.getRange(1, index + 1).setValue(header);
    });
  }

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setFontWeight('bold')
    .setBackground('#1764d4')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  const statusColumn = HEADERS.indexOf('처리상태') + 1;
  const validation = SpreadsheetApp.newDataValidation()
    .requireValueInList(['신규', '연락완료', '면접예정', '합격', '불합격'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, statusColumn, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(validation);

  const widths = {
    1: 125, 2: 145, 3: 90, 4: 220, 5: 90, 6: 120, 7: 120,
    8: 105, 9: 60, 10: 70, 15: 260, 44: 220, 51: 260
  };
  Object.keys(widths).forEach((column) => sheet.setColumnWidth(Number(column), widths[column]));

  if (!sheet.getFilter() && sheet.getLastRow() >= 1) {
    sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), HEADERS.length).createFilter();
  }
}

function applyRowFormatting_(sheet, rowNumber) {
  sheet.getRange(rowNumber, 1, 1, HEADERS.length).setVerticalAlignment('middle');
  const dateColumn = HEADERS.indexOf('접수일시') + 1;
  sheet.getRange(rowNumber, dateColumn).setNumberFormat('yyyy-mm-dd hh:mm');
}

function flattenSubmission_(payload) {
  const fields = (payload.data && payload.data.fields) || {};
  const checked = (payload.data && payload.data.checked) || {};
  const submittedAt = payload.submittedAt ? new Date(payload.submittedAt) : new Date();

  const record = {
    '접수번호': payload.receiptNumber || '',
    '접수일시': Utilities.formatDate(submittedAt, TIME_ZONE, 'yyyy-MM-dd HH:mm:ss'),
    '처리상태': '신규',
    '담당자 메모': '',
    '성명': fields.koreanName || payload.applicantName || '',
    '영문 성명': fields.englishName || '',
    '연락처': fields.phone || payload.phone || '',
    '생년월일': fields.birthDate || '',
    '나이': fields.age || '',
    '성별': firstChecked_(checked.gender),
    '국적': fields.nationality || '',
    '기타 국적': fields.otherNationality || '',
    '비자': fields.visa || '',
    '결혼 여부': firstChecked_(checked.maritalStatus),
    '주소': fields.address || '',
    '비상연락처': fields.emergencyPhone || '',
    '비상연락처 관계': fields.emergencyRelation || '',
    '졸업년도': fields.graduationYear || '',
    '학교명': fields.schoolName || '',
    '가능 근무형태': joinChecked_(checked.workShift),
    '잔업 가능': firstChecked_(checked.overtimeAvailable),
    '특근 가능': firstChecked_(checked.holidayWorkAvailable),
    '출퇴근 방법': firstChecked_(checked.commuteType),
    '기타 출퇴근 방법': fields.otherCommute || '',
    '통근버스 탑승 희망 장소': fields.shuttleBoardingPlace || '',
    '희망 급여 방식': firstChecked_(checked.salaryType),
    '희망 급여': fields.desiredSalary || '',
    '출근 가능일': fields.availableStartDate || '',
    '근무조건 요청사항': fields.workConditionNote || '',
    '건강상태': firstChecked_(checked.healthStatus),
    '기존 병력': fields.medicalHistory || '',
    '좌안 시력': fields.leftVision || '',
    '우안 시력': fields.rightVision || '',
    '안경·렌즈 착용': firstChecked_(checked.visionCorrection),
    '흡연 여부': firstChecked_(checked.smokingStatus),
    '특이사항': fields.specialNotes || '',
    '희망 고용 방식': firstChecked_(checked.insurancePreference),
    '개인정보 동의': checked.privacyConsent && checked.privacyConsent.length ? '동의' : '미동의',
    '전자서명': fields.signatureData ? '서명 완료' : '서명 없음',
    '브라우저정보': payload.userAgent || ''
  };

  for (let i = 1; i <= 3; i += 1) {
    record[`경력${i} 회사명`] = fields[`careerCompany${i}`] || '';
    record[`경력${i} 근무기간`] = fields[`careerPeriod${i}`] || '';
    record[`경력${i} 담당업무`] = fields[`careerJob${i}`] || '';
    record[`경력${i} 근무형태`] = firstChecked_(checked[`careerType${i}`]);
    record[`경력${i} 퇴사사유`] = fields[`careerReason${i}`] || '';
  }

  return record;
}

function migrateLegacyApplicants_(spreadsheet, targetSheet) {
  const legacy = spreadsheet.getSheetByName(LEGACY_SHEET_NAME);
  if (!legacy || legacy.getLastRow() < 2) return;

  const values = legacy.getDataRange().getValues();
  const headers = values[0].map(String);
  const existingReceipts = new Set();

  if (targetSheet.getLastRow() > 1) {
    targetSheet.getRange(2, 1, targetSheet.getLastRow() - 1, 1).getValues()
      .flat()
      .forEach((value) => existingReceipts.add(String(value)));
  }

  const rows = [];
  values.slice(1).forEach((row) => {
    const old = {};
    headers.forEach((header, index) => { old[header] = row[index]; });
    const receipt = pick_(old, ['접수번호']);
    if (!receipt || existingReceipts.has(String(receipt))) return;

    const record = {
      '접수번호': receipt,
      '접수일시': normalizeLegacyDate_(pick_(old, ['접수일시', '제출일시'])),
      '처리상태': pick_(old, ['처리상태']) || '신규',
      '담당자 메모': pick_(old, ['담당자 메모', '메모']),
      '성명': pick_(old, ['성명', '지원자명', '입력_koreanName']),
      '영문 성명': pick_(old, ['영문 성명', '입력_englishName']),
      '연락처': pick_(old, ['연락처', '입력_phone']),
      '생년월일': pick_(old, ['생년월일', '입력_birthDate']),
      '나이': pick_(old, ['나이', '입력_age']),
      '성별': pick_(old, ['성별', '선택_gender']),
      '국적': pick_(old, ['국적', '입력_nationality']),
      '기타 국적': pick_(old, ['기타 국적', '입력_otherNationality']),
      '비자': pick_(old, ['비자', '입력_visa']),
      '결혼 여부': pick_(old, ['결혼 여부', '선택_maritalStatus']),
      '주소': pick_(old, ['주소', '입력_address']),
      '비상연락처': pick_(old, ['비상연락처', '입력_emergencyPhone']),
      '비상연락처 관계': pick_(old, ['비상연락처 관계', '입력_emergencyRelation']),
      '졸업년도': pick_(old, ['졸업년도', '입력_graduationYear']),
      '학교명': pick_(old, ['학교명', '입력_schoolName']),
      '가능 근무형태': pick_(old, ['가능 근무형태', '선택_workShift']),
      '잔업 가능': pick_(old, ['잔업 가능', '선택_overtimeAvailable']),
      '특근 가능': pick_(old, ['특근 가능', '선택_holidayWorkAvailable']),
      '출퇴근 방법': pick_(old, ['출퇴근 방법', '선택_commuteType']),
      '기타 출퇴근 방법': pick_(old, ['기타 출퇴근 방법', '입력_otherCommute']),
      '통근버스 탑승 희망 장소': pick_(old, ['통근버스 탑승 희망 장소', '입력_shuttleBoardingPlace']),
      '희망 급여 방식': pick_(old, ['희망 급여 방식', '선택_salaryType']),
      '희망 급여': pick_(old, ['희망 급여', '입력_desiredSalary']),
      '출근 가능일': pick_(old, ['출근 가능일', '입력_availableStartDate']),
      '근무조건 요청사항': pick_(old, ['근무조건 요청사항', '입력_workConditionNote']),
      '건강상태': pick_(old, ['건강상태', '선택_healthStatus']),
      '기존 병력': pick_(old, ['기존 병력', '입력_medicalHistory']),
      '좌안 시력': pick_(old, ['좌안 시력', '입력_leftVision']),
      '우안 시력': pick_(old, ['우안 시력', '입력_rightVision']),
      '안경·렌즈 착용': pick_(old, ['안경·렌즈 착용', '선택_visionCorrection']),
      '흡연 여부': pick_(old, ['흡연 여부', '선택_smokingStatus']),
      '특이사항': pick_(old, ['특이사항', '입력_specialNotes']),
      '희망 고용 방식': pick_(old, ['희망 고용 방식', '선택_insurancePreference']),
      '개인정보 동의': pick_(old, ['개인정보 동의', '선택_privacyConsent']) || '동의',
      '전자서명': pick_(old, ['전자서명']),
      '브라우저정보': pick_(old, ['브라우저정보'])
    };

    for (let i = 1; i <= 3; i += 1) {
      record[`경력${i} 회사명`] = pick_(old, [`경력${i} 회사명`, `입력_careerCompany${i}`]);
      record[`경력${i} 근무기간`] = pick_(old, [`경력${i} 근무기간`, `입력_careerPeriod${i}`]);
      record[`경력${i} 담당업무`] = pick_(old, [`경력${i} 담당업무`, `입력_careerJob${i}`]);
      record[`경력${i} 근무형태`] = pick_(old, [`경력${i} 근무형태`, `선택_careerType${i}`]);
      record[`경력${i} 퇴사사유`] = pick_(old, [`경력${i} 퇴사사유`, `입력_careerReason${i}`]);
    }

    rows.push(HEADERS.map((header) => record[header] ?? ''));
    existingReceipts.add(String(receipt));
  });

  if (rows.length) {
    targetSheet.getRange(targetSheet.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
  }
}

function normalizeLegacyDate_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return value;
  return Utilities.formatDate(date, TIME_ZONE, 'yyyy-MM-dd HH:mm:ss');
}

function pick_(object, keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = object[keys[i]];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function firstChecked_(value) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function joinChecked_(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value || '';
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
