const steps = Array.from(document.querySelectorAll(".wizard-step"));
const stepCounter = document.getElementById("stepCounter");
const progressFill = document.getElementById("progressFill");
const form = document.getElementById("captureForm");
const resultMessage = document.getElementById("resultMessage");
const chooseFolderButton = document.getElementById("chooseFolderButton");
const folderStatus = document.getElementById("folderStatus");
const codeInput = document.getElementById("code");
const saveButton = document.getElementById("saveButton");

const tonguePhotoInput = document.getElementById("tonguePhotoInput");
const tongueVideoInput = document.getElementById("tongueVideoInput");
const tonguePhotoPreview = document.getElementById("tonguePhotoPreview");
const tongueVideoPreview = document.getElementById("tongueVideoPreview");
const tonguePhotoPlaceholder = document.getElementById("tonguePhotoPlaceholder");
const tongueVideoPlaceholder = document.getElementById("tongueVideoPlaceholder");
const tonguePhotoStatus = document.getElementById("tonguePhotoStatus");
const tongueVideoStatus = document.getElementById("tongueVideoStatus");

const startRecordingButton = document.getElementById("startRecording");
const stopRecordingButton = document.getElementById("stopRecording");
const recordingStatus = document.getElementById("recordingStatus");
const voicePreview = document.getElementById("voicePreview");

const faceFrontInput = document.getElementById("faceFrontInput");
const faceLeftInput = document.getElementById("faceLeftInput");
const faceRightInput = document.getElementById("faceRightInput");
const faceFrontPreview = document.getElementById("faceFrontPreview");
const faceLeftPreview = document.getElementById("faceLeftPreview");
const faceRightPreview = document.getElementById("faceRightPreview");
const faceFrontPlaceholder = document.getElementById("faceFrontPlaceholder");
const faceLeftPlaceholder = document.getElementById("faceLeftPlaceholder");
const faceRightPlaceholder = document.getElementById("faceRightPlaceholder");
const faceFrontStatus = document.getElementById("faceFrontStatus");
const faceLeftStatus = document.getElementById("faceLeftStatus");
const faceRightStatus = document.getElementById("faceRightStatus");

const reviewPatientId = document.getElementById("reviewPatientId");
const reviewFolder = document.getElementById("reviewFolder");
const reviewTonguePhoto = document.getElementById("reviewTonguePhoto");
const reviewTongueVideo = document.getElementById("reviewTongueVideo");
const reviewVoice = document.getElementById("reviewVoice");
const reviewFaceFront = document.getElementById("reviewFaceFront");
const reviewFaceLeft = document.getElementById("reviewFaceLeft");
const reviewFaceRight = document.getElementById("reviewFaceRight");

let currentStep = 1;
let rootDirectoryHandle = null;
let recordedAudioBlob = null;
let voiceRecorder = null;
let voiceStream = null;
let voiceChunks = [];

let capturedTonguePhotoBlob = null;
let capturedTongueVideoBlob = null;
let capturedFaceFrontBlob = null;
let capturedFaceLeftBlob = null;
let capturedFaceRightBlob = null;

function setResult(message, isError = false) {
  resultMessage.textContent = message;
  resultMessage.classList.toggle("error", isError);
  resultMessage.classList.toggle("success", !isError);
}

function supportsDeviceFolderSave() {
  return typeof window.showDirectoryPicker === "function";
}

function sanitizePatientId(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_");
}

function updateFolderSupportState() {
  if (supportsDeviceFolderSave()) {
    folderStatus.textContent = rootDirectoryHandle
      ? `Selected device folder: ${rootDirectoryHandle.name}`
      : "No device folder selected yet.";
    chooseFolderButton.disabled = false;
    return;
  }

  folderStatus.textContent =
    "This browser does not support device-folder saving. Use Android Chrome or Edge on HTTPS.";
  chooseFolderButton.disabled = true;
}

async function chooseDeviceFolder() {
  if (!supportsDeviceFolderSave()) {
    setResult("Device-folder saving is not supported in this browser.", true);
    return;
  }

  try {
    rootDirectoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    updateFolderSupportState();
    updateReview();
    setResult(`Device folder selected: ${rootDirectoryHandle.name}`);
  } catch (error) {
    if (error?.name !== "AbortError") {
      setResult("Could not access the selected device folder.", true);
    }
  }
}

function updateProgress() {
  stepCounter.textContent = `Step ${currentStep} of ${steps.length}`;
  progressFill.style.width = `${(currentStep / steps.length) * 100}%`;
}

