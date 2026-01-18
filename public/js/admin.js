/**
 * WebAR Restaurant - Admin Dashboard JavaScript
 *
 * This file handles:
 * 1. File uploads with drag & drop
 * 2. Form submission to create menu items
 * 3. Displaying and managing menu items list
 * 4. QR code display and download
 * 5. Client-side MindAR target compilation (optional)
 */

// ============================================
// GLOBAL STATE
// ============================================

let selectedTargetImage = null;
let selectedARContent = null;
let currentQRItem = null;

// Get auth token from localStorage
function getAuthToken() {
    return localStorage.getItem('token');
}

// Check if user is logged in
function checkAuth() {
    const token = getAuthToken();
    if (!token) {
        showToast('Please login to access admin panel', 'error');
        setTimeout(() => {
            window.location.href = '/login';
        }, 1500);
        return false;
    }
    return true;
}

// Helper for authenticated fetch requests
async function authFetch(url, options = {}) {
    const token = getAuthToken();
    if (!token) {
        throw new Error('Authentication required');
    }
    
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    
    // Don't set Content-Type for FormData (let browser set it with boundary)
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    
    const response = await fetch(url, { ...options, headers });
    
    if (response.status === 401) {
        localStorage.removeItem('token');
        showToast('Session expired. Please login again.', 'error');
        setTimeout(() => {
            window.location.href = '/login';
        }, 1500);
        throw new Error('Session expired');
    }
    
    return response;
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Admin JS loaded, initializing...');
    if (!checkAuth()) return;
    
    initFileUploads();
    initForm();
    loadMenuItems();
});

// ============================================
// FILE UPLOAD HANDLING
// ============================================

function initFileUploads() {
    // Target Image Upload
    const targetInput = document.getElementById('targetImage');
    const targetBox = document.getElementById('targetImageBox');

    if (!targetInput || !targetBox) {
        console.error('Target upload elements not found');
        return;
    }

    console.log('Setting up target image upload');

    targetInput.addEventListener('change', (e) => {
        console.log('Target input changed', e.target.files);
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0], 'target');
        }
    });

    // Make entire box clickable
    targetBox.addEventListener('click', (e) => {
        console.log('Target box clicked', e.target.tagName, e.target.className);
        // Don't trigger if clicking on remove button or if box has file
        if (e.target.classList.contains('remove-btn')) return;
        if (!targetBox.classList.contains('has-file')) {
            console.log('Opening file picker for target');
            targetInput.click();
        }
    });

    setupDragDrop(targetBox, (file) => {
        if (file.type.startsWith('image/')) {
            handleFileSelect(file, 'target');
            targetInput.files = createFileList(file);
        } else {
            showToast('Please drop an image file', 'error');
        }
    });

    // AR Content Upload
    const contentInput = document.getElementById('arContent');
    const contentBox = document.getElementById('arContentBox');

    if (!contentInput || !contentBox) {
        console.error('Content upload elements not found');
        return;
    }

    console.log('Setting up AR content upload');

    contentInput.addEventListener('change', (e) => {
        console.log('Content input changed', e.target.files);
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0], 'content');
        }
    });

    // Make entire box clickable
    contentBox.addEventListener('click', (e) => {
        console.log('Content box clicked', e.target.tagName, e.target.className);
        // Don't trigger if clicking on remove button or if box has file
        if (e.target.classList.contains('remove-btn')) return;
        if (!contentBox.classList.contains('has-file')) {
            console.log('Opening file picker for content');
            contentInput.click();
        }
    });

    setupDragDrop(contentBox, (file) => {
        const validTypes = ['video/mp4', 'video/webm', 'video/ogg'];
        const validExts = ['.glb', '.gltf'];
        const ext = '.' + file.name.split('.').pop().toLowerCase();

        if (validTypes.includes(file.type) || validExts.includes(ext)) {
            handleFileSelect(file, 'content');
            contentInput.files = createFileList(file);
        } else {
            showToast('Please drop a video or 3D model file', 'error');
        }
    });

    console.log('File upload initialization complete');
}

