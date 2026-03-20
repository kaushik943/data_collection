# Data Collector Mobile App

This project is a mobile-first web app for collecting:

- a patient ID / code
- tongue photo or video
- one voice sample
- face photos from front, left, and right

The app is designed for deployment as a static site and can save files directly into a user-chosen folder on the device when the browser supports the File System Access API.

## Stack

- Frontend: plain HTML, CSS, and JavaScript
- Storage: direct device-folder save using the browser File System Access API
- Hosting: Vercel static deployment

## Browser Support

- Best supported: Android Chrome and Android Edge over HTTPS
- Not reliable: iPhone Safari and many non-Chromium mobile browsers
- The user must choose a folder first before the app can save files there

## File Naming

If the patient ID is `pat1`, the app saves:

```text
pat1/
  tongue/
    pat1T.jpg
    pat1TV.webm
  voice/
    pat1V.webm
  face/
    pat1F.jpg
    pat1L.jpg
    pat1R.jpg
```

## Local Run

Use a secure localhost/static server when testing camera and folder access. One easy option is:

```powershell
npx.cmd vercel dev
```

Then open the local URL it prints.

## Deploy To Vercel

1. Push this project to GitHub
2. Import the repo into Vercel
3. Deploy it as a static project
4. Open the deployed HTTPS URL on Android Chrome or Edge
5. Tap `Choose Device Folder` before saving patient data

## Important Note

This Vercel version does not save files on the Vercel server. It saves files directly to the user's chosen device folder when the browser allows it.
