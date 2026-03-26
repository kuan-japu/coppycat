const { app, BrowserWindow, Tray, clipboard, ipcMain, nativeImage, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;
let window = null;
let clipboardInterval = null;
let lastText = '';
let lastImageBuf = null;
const MAX_ITEMS = 80; // Giảm xuống 80 để tránh đầy bộ nhớ do lưu ảnh định dạng Base64

const historyPath = path.join(app.getPath('userData'), 'clipboard-history.json');

function loadHistory() {
  try {
    if (fs.existsSync(historyPath)) {
      const data = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      // migrate data cũ nếu chưa có 'type'
      return data.map(item => typeof item === 'string' ? { type: 'text', content: item, timestamp: Date.now() } : item);
    }
  } catch (err) {
    console.error('Error loading history:', err);
  }
  return [];
}

function saveHistory(history) {
  try {
    fs.writeFileSync(historyPath, JSON.stringify(history));
  } catch (err) {
    console.error('Error saving history:', err);
  }
}

let history = loadHistory();

// Ẩn icon trên doc
if (app.dock) {
    app.dock.hide();
}

app.whenReady().then(() => {
  createTray();
  createWindow();
  startClipboardMonitor();

  // Đăng ký phím tắt toàn cục: Mở App bất cứ khi nào
  globalShortcut.register('CommandOrControl+Shift+C', () => {
    if (window && window.isVisible()) {
      window.hide();
    } else {
      showWindow(tray ? tray.getBounds() : undefined);
    }
  });

  ipcMain.handle('get-history', () => history);

  ipcMain.handle('delete-history', (event, index) => {
    history.splice(index, 1);
    saveHistory(history);
    return history;
  });

  ipcMain.handle('clear-history', () => {
    history = [];
    saveHistory(history);
    return history;
  });

  // Hỗ trợ dán cả text hoặc ảnh ngược trở lại vào clipboard
  ipcMain.on('copy-item', (event, item) => {
    if (item.type === 'image') {
        const img = nativeImage.createFromDataURL(item.content);
        clipboard.writeImage(img);
        lastText = item.content; // update tracker
    } else {
        clipboard.writeText(item.content);
        lastText = item.content;
        lastImageBuf = null;
    }
    
    if (window && window.isVisible()) {
        window.hide();
    }
  });

  ipcMain.on('hide-window', () => window.hide());
  ipcMain.on('quit-app', () => app.quit());
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setTitle('📋');
  tray.setToolTip('CoppyCat');

  tray.on('click', (event, bounds) => {
    if (window.isVisible()) {
      window.hide();
    } else {
      showWindow(bounds);
    }
  });
}

function createWindow() {
  window = new BrowserWindow({
    width: 380,
    height: 500,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile('index.html');
  
  window.on('blur', () => {
    if (!window.webContents.isDevToolsOpened()) {
      window.hide();
    }
  });
}

function showWindow(trayBounds) {
  // Nếu bật bằng phím tắt trayBounds sẽ undef, ta lấy toạ độ con trỏ chuột
  if (!trayBounds) {
      const point = screen.getCursorScreenPoint();
      trayBounds = { x: point.x, y: point.y, width: 0, height: 0 };
  }
  
  const windowBounds = window.getBounds();
  
  let x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
  let y = Math.round(trayBounds.y + trayBounds.height);
  
  // Tránh việc cửa sổ bị kẹt lòi ra ngoài viền màn hình
  const display = screen.getDisplayNearestPoint({ x, y });
  if (x + windowBounds.width > display.bounds.x + display.bounds.width) {
      x = display.bounds.x + display.bounds.width - windowBounds.width - 10;
  }
  if (x < display.bounds.x) {
      x = display.bounds.x + 10;
  }
  
  window.setPosition(x, y, false);
  window.show();
  window.focus();
}

function startClipboardMonitor() {
  clipboardInterval = setInterval(() => {
    const formats = clipboard.availableFormats();
    let newItem = null;

    // Ưu tiên check hình ảnh
    if (formats.includes('image/png') || formats.includes('image/jpeg')) {
        const image = clipboard.readImage();
        if (!image.isEmpty()) {
            const bmp = image.toBitmap();
            // So sánh buffer thay vì DataURL để tối ưu tốc độ CPU (tránh lag liên tục)
            if (!lastImageBuf || lastImageBuf.length !== bmp.length || 
                lastImageBuf[0] !== bmp[0] || lastImageBuf[bmp.length - 1] !== bmp[bmp.length - 1]) {
                const dataUrl = image.toDataURL();
                if (dataUrl !== lastText) {
                    lastImageBuf = bmp;
                    lastText = dataUrl;
                    newItem = { type: 'image', content: dataUrl, timestamp: Date.now() };
                }
            }
        }
    } else {
        const text = clipboard.readText();
        if (text && text.trim() !== '' && text !== lastText) {
            lastText = text;
            lastImageBuf = null;
            newItem = { type: 'text', content: text, timestamp: Date.now() };
        }
    }

    if (newItem) {
        // Loại bỏ trùng lặp đẩy nó lên đầu
        const existingIndex = history.findIndex(h => h.content === newItem.content);
        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }
        
        history.unshift(newItem);
        if (history.length > MAX_ITEMS) {
            history.pop();
        }
        saveHistory(history);
        
        if (window) {
            window.webContents.send('history-updated', history);
        }
    }
  }, 1000); // Tăng loop lên 1 giây để xử lý ảnh ko tốn pin
}