function showStep(stepNumber) {
  currentStep = stepNumber;
  steps.forEach((step, index) => {
    step.classList.toggle("active", index + 1 === stepNumber);
  });
  updateProgress();
  updateReview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function nextStep() {
  if (currentStep < steps.length) {
    showStep(currentStep + 1);
  }
}

function prevStep() {
  if (currentStep > 1) {
    showStep(currentStep - 1);
  }
}

function setPreview(element, placeholder, blob) {
  if (!blob) {
    element.hidden = true;
    element.removeAttribute("src");
    placeholder.hidden = false;
    return;
  }

  element.src = URL.createObjectURL(blob);
  element.hidden = false;
  placeholder.hidden = true;
}

function triggerNativeCamera(input, mode) {
  if (mode) {
    input.setAttribute("capture", mode);
  } else {
    input.removeAttribute("capture");
  }
  input.click();
}

function openFaceCapture(input) {
  triggerNativeCamera(input);
}

function updateReview() {
  const patientId = sanitizePatientId(codeInput.value);
  reviewPatientId.textContent = patientId || "-";
  reviewFolder.textContent = rootDirectoryHandle?.name || "-";
  reviewTonguePhoto.textContent = capturedTonguePhotoBlob ? "Ready" : "Pending";
  reviewTongueVideo.textContent = capturedTongueVideoBlob ? "Ready" : "Skipped";
  reviewVoice.textContent = recordedAudioBlob ? "Ready" : "Pending";
  reviewFaceFront.textContent = capturedFaceFrontBlob ? "Ready" : "Pending";
  reviewFaceLeft.textContent = capturedFaceLeftBlob ? "Ready" : "Pending";
  reviewFaceRight.textContent = capturedFaceRightBlob ? "Ready" : "Pending";
}

function requireSetup() {
  if (!supportsDeviceFolderSave()) {
    return "This browser does not support saving to a chosen device folder. Use Android Chrome or Edge on HTTPS.";
  }
  if (!rootDirectoryHandle) {
    return "Choose a device folder first.";
  }
  if (!sanitizePatientId(codeInput.value)) {
    return "Enter patient ID first.";
  }
  return null;
}

function handleImageFile(input, onSet, preview, placeholder, statusElement, emptyText, filledText, button) {
  const file = input.files?.[0] || null;
  onSet(file);
  setPreview(preview, placeholder, file);
  statusElement.textContent = file ? filledText : emptyText;
  if (button) {
    button.textContent = file ? button.dataset.retake : button.dataset.open;
  }
  updateReview();
}

function setTonguePhoto(file) {
  capturedTonguePhotoBlob = file;
}
function setTongueVideo(file) {
  capturedTongueVideoBlob = file;
}
function setFaceFront(file) {
  capturedFaceFrontBlob = file;
}
function setFaceLeft(file) {
  capturedFaceLeftBlob = file;
}
function setFaceRight(file) {
  capturedFaceRightBlob = file;
}

function startVoiceStreamCleanup() {
  if (!voiceStream) {
    return;
  }
  voiceStream.getTracks().forEach((track) => track.stop());
  voiceStream = null;
}

async function startVoiceRecording() {
  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    voiceRecorder = new MediaRecorder(voiceStream);
    voiceChunks = [];

    voiceRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        voiceChunks.push(event.data);
      }
    });

    voiceRecorder.addEventListener("stop", () => {
      recordedAudioBlob = new Blob(voiceChunks, {
        type: voiceRecorder.mimeType || "audio/webm"
      });
      voicePreview.src = URL.createObjectURL(recordedAudioBlob);
      voicePreview.hidden = false;
      recordingStatus.textContent = "Voice sample ready. Sun lijiye, phir next kariye.";
      startVoiceStreamCleanup();
      updateReview();
    });

    voiceRecorder.start();
    startRecordingButton.disabled = true;
    stopRecordingButton.disabled = false;
    recordingStatus.textContent = "Recording voice sample...";
  } catch (error) {
    setResult("Microphone access failed. Please allow permission and try again.", true);
  }
}

function stopVoiceRecording() {
  if (!voiceRecorder || voiceRecorder.state === "inactive") {
    return;
  }
  voiceRecorder.stop();
  startRecordingButton.disabled = false;
  stopRecordingButton.disabled = true;
}

function validateFinal() {
  const setupError = requireSetup();
  if (setupError) {
    return setupError;
  }
  if (!capturedTonguePhotoBlob) {
    return "Tongue photo required hai.";
  }
  if (!recordedAudioBlob) {
    return "Voice sample required hai.";
  }
  if (!capturedFaceFrontBlob) {
    return "Front face photo required hai.";
  }
  if (!capturedFaceLeftBlob) {
    return "Left face photo required hai.";
  }
  if (!capturedFaceRightBlob) {
    return "Right face photo required hai.";
  }
  return null;
}

