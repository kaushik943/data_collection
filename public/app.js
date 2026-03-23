const form = document.getElementById("captureForm");
const resultMessage = document.getElementById("resultMessage");
const submitButton = document.getElementById("submitButton");
const chooseFolderButton = document.getElementById("chooseFolderButton");
const folderStatus = document.getElementById("folderStatus");
const faceCameraMode = document.getElementById("faceCameraMode");

const tonguePhotoInput = document.getElementById("tonguePhotoInput");
const tongueVideoInput = document.getElementById("tongueVideoInput");
const openTonguePhotoCameraButton = document.getElementById("openTonguePhotoCamera");
const openTongueVideoCameraButton = document.getElementById("openTongueVideoCamera");
const tongueStatus = document.getElementById("tongueStatus");
const tonguePhotoPreview = document.getElementById("tonguePhotoPreview");
const tongueVideoPreview = document.getElementById("tongueVideoPreview");
const confirmTonguePhoto = document.getElementById("confirmTonguePhoto");
const confirmTongueVideo = document.getElementById("confirmTongueVideo");

const startRecordingButton = document.getElementById("startRecording");
const stopRecordingButton = document.getElementById("stopRecording");
const recordingStatus = document.getElementById("recordingStatus");
const voicePreview = document.getElementById("voicePreview");
const confirmVoice = document.getElementById("confirmVoice");

const faceFrontInput = document.getElementById("faceFrontInput");
const faceLeftInput = document.getElementById("faceLeftInput");
const faceRightInput = document.getElementById("faceRightInput");
const openFaceFrontCameraButton = document.getElementById("openFaceFrontCamera");
const openFaceLeftCameraButton = document.getElementById("openFaceLeftCamera");
const openFaceRightCameraButton = document.getElementById("openFaceRightCamera");
const faceStatus = document.getElementById("faceStatus");
const faceFrontPreview = document.getElementById("faceFrontPreview");
const faceLeftPreview = document.getElementById("faceLeftPreview");
const faceRightPreview = document.getElementById("faceRightPreview");
const confirmFaceFront = document.getElementById("confirmFaceFront");
const confirmFaceLeft = document.getElementById("confirmFaceLeft");
const confirmFaceRight = document.getElementById("confirmFaceRight");

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

function setPreviewSource(element, blob) {
  if (!blob) {
    element.hidden = true;
    element.removeAttribute("src");
    return;
  }

  element.src = URL.createObjectURL(blob);
  element.hidden = false;
}

function enableConfirmation(checkbox, enabled) {
  checkbox.disabled = !enabled;
  if (!enabled) {
    checkbox.checked = false;
  }
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

function triggerNativeCamera(input, mode) {
  if (mode) {
    input.setAttribute("capture", mode);
  } else {
    input.removeAttribute("capture");
  }

  input.click();
}

function updateTongueStatus() {
  const confirmedItems = [];

  if (confirmTonguePhoto.checked) {
    confirmedItems.push("photo");
  }

  if (confirmTongueVideo.checked) {
    confirmedItems.push("video");
  }

  if (confirmedItems.length === 0) {
    tongueStatus.textContent = "Take tongue photo or video, then confirm it.";
    return;
  }

  tongueStatus.textContent = `Tongue ${confirmedItems.join(" and ")} confirmed.`;
}

function updateFaceStatus() {
  const completed = [];

  if (confirmFaceFront.checked) {
    completed.push("front");
  }

  if (confirmFaceLeft.checked) {
    completed.push("left");
  }

  if (confirmFaceRight.checked) {
    completed.push("right");
  }

  if (completed.length === 0) {
    faceStatus.textContent = "Capture front, left, and right face photos and confirm each.";
    return;
  }

  faceStatus.textContent = `Confirmed: ${completed.join(", ")}.`;
}

function handleImageSelection(input, setter, previewElement, checkbox, button, successMessage, retakeLabel) {
  const file = input.files?.[0] || null;
  setter(file);
  setPreviewSource(previewElement, file);
  enableConfirmation(checkbox, Boolean(file));
  if (file) {
    button.textContent = retakeLabel;
    setResult(successMessage);
  }
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

function openFaceCapture(input) {
  triggerNativeCamera(input, faceCameraMode.value);
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
      recordingStatus.textContent = "Voice sample recorded. Preview suniye aur confirm tick kariye.";
      enableConfirmation(confirmVoice, true);
      stopStream();
    });

    voiceRecorder.start();
    startRecordingButton.disabled = true;
    stopRecordingButton.disabled = false;
    recordingStatus.textContent = "Recording voice sample...";
  } catch (error) {
    setResult("Microphone access failed. Please allow permission and try again.", true);
  }
}

