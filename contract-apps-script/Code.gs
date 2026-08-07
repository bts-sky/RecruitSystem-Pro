const CONTRACT_SYSTEM = {
  ROOT_FOLDER_NAME: "하늘컴퍼니_근로계약서",
  SPREADSHEET_NAME: "하늘컴퍼니_근로계약관리",
  SHEET_NAME: "근로계약목록",
  VERSION: "contract-v3.0"
};
const CONTRACT_HEADERS=["토큰","접수번호","성명","연락처","주소","입사일","상태","생성일시","완료일시","작성일","주민등록번호","은행명","예금주","계좌번호","서명파일","계약PDF","근로계약내용","안전수칙내용"];

function setupContractSystem(){
  const p=PropertiesService.getScriptProperties();
  let fid=p.getProperty('CONTRACT_ROOT_FOLDER_ID'); if(!fid){const f=DriveApp.createFolder(CONTRACT_SYSTEM.ROOT_FOLDER_NAME);fid=f.getId();p.setProperty('CONTRACT_ROOT_FOLDER_ID',fid);}
  let sid=p.getProperty('CONTRACT_SPREADSHEET_ID'); if(!sid){const s=SpreadsheetApp.create(CONTRACT_SYSTEM.SPREADSHEET_NAME);sid=s.getId();p.setProperty('CONTRACT_SPREADSHEET_ID',sid);}
  const ss=SpreadsheetApp.openById(sid);let sh=ss.getSheetByName(CONTRACT_SYSTEM.SHEET_NAME);if(!sh){sh=ss.getSheets()[0];sh.setName(CONTRACT_SYSTEM.SHEET_NAME);}ensureContractHeaders_(sh);
  return {ok:true,folderUrl:'https://drive.google.com/drive/folders/'+fid,spreadsheetUrl:'https://docs.google.com/spreadsheets/d/'+sid};
}

// 이 줄을 현재 RecruitSystem 관리자 비밀번호와 같은 값으로 바꾼 뒤 1회 실행하세요.
function setupContractAdminPassword(){
  const password="CHANGE_THIS_TO_YOUR_CURRENT_ADMIN_PASSWORD";
  if(!password || password.indexOf('CHANGE_THIS')===0) throw new Error('setupContractAdminPassword 함수 안의 password를 현재 관리자 비밀번호로 바꿔 주세요.');
  PropertiesService.getScriptProperties().setProperty('CONTRACT_ADMIN_PASSWORD',password);
  return {ok:true,message:'근로계약 관리자 비밀번호가 설정되었습니다.'};
}

function doGet(e){
  const q=(e&&e.parameter)||{}, action=txt_(q.action);
  try{
    if(action==='createContractLink')return out_(createContractLink_(q),q.callback);
    if(action==='getContract')return out_(getContract_(q.token),q.callback);
    if(action==='adminContractList')return out_(adminContractList_(q),q.callback);
    return out_({ok:true,service:'EmploymentContract',version:CONTRACT_SYSTEM.VERSION},q.callback);
  }catch(err){return out_({ok:false,message:err&&err.message?err.message:'처리 중 오류가 발생했습니다.'},q.callback);}
}

function doPost(e){
  const lock=LockService.getScriptLock();
  try{lock.waitLock(30000);if(!e||!e.postData||!e.postData.contents)throw new Error('전송 데이터가 없습니다.');const d=JSON.parse(e.postData.contents);if(txt_(d.action)!=='submitContract')throw new Error('지원하지 않는 요청입니다.');return json_(submitContract_(d));}
  catch(err){return json_({ok:false,message:err&&err.message?err.message:'근로계약 저장 중 오류가 발생했습니다.'});}
  finally{try{lock.releaseLock();}catch(_){}}
}

function createContractLink_(q){
  verify_(q.password); const sh=sheet_(); ensureContractHeaders_(sh); const receipt=txt_(q.receipt); if(!receipt)throw new Error('접수번호가 없습니다.');
  const rows=objects_(sh); let rec=rows.find(x=>txt_(x['접수번호'])===receipt && txt_(x['상태'])!=='완료');
  let token=rec?txt_(rec['토큰']):Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'').slice(0,16);
  if(!rec){sh.appendRow([token,receipt,txt_(q.name),txt_(q.phone),txt_(q.address),txt_(q.startDate),'대기',new Date(),'','','','','','','','','','']);}
  const base=txt_(q.baseUrl); if(!/^https?:\/\//i.test(base))throw new Error('계약서 주소가 올바르지 않습니다.');
  return {ok:true,token,url:base+(base.indexOf('?')>=0?'&':'?')+'mode=sign&token='+encodeURIComponent(token)};
}

