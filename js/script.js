document.addEventListener("DOMContentLoaded",()=>{
"use strict";
const form=document.getElementById("applicationForm"),steps=[...document.querySelectorAll(".form-step")];
const names={1:"기본정보",2:"학력 및 경력사항",3:"근무조건",4:"사진 및 이력서",5:"개인정보 동의 및 서명",6:"최종 확인"};
let current=1,hasSignature=false;
const $=id=>document.getElementById(id);
const FRONTEND_VERSION="v5.5.3-validation";
const OPTIONAL_IDS=new Set(["age","resumeFile","signatureData","workConditionNote"]);
const CONDITIONAL_IDS=new Set(["nationalityOther","visa","shuttleLocation","medicalHistory"]);
function insertAfter(reference,node){reference?.parentNode?.insertBefore(node,reference.nextSibling)}
function htmlNode(html){const box=document.createElement("div");box.innerHTML=html.trim();return box.firstElementChild}
function ensureAdditionalFields(){
  if(!$("maritalStatusField")){
    const gender=form.querySelector('[name="gender"]')?.closest("fieldset");
    const node=htmlNode(`<fieldset class="form-group" id="maritalStatusField"><legend>결혼 여부 *</legend><div class="choice-grid"><label><input type="radio" name="maritalStatus" value="미혼"><span>미혼</span></label><label><input type="radio" name="maritalStatus" value="기혼"><span>기혼</span></label><label><input type="radio" name="maritalStatus" value="기타"><span>기타</span></label></div><p class="field-error" id="maritalStatusError"></p></fieldset>`);
    insertAfter(gender,node);
  }
  if(!$("emergencyRelation")){
    const emergency=$("emergencyPhone")?.closest(".form-group");
    const node=htmlNode(`<div class="form-group"><label for="emergencyRelation">비상연락처 관계 *</label><input id="emergencyRelation" name="emergencyRelation" placeholder="예: 배우자, 부모, 형제자매" required><p class="field-error" id="emergencyRelationError"></p></div>`);
    insertAfter(emergency,node);
  }
  if(!$("bloodType")){
    const vision=$("correctedVision")?.closest(".form-group");
    const node=htmlNode(`<div class="form-group"><label for="bloodType">혈액형 *</label><select id="bloodType" name="bloodType" required><option value="">선택해 주세요</option><option value="A형">A형</option><option value="B형">B형</option><option value="O형">O형</option><option value="AB형">AB형</option><option value="모름">모름</option></select><p class="field-error" id="bloodTypeError"></p></div>`);
    insertAfter(vision,node);
  }
  if(!$("shoeSize")){
    const weight=$("weight")?.closest(".form-group");
    const node=htmlNode(`<div class="form-group"><label for="shoeSize">신발 사이즈(mm) *</label><input id="shoeSize" name="shoeSize" type="number" inputmode="numeric" min="200" max="330" step="5" placeholder="예: 265" required><p class="field-error" id="shoeSizeError"></p></div>`);
    insertAfter(weight,node);
  }
}
function visible(el){return Boolean(el)&&!el.disabled&&el.type!=="hidden"&&!el.closest(".hidden")&&el.offsetParent!==null}
function groupLabel(el){const box=el.closest(".form-group,fieldset");return (box?.querySelector("label,legend")?.textContent||"필수 항목").replace("*","").trim()}
function markAllRequired(){
  [...form.elements].forEach(el=>{
    if(!el.id&&!el.name)return;
    if(OPTIONAL_IDS.has(el.id)||el.readOnly)return;
    if(["button","submit","reset","file","hidden"].includes(el.type))return;
    if(CONDITIONAL_IDS.has(el.id))return;
    if(/^career(Company|Period|Job|EmploymentType|Reason)[23]$/.test(el.id))return;
    el.required=true;
    const label=el.closest(".form-group,fieldset")?.querySelector("label,legend");
    if(label&&!label.textContent.includes("*"))label.append(" *");
  });
}
function updateConditionalRequired(){
  const foreign=Boolean($("nationality")?.value&&$("nationality").value!=="대한민국");
  if($("visa"))$("visa").required=foreign;
  if($("nationalityOther"))$("nationalityOther").required=$("nationality")?.value==="기타";
  if($("shuttleLocation"))$("shuttleLocation").required=selected("commuteType")==="통근버스";
  if($("medicalHistory")){
    const health=selected("healthStatus");
    $("medicalHistory").required=health==="치료중"||health==="기타";
  }
}
function validateCareerRows(){
  for(let i=1;i<=3;i++){
    const fields=[`careerCompany${i}`,`careerPeriod${i}`,`careerJob${i}`,`careerEmploymentType${i}`,`careerReason${i}`].map($);
    const started=fields.some(el=>el&&el.value.trim());
    if(!started)continue;
    const missing=fields.find(el=>!el?.value.trim());
    if(missing){alert(`경력 ${i}의 회사명, 근무기간, 담당업무, 근무형태, 퇴사사유를 모두 입력해 주세요.`);missing.focus();return false}
  }
  return true;
}
function validateRequiredStep(stepNumber){
  updateConditionalRequired();
  const step=steps.find(item=>Number(item.dataset.step)===stepNumber);
  if(!step)return true;
  const seenGroups=new Set();
  for(const el of [...step.querySelectorAll("input,select,textarea")]){
    if(!visible(el)||OPTIONAL_IDS.has(el.id)||el.readOnly)continue;
    if(el.type==="file"){
      if(el.id==="profilePhoto"&&!window.RecruitUpload?.getMetadata().hasPhoto){error("profilePhotoError","사진을 선택하고 ‘이 사진 사용’을 눌러 확정해 주세요.");return false}
      continue;
    }
    if(!el.required)continue;
    if((el.type==="radio"||el.type==="checkbox")&&el.name){
      if(seenGroups.has(el.name))continue;
      seenGroups.add(el.name);
      if(!step.querySelector(`[name="${CSS.escape(el.name)}"]:checked`)){alert(`${groupLabel(el)}을(를) 선택해 주세요.`);el.scrollIntoView({behavior:"smooth",block:"center"});return false}
      continue;
    }
    if(!String(el.value||"").trim()){alert(`${groupLabel(el)}을(를) 입력해 주세요.`);el.focus();el.scrollIntoView({behavior:"smooth",block:"center"});return false}
  }
  if(stepNumber===2&&!validateCareerRows())return false;
  return true;
}

function validatePrivacyConsent(){
  const boxes=[...form.querySelectorAll('[name="privacyConsent"]')];
  if(!boxes.length)return true;
  const checked=boxes.find(el=>el.checked);
  if(!checked){
    alert("개인정보 수집 및 이용에 동의해야 제출할 수 있습니다.");
    boxes[0].scrollIntoView({behavior:"smooth",block:"center"});
    return false;
  }
  const value=String(checked.value||"").trim();
  if(value==="동의하지 않음"||value==="미동의"){
    alert("개인정보 수집 및 이용에 동의해야 제출할 수 있습니다.");
    checked.scrollIntoView({behavior:"smooth",block:"center"});
    return false;
  }
  return true;
}

function validateAllSteps(){
  for(let n=1;n<=5;n++){if(!validateRequiredStep(n)){show(n);return false}}
  if(!validatePrivacyConsent())return false;
  return true;
}
function careerCards(){const c=$("careerContainer");for(let i=1;i<=3;i++)c.insertAdjacentHTML("beforeend",`<div class="career-card"><h3>경력 ${i}${i===1?" · 최근 경력":""}</h3><div class="form-group"><label for="careerCompany${i}">회사명 또는 근무지</label><input id="careerCompany${i}" name="careerCompany${i}"></div><div class="form-row"><div class="form-group"><label for="careerPeriod${i}">근무기간</label><input id="careerPeriod${i}" name="careerPeriod${i}" placeholder="예: 2024.01 ~ 2025.06"></div><div class="form-group"><label for="careerJob${i}">담당업무</label><input id="careerJob${i}" name="careerJob${i}" placeholder="예: 생산, 검사, 포장"></div></div><div class="form-row"><div class="form-group"><label for="careerEmploymentType${i}">근무형태</label><input id="careerEmploymentType${i}" name="careerEmploymentType${i}" placeholder="아르바이트·계약·정규·도급"></div><div class="form-group"><label for="careerReason${i}">퇴사사유</label><input id="careerReason${i}" name="careerReason${i}"></div></div></div>`)}
function show(n){current=n;steps.forEach(s=>s.classList.toggle("active",Number(s.dataset.step)===n));$("currentStepText").textContent=names[n];$("currentStepNumber").textContent=n;$("progressBarFill").style.width=`${n/6*100}%`;if(n===5){requestAnimationFrame(()=>requestAnimationFrame(resizeSignatureCanvas))}if(n===6){renderPreview();window.RecruitUpload?.renderFinalUploadPreview()}window.scrollTo({top:0,behavior:"smooth"})}
function error(id,msg=""){$(id).textContent=msg}
function dateValid(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const [y,m,d]=v.split("-").map(Number),x=new Date(y,m-1,d);return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d}
function validate1(){["koreanNameError","phoneError","birthDateError","genderError","addressError","nationalityError","nationalityOtherError","visaError","militaryStatusError"].forEach(x=>error(x));let ok=true;if(!$("koreanName").value.trim()){error("koreanNameError","성명을 입력해 주세요.");ok=false}if(!/^010-\d{4}-\d{4}$/.test($("phone").value)){error("phoneError","휴대전화 번호를 정확히 입력해 주세요.");ok=false}if(!dateValid($("birthDate").value)){error("birthDateError","생년월일을 YYYY-MM-DD 형식으로 입력해 주세요.");ok=false}if(!form.querySelector('[name="gender"]:checked')){error("genderError","성별을 선택해 주세요.");ok=false}if(!$("address").value.trim()){error("addressError","주소를 입력해 주세요.");ok=false}
if(!$("nationality").value){error("nationalityError","국적을 선택해 주세요.");ok=false}
if($("nationality").value==="기타"&&!$("nationalityOther").value.trim()){error("nationalityOtherError","국가명을 입력해 주세요.");ok=false}
if($("nationality").value&&$("nationality").value!=="대한민국"&&!$("visa").value){error("visaError","비자 종류를 선택해 주세요.");ok=false}
if(!form.querySelector('[name="militaryStatus"]:checked')){error("militaryStatusError","병역사항을 선택해 주세요.");ok=false}
return ok}
function validate4(){if(!window.RecruitUpload?.getMetadata().hasPhoto){error("profilePhotoError","사진을 선택하고 ‘이 사진 사용’을 눌러 확정해 주세요.");return false}return true}
function validate5(){error("privacyConsentError");error("signatureError");let ok=true;if(!$("privacyConsent").checked){error("privacyConsentError","개인정보 수집·이용에 동의해 주세요.");ok=false}if(!hasSignature){error("signatureError","전자서명을 입력해 주세요.");ok=false}return ok}
function val(id){return $(id)?.value.trim()||"미입력"}function selected(name){return form.querySelector(`[name="${name}"]:checked`)?.value||"미선택"}
function section(title,rows){return `<section class="preview-section"><h3>${title}</h3><dl>${rows.map(([a,b])=>`<div class="preview-row"><dt>${a}</dt><dd>${escapeHtml(b)}</dd></div>`).join("")}</dl></section>`}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function renderPreview(){
  const careers=[];
  for(let i=1;i<=3;i++){
    const values=[val(`careerCompany${i}`),val(`careerPeriod${i}`),val(`careerJob${i}`),val(`careerEmploymentType${i}`),val(`careerReason${i}`)];
    if(values.some(v=>v!=="미입력")) careers.push(`경력 ${i}: ${values.join(" / ")}`);
  }
  $("finalPreview").innerHTML=
    section("기본정보",[["성명",val("koreanName")],["휴대전화",val("phone")],["생년월일",val("birthDate")],["만 나이",val("age")],["성별",selected("gender")],["결혼 여부",selected("maritalStatus")],["국적",$("nationality").value==="기타"?val("nationalityOther"):val("nationality")],["비자",$("nationality").value&&$("nationality").value!=="대한민국"?val("visa"):"해당 없음"],["병역사항",selected("militaryStatus")],["주소",val("address")],["비상연락처",val("emergencyPhone")],["비상연락처 관계",val("emergencyRelation")]])+
    section("건강정보",[["건강상태",selected("healthStatus")],["병력 및 특이사항",val("medicalHistory")],["교정시력",val("correctedVision")],["혈액형",val("bloodType")]])+
    section("학력·경력",[["학교명",val("schoolName")],["졸업년도",val("graduationYear")],["경력",careers.join("\n")||"미입력"]])+
    section("근무조건",[["근무형태",selected("workType")],["잔업 가능",selected("overtimeAvailable")],["특근 가능",selected("weekendAvailable")],["출퇴근",selected("commuteType")],["통근버스 탑승 위치",selected("commuteType")==="통근버스"?val("shuttleLocation"):"해당 없음"],["작업복 치수",`키 ${val("height")}cm / 몸무게 ${val("weight")}kg / 신발 ${val("shoeSize")}mm`],["급여통장",`${val("bankName")} / ${val("accountNumber")} / 예금주 ${val("accountHolder")}`],["출근 가능일",val("availableStartDate")],["요청사항",val("workConditionNote")]])+
    section("동의",[["개인정보 수집·이용",$("privacyConsent").checked?"동의":"미동의"]]);
}
document.querySelectorAll("[data-next]").forEach(b=>b.onclick=()=>{
  const n=Number(b.dataset.next);
  if(!validateRequiredStep(current))return;
  if(current===1&&!validate1())return;
  if(current===3){
    error("insurancePreferenceError");
    if(selected("commuteType")==="통근버스"&&!$("shuttleLocation").value.trim()){
      error("shuttleLocationError","통근버스 탑승 희망 위치를 입력해 주세요.");
      $("shuttleLocation").focus();
      return;
    }
    if(selected("insurancePreference")==="미선택"){
      error("insurancePreferenceError","희망 고용 방식을 선택해 주세요.");
      document.querySelector('[name="insurancePreference"]')?.focus();
      return;
    }
  }
  show(n);
});
document.querySelectorAll("[data-prev]").forEach(b=>b.onclick=()=>show(Number(b.dataset.prev)));
const commuteRadios=[...form.querySelectorAll('[name="commuteType"]')];
function updateShuttleLocation(){
  const isShuttle=selected("commuteType")==="통근버스";
  $("shuttleLocationGroup").classList.toggle("hidden",!isShuttle);
  $("shuttleLocation").required=isShuttle;
  if(!isShuttle){
    $("shuttleLocation").value="";
    error("shuttleLocationError");
  }
}
commuteRadios.forEach(radio=>radio.addEventListener("change",()=>{updateShuttleLocation();updateConditionalRequired()}));
const nationalitySelect=$("nationality");
function updateNationalityOther(){
  const other=nationalitySelect.value==="기타";
  $("nationalityOtherGroup").classList.toggle("hidden",!other);
  $("nationalityOther").required=other;
  if(!other){$("nationalityOther").value="";error("nationalityOtherError");}
  const needsVisa=Boolean(nationalitySelect.value&&nationalitySelect.value!=="대한민국");
  $("visaGroup").classList.toggle("hidden",!needsVisa);
  $("visa").required=needsVisa;
  if(!needsVisa){$("visa").value="";error("visaError");}
}
nationalitySelect.addEventListener("change",()=>{updateNationalityOther();updateConditionalRequired()});
form.querySelectorAll('[name="healthStatus"]').forEach(r=>r.addEventListener("change",updateConditionalRequired));
$("step4NextButton").onclick=()=>{if(validateRequiredStep(4)&&validate4())show(5)};
$("step5NextButton").onclick=()=>{if(validateRequiredStep(5)&&validate5())show(6)};
["phone","emergencyPhone"].forEach(id=>$(id).addEventListener("input",e=>{const d=e.target.value.replace(/\D/g,"").slice(0,11);e.target.value=d.length<=3?d:d.length<=7?`${d.slice(0,3)}-${d.slice(3)}`:`${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`}));
["birthDate","availableStartDate"].forEach(id=>$(id).addEventListener("input",e=>{const d=e.target.value.replace(/\D/g,"").slice(0,8);e.target.value=d.length<=4?d:d.length<=6?`${d.slice(0,4)}-${d.slice(4)}`:`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6)}`;if(id==="birthDate"&&dateValid(e.target.value)){const [y,m,day]=e.target.value.split("-").map(Number),t=new Date();let a=t.getFullYear()-y;if(t.getMonth()+1<m||(t.getMonth()+1===m&&t.getDate()<day))a--;$("age").value=a>=0?a:""}}));
const signatureCanvas=$("signatureCanvas");
const signatureContext=signatureCanvas.getContext("2d");
const signatureWrap=signatureCanvas.parentElement;
let signatureDrawing=false;
let signatureLastPoint=null;
let signaturePointerId=null;

function signatureGuideRect(){
  const rect=signatureCanvas.getBoundingClientRect();
  return {x:rect.width*0.15,y:rect.height*0.22,w:rect.width*0.70,h:rect.height*0.56};
}
function exportGuidedSignature(){
  if(!hasSignature)return "";
  const display=signatureCanvas.getBoundingClientRect();
  const guide=signatureGuideRect();
  const scaleX=signatureCanvas.width/display.width;
  const scaleY=signatureCanvas.height/display.height;
  const output=document.createElement("canvas");
  output.width=700;output.height=220;
  const ctx=output.getContext("2d");
  ctx.clearRect(0,0,output.width,output.height);
  ctx.drawImage(signatureCanvas,guide.x*scaleX,guide.y*scaleY,guide.w*scaleX,guide.h*scaleY,0,0,output.width,output.height);
  return output.toDataURL("image/png");
}

function resizeSignatureCanvas(){
  const rect=signatureWrap.getBoundingClientRect();
  const ratio=Math.max(1,window.devicePixelRatio||1);
  const saved=hasSignature?signatureCanvas.toDataURL("image/png"):"";

  signatureCanvas.width=Math.max(1,Math.round(rect.width*ratio));
  signatureCanvas.height=Math.max(1,Math.round(rect.height*ratio));
  signatureCanvas.style.width=`${rect.width}px`;
  signatureCanvas.style.height=`${rect.height}px`;

  signatureContext.setTransform(ratio,0,0,ratio,0,0);
  signatureContext.lineWidth=2.5;
  signatureContext.lineCap="round";
  signatureContext.lineJoin="round";
  signatureContext.strokeStyle="#111";

  if(saved){
    const image=new Image();
    image.onload=()=>{
      signatureContext.drawImage(image,0,0,rect.width,rect.height);
      $("signatureData").value=exportGuidedSignature();
    };
    image.src=saved;
  }
}

function signaturePoint(event){
  const rect=signatureCanvas.getBoundingClientRect();
  return {
    x:event.clientX-rect.left,
    y:event.clientY-rect.top
  };
}

function signatureStart(event){
  if(event.button!==undefined&&event.button!==0)return;
  event.preventDefault();

  signatureDrawing=true;
  signaturePointerId=event.pointerId;
  signatureCanvas.setPointerCapture?.(event.pointerId);

  const point=signaturePoint(event);
  signatureLastPoint=point;

  signatureContext.beginPath();
  signatureContext.moveTo(point.x,point.y);
  signatureContext.lineTo(point.x+0.1,point.y+0.1);
  signatureContext.stroke();

  hasSignature=true;
  $("signaturePlaceholder").classList.add("hidden");signatureWrap.classList.add("has-signature");
  $("signatureError").textContent="";
}

function signatureMove(event){
  if(!signatureDrawing||event.pointerId!==signaturePointerId)return;
  event.preventDefault();

  const point=signaturePoint(event);
  signatureContext.beginPath();
  signatureContext.moveTo(signatureLastPoint.x,signatureLastPoint.y);
  signatureContext.lineTo(point.x,point.y);
  signatureContext.stroke();
  signatureLastPoint=point;

  hasSignature=true;
  $("signaturePlaceholder").classList.add("hidden");signatureWrap.classList.add("has-signature");
}

function signatureEnd(event){
  if(!signatureDrawing)return;
  if(event.pointerId!==undefined&&signaturePointerId!==null&&event.pointerId!==signaturePointerId)return;

  signatureDrawing=false;
  signatureLastPoint=null;
  signaturePointerId=null;
  $("signatureData").value=exportGuidedSignature();
}

requestAnimationFrame(resizeSignatureCanvas);
window.addEventListener("resize",resizeSignatureCanvas);
if(window.ResizeObserver){
  new ResizeObserver(()=>{
    if(current===5) resizeSignatureCanvas();
  }).observe(signatureWrap);
}

signatureCanvas.addEventListener("pointerdown",signatureStart,{passive:false});
signatureCanvas.addEventListener("pointermove",signatureMove,{passive:false});
signatureCanvas.addEventListener("pointerup",signatureEnd);
signatureCanvas.addEventListener("pointercancel",signatureEnd);
signatureCanvas.addEventListener("lostpointercapture",signatureEnd);

$("clearSignatureButton").onclick=()=>{
  const rect=signatureCanvas.getBoundingClientRect();
  signatureContext.clearRect(0,0,rect.width,rect.height);
  hasSignature=false;
  signatureDrawing=false;
  signatureLastPoint=null;
  signaturePointerId=null;
  $("signatureData").value="";
  $("signaturePlaceholder").classList.remove("hidden");signatureWrap.classList.remove("has-signature");
  $("signatureError").textContent="";
};
$("step5NextButton").addEventListener("click",()=>{$("previewSignatureImage").src=$("signatureData").value});
$("finalSubmitButton").onclick=async()=>{
  if(!validateAllSteps())return;
  const btn=$("finalSubmitButton"),message=$("finalSubmitError");
  message.textContent="";
  const endpoint=window.RECRUIT_CONFIG?.googleAppsScriptUrl?.trim();
  if(!endpoint){
    message.textContent="Google Apps Script 배포 주소가 아직 설정되지 않았습니다. js/config.js에 /exec 주소를 입력해 주세요.";
    return;
  }
  btn.disabled=true;
  btn.textContent="제출 중...";
  try{
    const payload={
      version:FRONTEND_VERSION,
      submittedAt:new Date().toISOString(),
      applicantName:val("koreanName"),
      phone:val("phone"),
      form:Object.fromEntries(new FormData(form).entries()),
      uploads:await window.RecruitUpload.buildUploadPayload()
    };
    const response=await fetch(endpoint,{
      method:"POST",
      headers:{"Content-Type":"text/plain;charset=utf-8"},
      body:JSON.stringify(payload)
    });
    const result=await response.json();
    if(!result.ok)throw new Error(result.message||"저장에 실패했습니다.");
    alert(`지원서가 정상적으로 제출되었습니다.
접수번호: ${result.applicationId}`);
    form.reset();
    location.reload();
  }catch(err){
    console.error(err);
    message.textContent=`제출하지 못했습니다: ${err.message||"잠시 후 다시 시도해 주세요."}`;
  }finally{
    btn.disabled=false;
    btn.textContent="최종 제출";
  }
};
ensureAdditionalFields();careerCards();markAllRequired();updateConditionalRequired();updateShuttleLocation();updateNationalityOther();show(1);
});