function setupDragDrop(element, onDrop) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
        element.addEventListener(event, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(event => {
        element.addEventListener(event, () => {
            element.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(event => {
        element.addEventListener(event, () => {
            element.classList.remove('dragover');
        });
    });

    element.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file) onDrop(file);
    });
}

function handleFileSelect(file, type) {
    if (!file) return;

    console.log('handleFileSelect called', type, file.name);

    const previewId = type === 'target' ? 'targetPreview' : 'contentPreview';
    const boxId = type === 'target' ? 'targetImageBox' : 'arContentBox';
    const previewContainer = document.getElementById(previewId);
    const uploadBox = document.getElementById(boxId);

    // Store reference
    if (type === 'target') {
        selectedTargetImage = file;
    } else {
        selectedARContent = file;
    }

    // Create preview
    previewContainer.innerHTML = '';

    if (type === 'target' || file.type.startsWith('image/')) {
        // Image preview
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.alt = 'Preview';
        previewContainer.appendChild(img);
    } else if (file.type.startsWith('video/')) {
        // Video preview
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        previewContainer.appendChild(video);
    } else {
        // 3D model placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'model-placeholder';
        placeholder.innerHTML = `
            <span style="font-size: 3rem;">📦</span>
            <p style="margin-top: 0.5rem; color: #a0aec0;">${file.name}</p>
        `;
        placeholder.style.cssText = 'text-align: center; padding: 2rem;';
        previewContainer.appendChild(placeholder);
    }

    // Add remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '✕';
    removeBtn.type = 'button';  // Prevent form submission
    removeBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearFileSelection(type);
    };
    previewContainer.appendChild(removeBtn);

    // Update box state
    uploadBox.classList.add('has-file');
    uploadBox.querySelector('.upload-content').style.display = 'none';

    showToast(`${type === 'target' ? 'Target image' : 'AR content'} selected`, 'success');
}

function clearFileSelection(type) {
    const previewId = type === 'target' ? 'targetPreview' : 'contentPreview';
    const boxId = type === 'target' ? 'targetImageBox' : 'arContentBox';
    const inputId = type === 'target' ? 'targetImage' : 'arContent';

    document.getElementById(previewId).innerHTML = '';
    document.getElementById(boxId).classList.remove('has-file');
    document.getElementById(boxId).querySelector('.upload-content').style.display = 'flex';
    document.getElementById(inputId).value = '';

    if (type === 'target') {
        selectedTargetImage = null;
    } else {
        selectedARContent = null;
    }
}

function createFileList(file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    return dt.files;
}

// ============================================
// FORM HANDLING
// ============================================

function initForm() {
    const form = document.getElementById('uploadForm');
    const submitBtn = document.getElementById('submitBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Validate
        if (!selectedTargetImage) {
            showToast('Please select a target image', 'error');
            return;
        }

        if (!selectedARContent) {
            showToast('Please select AR content', 'error');
            return;
        }

        // Disable button
        submitBtn.disabled = true;

        try {
            // Show compiler status
            showCompilerStatus('Uploading files...');
            updateProgress(20);

            // Prepare form data
            const formData = new FormData();
            formData.append('name', document.getElementById('itemName').value);
            formData.append('description', document.getElementById('itemDescription').value);
            formData.append('targetImage', selectedTargetImage);
            formData.append('arContent', selectedARContent);

            updateProgress(40);
            showCompilerStatus('Processing target image...');

            // Submit to server with auth
            const response = await authFetch('/api/items', {
                method: 'POST',
                body: formData
            });

            updateProgress(80);
            showCompilerStatus('Generating QR code...');

            const result = await response.json();

            if (result.success) {
                updateProgress(100);
                showCompilerStatus('Complete!');

                setTimeout(() => {
                    hideCompilerStatus();
                    showToast('Menu item created successfully!', 'success');

                    // Reset form
                    form.reset();
                    clearFileSelection('target');
                    clearFileSelection('content');

                    // Reload items list
                    loadMenuItems();

                    // Show QR code
                    showQRModal(result.item);
                }, 500);
            } else {
                throw new Error(result.error || 'Failed to create item');
            }

        } catch (error) {
            hideCompilerStatus();
            showToast(error.message, 'error');
        } finally {
            submitBtn.disabled = false;
        }
    });
}