function getContract_(token){
  const rec=findToken_(token); if(!rec)throw new Error('유효하지 않거나 만료된 계약 링크입니다.');
  return {ok:true,contract:{receipt:txt_(rec['접수번호']),name:txt_(rec['성명']),phone:txt_(rec['연락처']),address:txt_(rec['주소']),startDate:txt_(rec['입사일']),status:txt_(rec['상태']),writtenDate:txt_(rec['작성일']),rrn:txt_(rec['주민등록번호']),bank:txt_(rec['은행명']),holder:txt_(rec['예금주']),account:txt_(rec['계좌번호']),contractText:txt_(rec['근로계약내용']),safetyText:txt_(rec['안전수칙내용'])}};
}

function adminContractList_(q){
  verify_(q.password); const rows=objects_(sheet_()); return {ok:true,contracts:rows.map(r=>({receipt:txt_(r['접수번호']),name:txt_(r['성명']),status:txt_(r['상태'])||'대기',token:txt_(r['토큰']),pdfUrl:txt_(r['계약PDF']),completedAt:txt_(r['완료일시'])}))};
}

function submitContract_(d){
  const token=txt_(d.token), found=findTokenRow_(token); if(!found)throw new Error('유효하지 않은 계약 링크입니다.'); const sh=found.sheet,row=found.row, headers=found.headers, current=objFromRow_(headers,sh.getRange(row,1,1,headers.length).getDisplayValues()[0]);
  if(txt_(current['상태'])==='완료')throw new Error('이미 작성 완료된 근로계약서입니다.');
  const rrn=txt_(d.rrn).replace(/\D/g,''); if(rrn.length!==13)throw new Error('주민등록번호 13자리를 확인해 주세요.'); if(!txt_(d.signatureData))throw new Error('전자서명이 없습니다.');
  const folder=getOrCreateReceiptFolder_(txt_(current['접수번호']),txt_(d.name||current['성명']));
  const sig=saveDataUrl_(folder,d.signatureData,'근로계약_서명.png');
  const record={"연락처":txt_(d.phone),"주소":txt_(d.address),"입사일":txt_(d.startDate),"상태":"완료","완료일시":new Date(),"작성일":txt_(d.writtenDate),"주민등록번호":txt_(d.rrn),"은행명":txt_(d.bank),"예금주":txt_(d.holder),"계좌번호":txt_(d.account),"서명파일":sig.getUrl(),"근로계약내용":txt_(d.contractText),"안전수칙내용":txt_(d.safetyText),"성명":txt_(d.name)};
  Object.keys(record).forEach(k=>{const c=headers.indexOf(k)+1;if(c)sh.getRange(row,c).setValue(record[k]);}); SpreadsheetApp.flush();
  const pdf=createContractPdf_(folder,Object.assign({},current,record),sig); const pc=headers.indexOf('계약PDF')+1;if(pc)sh.getRange(row,pc).setValue(pdf.getUrl()); SpreadsheetApp.flush();
  return {ok:true,message:'근로계약서가 정상적으로 저장되었습니다.',pdfUrl:pdf.getUrl()};
}

function createContractPdf_(folder,r,sig){
  const doc=DocumentApp.create('근로계약서_'+safe_(r['성명'])+'_임시'),body=doc.getBody(); body.setMarginTop(18).setMarginBottom(18).setMarginLeft(24).setMarginRight(24);
  let p=body.appendParagraph('근 로 계 약 서');p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);p.editAsText().setBold(true).setFontSize(18);
  const table=body.appendTable([["근로계약서","안전수칙 서약서"],[txt_(r['근로계약내용']),txt_(r['안전수칙내용'])]]);table.setBorderWidth(0.6);table.getRow(0).getCell(0).editAsText().setBold(true);table.getRow(0).getCell(1).editAsText().setBold(true);
  body.appendParagraph('작성일: '+txt_(r['작성일'])+'    입사일: '+txt_(r['입사일'])+'    연락처: '+txt_(r['연락처']));
  body.appendParagraph('주민등록번호: '+txt_(r['주민등록번호'])+'    확인자 성명: '+txt_(r['성명'])); body.appendParagraph('주소(현거주지): '+txt_(r['주소'])); body.appendParagraph('은행명: '+txt_(r['은행명'])+'    예금주: '+txt_(r['예금주'])+'    계좌번호: '+txt_(r['계좌번호']));
  const sp=body.appendParagraph('전자서명: ');try{sp.appendInlineImage(sig.getBlob()).setWidth(90).setHeight(35);}catch(_){sp.appendText('(서명 저장됨)');}
  body.appendParagraph('본 근로계약서는 본인이 작성하고, 사진전송및복사 교부함을 확인하였음.'); body.appendParagraph('주식회사 하늘컴퍼니    대표자 박호림 (직인)').setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  doc.saveAndClose(); const f=DriveApp.getFileById(doc.getId()), pdf=folder.createFile(f.getAs(MimeType.PDF).setName('근로계약서_'+safe_(r['성명'])+'.pdf'));f.setTrashed(true);return pdf;
}

