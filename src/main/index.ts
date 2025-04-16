import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";

// アプリのウィンドウを格納するグローバル参照
// これをしないとGCされてしまいます
let mainWindow: BrowserWindow | null = null;

// メインウィンドウを作成する関数
function createWindow(): void {
	console.log("Creating main window...");

	mainWindow = new BrowserWindow({
		width: 1200,
		height: 800,
		webPreferences: {
			preload: path.join(__dirname, "../preload/index.js"),
			contextIsolation: true,
			nodeIntegration: false,
		},
		show: false,
		backgroundColor: "#FFFFFF",
	});

	// 開発環境であればDevToolsを開く
	if (!app.isPackaged) {
		mainWindow.webContents.openDevTools();
	}

	mainWindow.on("ready-to-show", () => {
		mainWindow?.show();
	});

	mainWindow.on("closed", () => {
		mainWindow = null;
	});

	// レンダラープロセスのロード
	if (app.isPackaged) {
		mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
	} else {
		// 開発時はローカルサーバーからロード - ポート番号を5173に変更
		const url = `http://localhost:5173`;
		mainWindow.loadURL(url);
	}
}

// Electronのライフサイクルイベント: アプリが初期化されたとき
app.whenReady().then(() => {
	createWindow();

	app.on("activate", () => {
		// macOSでは、ウィンドウが閉じられても他のウィンドウが
		// 開かれていなければアプリケーションを終了せず、
		// ウィンドウが再作成されるのが一般的です
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

// Electronのライフサイクルイベント: すべてのウィンドウが閉じられたとき
app.on("window-all-closed", () => {
	// macOS以外では、すべてのウィンドウが閉じられたときに
	// アプリケーションを終了するのが一般的です
	if (process.platform !== "darwin") {
		app.quit();
	}
});

// IPC通信の設定
ipcMain.handle("dialog:openFile", async () => {
	const { canceled, filePaths } = await dialog.showOpenDialog({
		properties: ["openFile"],
	});
	if (canceled) {
		return undefined;
	} else {
		return filePaths[0];
	}
});
