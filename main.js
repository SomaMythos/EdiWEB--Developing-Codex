const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, "icon.ico"),
    autoHideMenuBar: true,
  });

  mainWindow.loadFile(
    path.join(__dirname, "frontend", "dist", "index.html")
  );
}

app.whenReady().then(() => {

  const isPackaged = app.isPackaged;

  const backendExe = isPackaged
    ? path.join(process.resourcesPath, "backend", "dist", "main.exe")
    : path.join(__dirname, "backend", "dist", "main.exe");

  backendProcess = spawn(backendExe, [], {
    windowsHide: true
  });

  createWindow();
});