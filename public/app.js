const form = document.getElementById("captureForm");
const resultMessage = document.getElementById("resultMessage");
const submitButton = document.getElementById("submitButton");
const chooseFolderButton = document.getElementById("chooseFolderButton");
const folderStatus = document.getElementById("folderStatus");

const startRecordingButton = document.getElementById("startRecording");
const stopRecordingButton = document.getElementById("stopRecording");
const recordingStatus = document.getElementById("recordingStatus");
const voicePreview = document.getElementById("voicePreview");

const tongueCamera = document.getElementById("tongueCamera");
const openTongueCameraButton = document.getElementById("openTongueCamera");
const closeTongueCameraButton = document.getElementById("closeTongueCamera");
const captureTonguePhotoButton = document.getElementById("captureTonguePhoto");
const startTongueVideoButton = document.getElementById("startTongueVideo");
const stopTongueVideoButton = document.getElementById("stopTongueVideo");
const tongueStatus = document.getElementById("tongueStatus");
const tonguePhotoPreview = document.getElementById("tonguePhotoPreview");
const tongueVideoPreview = document.getElementById("tongueVideoPreview");

const faceCamera = document.getElementById("faceCamera");
const openFaceCameraButton = document.getElementById("openFaceCamera");
const closeFaceCameraButton = document.getElementById("closeFaceCamera");
const captureFaceFrontButton = document.getElementById("captureFaceFront");
const captureFaceLeftButton = document.getElementById("captureFaceLeft");
const captureFaceRightButton = document.getElementById("captureFaceRight");
const faceStatus = document.getElementById("faceStatus");
const faceFrontPreview = document.getElementById("faceFrontPreview");
const faceLeftPreview = document.getElementById("faceLeftPreview");
const faceRightPreview = document.getElementById("faceRightPreview");

let rootDirectoryHandle = null;
let voiceRecorder = null;
let voiceStream = null;
let voiceChunks = [];
let recordedAudioBlob = null;

let tongueStream = null;
let tongueVideoRecorder = null;
let capturedTonguePhotoBlob = null;
let capturedTongueVideoBlob = null;

let faceStream = null;
let capturedFaceFrontBlob = null;
let capturedFaceLeftBlob = null;
let capturedFaceRightBlob = null;

function setResult(message, isError = false) {
  resultMessage.textContent = message;
  resultMessage.classList.toggle("error", isError);
  resultMessage.classList.toggle("success", !isError);
}

function setPreviewSource(element, blob) {
  if (!blob) {
    element.hidden = true;
    element.removeAttribute("src");
    return;
  }

  element.src = URL.createObjectURL(blob);
  element.hidden = false;
}

function showVideoStream(videoElement, stream) {
  videoElement.srcObject = stream;
  videoElement.hidden = false;
  videoElement.play().catch(() => {});
}

function clearVideoStream(videoElement) {
  videoElement.pause();
  videoElement.srcObject = null;
  videoElement.hidden = true;
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
    setResult(`Device folder selected: ${rootDirectoryHandle.name}`);
  } catch (error) {
    if (error && error.name === "AbortError") {
      return;
    }

    setResult("Could not access the selected device folder.", true);
  }
}

