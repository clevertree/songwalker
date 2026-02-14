const {app, BrowserWindow, ipcMain} = require('electron')
const {watchFile, readFileSync} = require("fs");

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        // fullscreen: true
    })

    // win.loadFile('index.html')
    function loadHomeUrl() {
        win.loadURL('http://localhost:3000/')
        win.webContents.on("did-fail-load", (event, errorCode) => {
            console.log("did-fail-load - errorCode:", errorCode);
            setTimeout(loadHomeUrl, 3000)
        });
    }

    loadHomeUrl();
}

app.whenReady().then(() => {
    createWindow()
})
