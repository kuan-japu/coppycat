const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    getHistory: () => ipcRenderer.invoke('get-history'),
    deleteHistory: (index) => ipcRenderer.invoke('delete-history', index),
    clearHistory: () => ipcRenderer.invoke('clear-history'),
    copyItem: (item) => ipcRenderer.send('copy-item', item), // thay thế copyText để gởi object hoàn chỉnh
    hideWindow: () => ipcRenderer.send('hide-window'),
    quitApp: () => ipcRenderer.send('quit-app'),
    onHistoryUpdated: (callback) => ipcRenderer.on('history-updated', (event, data) => callback(data))
});