function sheet_(){const id=PropertiesService.getScriptProperties().getProperty('CONTRACT_SPREADSHEET_ID');if(!id)throw new Error('setupContractSystem()을 먼저 실행해 주세요.');const sh=SpreadsheetApp.openById(id).getSheetByName(CONTRACT_SYSTEM.SHEET_NAME);if(!sh)throw new Error('근로계약목록 시트를 찾을 수 없습니다.');ensureContractHeaders_(sh);return sh;}
function ensureContractHeaders_(sh){const n=CONTRACT_HEADERS.length;if(sh.getLastRow()===0){sh.getRange(1,1,1,n).setValues([CONTRACT_HEADERS]);return;}const cur=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),n)).getDisplayValues()[0];CONTRACT_HEADERS.forEach((h,i)=>{if(txt_(cur[i])!==h)sh.getRange(1,i+1).setValue(h);});}
function objects_(sh){if(sh.getLastRow()<2)return[];const hs=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(txt_);return sh.getRange(2,1,sh.getLastRow()-1,hs.length).getDisplayValues().map(r=>objFromRow_(hs,r));}
function objFromRow_(h,r){const o={};h.forEach((x,i)=>{if(x)o[x]=r[i]||''});return o;}
function findToken_(token){const f=findTokenRow_(token);return f?objFromRow_(f.headers,f.sheet.getRange(f.row,1,1,f.headers.length).getDisplayValues()[0]):null;}
function findTokenRow_(token){token=txt_(token);if(!token)return null;const sh=sheet_(),hs=sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0].map(txt_),c=hs.indexOf('토큰');if(c<0)return null;const vs=sh.getRange(2,c+1,Math.max(0,sh.getLastRow()-1),1).getDisplayValues();for(let i=0;i<vs.length;i++)if(txt_(vs[i][0])===token)return{sheet:sh,row:i+2,headers:hs};return null;}
function getOrCreateReceiptFolder_(receipt,name){const id=PropertiesService.getScriptProperties().getProperty('CONTRACT_ROOT_FOLDER_ID');if(!id)throw new Error('setupContractSystem()을 먼저 실행해 주세요.');const root=DriveApp.getFolderById(id),nm=safe_(receipt+'_'+name),it=root.getFoldersByName(nm);return it.hasNext()?it.next():root.createFolder(nm);}
function saveDataUrl_(folder,dataUrl,name){const m=txt_(dataUrl).match(/^data:([^;]+);base64,(.+)$/);if(!m)throw new Error('전자서명 데이터가 올바르지 않습니다.');return folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]),m[1],name));}
function verify_(p){const saved=PropertiesService.getScriptProperties().getProperty('CONTRACT_ADMIN_PASSWORD');if(!saved)throw new Error('setupContractAdminPassword()를 먼저 실행해 주세요.');if(txt_(p)!==saved)throw new Error('관리자 비밀번호가 올바르지 않습니다.');}
function out_(d,cb){cb=txt_(cb);if(cb&&/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(cb))return ContentService.createTextOutput(cb+'('+JSON.stringify(d)+');').setMimeType(ContentService.MimeType.JAVASCRIPT);return json_(d);}
function json_(d){return ContentService.createTextOutput(JSON.stringify(d)).setMimeType(ContentService.MimeType.JSON);}
function txt_(v){return String(v==null?'':v).trim();}
function safe_(v){return txt_(v).replace(/[\\/:*?"<>|#%{}]/g,'_').slice(0,100)||'계약서';}
