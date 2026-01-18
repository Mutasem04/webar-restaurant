/**
 * WebAR Restaurant - AR Viewer JavaScript
 * 
 * This file handles:
 * 1. Loading menu item data from the server
 * 2. Compiling target image to .mind format in browser
 * 3. Initializing the MindAR scene
 * 4. Camera permission handling
 * 5. AR target tracking events
 * 6. Displaying video or 3D content on target
 */

// ============================================
// GLOBAL STATE
// ============================================

let menuItem = null;
let arScene = null;
let isARActive = false;
let compiledMindData = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Get item ID from URL
        const params = new URLSearchParams(window.location.search);
        const itemId = params.get('id');
        
        if (!itemId) {
            showError('No Item Selected', 'Please scan a valid QR code to view AR content.');
            return;
        }
        
        // Load menu item data
        updateLoadingText('Loading item data...');
        menuItem = await loadMenuItem(itemId);
        
        if (!menuItem) {
            showError('Item Not Found', 'This menu item no longer exists.');
            return;
        }
        
        // Update UI with item info
        document.getElementById('itemName').textContent = menuItem.name;
        document.getElementById('itemDescription').textContent = menuItem.description || '';
        document.getElementById('targetPreviewImg').src = menuItem.targetImage;
        
        // Check for WebXR/camera support
        updateLoadingText('Checking camera access...');
        const hasCamera = await checkCameraSupport();
        
        if (!hasCamera) {
            showFallback();
            return;
        }
        
        // Compile target image to .mind format
        updateLoadingText('Preparing AR target (this may take a moment)...');
        compiledMindData = await compileTargetImage(menuItem.targetImage);
        
        if (!compiledMindData) {
            showError('Compilation Failed', 'Could not process the target image for AR. Please try again.');
            return;
        }
        
        // Initialize AR
        updateLoadingText('Starting AR experience...');
        await initAR();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Error', error.message || 'Something went wrong');
    }
});

// ============================================
// DATA LOADING
// ============================================

async function loadMenuItem(id) {
    try {
        const response = await fetch(`/api/items/${id}`);
        if (!response.ok) {
            throw new Error('Item not found');
        }
        return await response.json();
    } catch (error) {
        console.error('Failed to load menu item:', error);
        return null;
    }
}

// ============================================
// TARGET IMAGE COMPILATION
// ============================================

async function compileTargetImage(imageUrl) {
    try {
        console.log('Compiling target image:', imageUrl);
        
        // Load the image
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('Failed to load target image'));
            img.src = imageUrl;
        });
        
        console.log('Image loaded:', img.width, 'x', img.height);
        
        // Check if MindAR compiler is available
        if (typeof MINDAR === 'undefined' || !MINDAR.IMAGE || !MINDAR.IMAGE.Compiler) {
            console.log('MindAR compiler not found, loading...');
            await loadScript('https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js');
        }
        
        // Compile the image using MindAR's compiler
        const compiler = new MINDAR.IMAGE.Compiler();
        await compiler.compileImageTargets([img], (progress) => {
            const percent = Math.round(progress * 100);
            updateLoadingText(`Processing target image... ${percent}%`);
        });
        
        // Get the compiled data
        const exportedData = await compiler.exportData();
        
        // Convert to blob URL for use in A-Frame
        const blob = new Blob([exportedData], { type: 'application/octet-stream' });
        const blobUrl = URL.createObjectURL(blob);
        
        console.log('Target image compiled successfully');
        return blobUrl;
        
    } catch (error) {
        console.error('Failed to compile target image:', error);
        return null;
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load script: ' + src));
        document.head.appendChild(script);
    });
}

// ============================================
// CAMERA SUPPORT CHECK
// ============================================

async function checkCameraSupport() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('getUserMedia not supported');
            return false;
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        console.warn('Camera access denied or unavailable:', error);
        return false;
    }
}

// ============================================
// AR INITIALIZATION
// ============================================

async function initAR() {
    const arContainer = document.getElementById('arContainer');
    
    // Create A-Frame scene
    const sceneHTML = createARScene();
    arContainer.innerHTML = sceneHTML;
    
    arScene = document.querySelector('a-scene');
    
    arScene.addEventListener('loaded', () => {
        console.log('A-Frame scene loaded');
        hideLoading();
        showUI();
        showInstructions();
    });
    
    arScene.addEventListener('arReady', () => {
        console.log('MindAR ready');
        isARActive = true;
    });
    
    arScene.addEventListener('arError', (e) => {
        console.error('MindAR error:', e);
        showError('AR Error', 'Failed to start AR. Please refresh and try again.');
    });
    
    // Setup target event listeners
    setTimeout(() => {
        const target = document.querySelector('[mindar-image-target]');
        if (target) {
            target.addEventListener('targetFound', onTargetFound);
            target.addEventListener('targetLost', onTargetLost);
        }
    }, 1000);
}

