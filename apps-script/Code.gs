const SHEET_NAME = '지원자목록';

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'RecruitSystem-Pro' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = spreadsheet.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

    const flat = flattenSubmission(payload);
    ensureHeaders(sheet, Object.keys(flat));

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const row = headers.map((header) => flat[header] ?? '');
    sheet.appendRow(row);

    return jsonResponse({ ok: true, receiptNumber: payload.receiptNumber || '' });
  } catch (error) {
    return jsonResponse({ ok: false, message: String(error) });
  }
}

function flattenSubmission(payload) {
  const fields = (payload.data && payload.data.fields) || {};
  const checked = (payload.data && payload.data.checked) || {};
  const result = {
    '접수번호': payload.receiptNumber || '',
    '제출일시': payload.submittedAt || new Date().toISOString(),
    '지원자명': payload.applicantName || fields.koreanName || '',
    '연락처': payload.phone || fields.phone || '',
    '브라우저정보': payload.userAgent || ''
  };

  Object.keys(fields).forEach((key) => {
    if (key === 'signatureData') return;
    result['입력_' + key] = fields[key];
  });

  Object.keys(checked).forEach((key) => {
    result['선택_' + key] = Array.isArray(checked[key]) ? checked[key].join(', ') : checked[key];
  });

  result['전자서명'] = fields.signatureData ? '서명 완료' : '서명 없음';
  return result;
}

function ensureHeaders(sheet, keys) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, keys.length).setValues([keys]);
    sheet.setFrozenRows(1);
    return;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const missing = keys.filter((key) => headers.indexOf(key) === -1);
  if (missing.length) {
    sheet.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
  }
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