async function writeBlobToFile(directoryHandle, fileName, blob) {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

function getExtension(file, fallback) {
  const parts = String(file?.name || "").split(".");
  return parts.length > 1 ? parts.pop() : fallback;
}

async function saveToDevice(patientId) {
  const patientFolder = await rootDirectoryHandle.getDirectoryHandle(patientId, { create: true });
  const tongueFolder = await patientFolder.getDirectoryHandle("tongue", { create: true });
  const voiceFolder = await patientFolder.getDirectoryHandle("voice", { create: true });
  const faceFolder = await patientFolder.getDirectoryHandle("face", { create: true });

  const savedFiles = [];

  await writeBlobToFile(tongueFolder, `${patientId}T.${getExtension(capturedTonguePhotoBlob, "jpg")}`, capturedTonguePhotoBlob);
  savedFiles.push("tongue photo");

  if (capturedTongueVideoBlob) {
    await writeBlobToFile(tongueFolder, `${patientId}TV.${getExtension(capturedTongueVideoBlob, "mp4")}`, capturedTongueVideoBlob);
    savedFiles.push("tongue video");
  }

  await writeBlobToFile(voiceFolder, `${patientId}V.webm`, recordedAudioBlob);
  savedFiles.push("voice sample");
  await writeBlobToFile(faceFolder, `${patientId}F.${getExtension(capturedFaceFrontBlob, "jpg")}`, capturedFaceFrontBlob);
  await writeBlobToFile(faceFolder, `${patientId}L.${getExtension(capturedFaceLeftBlob, "jpg")}`, capturedFaceLeftBlob);
  await writeBlobToFile(faceFolder, `${patientId}R.${getExtension(capturedFaceRightBlob, "jpg")}`, capturedFaceRightBlob);
  savedFiles.push("front face", "left face", "right face");

  return { patientFolderName: patientFolder.name, savedFiles };
}

function resetCaptureState() {
  capturedTonguePhotoBlob = null;
  capturedTongueVideoBlob = null;
  capturedFaceFrontBlob = null;
  capturedFaceLeftBlob = null;
  capturedFaceRightBlob = null;
  recordedAudioBlob = null;

  tonguePhotoInput.value = "";
  tongueVideoInput.value = "";
  faceFrontInput.value = "";
  faceLeftInput.value = "";
  faceRightInput.value = "";
  voicePreview.hidden = true;
  voicePreview.removeAttribute("src");

  setPreview(tonguePhotoPreview, tonguePhotoPlaceholder, null);
  setPreview(tongueVideoPreview, tongueVideoPlaceholder, null);
  setPreview(faceFrontPreview, faceFrontPlaceholder, null);
  setPreview(faceLeftPreview, faceLeftPlaceholder, null);
  setPreview(faceRightPreview, faceRightPlaceholder, null);

  tonguePhotoStatus.textContent = "Take the tongue photo to continue.";
  tongueVideoStatus.textContent = "You can record a tongue video or skip this step.";
  recordingStatus.textContent = "No voice sample recorded yet.";
  faceFrontStatus.textContent = "Take the front face photo to continue.";
  faceLeftStatus.textContent = "Take the left face photo to continue.";
  faceRightStatus.textContent = "Take the right face photo to continue.";

  document.querySelectorAll("[data-open]").forEach((button) => {
    button.textContent = button.dataset.open;
  });

  updateReview();
}

async function submitForm(event) {
  event.preventDefault();
  const validationError = validateFinal();
  if (validationError) {
    setResult(validationError, true);
    return;
  }

  const patientId = sanitizePatientId(codeInput.value);
  saveButton.disabled = true;
  setResult("Saving files to the chosen device folder...");

  try {
    const result = await saveToDevice(patientId);
    setResult(`Saved ${result.savedFiles.length} files in device folder ${result.patientFolderName}.`);
    form.reset();
    rootDirectoryHandle = null;
    updateFolderSupportState();
    resetCaptureState();
    showStep(1);
  } catch (error) {
    setResult(error.message || "Failed to save into the chosen device folder.", true);
  } finally {
    saveButton.disabled = false;
  }
}

chooseFolderButton.addEventListener("click", chooseDeviceFolder);
codeInput.addEventListener("input", updateReview);

function wireStepButton(id, handler) {
  const element = document.getElementById(id);
  if (element) {
    element.addEventListener("click", handler);
  }
}

wireStepButton("goStep2", () => {
  const error = requireSetup();
  if (error) {
    setResult(error, true);
    return;
  }
  nextStep();
});
wireStepButton("step2Back", prevStep);
wireStepButton("step2Next", () => {
  if (!capturedTonguePhotoBlob) {
    setResult("Tongue photo le lijiye phir next karein.", true);
    return;
  }
  nextStep();
});
wireStepButton("step3Back", prevStep);
wireStepButton("step3Next", nextStep);
wireStepButton("step4Back", prevStep);
wireStepButton("step4Next", () => {
  if (!recordedAudioBlob) {
    setResult("Voice sample record kijiye phir next karein.", true);
    return;
  }
  nextStep();
});
wireStepButton("step5Back", prevStep);
wireStepButton("step5Next", () => {
  if (!capturedFaceFrontBlob) {
    setResult("Front face photo lijiye phir next karein.", true);
    return;
  }
  nextStep();
});
wireStepButton("step6Back", prevStep);
wireStepButton("step6Next", () => {
  if (!capturedFaceLeftBlob) {
    setResult("Left face photo lijiye phir next karein.", true);
    return;
  }
  nextStep();
});
wireStepButton("step7Back", prevStep);
wireStepButton("step7Next", () => {
  if (!capturedFaceRightBlob) {
    setResult("Right face photo lijiye phir next karein.", true);
    return;
  }
  nextStep();
});
wireStepButton("step8Back", prevStep);

function setButtonLabels() {
  document.getElementById("retakeTonguePhoto").dataset.open = "Open Camera";
  document.getElementById("retakeTonguePhoto").dataset.retake = "Retake";
  document.getElementById("retakeTongueVideo").dataset.open = "Record Video";
  document.getElementById("retakeTongueVideo").dataset.retake = "Retake Video";
  document.getElementById("retakeFaceFront").dataset.open = "Open Camera";
  document.getElementById("retakeFaceFront").dataset.retake = "Retake";
  document.getElementById("retakeFaceLeft").dataset.open = "Open Camera";
  document.getElementById("retakeFaceLeft").dataset.retake = "Retake";
  document.getElementById("retakeFaceRight").dataset.open = "Open Camera";
  document.getElementById("retakeFaceRight").dataset.retake = "Retake";
}

setButtonLabels();

wireStepButton("retakeTonguePhoto", () => triggerNativeCamera(tonguePhotoInput, "environment"));
wireStepButton("retakeTongueVideo", () => triggerNativeCamera(tongueVideoInput, "environment"));
wireStepButton("retakeFaceFront", () => openFaceCapture(faceFrontInput));
wireStepButton("retakeFaceLeft", () => openFaceCapture(faceLeftInput));
wireStepButton("retakeFaceRight", () => openFaceCapture(faceRightInput));

startRecordingButton.addEventListener("click", startVoiceRecording);
stopRecordingButton.addEventListener("click", stopVoiceRecording);
form.addEventListener("submit", submitForm);

tonguePhotoInput.addEventListener("change", () => {
  handleImageFile(
    tonguePhotoInput,
    setTonguePhoto,
    tonguePhotoPreview,
    tonguePhotoPlaceholder,
    tonguePhotoStatus,
    "Take the tongue photo to continue.",
    "Tongue photo ready. Preview dekho ya retake karo.",
    document.getElementById("retakeTonguePhoto")
  );
});

tongueVideoInput.addEventListener("change", () => {
  const file = tongueVideoInput.files?.[0] || null;
  setTongueVideo(file);
  setPreview(tongueVideoPreview, tongueVideoPlaceholder, file);
  tongueVideoStatus.textContent = file
    ? "Tongue video ready. Preview dekho ya retake karo."
    : "You can record a tongue video or skip this step.";
  const button = document.getElementById("retakeTongueVideo");
  button.textContent = file ? button.dataset.retake : button.dataset.open;
  updateReview();
});

faceFrontInput.addEventListener("change", () => {
  handleImageFile(
    faceFrontInput,
    setFaceFront,
    faceFrontPreview,
    faceFrontPlaceholder,
    faceFrontStatus,
    "Take the front face photo to continue.",
    "Front face ready. Preview dekho ya retake karo.",
    document.getElementById("retakeFaceFront")
  );
});

faceLeftInput.addEventListener("change", () => {
  handleImageFile(
    faceLeftInput,
    setFaceLeft,
    faceLeftPreview,
    faceLeftPlaceholder,
    faceLeftStatus,
    "Take the left face photo to continue.",
    "Left face ready. Preview dekho ya retake karo.",
    document.getElementById("retakeFaceLeft")
  );
});

faceRightInput.addEventListener("change", () => {
  handleImageFile(
    faceRightInput,
    setFaceRight,
    faceRightPreview,
    faceRightPlaceholder,
    faceRightStatus,
    "Take the right face photo to continue.",
    "Right face ready. Preview dekho ya retake karo.",
    document.getElementById("retakeFaceRight")
  );
});

resetCaptureState();
updateFolderSupportState();
showStep(1);


