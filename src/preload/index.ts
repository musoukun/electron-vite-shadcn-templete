import { contextBridge, ipcRenderer } from 'electron';

// レンダラープロセスで使用する安全なAPIを定義
contextBridge.exposeInMainWorld('electronAPI', {
  // ファイル選択ダイアログを開く
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  
  // LLMとの通信機能 (将来実装)
  sendMessageToLLM: (message: string) => {
    // LLMとの通信ロジックを実装予定
    console.log(`Message to LLM: ${message}`);
    return Promise.resolve('LLMからの応答がここに表示されます');
  }
});
