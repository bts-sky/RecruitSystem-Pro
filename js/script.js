document.addEventListener("DOMContentLoaded",()=>{
"use strict";
const form=document.getElementById("applicationForm"),steps=[...document.querySelectorAll(".form-step")];
const names={1:"기본정보",2:"학력 및 경력사항",3:"근무조건",4:"사진 및 이력서",5:"개인정보 동의 및 서명",6:"최종 확인"};
let current=1,hasSignature=false;
const $=id=>document.getElementById(id);
function careerCards(){const c=$("careerContainer");for(let i=1;i<=3;i++)c.insertAdjacentHTML("beforeend",`<div class="career-card"><h3>경력 ${i}${i===1?" · 최근 경력":""}</h3><div class="form-group"><label for="careerCompany${i}">회사명 또는 근무지</label><input id="careerCompany${i}" name="careerCompany${i}"></div><div class="form-row"><div class="form-group"><label for="careerPeriod${i}">근무기간</label><input id="careerPeriod${i}" name="careerPeriod${i}" placeholder="예: 2024.01 ~ 2025.06"></div><div class="form-group"><label for="careerJob${i}">담당업무</label><input id="careerJob${i}" name="careerJob${i}" placeholder="예: 생산, 검사, 포장"></div></div><div class="form-group"><label for="careerReason${i}">퇴사사유</label><input id="careerReason${i}" name="careerReason${i}"></div></div>`)}
function show(n){current=n;steps.forEach(s=>s.classList.toggle("active",Number(s.dataset.step)===n));$("currentStepText").textContent=names[n];$("currentStepNumber").textContent=n;$("progressBarFill").style.width=`${n/6*100}%`;if(n===5){requestAnimationFrame(()=>requestAnimationFrame(resizeSignatureCanvas))}if(n===6){renderPreview();window.RecruitUpload?.renderFinalUploadPreview()}window.scrollTo({top:0,behavior:"smooth"})}
function error(id,msg=""){$(id).textContent=msg}
function dateValid(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const [y,m,d]=v.split("-").map(Number),x=new Date(y,m-1,d);return x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d}
function validate1(){["koreanNameError","phoneError","birthDateError","genderError","addressError"].forEach(x=>error(x));let ok=true;if(!$("koreanName").value.trim()){error("koreanNameError","성명을 입력해 주세요.");ok=false}if(!/^010-\d{4}-\d{4}$/.test($("phone").value)){error("phoneError","휴대전화 번호를 정확히 입력해 주세요.");ok=false}if(!dateValid($("birthDate").value)){error("birthDateError","생년월일을 YYYY-MM-DD 형식으로 입력해 주세요.");ok=false}if(!form.querySelector('[name="gender"]:checked')){error("genderError","성별을 선택해 주세요.");ok=false}if(!$("address").value.trim()){error("addressError","주소를 입력해 주세요.");ok=false}return ok}
function validate4(){if(!window.RecruitUpload?.getMetadata().hasPhoto){error("profilePhotoError","사진을 선택하고 ‘이 사진 사용’을 눌러 확정해 주세요.");return false}return true}
function validate5(){error("privacyConsentError");error("signatureError");let ok=true;if(!$("privacyConsent").checked){error("privacyConsentError","개인정보 수집·이용에 동의해 주세요.");ok=false}if(!hasSignature){error("signatureError","전자서명을 입력해 주세요.");ok=false}return ok}
function val(id){return $(id)?.value.trim()||"미입력"}function selected(name){return form.querySelector(`[name="${name}"]:checked`)?.value||"미선택"}
function section(title,rows){return `<section class="preview-section"><h3>${title}</h3><dl>${rows.map(([a,b])=>`<div class="preview-row"><dt>${a}</dt><dd>${escapeHtml(b)}</dd></div>`).join("")}</dl></section>`}
function escapeHtml(v){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function renderPreview(){const careers=[];for(let i=1;i<=3;i++){const company=val(`careerCompany${i}`);if(company!=="미입력")careers.push(`${company} / ${val(`careerPeriod${i}`)} / ${val(`careerJob${i}`)}`)}$("finalPreview").innerHTML=section("기본정보",[["성명",val("koreanName")],["휴대전화",val("phone")],["생년월일",val("birthDate")],["성별",selected("gender")],["주소",val("address")]])+section("학력·경력",[["학교명",val("schoolName")],["졸업년도",val("graduationYear")],["경력",careers.join("\n")||"미입력"]])+section("근무조건",[["근무형태",selected("workType")],["출퇴근",selected("commuteType")],["통근버스 탑승 위치",selected("commuteType")==="통근버스"?val("shuttleLocation"):"해당 없음"],["희망 고용 방식",selected("insurancePreference")],["출근 가능일",val("availableStartDate")],["요청사항",val("workConditionNote")]])}
document.querySelectorAll("[data-next]").forEach(b=>b.onclick=()=>{
  const n=Number(b.dataset.next);
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
commuteRadios.forEach(radio=>radio.addEventListener("change",updateShuttleLocation));
$("step4NextButton").onclick=()=>{if(validate4())show(5)};
$("step5NextButton").onclick=()=>{if(validate5())show(6)};
["phone","emergencyPhone"].forEach(id=>$(id).addEventListener("input",e=>{const d=e.target.value.replace(/\D/g,"").slice(0,11);e.target.value=d.length<=3?d:d.length<=7?`${d.slice(0,3)}-${d.slice(3)}`:`${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`}));
["birthDate","availableStartDate"].forEach(id=>$(id).addEventListener("input",e=>{const d=e.target.value.replace(/\D/g,"").slice(0,8);e.target.value=d.length<=4?d:d.length<=6?`${d.slice(0,4)}-${d.slice(4)}`:`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6)}`;if(id==="birthDate"&&dateValid(e.target.value)){const [y,m,day]=e.target.value.split("-").map(Number),t=new Date();let a=t.getFullYear()-y;if(t.getMonth()+1<m||(t.getMonth()+1===m&&t.getDate()<day))a--;$("age").value=a>=0?a:""}}));
const signatureCanvas=$("signatureCanvas");
const signatureContext=signatureCanvas.getContext("2d");
const signatureWrap=signatureCanvas.parentElement;
let signatureDrawing=false;
let signatureLastPoint=null;
let signaturePointerId=null;

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
      $("signatureData").value=signatureCanvas.toDataURL("image/png");
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
  $("signaturePlaceholder").classList.add("hidden");
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
  $("signaturePlaceholder").classList.add("hidden");
}

function signatureEnd(event){
  if(!signatureDrawing)return;
  if(event.pointerId!==undefined&&signaturePointerId!==null&&event.pointerId!==signaturePointerId)return;

  signatureDrawing=false;
  signatureLastPoint=null;
  signaturePointerId=null;
  $("signatureData").value=signatureCanvas.toDataURL("image/png");
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
  $("signaturePlaceholder").classList.remove("hidden");
  $("signatureError").textContent="";
};
$("step5NextButton").addEventListener("click",()=>{$("previewSignatureImage").src=$("signatureData").value});
$("finalSubmitButton").onclick=async()=>{
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
      version:window.RECRUIT_CONFIG?.version||"v1.3.9",
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
careerCards();updateShuttleLocation();show(1);
});