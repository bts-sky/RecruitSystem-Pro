(() => {
  "use strict";
  const state = { sourceFile:null, image:null, photoDataUrl:"", resumeFile:null, scale:1, minScale:1, offsetX:0, offsetY:0, dragging:false, lastX:0, lastY:0 };
  const $ = id => document.getElementById(id);
  const canvas = $("cropCanvas"), ctx = canvas.getContext("2d");
  const stage = $("cropStage"), zoom = $("photoZoom"), modal = $("photoEditorModal");

  function readDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file)})}
  function loadImage(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src})}
  function formatBytes(n){if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`}
  function draw(){
    if(!state.image)return;
    ctx.fillStyle="#111";ctx.fillRect(0,0,canvas.width,canvas.height);
    const w=state.image.naturalWidth*state.scale, h=state.image.naturalHeight*state.scale;
    ctx.drawImage(state.image,state.offsetX,state.offsetY,w,h);
  }
  function clamp(){
    if(!state.image)return;
    const w=state.image.naturalWidth*state.scale, h=state.image.naturalHeight*state.scale;
    state.offsetX=Math.min(0,Math.max(canvas.width-w,state.offsetX));
    state.offsetY=Math.min(0,Math.max(canvas.height-h,state.offsetY));
  }
  async function choosePhoto(file){
    $("profilePhotoError").textContent="";
    if(!file)return;
    const ext=(file.name.split(".").pop()||"").toLowerCase();
    if(!["jpg","jpeg","png","webp"].includes(ext)||file.size>10*1024*1024){
      $("profilePhotoError").textContent="JPG, PNG, WEBP 형식의 10MB 이하 사진을 선택해 주세요.";return;
    }
    try{
      const src=await readDataURL(file), image=await loadImage(src);
      state.sourceFile=file;state.image=image;
      state.minScale=Math.max(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight);
      state.scale=state.minScale; zoom.min=String(state.minScale); zoom.max=String(state.minScale*3); zoom.value=String(state.scale);
      state.offsetX=(canvas.width-image.naturalWidth*state.scale)/2;
      state.offsetY=(canvas.height-image.naturalHeight*state.scale)/2;
      draw(); modal.classList.remove("hidden"); document.body.style.overflow="hidden";
    }catch(e){$("profilePhotoError").textContent="사진을 불러오지 못했습니다. 다른 사진을 선택해 주세요."}
  }
  function closeEditor(){modal.classList.add("hidden");document.body.style.overflow="";state.dragging=false}
  function pointerPos(e){const r=stage.getBoundingClientRect(),p=e.touches?.[0]||e;return {x:(p.clientX-r.left)*(canvas.width/r.width),y:(p.clientY-r.top)*(canvas.height/r.height)}}
  function start(e){if(!state.image)return;e.preventDefault();const p=pointerPos(e);state.dragging=true;state.lastX=p.x;state.lastY=p.y}
  function move(e){if(!state.dragging)return;e.preventDefault();const p=pointerPos(e);state.offsetX+=p.x-state.lastX;state.offsetY+=p.y-state.lastY;state.lastX=p.x;state.lastY=p.y;clamp();draw()}
  function end(){state.dragging=false}
  function confirm(){
    state.photoDataUrl=canvas.toDataURL("image/jpeg",0.9);
    $("profilePhotoPreviewImage").src=state.photoDataUrl;
    $("profilePhotoPreview").classList.remove("hidden");
    closeEditor(); renderFinal();
  }
  function handleResume(file){
    $("resumeFileError").textContent="";
    if(!file){state.resumeFile=null;renderResume();return}
    const ext=(file.name.split(".").pop()||"").toLowerCase();
    if(!["pdf","hwp","doc","docx"].includes(ext)||file.size>15*1024*1024){
      $("resumeFileError").textContent="PDF, HWP, DOC, DOCX 형식의 15MB 이하 파일을 선택해 주세요.";return;
    }
    state.resumeFile=file;renderResume();renderFinal();
  }
  function renderResume(){
    const box=$("resumeFilePreview");
    if(!state.resumeFile){box.classList.add("hidden");box.innerHTML="";return}
    box.innerHTML=`<div class="file-item"><div><strong>${escapeHtml(state.resumeFile.name)}</strong><span>${formatBytes(state.resumeFile.size)}</span></div><button type="button" class="btn secondary small" id="removeResumeButton">삭제</button></div>`;
    box.classList.remove("hidden");
    $("removeResumeButton").onclick=()=>{state.resumeFile=null;$("resumeFile").value="";renderResume();renderFinal()};
  }
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
  function renderFinal(){
    $("finalPhotoPreview").innerHTML=state.photoDataUrl?`<img class="final-photo" src="${state.photoDataUrl}" alt="지원자 사진">`:`<p class="hint">확정된 사진이 없습니다.</p>`;
    $("finalAttachmentPreview").innerHTML=state.resumeFile?`<p><strong>이력서:</strong> ${escapeHtml(state.resumeFile.name)} (${formatBytes(state.resumeFile.size)})</p>`:`<p class="hint">첨부된 이력서가 없습니다.</p>`;
  }
  function fileToBase64(file){return new Promise((res,rej)=>{if(!file)return res(null);const r=new FileReader();r.onload=()=>res({name:file.name,type:file.type||"application/octet-stream",size:file.size,base64:String(r.result).split(",")[1]||""});r.onerror=rej;r.readAsDataURL(file)})}
  async function buildUploadPayload(){return {profilePhoto:state.photoDataUrl?{name:"profile-photo.jpg",type:"image/jpeg",base64:state.photoDataUrl.split(",")[1]}:null,resume:await fileToBase64(state.resumeFile)}}
  $("choosePhotoButton").onclick=()=>$("profilePhoto").click();
  $("changePhotoButton").onclick=()=>$("profilePhoto").click();
  $("profilePhoto").onchange=e=>choosePhoto(e.target.files?.[0]);
  $("chooseResumeButton").onclick=()=>$("resumeFile").click();
  $("resumeFile").onchange=e=>handleResume(e.target.files?.[0]);
  $("closePhotoEditorButton").onclick=closeEditor;$("cancelPhotoButton").onclick=closeEditor;$("confirmPhotoButton").onclick=confirm;
  zoom.oninput=()=>{if(!state.image)return;const old=state.scale,newS=Number(zoom.value),cx=canvas.width/2,cy=canvas.height/2;state.offsetX=cx-(cx-state.offsetX)*(newS/old);state.offsetY=cy-(cy-state.offsetY)*(newS/old);state.scale=newS;clamp();draw()};
  stage.addEventListener("mousedown",start);window.addEventListener("mousemove",move);window.addEventListener("mouseup",end);
  stage.addEventListener("touchstart",start,{passive:false});stage.addEventListener("touchmove",move,{passive:false});stage.addEventListener("touchend",end);
  renderFinal();
  window.RecruitUpload={buildUploadPayload,getMetadata:()=>({hasPhoto:!!state.photoDataUrl,resumeName:state.resumeFile?.name||""}),renderFinalUploadPreview:renderFinal};
})();