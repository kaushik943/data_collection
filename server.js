require("dotenv").config();

const express = require("express");
const multer = require("multer");
const fs = require("fs/promises");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;
const uploadRoot = path.resolve(__dirname, process.env.UPLOAD_ROOT || "uploads");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(uploadRoot));

function sanitizeCode(code) {
  return String(code || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_");
}

function buildFileUploadGroups(patientId, files) {
  return {
    tongue: [
      ...(files.tonguePhoto || []).map((file) => ({
        ...file,
        originalname: `${patientId}T${path.extname(file.originalname || ".jpg")}`,
        legacyBaseNames: ["tongue_photo"]
      })),
      ...(files.tongueVideo || []).map((file) => ({
        ...file,
        originalname: `${patientId}TV${path.extname(file.originalname || ".mp4")}`,
        legacyBaseNames: ["tongue_video"]
      }))
    ],
    voice: [
      ...(files.voiceSample || []).map((file) => ({
        ...file,
        originalname: `${patientId}V${path.extname(file.originalname || ".webm")}`,
        legacyBaseNames: ["voice_sample"]
      }))
    ],
    face: [
      ...(files.faceFront || []).map((file) => ({
        ...file,
        originalname: `${patientId}F${path.extname(file.originalname || ".jpg")}`,
        legacyBaseNames: ["face_front"]
      })),
      ...(files.faceLeft || []).map((file) => ({
        ...file,
        originalname: `${patientId}L${path.extname(file.originalname || ".jpg")}`,
        legacyBaseNames: ["face_left"]
      })),
      ...(files.faceRight || []).map((file) => ({
        ...file,
        originalname: `${patientId}R${path.extname(file.originalname || ".jpg")}`,
        legacyBaseNames: ["face_right"]
      }))
    ]
  };
}

function getFileBaseName(fileName) {
  return path.basename(fileName, path.extname(fileName));
}

function validateSubmission(body, files) {
  const code = sanitizeCode(body.code);

  if (!code) {
    return "Patient ID is required.";
  }

  if (!(files.tonguePhoto?.length || files.tongueVideo?.length)) {
    return "Upload at least one tongue photo or tongue video.";
  }

  if (!files.voiceSample?.length) {
    return "Voice sample is required.";
  }

  if (!files.faceFront?.length || !files.faceLeft?.length || !files.faceRight?.length) {
    return "Front, left, and right face photos are all required.";
  }

  return null;
}

async function ensureSubmissionFolders(uniqueId) {
  const uniqueFolderPath = path.join(uploadRoot, uniqueId);
  const subfolders = {
    tongue: path.join(uniqueFolderPath, "tongue"),
    voice: path.join(uniqueFolderPath, "voice"),
    face: path.join(uniqueFolderPath, "face")
  };

  await Promise.all([
    fs.mkdir(subfolders.tongue, { recursive: true }),
    fs.mkdir(subfolders.voice, { recursive: true }),
    fs.mkdir(subfolders.face, { recursive: true })
  ]);

  return {
    uniqueFolderPath,
    subfolders
  };
}

function toPublicUploadPath(filePath) {
  return "/" + path.relative(__dirname, filePath).replace(/\\/g, "/");
}

async function removeExistingVariants(folderPath, fileBaseName) {
  const existingEntries = await fs.readdir(folderPath, { withFileTypes: true });

  await Promise.all(
    existingEntries
      .filter((entry) => entry.isFile() && path.basename(entry.name, path.extname(entry.name)) === fileBaseName)
      .map((entry) => fs.unlink(path.join(folderPath, entry.name)))
  );
}

async function removeLegacyFiles(folderPath, legacyBaseNames) {
  if (!legacyBaseNames?.length) {
    return;
  }

  const existingEntries = await fs.readdir(folderPath, { withFileTypes: true });
  const legacyNames = new Set(legacyBaseNames);

  await Promise.all(
    existingEntries
      .filter((entry) => entry.isFile() && legacyNames.has(path.basename(entry.name, path.extname(entry.name))))
      .map((entry) => fs.unlink(path.join(folderPath, entry.name)))
  );
}

async function saveGroupedFiles(groupedFiles, subfolders) {
  const savedFiles = [];

  for (const [groupName, files] of Object.entries(groupedFiles)) {
    for (const file of files) {
      const fileName = file.originalname;
      const destinationPath = path.join(subfolders[groupName], fileName);
      const fileBaseName = getFileBaseName(fileName);

      await removeExistingVariants(subfolders[groupName], fileBaseName);
      await removeLegacyFiles(subfolders[groupName], file.legacyBaseNames);

      await fs.writeFile(destinationPath, file.buffer);

      savedFiles.push({
        category: groupName,
        fileName,
        localPath: destinationPath,
        publicPath: toPublicUploadPath(destinationPath)
      });
    }
  }

  return savedFiles;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post(
  "/api/submissions",
  upload.fields([
    { name: "tonguePhoto", maxCount: 1 },
    { name: "tongueVideo", maxCount: 1 },
    { name: "voiceSample", maxCount: 1 },
    { name: "faceFront", maxCount: 1 },
    { name: "faceLeft", maxCount: 1 },
    { name: "faceRight", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const validationError = validateSubmission(req.body, req.files || {});
      if (validationError) {
        return res.status(400).json({ error: validationError });
      }

      const uniqueId = sanitizeCode(req.body.code);
      const groupedFiles = buildFileUploadGroups(uniqueId, req.files || {});
      const folderTree = await ensureSubmissionFolders(uniqueId);
      const savedFiles = await saveGroupedFiles(groupedFiles, folderTree.subfolders);

      return res.status(201).json({
        message: "Submission saved successfully.",
        uniqueId,
        rootFolder: folderTree.uniqueFolderPath,
        subfolders: folderTree.subfolders,
        files: savedFiles
      });
    } catch (error) {
      console.error("Submission save failed:", error);
      return res.status(500).json({
        error: "Failed to save submission locally.",
        details: error.message
      });
    }
  }
);

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found." });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "One of the files is too large. Maximum size is 50MB per file."
        : error.message;

    return res.status(400).json({ error: message });
  }

  console.error("Unhandled server error:", error);
  return res.status(500).json({ error: "Unexpected server error.", details: error.message });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