function showCompilerStatus(message) {
    const status = document.getElementById('compilerStatus');
    const text = document.getElementById('progressText');
    status.classList.remove('hidden');
    text.textContent = message;
}

function hideCompilerStatus() {
    document.getElementById('compilerStatus').classList.add('hidden');
    updateProgress(0);
}

function updateProgress(percent) {
    document.getElementById('progressFill').style.width = `${percent}%`;
}

// ============================================
// MENU ITEMS LIST
// ============================================

async function loadMenuItems() {
    const container = document.getElementById('menuItemsList');

    try {
        const response = await authFetch('/api/items');
        const data = await response.json();
        
        // Handle both array and object with items property
        const items = Array.isArray(data) ? data : (data.items || []);

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <h3>No menu items yet</h3>
                    <p>Upload your first AR menu item above!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="menu-item-card" data-id="${item.id}">
                <img class="item-image" src="${item.targetImage}" alt="${item.name}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23252542%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2230%22>🍽️</text></svg>'">
                <div class="item-details">
                    <h3>${escapeHtml(item.name)}</h3>
                    <p>${escapeHtml(item.description || 'No description')}</p>
                    <span class="item-type">${item.contentType === '3d' ? '📦 3D Model' : '🎬 Video'}</span>
                    <div class="item-actions">
                        <button class="btn btn-outline" onclick="showQRModal(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                            📱 QR Code
                        </button>
                        <button class="btn btn-outline" onclick="window.open('${item.viewerUrl}', '_blank')">
                            👁️ Preview
                        </button>
                        <button class="btn btn-danger" onclick="deleteItem('${item.id}')">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h3>Error loading items</h3>
                <p>${error.message}</p>
                <button class="btn btn-outline" onclick="loadMenuItems()">Try Again</button>
            </div>
        `;
    }
}

async function deleteItem(id) {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
        const response = await authFetch(`/api/items/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (result.success) {
            showToast('Item deleted successfully', 'success');
            loadMenuItems();
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ============================================
// QR CODE MODAL
// ============================================

function showQRModal(item) {
    currentQRItem = item;
    const modal = document.getElementById('qrModal');
    const title = document.getElementById('qrModalTitle');
    const container = document.getElementById('qrCodeContainer');
    const url = document.getElementById('qrUrl');

    title.textContent = item.name;
    url.textContent = item.viewerUrl;

    // Use qrCode from item if available, otherwise fetch
    if (item.qrCode) {
        container.innerHTML = `<img src="${item.qrCode}" alt="QR Code">`;
    } else {
        authFetch(`/api/items/${item.id}/qrcode`)
            .then(res => res.json())
            .then(data => {
                container.innerHTML = `<img src="${data.qrCode}" alt="QR Code">`;
            })
            .catch(() => {
                container.innerHTML = `<p style="color: #ef4444;">Failed to load QR code</p>`;
            });
    }

    modal.classList.remove('hidden');
}

function closeQRModal() {
    document.getElementById('qrModal').classList.add('hidden');
    currentQRItem = null;
}

function downloadQR() {
    if (!currentQRItem) return;

    const img = document.querySelector('#qrCodeContainer img');
    if (!img) return;

    const link = document.createElement('a');
    link.download = `qr-${currentQRItem.name.toLowerCase().replace(/\s+/g, '-')}.png`;
    link.href = img.src;
    link.click();

    showToast('QR code downloaded!', 'success');
}

function copyLink() {
    if (!currentQRItem) return;

    navigator.clipboard.writeText(currentQRItem.viewerUrl)
        .then(() => showToast('Link copied to clipboard!', 'success'))
        .catch(() => showToast('Failed to copy link', 'error'));
}

// Close modal on outside click
document.getElementById('qrModal').addEventListener('click', (e) => {
    if (e.target.id === 'qrModal') {
        closeQRModal();
    }
});

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        warning: '⚠️'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
