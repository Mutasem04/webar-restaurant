/**
 * Smart Menu AR - AR Viewer JavaScript
 * Enhanced 3D model and video support
 */

let menuItem = null;
let arScene = null;
let isARActive = false;
let compiledMindData = null;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const params = new URLSearchParams(window.location.search);
        const itemId = params.get('id');

        if (!itemId) {
            showError('No Item Selected', 'Please scan a valid QR code to view AR content.');
            return;
        }

        updateLoadingText('Loading item data...');
        menuItem = await loadMenuItem(itemId);

        if (!menuItem) {
            showError('Item Not Found', 'This menu item no longer exists.');
            return;
        }

        console.log('Menu item loaded:', menuItem);
        console.log('Content type:', menuItem.contentType);
        console.log('AR content:', menuItem.arContent);

        document.getElementById('itemName').textContent = menuItem.name;
        document.getElementById('itemDescription').textContent = menuItem.description || '';
        document.getElementById('targetPreviewImg').src = menuItem.targetImage;

        updateLoadingText('Checking camera access...');
        const hasCamera = await checkCameraSupport();

        if (!hasCamera) {
            showFallback();
            return;
        }

        updateLoadingText('Preparing AR target...');
        compiledMindData = await compileTargetImage(menuItem.targetImage);

        if (!compiledMindData) {
            showError('Compilation Failed', 'Could not process the target image. Please try again.');
            return;
        }

        updateLoadingText('Starting AR experience...');
        await initAR();

    } catch (error) {
        console.error('Initialization error:', error);
        showError('Error', error.message || 'Something went wrong');
    }
});

async function loadMenuItem(id) {
    try {
        const response = await fetch('/api/items/' + id);
        if (!response.ok) throw new Error('Item not found');
        return await response.json();
    } catch (error) {
        console.error('Failed to load menu item:', error);
        return null;
    }
}

async function compileTargetImage(imageUrl) {
    try {
        console.log('Compiling target image:', imageUrl);

        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = () => reject(new Error('Failed to load target image'));
            img.src = imageUrl;
        });

        console.log('Image loaded:', img.width, 'x', img.height);

        if (typeof MINDAR === 'undefined' || !MINDAR.IMAGE || !MINDAR.IMAGE.Compiler) {
            console.log('Loading MindAR compiler...');
            await loadScript('https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js');
        }

        const compiler = new MINDAR.IMAGE.Compiler();
        await compiler.compileImageTargets([img], (progress) => {
            const percent = Math.round(progress * 100);
            updateLoadingText('Processing target image... ' + percent + '%');
        });

        const exportedData = await compiler.exportData();
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
        if (document.querySelector('script[src="' + src + '"]')) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = () => reject(new Error('Failed to load: ' + src));
        document.head.appendChild(script);
    });
}

async function checkCameraSupport() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (error) {
        console.warn('Camera access denied:', error);
        return false;
    }
}

async function initAR() {
    const arContainer = document.getElementById('arContainer');
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
    const arContent = menuItem.arContent;

    console.log('Creating AR scene with content type:', contentType);
    console.log('AR content URL:', arContent);

    let assetHTML = '';
    let contentHTML = '';

    if (contentType === '3d') {
        assetHTML = '<a-asset-item id="arModel" src="' + arContent + '"></a-asset-item>';
        contentHTML = '<a-gltf-model ' +
            'src="#arModel" ' +
            'position="0 0.1 0" ' +
            'scale="0.3 0.3 0.3" ' +
            'rotation="0 0 0" ' +
            'animation="property: rotation; to: 0 360 0; dur: 10000; loop: true; easing: linear">' +
            '</a-gltf-model>';
    } else if (contentType === 'image') {
        assetHTML = '<img id="arImage" src="' + arContent + '" crossorigin="anonymous">';
        contentHTML = '<a-image ' +
            'src="#arImage" ' +
            'position="0 0 0" ' +
            'width="1" ' +
            'height="1" ' +
            'rotation="0 0 0">' +
            '</a-image>';
    } else {
        assetHTML = '<video id="arVideo" src="' + arContent + '" preload="auto" loop crossorigin="anonymous" playsinline webkit-playsinline muted></video>';
        contentHTML = '<a-video ' +
            'src="#arVideo" ' +
            'position="0 0 0" ' +
            'width="1" ' +
            'height="0.552" ' +
            'rotation="0 0 0">' +
            '</a-video>';
    }

    return '<a-scene ' +
        'mindar-image="imageTargetSrc: ' + compiledMindData + '; autoStart: true; uiLoading: no; uiScanning: no; uiError: no; filterMinCF: 0.0001; filterBeta: 1000; missTolerance: 5; warmupTolerance: 5" ' +
        'color-space="sRGB" ' +
        'renderer="colorManagement: true; physicallyCorrectLights: true; antialias: true" ' +
        'vr-mode-ui="enabled: false" ' +
        'device-orientation-permission-ui="enabled: false">' +
        '<a-assets timeout="30000">' + assetHTML + '</a-assets>' +
        '<a-camera position="0 0 0" look-controls="enabled: false"></a-camera>' +
        '<a-entity mindar-image-target="targetIndex: 0">' +
        '<a-light type="ambient" color="#ffffff" intensity="0.8"></a-light>' +
        '<a-light type="directional" color="#ffffff" intensity="0.6" position="0 1 1"></a-light>' +
        contentHTML +
        '</a-entity>' +
        '</a-scene>';
}

function onTargetFound() {
    console.log('Target found!');
    const scanningIndicator = document.getElementById('scanningIndicator');
    if (scanningIndicator) scanningIndicator.classList.add('hidden');

    const contentType = menuItem.contentType || 'video';
    if (contentType === 'video') {
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
    if (scanningIndicator) scanningIndicator.classList.remove('hidden');

    const contentType = menuItem.contentType || 'video';
    if (contentType === 'video') {
        const video = document.getElementById('arVideo');
        if (video) video.pause();
    }
}

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
            mediaContainer.innerHTML = '<video controls autoplay loop muted playsinline style="max-width: 100%; border-radius: 12px;"><source src="' + menuItem.arContent + '" type="video/mp4"></video>';
        } else if (contentType === '3d') {
            mediaContainer.innerHTML = '<model-viewer src="' + menuItem.arContent + '" auto-rotate camera-controls style="width: 100%; height: 300px; border-radius: 12px;"></model-viewer><script type="module" src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"><\/script>';
        } else {
            mediaContainer.innerHTML = '<img src="' + menuItem.arContent + '" style="max-width: 100%; border-radius: 12px;" alt="' + menuItem.name + '">';
        }
    }
}

if (typeof AFRAME !== 'undefined') {
    AFRAME.registerComponent('play-on-target', {
        init: function() {
            this.el.addEventListener('materialvideoloadeddata', () => console.log('Video loaded'));
        }
    });
}