function stopStream() {
  if (!voiceStream) {
    return;
  }

  voiceStream.getTracks().forEach((track) => track.stop());
  voiceStream = null;
}

function stopVoiceRecording() {
  if (!voiceRecorder || voiceRecorder.state === "inactive") {
    return;
  }

  voiceRecorder.stop();
  startRecordingButton.disabled = false;
  stopRecordingButton.disabled = true;
}

function isTongueConfirmed() {
  return Boolean(
    (capturedTonguePhotoBlob && confirmTonguePhoto.checked) ||
      (capturedTongueVideoBlob && confirmTongueVideo.checked)
  );
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

  if (!isTongueConfirmed()) {
    return "Tongue photo ya tongue video capture karke confirm tick kariye.";
  }

  if (!recordedAudioBlob || !confirmVoice.checked) {
    return "Voice sample record karke confirm tick kariye.";
  }

  if (!capturedFaceFrontBlob || !confirmFaceFront.checked) {
    return "Front face capture karke confirm tick kariye.";
  }

  if (!capturedFaceLeftBlob || !confirmFaceLeft.checked) {
    return "Left face capture karke confirm tick kariye.";
  }

  if (!capturedFaceRightBlob || !confirmFaceRight.checked) {
    return "Right face capture karke confirm tick kariye.";
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

  if (capturedTonguePhotoBlob && confirmTonguePhoto.checked) {
    const fileName = `${patientId}T.${capturedTonguePhotoBlob.name.split(".").pop() || "jpg"}`;
    await writeBlobToFile(tongueFolder, fileName, capturedTonguePhotoBlob);
    savedFiles.push(`tongue/${fileName}`);
  }

  if (capturedTongueVideoBlob && confirmTongueVideo.checked) {
    const fileName = `${patientId}TV.${capturedTongueVideoBlob.name.split(".").pop() || "mp4"}`;
    await writeBlobToFile(tongueFolder, fileName, capturedTongueVideoBlob);
    savedFiles.push(`tongue/${fileName}`);
  }

  if (recordedAudioBlob && confirmVoice.checked) {
    const fileName = `${patientId}V.webm`;
    await writeBlobToFile(voiceFolder, fileName, recordedAudioBlob);
    savedFiles.push(`voice/${fileName}`);
  }

  const faceFiles = [
    { blob: capturedFaceFrontBlob, confirmed: confirmFaceFront.checked, fileName: `${patientId}F.jpg` },
    { blob: capturedFaceLeftBlob, confirmed: confirmFaceLeft.checked, fileName: `${patientId}L.jpg` },
    { blob: capturedFaceRightBlob, confirmed: confirmFaceRight.checked, fileName: `${patientId}R.jpg` }
  ];

  for (const faceFile of faceFiles) {
    if (!faceFile.blob || !faceFile.confirmed) {
      continue;
    }

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

  tonguePhotoInput.value = "";
  tongueVideoInput.value = "";
  faceFrontInput.value = "";
  faceLeftInput.value = "";
  faceRightInput.value = "";

  setPreviewSource(tonguePhotoPreview, null);
  setPreviewSource(tongueVideoPreview, null);
  setPreviewSource(faceFrontPreview, null);
  setPreviewSource(faceLeftPreview, null);
  setPreviewSource(faceRightPreview, null);
  setPreviewSource(voicePreview, null);

  enableConfirmation(confirmTonguePhoto, false);
  enableConfirmation(confirmTongueVideo, false);
  enableConfirmation(confirmFaceFront, false);
  enableConfirmation(confirmFaceLeft, false);
  enableConfirmation(confirmFaceRight, false);
  enableConfirmation(confirmVoice, false);

  openTonguePhotoCameraButton.textContent = "Take Tongue Photo";
  openTongueVideoCameraButton.textContent = "Record Tongue Video";
  openFaceFrontCameraButton.textContent = "Take Front Face";
  openFaceLeftCameraButton.textContent = "Take Left Face";
  openFaceRightCameraButton.textContent = "Take Right Face";

  tongueStatus.textContent = "Take tongue photo or video, then confirm it.";
  faceStatus.textContent = "Capture front, left, and right face photos and confirm each.";
  recordingStatus.textContent = "No voice sample recorded yet.";
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
openTonguePhotoCameraButton.addEventListener("click", () => triggerNativeCamera(tonguePhotoInput, "environment"));
openTongueVideoCameraButton.addEventListener("click", () => triggerNativeCamera(tongueVideoInput, "environment"));
openFaceFrontCameraButton.addEventListener("click", () => openFaceCapture(faceFrontInput));
openFaceLeftCameraButton.addEventListener("click", () => openFaceCapture(faceLeftInput));
openFaceRightCameraButton.addEventListener("click", () => openFaceCapture(faceRightInput));

startRecordingButton.addEventListener("click", startVoiceRecording);
stopRecordingButton.addEventListener("click", stopVoiceRecording);
form.addEventListener("submit", submitForm);

confirmTonguePhoto.addEventListener("change", updateTongueStatus);
confirmTongueVideo.addEventListener("change", updateTongueStatus);
confirmFaceFront.addEventListener("change", updateFaceStatus);
confirmFaceLeft.addEventListener("change", updateFaceStatus);
confirmFaceRight.addEventListener("change", updateFaceStatus);

voicePreview.addEventListener("loadeddata", () => {
  recordingStatus.textContent = "Voice preview ready. Confirm tick kariye.";
});

tonguePhotoInput.addEventListener("change", () => {
  handleImageSelection(
    tonguePhotoInput,
    setTonguePhoto,
    tonguePhotoPreview,
    confirmTonguePhoto,
    openTonguePhotoCameraButton,
    "Tongue photo captured. Preview check karke confirm tick kariye.",
    "Retake Tongue Photo"
  );
  updateTongueStatus();
});

tongueVideoInput.addEventListener("change", () => {
  handleImageSelection(
    tongueVideoInput,
    setTongueVideo,
    tongueVideoPreview,
    confirmTongueVideo,
    openTongueVideoCameraButton,
    "Tongue video captured. Preview check karke confirm tick kariye.",
    "Retake Tongue Video"
  );
  updateTongueStatus();
});

faceFrontInput.addEventListener("change", () => {
  handleImageSelection(
    faceFrontInput,
    setFaceFront,
    faceFrontPreview,
    confirmFaceFront,
    openFaceFrontCameraButton,
    "Front face captured. Preview check karke confirm tick kariye.",
    "Retake Front Face"
  );
  updateFaceStatus();
});

faceLeftInput.addEventListener("change", () => {
  handleImageSelection(
    faceLeftInput,
    setFaceLeft,
    faceLeftPreview,
    confirmFaceLeft,
    openFaceLeftCameraButton,
    "Left face captured. Preview check karke confirm tick kariye.",
    "Retake Left Face"
  );
  updateFaceStatus();
});

faceRightInput.addEventListener("change", () => {
  handleImageSelection(
    faceRightInput,
    setFaceRight,
    faceRightPreview,
    confirmFaceRight,
    openFaceRightCameraButton,
    "Right face captured. Preview check karke confirm tick kariye.",
    "Retake Right Face"
  );
  updateFaceStatus();
});

confirmVoice.addEventListener("change", () => {
  if (confirmVoice.checked) {
    recordingStatus.textContent = "Voice sample confirmed.";
  } else if (recordedAudioBlob) {
    recordingStatus.textContent = "Voice preview ready. Confirm tick kariye.";
  }
});

resetCaptureState();
updateFolderSupportState();
