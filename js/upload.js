(() => {
  "use strict";

  const OUTPUT_WIDTH = 600;
  const OUTPUT_HEIGHT = 800;
  // 화면 중앙의 3:4 점선 프레임만 최종 사진으로 저장합니다.
  const CROP_FRAME_RATIO = 0.44;
  const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
  const MAX_RESUME_BYTES = 15 * 1024 * 1024;

  const state = {
    sourceFile: null,
    originalImage: null,
    workingCanvas: document.createElement("canvas"),
    workingContext: null,
    photoDataUrl: "",
    resumeFile: null,
    scale: 1,
    minScale: 1,
    maxScale: 4,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    pointers: new Map(),
    gestureStartDistance: 0,
    gestureStartScale: 1,
    gestureCenter: null,
    lastPanPoint: null
  };

  state.workingContext = state.workingCanvas.getContext("2d");

  const $ = id => document.getElementById(id);
  const canvas = $("cropCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const stage = $("cropStage");
  const zoom = $("photoZoom");
  const modal = $("photoEditorModal");

  canvas.width = OUTPUT_WIDTH;
  canvas.height = OUTPUT_HEIGHT;

  function readDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("파일 읽기 실패"));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("이미지 불러오기 실패"));
      image.src = src;
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  function rebuildWorkingImage() {
    const image = state.originalImage;
    if (!image) return;

    const quarterTurns = ((state.rotation % 360) + 360) % 360;
    const rotated = quarterTurns === 90 || quarterTurns === 270;

    state.workingCanvas.width = rotated ? image.naturalHeight : image.naturalWidth;
    state.workingCanvas.height = rotated ? image.naturalWidth : image.naturalHeight;

    const wctx = state.workingContext;
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.clearRect(0, 0, state.workingCanvas.width, state.workingCanvas.height);
    wctx.translate(state.workingCanvas.width / 2, state.workingCanvas.height / 2);
    wctx.rotate(quarterTurns * Math.PI / 180);
    wctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
    wctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function getCropRect() {
    const width = canvas.width * CROP_FRAME_RATIO;
    const height = width * (OUTPUT_HEIGHT / OUTPUT_WIDTH);
    return {
      x: (canvas.width - width) / 2,
      y: (canvas.height - height) / 2,
      width,
      height
    };
  }

  function draw() {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!state.originalImage) return;

    const width = state.workingCanvas.width * state.scale;
    const height = state.workingCanvas.height * state.scale;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(state.workingCanvas, state.offsetX, state.offsetY, width, height);
  }

  function clamp() {
    if (!state.originalImage) return;

    const crop = getCropRect();
    const width = state.workingCanvas.width * state.scale;
    const height = state.workingCanvas.height * state.scale;

    // 사진이 중앙 점선 프레임을 항상 완전히 덮도록 제한합니다.
    state.offsetX = Math.min(crop.x, Math.max(crop.x + crop.width - width, state.offsetX));
    state.offsetY = Math.min(crop.y, Math.max(crop.y + crop.height - height, state.offsetY));
  }

  function resetToAutoFit() {
    if (!state.originalImage) return;

    const crop = getCropRect();
    state.minScale = Math.max(
      crop.width / state.workingCanvas.width,
      crop.height / state.workingCanvas.height
    );
    state.maxScale = state.minScale * 4;
    state.scale = Math.min(state.maxScale, state.minScale * 2.6);
    state.offsetX = crop.x + (crop.width - state.workingCanvas.width * state.scale) / 2;
    state.offsetY = crop.y + (crop.height - state.workingCanvas.height * state.scale) / 2;

    zoom.min = String(state.minScale);
    zoom.max = String(state.maxScale);
    zoom.value = String(state.scale);

    clamp();
    draw();
  }

  function rotateBy(degrees) {
    if (!state.originalImage) return;
    state.rotation = (state.rotation + degrees + 360) % 360;
    rebuildWorkingImage();
    resetToAutoFit();
  }

  function setScaleAroundPoint(newScale, centerX, centerY) {
    if (!state.originalImage) return;

    const oldScale = state.scale;
    const boundedScale = Math.min(state.maxScale, Math.max(state.minScale, newScale));
    if (oldScale === boundedScale) return;

    state.offsetX = centerX - (centerX - state.offsetX) * (boundedScale / oldScale);
    state.offsetY = centerY - (centerY - state.offsetY) * (boundedScale / oldScale);
    state.scale = boundedScale;

    zoom.value = String(state.scale);
    clamp();
    draw();
  }

  function stagePoint(clientX, clientY) {
    const rect = stage.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function pointerDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function pointerCenter(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function onPointerDown(event) {
    if (!state.originalImage) return;
    event.preventDefault();
    stage.setPointerCapture?.(event.pointerId);

    const point = stagePoint(event.clientX, event.clientY);
    state.pointers.set(event.pointerId, point);

    if (state.pointers.size === 1) {
      state.lastPanPoint = point;
    } else if (state.pointers.size === 2) {
      const [first, second] = [...state.pointers.values()];
      state.gestureStartDistance = pointerDistance(first, second);
      state.gestureStartScale = state.scale;
      state.gestureCenter = pointerCenter(first, second);
      state.lastPanPoint = null;
    }
  }

  function onPointerMove(event) {
    if (!state.pointers.has(event.pointerId) || !state.originalImage) return;
    event.preventDefault();

    const point = stagePoint(event.clientX, event.clientY);
    state.pointers.set(event.pointerId, point);

    if (state.pointers.size === 1 && state.lastPanPoint) {
      state.offsetX += point.x - state.lastPanPoint.x;
      state.offsetY += point.y - state.lastPanPoint.y;
      state.lastPanPoint = point;
      clamp();
      draw();
      return;
    }

    if (state.pointers.size === 2) {
      const [first, second] = [...state.pointers.values()];
      const distance = pointerDistance(first, second);
      const center = pointerCenter(first, second);

      if (state.gestureStartDistance > 0) {
        const targetScale = state.gestureStartScale *
          (distance / state.gestureStartDistance);
        setScaleAroundPoint(targetScale, center.x, center.y);
      }

      if (state.gestureCenter) {
        state.offsetX += center.x - state.gestureCenter.x;
        state.offsetY += center.y - state.gestureCenter.y;
        state.gestureCenter = center;
        clamp();
        draw();
      }
    }
  }

  function onPointerUp(event) {
    state.pointers.delete(event.pointerId);

    if (state.pointers.size === 1) {
      state.lastPanPoint = [...state.pointers.values()][0];
    } else {
      state.lastPanPoint = null;
    }

    if (state.pointers.size < 2) {
      state.gestureStartDistance = 0;
      state.gestureCenter = null;
    }
  }

  async function choosePhoto(file) {
    $("profilePhotoError").textContent = "";
    if (!file) return;

    const extension = (file.name.split(".").pop() || "").toLowerCase();

    if (!["jpg", "jpeg", "png", "webp"].includes(extension) ||
        file.size > MAX_PHOTO_BYTES) {
      $("profilePhotoError").textContent =
        "JPG, PNG, WEBP 형식의 10MB 이하 사진을 선택해 주세요.";
      return;
    }

    try {
      const source = await readDataURL(file);
      const image = await loadImage(source);

      state.sourceFile = file;
      state.originalImage = image;
      state.rotation = 0;

      rebuildWorkingImage();
      resetToAutoFit();

      modal.classList.remove("hidden");
      document.body.style.overflow = "hidden";
    } catch (error) {
      console.error(error);
      $("profilePhotoError").textContent =
        "사진을 불러오지 못했습니다. 다른 사진을 선택해 주세요.";
    }
  }

  function closeEditor() {
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    state.pointers.clear();
    state.lastPanPoint = null;
  }

  function confirmPhoto() {
    if (!state.originalImage) return;

    // 화면에 현재 보이는 사진을 한 번 최신 상태로 그린 뒤,
    // 중앙 점선 3:4 프레임 영역만 그대로 잘라 저장합니다.
    // 이 방식은 이동·확대·축소·회전 결과와 최종 저장 결과를 일치시킵니다.
    clamp();
    draw();

    const crop = getCropRect();
    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = OUTPUT_WIDTH;
    outputCanvas.height = OUTPUT_HEIGHT;

    const outputContext = outputCanvas.getContext("2d", { alpha: false });
    outputContext.fillStyle = "#ffffff";
    outputContext.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = "high";

    outputContext.drawImage(
      canvas,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      OUTPUT_WIDTH,
      OUTPUT_HEIGHT
    );

    state.photoDataUrl = outputCanvas.toDataURL("image/jpeg", 0.92);
    $("profilePhotoPreviewImage").src = state.photoDataUrl;
    $("profilePhotoPreview").classList.remove("hidden");
    $("profilePhotoError").textContent = "";
    closeEditor();
    renderFinal();
  }

  function handleResume(file) {
    $("resumeFileError").textContent = "";

    if (!file) {
      state.resumeFile = null;
      renderResume();
      return;
    }

    const extension = (file.name.split(".").pop() || "").toLowerCase();

    if (!["pdf", "hwp", "doc", "docx"].includes(extension) ||
        file.size > MAX_RESUME_BYTES) {
      $("resumeFileError").textContent =
        "PDF, HWP, DOC, DOCX 형식의 15MB 이하 파일을 선택해 주세요.";
      return;
    }

    state.resumeFile = file;
    renderResume();
    renderFinal();
  }

  function renderResume() {
    const box = $("resumeFilePreview");

    if (!state.resumeFile) {
      box.classList.add("hidden");
      box.innerHTML = "";
      return;
    }

    box.innerHTML = `
      <div class="file-item">
        <div>
          <strong>${escapeHtml(state.resumeFile.name)}</strong>
          <span>${formatBytes(state.resumeFile.size)}</span>
        </div>
        <button type="button" class="btn secondary small"
          id="removeResumeButton">삭제</button>
      </div>`;

    box.classList.remove("hidden");

    $("removeResumeButton").onclick = () => {
      state.resumeFile = null;
      $("resumeFile").value = "";
      renderResume();
      renderFinal();
    };
  }

  function renderFinal() {
    $("finalPhotoPreview").innerHTML = state.photoDataUrl
      ? `<img class="final-photo" src="${state.photoDataUrl}" alt="지원자 사진">`
      : `<p class="hint">확정된 사진이 없습니다.</p>`;

    $("finalAttachmentPreview").innerHTML = state.resumeFile
      ? `<p><strong>이력서:</strong> ${escapeHtml(state.resumeFile.name)}
         (${formatBytes(state.resumeFile.size)})</p>`
      : `<p class="hint">첨부된 이력서가 없습니다.</p>`;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);

      const reader = new FileReader();
      reader.onload = () => resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        base64: String(reader.result).split(",")[1] || ""
      });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function buildUploadPayload() {
    return {
      profilePhoto: state.photoDataUrl ? {
        name: "profile-photo.jpg",
        type: "image/jpeg",
        width: OUTPUT_WIDTH,
        height: OUTPUT_HEIGHT,
        rotation: state.rotation,
        base64: state.photoDataUrl.split(",")[1]
      } : null,
      resume: await fileToBase64(state.resumeFile)
    };
  }

  $("choosePhotoButton").onclick = () => $("profilePhoto").click();
  $("changePhotoButton").onclick = () => $("profilePhoto").click();
  $("profilePhoto").onchange = event => choosePhoto(event.target.files?.[0]);

  $("chooseResumeButton").onclick = () => $("resumeFile").click();
  $("resumeFile").onchange = event => handleResume(event.target.files?.[0]);

  $("closePhotoEditorButton").onclick = closeEditor;
  $("cancelPhotoButton").onclick = closeEditor;
  $("confirmPhotoButton").onclick = confirmPhoto;

  $("rotateLeftButton").onclick = () => rotateBy(-90);
  $("rotateRightButton").onclick = () => rotateBy(90);
  $("autoFitButton").onclick = resetToAutoFit;

  zoom.oninput = () => {
    setScaleAroundPoint(
      Number(zoom.value),
      canvas.width / 2,
      canvas.height / 2
    );
  };

  stage.addEventListener("pointerdown", onPointerDown, { passive: false });
  stage.addEventListener("pointermove", onPointerMove, { passive: false });
  stage.addEventListener("pointerup", onPointerUp);
  stage.addEventListener("pointercancel", onPointerUp);
  stage.addEventListener("lostpointercapture", onPointerUp);

  stage.addEventListener("wheel", event => {
    if (!state.originalImage) return;
    event.preventDefault();

    const point = stagePoint(event.clientX, event.clientY);
    const factor = event.deltaY < 0 ? 1.08 : 0.92;
    setScaleAroundPoint(state.scale * factor, point.x, point.y);
  }, { passive: false });

  stage.addEventListener("dblclick", event => {
    event.preventDefault();
    resetToAutoFit();
  });

  renderFinal();

  window.RecruitUpload = {
    buildUploadPayload,
    getMetadata: () => ({
      hasPhoto: Boolean(state.photoDataUrl),
      resumeName: state.resumeFile?.name || "",
      photoWidth: state.photoDataUrl ? OUTPUT_WIDTH : 0,
      photoHeight: state.photoDataUrl ? OUTPUT_HEIGHT : 0,
      rotation: state.rotation
    }),
    renderFinalUploadPreview: renderFinal
  };
})();