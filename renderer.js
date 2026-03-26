const listEl = document.getElementById('historyList');
const searchInput = document.getElementById('searchInput');
const clearBtn = document.getElementById('clearBtn');
const quitBtn = document.getElementById('quitBtn');

const modal = document.getElementById('parseModal');
const modalSnippet = document.getElementById('modalSnippet');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnCopyOrig = document.getElementById('btnCopyOrig');
const btnExtractUrls = document.getElementById('btnExtractUrls');
const btnFormatJson = document.getElementById('btnFormatJson');
const btnDelete = document.getElementById('btnDelete');

let allHistory = [];
let targetIndex = -1;
let targetItem = null;

async function renderList(filter = '') {
    listEl.innerHTML = '';
    
    allHistory.forEach((item, index) => {
        const itemContent = item.content || '';
        const itemType = item.type || 'text';

        // Lọc bỏ nếu search không khớp với text
        if (filter && itemType === 'text' && !itemContent.toLowerCase().includes(filter.toLowerCase())) return;
        // Bỏ qua image vì không the search từ khung nhập
        if (filter && itemType === 'image') return; 

        const itemEl = document.createElement('div');
        itemEl.className = 'list-item';
        
        const contentEl = document.createElement('div');
        contentEl.className = 'item-text';
        
        if (itemType === 'image') {
            const img = document.createElement('img');
            img.src = itemContent;
            img.className = 'preview-img';
            contentEl.appendChild(img);
        } else {
            contentEl.textContent = itemContent.replace(/\n/g, ' ').substring(0, 100);
        }
        
        const optionsEl = document.createElement('div');
        optionsEl.className = 'item-options';
        optionsEl.textContent = 'Tuỳ chọn';
        optionsEl.onclick = (e) => {
            e.stopPropagation();
            openModal(item, index);
        };
        
        itemEl.appendChild(contentEl);
        itemEl.appendChild(optionsEl);
        
        itemEl.onclick = () => {
            window.api.copyItem(item);
        };
        
        listEl.appendChild(itemEl);
    });
}

function openModal(item, index) {
    targetIndex = index;
    targetItem = item;
    
    // Đổi hiển thị tuỳ cho nội dung hình hay dữ liệu chuỗi
    if (item.type === 'image') {
        modalSnippet.innerHTML = `<img src="${item.content}" class="preview-img modal-img">`;
        btnExtractUrls.style.display = 'none';
        btnFormatJson.style.display = 'none';
    } else {
        modalSnippet.textContent = item.content.replace(/\n/g, ' ').substring(0, 200) + '...';
        btnExtractUrls.style.display = 'block';
        btnFormatJson.style.display = 'block';
    }
    
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
}

async function fetchAndRender() {
    allHistory = await window.api.getHistory();
    renderList(searchInput.value);
}

searchInput.addEventListener('input', (e) => {
    renderList(e.target.value);
});

clearBtn.addEventListener('click', async () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử copy?')) {
        await window.api.clearHistory();
        fetchAndRender();
    }
});

quitBtn.addEventListener('click', () => {
    window.api.quitApp();
});

btnCloseModal.addEventListener('click', closeModal);

btnCopyOrig.addEventListener('click', () => {
    window.api.copyItem(targetItem);
    closeModal();
});

btnDelete.addEventListener('click', async () => {
    await window.api.deleteHistory(targetIndex);
    fetchAndRender();
    closeModal();
});

btnExtractUrls.addEventListener('click', () => {
    if (targetItem.type === 'image') return;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = targetItem.content.match(urlRegex);
    if (urls && urls.length > 0) {
        window.api.copyItem({ type: 'text', content: urls.join('\n') });
    } else {
        alert('Không tìm thấy link kiện/URL nào!');
    }
    closeModal();
});

btnFormatJson.addEventListener('click', () => {
    if (targetItem.type === 'image') return;
    try {
        const obj = JSON.parse(targetItem.content);
        const pretty = JSON.stringify(obj, null, 2);
        window.api.copyItem({ type: 'text', content: pretty });
    } catch (e) {
        alert('Văn bản này không phải là định dạng JSON hợp lệ!');
    }
    closeModal();
});

window.api.onHistoryUpdated((history) => {
    allHistory = history;
    renderList(searchInput.value);
});

fetchAndRender();
