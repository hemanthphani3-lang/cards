# 🚀 Google Sheets & Apps Script Setup Guide

Follow these simple steps to deploy your free Google Sheets backend for **Card Game Scorekeeper**.

---

## Step 1: Create a New Google Sheet
1. Open your browser and go to [sheets.new](https://sheets.new) (creates a fresh Google Sheet).
2. Title the sheet **Card Game Scorekeeper Database** (or any name you prefer).

---

## Step 2: Add the Apps Script Code
1. In your Google Sheet, click **Extensions** > **Apps Script** in the top menu.
2. Clear any existing code in the editor (`Code.gs`).
3. Copy the entire contents of `gas/Code.gs` from this project and paste it into the editor.
4. Click the **Save** icon 💾 (or press `Ctrl+S` / `Cmd+S`).

---

## Step 3: Deploy as Web App
1. Click the blue **Deploy** button at the top right > **New deployment**.
2. Click the **Select type** gear icon ⚙️ next to "Select type" and select **Web app**.
3. Fill in the deployment details:
   - **Description**: `Card Scorekeeper API v1`
   - **Execute as**: `Me (your@gmail.com)`
   - **Who has access**: `Anyone` *(Crucial so the scorekeeper app can save and load scores)*
4. Click **Deploy**.
5. Click **Authorize access**, choose your Google Account, click **Advanced**, and click **Go to Untitled project (unsafe)** (Google shows this standard warning for custom personal scripts), then click **Allow**.

---

## Step 4: Copy & Paste Your Web App URL
1. Once deployed, Google will display your **Web App URL** (it ends with `/exec`).
   - Example: `https://script.google.com/macros/s/AKfycbx.../exec`
2. Copy this URL.
3. Open the **Card Game Scorekeeper** web app in your browser.
4. Click the **⚙ Settings** icon in the header.
5. Paste your Web App URL into the **Google Apps Script Web App URL** input field.
6. Click **Test Connection & Save**.

🎉 **You are now connected to Google Sheets!** All games, players, rounds, and scores will be stored persistently in your Google Sheet normalized tables (`Games`, `Players`, `Scores`).

> **Note**: If you don't configure a URL, the app automatically runs in **Offline / Local Mode** using browser LocalStorage so you can start keeping score immediately!