async function openCamera(mode) {
  const constraints = {
    audio: false,
    video: {
      facingMode: mode,
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };

  return navigator.mediaDevices.getUserMedia(constraints);
}

function stopStream(stream) {
  if (!stream) {
    return null;
  }

  stream.getTracks().forEach((track) => track.stop());
  return null;
}

function resetTongueCameraControls() {
  closeTongueCameraButton.disabled = true;
  captureTonguePhotoButton.disabled = true;
  startTongueVideoButton.disabled = true;
  stopTongueVideoButton.disabled = true;
}

function resetFaceCameraControls() {
  closeFaceCameraButton.disabled = true;
  captureFaceFrontButton.disabled = true;
  captureFaceLeftButton.disabled = true;
  captureFaceRightButton.disabled = true;
}

function closeTongueCamera(statusMessage = null) {
  tongueStream = stopStream(tongueStream);
  clearVideoStream(tongueCamera);
  resetTongueCameraControls();
  if (statusMessage) {
    tongueStatus.textContent = statusMessage;
  }
}

function closeFaceCamera(statusMessage = null) {
  faceStream = stopStream(faceStream);
  clearVideoStream(faceCamera);
  resetFaceCameraControls();
  if (statusMessage) {
    faceStatus.textContent = statusMessage;
  }
}

function closeAllCameras() {
  closeTongueCamera();
  closeFaceCamera();
}

async function startTongueCamera() {
  try {
    closeFaceCamera("Face camera closed.");
    closeTongueCamera();
    tongueStream = await openCamera({ ideal: "environment" });
    showVideoStream(tongueCamera, tongueStream);
    closeTongueCameraButton.disabled = false;
    captureTonguePhotoButton.disabled = false;
    startTongueVideoButton.disabled = false;
    tongueStatus.textContent = "Tongue camera is open. Photo capture ke baad camera band ho jayega.";
  } catch (error) {
    setResult("Unable to open the tongue camera. Please allow camera access.", true);
  }
}

async function startFaceCamera() {
  try {
    closeTongueCamera("Tongue camera closed.");
    closeFaceCamera();
    faceStream = await openCamera({ ideal: "environment" });
    showVideoStream(faceCamera, faceStream);
    closeFaceCameraButton.disabled = false;
    captureFaceFrontButton.disabled = false;
    captureFaceLeftButton.disabled = false;
    captureFaceRightButton.disabled = false;
    faceStatus.textContent = "Back camera is open for face capture. Photo capture ke baad camera band ho jayega.";
  } catch (error) {
    setResult("Face camera open nahi ho pa raha. Camera permission allow karke dubara try karein.", true);
  }
}

function captureFrame(videoElement, mimeType = "image/jpeg", quality = 0.92) {
  const width = videoElement.videoWidth || 1280;
  const height = videoElement.videoHeight || 720;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(videoElement, 0, 0, width, height);

  return new Promise((resolve) => {
    canvas.toBlob(resolve, mimeType, quality);
  });
}

async function captureTonguePhoto() {
  if (!tongueStream) {
    setResult("Open the tongue camera before capturing a photo.", true);
    return;
  }

  capturedTonguePhotoBlob = await captureFrame(tongueCamera);
  setPreviewSource(tonguePhotoPreview, capturedTonguePhotoBlob);
  closeTongueCamera("Tongue photo captured successfully. Preview neeche dikh raha hai.");
}

function createVideoRecorder(stream, onStop) {
  const mimeCandidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4"
  ];

  const supportedMimeType = mimeCandidates.find((mimeType) => {
    return typeof MediaRecorder.isTypeSupported !== "function" || MediaRecorder.isTypeSupported(mimeType);
  });

  const recorder = supportedMimeType
    ? new MediaRecorder(stream, { mimeType: supportedMimeType })
    : new MediaRecorder(stream);
  const chunks = [];

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });

  recorder.addEventListener("stop", () => {
    onStop(new Blob(chunks, { type: recorder.mimeType || supportedMimeType || "video/webm" }));
  });

  return recorder;
}

function startTongueVideo() {
  if (!tongueStream) {
    setResult("Open the tongue camera before recording a video.", true);
    return;
  }

  if (typeof MediaRecorder === "undefined") {
    setResult("Video recording is not supported in this browser.", true);
    return;
  }

  tongueVideoRecorder = createVideoRecorder(tongueStream, (blob) => {
    capturedTongueVideoBlob = blob;
    setPreviewSource(tongueVideoPreview, capturedTongueVideoBlob);
    closeTongueCamera("Tongue video recorded successfully. Preview neeche dikh raha hai.");
  });

  tongueVideoRecorder.start();
  startTongueVideoButton.disabled = true;
  stopTongueVideoButton.disabled = false;
  captureTonguePhotoButton.disabled = true;
  closeTongueCameraButton.disabled = true;
  tongueStatus.textContent = "Recording tongue video...";
}

function stopTongueVideo() {
  if (!tongueVideoRecorder || tongueVideoRecorder.state === "inactive") {
    return;
  }

  tongueVideoRecorder.stop();
  stopTongueVideoButton.disabled = true;
}

function updateFaceStatus() {
  const completed = [
    capturedFaceFrontBlob ? "front" : null,
    capturedFaceLeftBlob ? "left" : null,
    capturedFaceRightBlob ? "right" : null
  ].filter(Boolean);

  if (completed.length === 3) {
    faceStatus.textContent = "Front, left, and right face photos captured.";
    return;
  }

  if (completed.length === 0) {
    faceStatus.textContent = "Front, left, and right face photos are still needed.";
    return;
  }

  faceStatus.textContent = `Captured: ${completed.join(", ")}. Capture the remaining face photos.`;
}

