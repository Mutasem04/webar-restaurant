/**
 * WebAR Restaurant - AR Viewer JavaScript
 * 
 * This file handles:
 * 1. Loading menu item data from the server
 * 2. Initializing the MindAR scene
 * 3. Camera permission handling
 * 4. AR target tracking events
 * 5. Displaying video or 3D content on target
 */

// ============================================
// GLOBAL STATE
// ============================================

let menuItem = null;
let arScene = null;
let isARActive = false;

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
        
        // Initialize AR
        updateLoadingText('Starting AR experience...');
        await initAR();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Error', error.message);
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
// CAMERA SUPPORT CHECK
// ============================================

async function checkCameraSupport() {
    try {
        // Check if getUserMedia is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('getUserMedia not supported');
            return false;
        }
        
        // Try to get camera access
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        
        // Stop the stream immediately (we just needed to check access)
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
    
    // Create A-Frame scene dynamically
    const sceneHTML = createARScene();
    arContainer.innerHTML = sceneHTML;
    
    // Wait for scene to initialize
    arScene = document.querySelector('a-scene');
    
    // Handle scene loaded
    arScene.addEventListener('loaded', () => {
        console.log('A-Frame scene loaded');
        hideLoading();
        showUI();
        showInstructions();
    });
    
    // Handle AR target found/lost events
    const arSystem = arScene.systems['mindar-image-system'];
    
    arScene.addEventListener('arReady', () => {
        console.log('MindAR ready');
        isARActive = true;
    });
    
    arScene.addEventListener('arError', (e) => {
        console.error('MindAR error:', e);
        showError('AR Error', 'Failed to initialize augmented reality.');
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
    /**
     * Create the A-Frame AR scene with MindAR
     * 
     * Key components:
     * - mindar-image: The AR system with the compiled target image (.mind file)
     * - mindar-image-target: The trackable target (index 0 = first target)
     * - a-video or a-gltf-model: The content to display on the target
     * 
     * TO SWAP ASSETS:
     * 1. Change the 'imageTargetSrc' to point to your .mind file
     * 2. For videos: Update the 'src' attribute of a-video
     * 3. For 3D models: Use a-gltf-model instead of a-video
     */
    
    // Use the target image directly if .mind file is not compiled
    // In production, use the compiled .mind file for better tracking
    const targetSrc = menuItem.mindFile || menuItem.targetImage;
    
    // Determine content element based on type
    let contentElement = '';
    
    if (menuItem.contentType === '3d') {
        // 3D Model (GLB/GLTF)
        contentElement = `
            <a-gltf-model
                src="${menuItem.arContent}"
                position="0 0 0"
                scale="0.5 0.5 0.5"
                rotation="0 0 0"
                animation="property: rotation; to: 0 360 0; dur: 10000; loop: true; easing: linear">
            </a-gltf-model>
        `;
    } else {
        // Video content
        contentElement = `
            <a-video
                src="${menuItem.arContent}"
                position="0 0 0"
                width="1"
                height="0.56"
                rotation="0 0 0"
                play-on-target>
            </a-video>
        `;
    }
    
    /**
     * IMPORTANT: For production use, you need to:
     * 
     * 1. Compile the target image to .mind format using MindAR's compiler:
     *    - Browser compiler: https://hiukim.github.io/mind-ar-js-doc/tools/compile/
     *    - Or use the server-side compiler
     * 
     * 2. Replace 'imageTargetSrc' with the path to your .mind file
     * 
     * 3. Adjust the scale and position of content to fit your needs:
     *    - For videos: width/height in meters
     *    - For 3D models: scale values
     */
    
    return `
        <a-scene
            mindar-image="imageTargetSrc: ${menuItem.targetImage}; 
                          autoStart: true;
                          uiLoading: no;
                          uiScanning: no;
                          uiError: no;
                          filterMinCF: 0.001;
                          filterBeta: 10"
            color-space="sRGB"
            renderer="colorManagement: true; physicallyCorrectLights: true"
            vr-mode-ui="enabled: false"
            device-orientation-permission-ui="enabled: false">
            
            <!-- Assets preloading -->
            <a-assets>
                ${menuItem.contentType === 'video' ? 
                    `<video id="arVideo" src="${menuItem.arContent}" 
                            preload="auto" loop crossorigin="anonymous" 
                            playsinline webkit-playsinline muted></video>` : 
                    `<a-asset-item id="arModel" src="${menuItem.arContent}"></a-asset-item>`
                }
            </a-assets>
            
            <!-- Camera -->
            <a-camera position="0 0 0" look-controls="enabled: false"></a-camera>
            
            <!-- AR Target -->
            <a-entity mindar-image-target="targetIndex: 0">
                ${menuItem.contentType === '3d' ? `
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
    
    // Hide scanning indicator
    document.getElementById('scanningIndicator').classList.add('hidden');
    
    // Play video if content is video
    if (menuItem.contentType === 'video') {
        const video = document.getElementById('arVideo');
        if (video) {
            video.muted = false;
            video.play().catch(e => {
                console.log('Video autoplay prevented, trying muted:', e);
                video.muted = true;
                video.play();
            });
        }
    }
}

function onTargetLost() {
    console.log('Target lost');
    
    // Show scanning indicator
    document.getElementById('scanningIndicator').classList.remove('hidden');
    
    // Pause video
    if (menuItem.contentType === 'video') {
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
    document.getElementById('loadingText').textContent = text;
}

function hideLoading() {
    document.getElementById('loadingScreen').classList.add('hidden');
}

function showUI() {
    document.getElementById('arContainer').classList.remove('hidden');
    document.getElementById('uiOverlay').classList.remove('hidden');
}

function showInstructions() {
    document.getElementById('instructionsOverlay').classList.remove('hidden');
}

function hideInstructions() {
    document.getElementById('instructionsOverlay').classList.add('hidden');
}

function showError(title, message) {
    document.getElementById('loadingScreen').classList.add('hidden');
    document.getElementById('errorScreen').classList.remove('hidden');
    document.getElementById('errorTitle').textContent = title;
    document.getElementById('errorMessage').textContent = message;
}

function showFallback() {
    document.getElementById('loadingScreen').classList.add('hidden');
    document.getElementById('fallbackView').classList.remove('hidden');
    document.getElementById('fallbackItemName').textContent = menuItem.name;
    document.getElementById('fallbackDescription').textContent = menuItem.description || '';
    
    const mediaContainer = document.getElementById('fallbackMedia');
    
    if (menuItem.contentType === 'video') {
        mediaContainer.innerHTML = `
            <video controls autoplay loop muted playsinline style="max-width: 100%; border-radius: 8px;">
                <source src="${menuItem.arContent}" type="video/mp4">
            </video>
        `;
    } else {
        // For 3D models, show model-viewer or placeholder
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

// ============================================
// CUSTOM A-FRAME COMPONENTS
// ============================================

// Component to handle video playback on target
AFRAME.registerComponent('play-on-target', {
    init: function() {
        this.el.addEventListener('materialvideoloadeddata', () => {
            console.log('Video loaded');
        });
    }
});