function createARScene() {
    const contentType = menuItem.contentType || 'video';
    
    return `
        <a-scene
            mindar-image="imageTargetSrc: ${compiledMindData}; 
                          autoStart: true;
                          uiLoading: no;
                          uiScanning: no;
                          uiError: no;
                          filterMinCF: 0.0001;
                          filterBeta: 1000;
                          missTolerance: 5;
                          warmupTolerance: 5"
            color-space="sRGB"
            renderer="colorManagement: true; physicallyCorrectLights: true"
            vr-mode-ui="enabled: false"
            device-orientation-permission-ui="enabled: false">
            
            <a-assets>
                ${contentType === 'video' ? 
                    `<video id="arVideo" src="${menuItem.arContent}" 
                            preload="auto" loop crossorigin="anonymous" 
                            playsinline webkit-playsinline muted></video>` : 
                    `<a-asset-item id="arModel" src="${menuItem.arContent}"></a-asset-item>`
                }
            </a-assets>
            
            <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
            
            <a-entity mindar-image-target="targetIndex: 0">
                ${contentType === '3d' ? `
                    <a-gltf-model
                        src="#arModel"
                        position="0 0 0.1"
                        scale="0.2 0.2 0.2"
                        rotation="-90 0 0"
                        animation="property: rotation; to: -90 360 0; dur: 8000; loop: true; easing: linear">
                    </a-gltf-model>
                ` : `
                    <a-video
                        src="#arVideo"
                        position="0 0 0"
                        width="1"
                        height="0.552"
                        rotation="0 0 0">
                    </a-video>
                `}
            </a-entity>
        </a-scene>
    `;
}

// ============================================
// TARGET TRACKING EVENTS
// ============================================

function onTargetFound() {
    console.log('Target found!');
    
    const scanningIndicator = document.getElementById('scanningIndicator');
    if (scanningIndicator) {
        scanningIndicator.classList.add('hidden');
    }
    
    if (menuItem.contentType === 'video' || !menuItem.contentType) {
        const video = document.getElementById('arVideo');
        if (video) {
            video.muted = false;
            video.play().catch(e => {
                console.log('Video autoplay blocked, playing muted');
                video.muted = true;
                video.play();
            });
        }
    }
}

function onTargetLost() {
    console.log('Target lost');
    
    const scanningIndicator = document.getElementById('scanningIndicator');
    if (scanningIndicator) {
        scanningIndicator.classList.remove('hidden');
    }
    
    if (menuItem.contentType === 'video' || !menuItem.contentType) {
        const video = document.getElementById('arVideo');
        if (video) {
            video.pause();
        }
    }
}

// ============================================
// UI HELPERS
// ============================================

function updateLoadingText(text) {
    const el = document.getElementById('loadingText');
    if (el) el.textContent = text;
}

function hideLoading() {
    const el = document.getElementById('loadingScreen');
    if (el) el.classList.add('hidden');
}

function showUI() {
    const arContainer = document.getElementById('arContainer');
    const uiOverlay = document.getElementById('uiOverlay');
    if (arContainer) arContainer.classList.remove('hidden');
    if (uiOverlay) uiOverlay.classList.remove('hidden');
}

function showInstructions() {
    const el = document.getElementById('instructionsOverlay');
    if (el) el.classList.remove('hidden');
}

function hideInstructions() {
    const el = document.getElementById('instructionsOverlay');
    if (el) el.classList.add('hidden');
}

function showError(title, message) {
    const loadingScreen = document.getElementById('loadingScreen');
    const errorScreen = document.getElementById('errorScreen');
    const errorTitle = document.getElementById('errorTitle');
    const errorMessage = document.getElementById('errorMessage');
    
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (errorScreen) errorScreen.classList.remove('hidden');
    if (errorTitle) errorTitle.textContent = title;
    if (errorMessage) errorMessage.textContent = message;
}

function showFallback() {
    const loadingScreen = document.getElementById('loadingScreen');
    const fallbackView = document.getElementById('fallbackView');
    
    if (loadingScreen) loadingScreen.classList.add('hidden');
    if (fallbackView) fallbackView.classList.remove('hidden');
    
    const fallbackItemName = document.getElementById('fallbackItemName');
    const fallbackDescription = document.getElementById('fallbackDescription');
    const mediaContainer = document.getElementById('fallbackMedia');
    
    if (fallbackItemName) fallbackItemName.textContent = menuItem.name;
    if (fallbackDescription) fallbackDescription.textContent = menuItem.description || '';
    
    if (mediaContainer) {
        const contentType = menuItem.contentType || 'video';
        if (contentType === 'video') {
            mediaContainer.innerHTML = `
                <video controls autoplay loop muted playsinline style="max-width: 100%; border-radius: 8px;">
                    <source src="${menuItem.arContent}" type="video/mp4">
                </video>
            `;
        } else {
            mediaContainer.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <span style="font-size: 4rem;">📦</span>
                    <p style="margin-top: 1rem; color: #a0aec0;">3D Model Preview</p>
                    <p style="font-size: 0.875rem; color: #666;">
                        Use a device with camera access to view in AR
                    </p>
                </div>
            `;
        }
    }
}

// Register A-Frame component
if (typeof AFRAME !== 'undefined') {
    AFRAME.registerComponent('play-on-target', {
        init: function() {
            this.el.addEventListener('materialvideoloadeddata', () => {
                console.log('Video loaded');
            });
        }
    });
}