async function captureFacePhoto(position) {
  if (!faceStream) {
    setResult("Open the face camera before capturing face photos.", true);
    return;
  }

  const blob = await captureFrame(faceCamera);

  if (position === "front") {
    capturedFaceFrontBlob = blob;
    setPreviewSource(faceFrontPreview, blob);
  }

  if (position === "left") {
    capturedFaceLeftBlob = blob;
    setPreviewSource(faceLeftPreview, blob);
  }

  if (position === "right") {
    capturedFaceRightBlob = blob;
    setPreviewSource(faceRightPreview, blob);
  }

  closeFaceCamera();
  updateFaceStatus();
  setResult(`${position} face photo captured. Preview neeche dikh raha hai.`);
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

      setPreviewSource(voicePreview, recordedAudioBlob);
      recordingStatus.textContent = "Voice sample recorded and ready to save.";
      stopStream(voiceStream);
      voiceStream = null;
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

function validateBeforeSubmit() {
  const patientId = sanitizePatientId(document.getElementById("code").value);

  if (!supportsDeviceFolderSave()) {
    return "This browser does not support saving to a chosen device folder. Use Android Chrome or Edge on HTTPS.";
  }

  if (!rootDirectoryHandle) {
    return "Choose a device folder before saving.";
  }

  if (!patientId) {
    return "Patient ID is required.";
  }

  if (!capturedTonguePhotoBlob && !capturedTongueVideoBlob) {
    return "Capture at least one tongue photo or tongue video.";
  }

  if (!recordedAudioBlob) {
    return "Record a voice sample before saving.";
  }

  if (!capturedFaceFrontBlob || !capturedFaceLeftBlob || !capturedFaceRightBlob) {
    return "Front, left, and right face photos are required.";
  }

  return null;
}

async function writeBlobToFile(directoryHandle, fileName, blob) {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function saveToDevice(patientId) {
  const patientFolder = await rootDirectoryHandle.getDirectoryHandle(patientId, { create: true });
  const tongueFolder = await patientFolder.getDirectoryHandle("tongue", { create: true });
  const voiceFolder = await patientFolder.getDirectoryHandle("voice", { create: true });
  const faceFolder = await patientFolder.getDirectoryHandle("face", { create: true });

  const savedFiles = [];

  if (capturedTonguePhotoBlob) {
    const fileName = `${patientId}T.jpg`;
    await writeBlobToFile(tongueFolder, fileName, capturedTonguePhotoBlob);
    savedFiles.push(`tongue/${fileName}`);
  }

  if (capturedTongueVideoBlob) {
    const fileName = `${patientId}TV.webm`;
    await writeBlobToFile(tongueFolder, fileName, capturedTongueVideoBlob);
    savedFiles.push(`tongue/${fileName}`);
  }

  if (recordedAudioBlob) {
    const fileName = `${patientId}V.webm`;
    await writeBlobToFile(voiceFolder, fileName, recordedAudioBlob);
    savedFiles.push(`voice/${fileName}`);
  }

  const faceFiles = [
    { blob: capturedFaceFrontBlob, fileName: `${patientId}F.jpg` },
    { blob: capturedFaceLeftBlob, fileName: `${patientId}L.jpg` },
    { blob: capturedFaceRightBlob, fileName: `${patientId}R.jpg` }
  ];

  for (const faceFile of faceFiles) {
    await writeBlobToFile(faceFolder, faceFile.fileName, faceFile.blob);
    savedFiles.push(`face/${faceFile.fileName}`);
  }

  return {
    patientFolderName: patientFolder.name,
    savedFiles
  };
}

function resetCaptureState() {
  capturedTonguePhotoBlob = null;
  capturedTongueVideoBlob = null;
  capturedFaceFrontBlob = null;
  capturedFaceLeftBlob = null;
  capturedFaceRightBlob = null;
  recordedAudioBlob = null;

  closeAllCameras();
  setPreviewSource(tonguePhotoPreview, null);
  setPreviewSource(tongueVideoPreview, null);
  setPreviewSource(faceFrontPreview, null);
  setPreviewSource(faceLeftPreview, null);
  setPreviewSource(faceRightPreview, null);
  setPreviewSource(voicePreview, null);

  tongueStatus.textContent = "No tongue photo or video captured yet.";
  recordingStatus.textContent = "No voice sample recorded yet.";
  updateFaceStatus();
}

async function submitForm(event) {
  event.preventDefault();

  const validationError = validateBeforeSubmit();
  if (validationError) {
    setResult(validationError, true);
    return;
  }

  const patientId = sanitizePatientId(document.getElementById("code").value);
  submitButton.disabled = true;
  setResult("Saving files to the chosen device folder...");

  try {
    const result = await saveToDevice(patientId);
    setResult(`Saved ${result.savedFiles.length} files in device folder ${result.patientFolderName}.`);
    form.reset();
    resetCaptureState();
  } catch (error) {
    setResult(error.message || "Failed to save into the chosen device folder.", true);
  } finally {
    submitButton.disabled = false;
  }
}

chooseFolderButton.addEventListener("click", chooseDeviceFolder);
openTongueCameraButton.addEventListener("click", startTongueCamera);
closeTongueCameraButton.addEventListener("click", () => closeTongueCamera("Tongue camera closed."));
captureTonguePhotoButton.addEventListener("click", captureTonguePhoto);
startTongueVideoButton.addEventListener("click", startTongueVideo);
stopTongueVideoButton.addEventListener("click", stopTongueVideo);
openFaceCameraButton.addEventListener("click", startFaceCamera);
closeFaceCameraButton.addEventListener("click", () => closeFaceCamera("Face camera closed."));
captureFaceFrontButton.addEventListener("click", () => captureFacePhoto("front"));
captureFaceLeftButton.addEventListener("click", () => captureFacePhoto("left"));
captureFaceRightButton.addEventListener("click", () => captureFacePhoto("right"));
startRecordingButton.addEventListener("click", startVoiceRecording);
stopRecordingButton.addEventListener("click", stopVoiceRecording);
form.addEventListener("submit", submitForm);
resetTongueCameraControls();
resetFaceCameraControls();
updateFaceStatus();
updateFolderSupportState();

