document.addEventListener('DOMContentLoaded', () => {
    // NEW: Add this block to check if required libraries are loaded
    if (window.streamSaver) {
        console.log('✅ StreamSaver.js loaded successfully.');
    } else {
        console.error('❌ CRITICAL ERROR: StreamSaver.js failed to load. Exporting will not work.');
    }
    if (window.oboe) {
        console.log('✅ oboe.js loaded successfully.');
    } else {
        console.error('❌ CRITICAL ERROR: oboe.js failed to load. Large file importing will not work.');
    }    // --- 1. STATE SETUP ---
    let timelineData = {};
    let isAdmin = false;
    let secretPhotoLoadIndex = 0;
    let secretPhotoLoadTimeoutId = null;

    const initialData = {
        timeline: [],
        secretPhotos: []
    };

    // --- 2. DOM ELEMENTS ---
    const timelineContainer = document.getElementById('timeline-container');
    const modalsContainer = document.getElementById('modals-container');
    const adminLoginBtn = document.getElementById('admin-login-btn');
    const adminControls = document.getElementById('admin-controls');
    const secretBtn = document.getElementById('secret-btn');
    const embarrassingPhotosSection = document.getElementById('embarrassing-photos');
    const photoGrid = document.getElementById('photo-grid');

    // --- 3. RENDER FUNCTIONS ---
    const initializeData = () => {
        timelineData = JSON.parse(JSON.stringify(initialData));
        renderTimeline();
    };

    const renderTimeline = () => {
        const createAddButtonGroup = (index, prevItemType) => {
            if (!isAdmin) return '';
            const allowAddBackground = prevItemType === 'polaroid' || prevItemType === null;
            const bgButton = allowAddBackground ? `<button class="add-bg-btn bg-sky-500 hover:bg-sky-600 text-white rounded-full h-8 w-8 flex items-center justify-center text-lg shadow-md" data-index="${index}" title="Add Background Theme">+</button>` : '';
            return `<div class="add-controls-group relative h-16 flex justify-center items-center gap-4"><div class="w-full h-px bg-white/10"></div><button class="add-polaroid-btn bg-green-500 hover:bg-green-600 text-white rounded-full h-8 w-8 flex items-center justify-center text-lg shadow-md" data-index="${index}" title="Add Polaroid">+</button>${bgButton}<div class="w-full h-px bg-white/10"></div></div>`;
        };
        
        const currentTimeline = timelineData.timeline || [];
        timelineContainer.innerHTML = ''; 

        if (currentTimeline.length === 0) {
            timelineContainer.innerHTML = `<div class="text-center py-20"><h2 class="text-2xl font-bold text-slate-300">The Timeline is Empty</h2><p class="text-slate-400 mt-2">Use Admin Controls to import a file or add new items.</p></div>`;
            document.body.style.backgroundImage = 'none';
            if (isAdmin) timelineContainer.insertAdjacentHTML('afterbegin', createAddButtonGroup(0, null));
            return;
        }

        currentTimeline.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        
        const firstBgItem = currentTimeline.find(item => item.type === 'background');
        let currentBackgroundUrl = firstBgItem ? firstBgItem.imageUrl : '';
        document.body.style.backgroundImage = currentBackgroundUrl ? `url('${currentBackgroundUrl}')` : 'none';

        timelineContainer.innerHTML = '<div class="absolute left-1/2 top-0 h-full w-1 bg-white/20 transform -translate-x-1/2"></div>';
        timelineContainer.insertAdjacentHTML('beforeend', createAddButtonGroup(0, null));
        
        let polaroidCounter = 0;
        currentTimeline.forEach((item, index) => {
            let elementToAppend;
            if (item.type === 'background') {
                currentBackgroundUrl = item.imageUrl;
                elementToAppend = document.createElement('div');
                elementToAppend.className = 'relative z-10 my-8 flex justify-center items-center timeline-item';
                elementToAppend.dataset.backgroundUrl = currentBackgroundUrl;
                if (isAdmin) {
                    elementToAppend.innerHTML = `<div class="bg-slate-700/80 backdrop-blur-sm rounded-full px-4 py-2 text-sm text-sky-300 flex items-center gap-4 shadow-lg"><span>Theme: ${item.themeName}</span><button class="edit-bg-btn text-sky-400 hover:text-white" data-id="${item.id}" title="Edit Background">✏️</button><button class="delete-btn text-red-400 hover:text-white" data-id="${item.id}" data-type="timeline" title="Delete Background">×</button></div>`;
                } else {
                    elementToAppend.innerHTML = `<div class="bg-slate-700/80 backdrop-blur-sm rounded-full px-4 py-2 text-sm text-sky-300"><span>Theme: ${item.themeName}</span></div>`;
                }
            } else if (item.type === 'polaroid') {
                const sideClass = polaroidCounter % 2 === 0 ? 'md:ml-auto' : 'md:mr-auto';
                elementToAppend = document.createElement('div');
                elementToAppend.className = `timeline-item timeline-item-placeholder relative w-full md:w-1/2 ${sideClass}`;
                elementToAppend.style.height = '420px'; // Average height to prevent scrollbar jumping
                elementToAppend.dataset.index = index;

                const nextItem = currentTimeline[index + 1];
                if (!nextItem || nextItem.type === 'background') {
                    elementToAppend.dataset.isBoundary = 'true';
                    let nextBgUrl = '';
                    for (let i = index + 1; i < currentTimeline.length; i++) {
                        if (currentTimeline[i].type === 'background') {
                            nextBgUrl = currentTimeline[i].imageUrl;
                            break;
                        }
                    }
                    elementToAppend.dataset.nextBg = nextBgUrl;
                }
                elementToAppend.dataset.backgroundUrl = currentBackgroundUrl;
                polaroidCounter++;
            }
            
            if (elementToAppend) timelineContainer.appendChild(elementToAppend);
            timelineContainer.insertAdjacentHTML('beforeend', createAddButtonGroup(index + 1, item.type));
        });
        setupObservers();
    };

const renderSecretPhotos = () => {
    const photos = timelineData.secretPhotos || [];

    // Helper to create low-res thumbnails for fast loading
    const createThumbnail = (base64String, callback) => {
        if (!base64String || typeof base64String !== 'string') {
            console.warn('Invalid image data found for a secret photo.');
            callback('https://placehold.co/300x300/f7f7f7/d1d1d1?text=Invalid+Data');
            return;
        }
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const max_size = 300;
            let { width, height } = img;

            if (width > height) {
                if (width > max_size) { height *= max_size / width; width = max_size; }
            } else {
                if (height > max_size) { width *= max_size / height; height = max_size; }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = () => callback('https://placehold.co/300x300/f7f7f7/d1d1d1?text=Load+Error');
        img.src = base64String;
    };

    function loadNextPhoto() {
        // Stop loading if all photos are done or if the secret menu is hidden
        if (secretPhotoLoadIndex >= photos.length || embarrassingPhotosSection.classList.contains('hidden')) {
            return;
        }
        
        const photo = photos[secretPhotoLoadIndex];

        // Safely skip any photo objects that are missing a URL
        if (!photo || !photo.url) {
            console.warn('Skipping a secret photo with no URL at index:', secretPhotoLoadIndex);
            secretPhotoLoadIndex++;
            loadNextPhoto(); // Immediately try to load the next one
            return;
        }

        createThumbnail(photo.url, (thumbnailUrl) => {
            const photoEl = document.createElement('div');
            photoEl.className = 'absolute w-48 h-auto bg-white p-2 rounded-lg shadow-lg cursor-grab active:cursor-grabbing opacity-0 transition-opacity duration-500';
            photoEl.style.top = photo.top;
            photoEl.style.left = photo.left;
            photoEl.style.transform = `rotate(${photo.rotation || 0}deg)`;
            photoEl.dataset.id = photo.id;
            
            photoEl.innerHTML = `<div class="bg-gray-200 rounded-sm">
                                    <img src="${thumbnailUrl}" class="w-full zoomable" data-full-res-src="${photo.url}">
                                 </div>
                                 <div class="rotate-handle"></div>
                                 ${isAdmin ? `<button class="delete-btn absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center text-xs z-10" data-id="${photo.id}" data-type="secret">×</button>` : ''}`;
            photoGrid.appendChild(photoEl);
            makeDraggableAndRotatable(photoEl);
            
            // Fade the photo in
            setTimeout(() => photoEl.classList.remove('opacity-0'), 10);
        });

        secretPhotoLoadIndex++;
        // Schedule the next photo to be loaded
        secretPhotoLoadTimeoutId = setTimeout(loadNextPhoto, 50);
    }

    loadNextPhoto();
};
    
    // --- 4. HELPER FUNCTIONS ---
    const showModal = (id, content, zIndex = 'z-50') => {
        const modalWrapper = document.createElement('div');
        modalWrapper.id = id;
        modalWrapper.className = `fixed inset-0 bg-black/60 flex items-center justify-center p-4 ${zIndex}`;
        modalWrapper.innerHTML = `<div class="bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md relative">
                                        <button class="close-modal-btn absolute top-3 right-3 text-white/50 hover:text-white text-2xl">×</button>
                                        ${content}
                                    </div>`;
        modalsContainer.appendChild(modalWrapper);
        modalWrapper.querySelector('.close-modal-btn').onclick = () => closeModal(id);
    };
    
    const showProgressOverlay = (message) => {
        const overlay = document.createElement('div');
        overlay.id = 'progress-overlay';
        overlay.className = 'progress-overlay';
        overlay.innerHTML = `
            <div>
                <h3 class="text-2xl font-bold">${message}</h3>
                <p class="text-slate-300 mt-2">Please keep this tab open. This may take several minutes.</p>
            </div>
            <div class="progress-bar-container">
                <div id="progress-bar-inner" class="progress-bar-inner"></div>
            </div>
            <div id="progress-percent" class="font-mono text-lg">0%</div>
        `;
        document.body.appendChild(overlay);
    };

    const updateProgress = (percent) => {
        const bar = document.getElementById('progress-bar-inner');
        const text = document.getElementById('progress-percent');
        if (bar) bar.style.width = `${percent}%`;
        if (text) text.textContent = `${percent}%`;
    };

    const hideProgressOverlay = () => {
        document.getElementById('progress-overlay')?.remove();
    };
    
    const closeModal = (id) => document.getElementById(id)?.remove();

    const handleAdminLogin = () => {
        const modalId = 'admin-login-modal';
        showModal(modalId, `
            <h3 class="text-xl font-bold mb-4">Admin Login</h3>
            <form id="admin-login-form" class="space-y-4">
                <input type="password" id="admin-password-input" class="w-full p-2 bg-slate-700 rounded" placeholder="Password">
                <button type="submit" class="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded">Login</button>
            </form>
        `);
        document.getElementById('admin-password-input')?.focus();

        document.getElementById('admin-login-form').onsubmit = (e) => {
            e.preventDefault();
            const password = document.getElementById('admin-password-input').value;
            if (password === "12006") {
                isAdmin = true;
                adminControls.classList.remove('hidden');
                renderTimeline();
                closeModal(modalId);
            } else { alert("Incorrect Password."); }
        };
    };
    
    const handleLogout = () => {
        isAdmin = false;
        adminControls.classList.add('hidden');
        renderTimeline();
    };

    const setupObservers = () => {
        const cardObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) entry.target.classList.add('is-visible');
            });
        }, { threshold: 0.1 });

        const backgroundChangeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const boundaryElement = entry.target;
                const prevBg = boundaryElement.dataset.backgroundUrl;
                const nextBg = boundaryElement.dataset.nextBg;
                if (entry.isIntersecting) {
                    document.body.style.backgroundImage = `url('${prevBg}')`;
                } else if (entry.boundingClientRect.bottom < 1) {
                    document.body.style.backgroundImage = nextBg ? `url('${nextBg}')` : 'none';
                }
            });
        }, { rootMargin: '0px 0px -100% 0px', threshold: 0 });

        const virtualizationObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;

                const placeholder = entry.target;
                observer.unobserve(placeholder); // Render only once

                const itemIndex = parseInt(placeholder.dataset.index);
                const item = timelineData.timeline[itemIndex];
                if (!item || item.type !== 'polaroid') return;

                const polaroidIndex = timelineData.timeline.slice(0, itemIndex).filter(i => i.type === 'polaroid').length;
                const alignmentClass = polaroidIndex % 2 === 0 ? 'md:pl-12' : 'md:pr-12';
                const rotationClass = polaroidIndex % 2 === 0 ? 'rotate-2' : '-rotate-2';
                const pinColors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500'];
                const randomPinColor = pinColors[Math.floor(Math.random() * pinColors.length)];

                let locationHtml = '';
                if (item.location && item.locationUrl) {
                    locationHtml = `<a href="${item.locationUrl}" target="_blank" rel="noopener noreferrer" class="cursive text-[15px] text-blue-600 hover:underline">${item.location}</a>`;
                } else if (item.location) {
                    locationHtml = `<p class="cursive text-[15px]">${item.location}</p>`;
                }

                placeholder.style.height = ''; // Remove placeholder height
                placeholder.innerHTML = `<div class="timeline-card w-full max-w-sm mx-auto md:mx-0 ${alignmentClass}"><div class="relative bg-white p-4 pb-2 rounded-lg shadow-2xl transform ${rotationClass} hover:!rotate-0 transition-transform duration-300"><div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 ${randomPinColor} rounded-full border-2 border-white shadow-md z-10"></div><div class="bg-gray-200 rounded-sm"><img src="${item.imageUrl}" alt="${item.title || 'Timeline Image'}" class="w-full h-auto rounded-sm zoomable" onerror="this.onerror=null;this.src='https://placehold.co/600x400/cccccc/ffffff?text=Image+Error';"></div><div class="p-4 pt-2 text-gray-800 ${polaroidIndex % 2 !== 0 ? 'md:text-right' : ''}"><p class="cursive text-[15px]">${item.date}</p>${item.title ? `<p class="cursive text-[20px] font-bold">${item.title}</p>` : ''}${locationHtml}</div><div class="absolute -top-3 -right-3 flex gap-2">${isAdmin ? `<button class="edit-polaroid-btn bg-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center shadow-lg" data-id="${item.id}" title="Edit Polaroid">✏️</button>` : ''}${isAdmin ? `<button class="delete-btn bg-red-600 text-white rounded-full h-8 w-8 flex items-center justify-center shadow-lg" data-id="${item.id}" data-type="timeline" title="Delete Polaroid">×</button>` : ''}</div></div></div>`;
                
                const newCard = placeholder.querySelector('.timeline-card');
                if (newCard) cardObserver.observe(newCard);
            });
        }, { rootMargin: '400px 0px 400px 0px' });

        document.querySelectorAll('.timeline-item-placeholder').forEach(el => virtualizationObserver.observe(el));
        document.querySelectorAll('.timeline-item[data-is-boundary="true"]').forEach(el => backgroundChangeObserver.observe(el));
    };

    const setupDeleteButtons = () => {
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.onclick = (e) => {
                // FIXED: Changed parseInt to parseFloat to handle the decimal IDs of secret photos
                const itemId = parseFloat(e.currentTarget.dataset.id); 
                const itemType = e.currentTarget.dataset.type;

                if (confirm('Are you sure you want to delete this item?')) {
                    if (itemType === 'timeline') {
                        timelineData.timeline = timelineData.timeline.filter(item => item.id !== itemId);
                        renderTimeline();
                    } else if (itemType === 'secret') {
                        timelineData.secretPhotos = timelineData.secretPhotos.filter(photo => photo.id !== itemId);
                        renderSecretPhotos();
                    }
                }
            };
        });
    };
    
    const handleImageFile = (file, previewEl, callback) => {
        if (!file || !file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            if (previewEl) {
                previewEl.innerHTML = `<img src="${dataUrl}" class="h-full w-full object-cover rounded">`;
                previewEl.classList.remove('p-4');
            }
            callback(dataUrl);
        };
        reader.readAsDataURL(file);
    };

const handleExport = () => {
    if ((!timelineData.timeline || timelineData.timeline.length === 0) && (!timelineData.secretPhotos || timelineData.secretPhotos.length === 0)) {
        alert("There is no data to export.");
        return;
    }

    const modalId = 'export-choice-modal';
    const modalContent = `
        <h3 class="text-xl font-bold mb-4">Choose Export Format</h3>
        <p class="text-slate-300 mb-6">How would you like to save your data?</p>
        <div class="space-y-4">
            <button id="export-single-file" class="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded">
                <strong class="block">Single Large File</strong>
                <span class="text-sm text-blue-200">Best for easy re-importing</span>
            </button>
            <button id="export-parts" class="w-full py-3 bg-sky-600 hover:bg-sky-700 rounded">
                <strong class="block">Separate Parts</strong>
                <span class="text-sm text-sky-200">Best for backup and recovery</span>
            </button>
        </div>
    `;
    
    showModal(modalId, modalContent);

    const exportAsStream = async () => {
        // This function remains the same as it was already correct.
        closeModal(modalId);
        const fileStream = streamSaver.createWriteStream('timeline_data.json');
        const writer = fileStream.getWriter();
        const encoder = new TextEncoder();
        const write = (str) => writer.write(encoder.encode(str));

        try {
            showProgressOverlay('Exporting as single file...');
            await write('{"timeline":[');
            for (let i = 0; i < timelineData.timeline.length; i++) {
                await write(JSON.stringify(timelineData.timeline[i]));
                if (i < timelineData.timeline.length - 1) await write(',');
                updateProgress(Math.round(((i + 1) / timelineData.timeline.length) * 50));
            }
            await write('],"secretPhotos":[');
            for (let i = 0; i < timelineData.secretPhotos.length; i++) {
                await write(JSON.stringify(timelineData.secretPhotos[i]));
                if (i < timelineData.secretPhotos.length - 1) await write(',');
                updateProgress(50 + Math.round(((i + 1) / timelineData.secretPhotos.length) * 50));
            }
            await write(']}');
            await writer.close();
            hideProgressOverlay();
            alert("Data exported to timeline_data.json!");
        } catch (err) {
            hideProgressOverlay();
            const errorMessage = err ? err.message : "An unknown error occurred.";
            console.error("Export failed:", err || errorMessage);
            alert(`An error occurred during export: ${errorMessage}`);
        }
    };

    const exportInParts = async () => {
        closeModal(modalId);
        showProgressOverlay('Exporting in parts...');

        const MAX_CHUNK_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

        const saveChunkAsStream = async (chunk, fileName) => {
            const fileStream = streamSaver.createWriteStream(fileName);
            const writer = fileStream.getWriter();
            const encoder = new TextEncoder();
            const write = (str) => writer.write(encoder.encode(str));
            await write('[');
            for (let i = 0; i < chunk.length; i++) {
                await write(JSON.stringify(chunk[i]));
                if (i < chunk.length - 1) await write(',');
            }
            await write(']');
            await writer.close();
        };

        // Generic function to process and save items in chunks
        const processAndSave = async (items, typeName) => {
            if (!items || items.length === 0) return 0;

            let chunk = [];
            let currentChunkSizeBytes = 0;
            let partNumber = 1;
            let savedChunksCount = 0;

            for (const item of items) {
                const itemSize = JSON.stringify(item).length;
                if (currentChunkSizeBytes > 0 && currentChunkSizeBytes + itemSize > MAX_CHUNK_SIZE_BYTES) {
                    await saveChunkAsStream(chunk, `${typeName}-part-${partNumber}.json`);
                    partNumber++;
                    savedChunksCount++;
                    chunk = [];
                    currentChunkSizeBytes = 0;
                }
                chunk.push(item);
                currentChunkSizeBytes += itemSize;
            }
            if (chunk.length > 0) {
                await saveChunkAsStream(chunk, `${typeName}-part-${partNumber}.json`);
                savedChunksCount++;
            }
            return savedChunksCount;
        };
        
        try {
            const timelineParts = await processAndSave(timelineData.timeline, 'timeline-metadata');
            const photoParts = await processAndSave(timelineData.secretPhotos, 'photos');
            
            hideProgressOverlay();
            alert(`Successfully exported ${timelineParts} timeline part(s) and ${photoParts} photo part(s)!`);

        } catch (err) {
            hideProgressOverlay();
            const errorMessage = err ? err.message : "An unknown error occurred.";
            console.error("Export in parts failed:", err || errorMessage);
            alert(`Export failed: ${errorMessage}`);
        }
    };

    document.getElementById('export-single-file').onclick = exportAsStream;
    document.getElementById('export-parts').onclick = exportInParts;
};

    const parseAndLoadJSON = (jsonString, modalId) => {
        try {
            const importedData = JSON.parse(jsonString);
            if (importedData.timeline && Array.isArray(importedData.timeline)) {
                timelineData = importedData;
                renderTimeline();
                if (modalId) closeModal(modalId);
                alert("Data imported successfully!");
            } else {
                alert("Invalid file format.");
            }
        } catch (error) {
            console.error("Error parsing JSON:", error);
            alert("Could not import data.");
        }
    };

const handleImport = () => {
    const modalId = 'import-modal';
    let stagedMetadata = []; // Changed from null to an empty array
    let stagedPhotos = [];

const modalHTML = `
    <h3 class="text-xl font-bold mb-4">Import Timeline Data</h3>
    <div id="import-status" class="text-center text-slate-400 mb-4"></div>

    <div class="space-y-4 pt-4">
        <h4 class="text-lg font-bold text-center">Import From Parts</h4>
        <div id="multi-file-status" class="text-center text-slate-400 h-10">
            <p>Select your exported chunk files.</p>
        </div>

        <div class="grid grid-cols-2 gap-4">
            <button id="import-meta-btn" class="w-full py-2 bg-sky-600 hover:bg-sky-700 rounded">
                1. Load Metadata
            </button>

            <button id="import-photos-btn" class="w-full py-2 bg-purple-600 hover:bg-purple-700 rounded">
                2. Load Photos
            </button>
        </div>

        <button id="import-all-btn" class="w-full py-2 bg-green-600 hover:bg-green-700 rounded font-bold">
            3. Rebuild Timeline
        </button>
    </div>
`;


    showModal(modalId, modalHTML);

    const multiStatusEl = document.getElementById('multi-file-status');

    const readFileAsJson = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => { try { resolve(JSON.parse(event.target.result)); } catch (e) { reject(e); } };
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });

    document.getElementById('import-meta-btn').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.multiple = true; // Allow multiple file selection
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            multiStatusEl.innerHTML = `<p>Processing ${files.length} metadata file(s)...</p>`;
            try {
                // Read all selected files in parallel
                const parsedFiles = await Promise.all(files.map(readFileAsJson));
                stagedMetadata = []; // Reset before adding new data
                parsedFiles.forEach(data => {
                    if (Array.isArray(data)) stagedMetadata.push(...data);
                });
                multiStatusEl.innerHTML = `<p class="text-green-400">✅ ${stagedMetadata.length} total timeline items loaded.</p>`;
            } catch (error) {
                multiStatusEl.innerHTML = `<p class="text-red-400">Error: ${error.message}</p>`;
            }
        };
        input.click();
    };

    document.getElementById('import-photos-btn').onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.multiple = true;
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            multiStatusEl.innerHTML = `<p>Loading ${files.length} photo file(s)...</p>`;
            stagedPhotos = []; // Reset before loading new photos
            try {
                const parsedFiles = await Promise.all(files.map(readFileAsJson));
                parsedFiles.forEach(data => {
                    if (Array.isArray(data)) stagedPhotos.push(...data);
                });
                multiStatusEl.innerHTML = `<p class="text-green-400">✅ ${stagedPhotos.length} total photos loaded.</p>`;
            } catch (error) {
                multiStatusEl.innerHTML = `<p class="text-red-400">Error: ${error.message}</p>`;
            }
        };
        input.click();
    };

    document.getElementById('import-all-btn').onclick = () => {
        if (stagedMetadata.length === 0) { // Check length, not null
            alert("Please load the metadata file(s) first.");
            return;
        }
        timelineData = { timeline: stagedMetadata, secretPhotos: stagedPhotos };
        renderTimeline();
        closeModal(modalId);
        alert(`Timeline successfully rebuilt!`);
    };
};
    
    const openAddPolaroidModal = (insertIndex) => {
        const modalId = 'add-polaroid-modal';
        showModal(modalId, `
            <h3 class="text-xl font-bold mb-4">Add New Polaroid</h3>
            <form id="add-polaroid-form" class="space-y-4">
                <div id="drop-zone-polaroid" class="drop-zone h-32 rounded-lg flex items-center justify-center text-slate-400 p-4">Drop image here or paste</div>
                <input type="hidden" name="imageUrl" required>
                <input type="text" name="date" placeholder="Date (e.g., 2025)" class="w-full p-2 bg-slate-700 rounded">
                <input type="text" name="title" placeholder="Title (Optional)" class="w-full p-2 bg-slate-700 rounded">
                <input type="text" name="location" placeholder="Location Name (Optional)" class="w-full p-2 bg-slate-700 rounded">
                <input type="url" name="locationUrl" placeholder="Google Maps URL (Optional)" class="w-full p-2 bg-slate-700 rounded">
                <button type="submit" class="w-full py-2 bg-green-600 hover:bg-green-700 rounded">Add Polaroid</button>
            </form>
        `);
        const form = document.getElementById('add-polaroid-form');
        const dropZone = document.getElementById('drop-zone-polaroid');
        const imageUrlInput = form.querySelector('input[name="imageUrl"]');

        const setupImageHandler = (file) => handleImageFile(file, dropZone, (dataUrl) => { imageUrlInput.value = dataUrl; });

        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); setupImageHandler(e.dataTransfer.files[0]); });
        document.addEventListener('paste', e => { if (document.activeElement.form === form) setupImageHandler(e.clipboardData.files[0]); });

        form.onsubmit = (e) => {
            e.preventDefault();
            if (!imageUrlInput.value) { alert("Please add an image first."); return; }
            const formData = new FormData(e.target);
            const newPolaroid = { id: Date.now(), type: 'polaroid' };
            formData.forEach((value, key) => newPolaroid[key] = value);

            const prevTimestamp = new Date(timelineData.timeline[insertIndex - 1]?.createdAt || 0).getTime();
            const nextTimestamp = new Date(timelineData.timeline[insertIndex]?.createdAt || Date.now() + 60000).getTime();
            newPolaroid.createdAt = new Date((prevTimestamp + nextTimestamp) / 2).toISOString();
            
            timelineData.timeline.splice(insertIndex, 0, newPolaroid);
            renderTimeline();
            closeModal(modalId);
        };
    };

    const openAddBackgroundModal = (insertIndex) => {
        const modalId = 'add-bg-modal';
        showModal(modalId, `
            <h3 class="text-xl font-bold mb-4">Add New Background Theme</h3>
            <form id="add-bg-form" class="space-y-4">
                <div id="drop-zone-bg" class="drop-zone h-32 rounded-lg flex items-center justify-center text-slate-400 p-4">Drop image here or paste</div>
                <input type="hidden" name="imageUrl" required>
                <input type="text" name="themeName" placeholder="Theme Name (e.g., Paris Trip)" class="w-full p-2 bg-slate-700 rounded" required>
                <button type="submit" class="w-full py-2 bg-sky-600 hover:bg-sky-700 rounded">Add Background</button>
            </form>
        `);
        const form = document.getElementById('add-bg-form');
        const dropZone = document.getElementById('drop-zone-bg');
        const imageUrlInput = form.querySelector('input[name="imageUrl"]');
        
        const setupImageHandler = (file) => handleImageFile(file, dropZone, (dataUrl) => { imageUrlInput.value = dataUrl; });

        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); setupImageHandler(e.dataTransfer.files[0]); });
        document.addEventListener('paste', e => { if (document.activeElement.form === form) setupImageHandler(e.clipboardData.files[0]); });

        form.onsubmit = (e) => {
            e.preventDefault();
            if (!imageUrlInput.value) { alert("Please add an image first."); return; }
            const formData = new FormData(e.target);
            const newBg = { id: Date.now(), type: 'background' };
            formData.forEach((value, key) => newBg[key] = value);

            const prevTimestamp = new Date(timelineData.timeline[insertIndex - 1]?.createdAt || 0).getTime();
            const nextTimestamp = new Date(timelineData.timeline[insertIndex]?.createdAt || Date.now() + 60000).getTime();
            newBg.createdAt = new Date((prevTimestamp + nextTimestamp) / 2).toISOString();

            timelineData.timeline.splice(insertIndex, 0, newBg);
            renderTimeline();
            closeModal(modalId);
        };
    };

    // NEW: Function to edit an existing Polaroid
    const openEditPolaroidModal = (itemId) => {
        const itemIndex = timelineData.timeline.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return;
        const itemData = timelineData.timeline[itemIndex];

        const modalId = 'edit-polaroid-modal';
        showModal(modalId, `
            <h3 class="text-xl font-bold mb-4">Edit Polaroid</h3>
            <form id="edit-polaroid-form" class="space-y-4">
                <div id="drop-zone-polaroid-edit" class="drop-zone h-32 rounded-lg flex items-center justify-center text-slate-400"></div>
                <input type="hidden" name="imageUrl" value="${itemData.imageUrl}" required>
                <input type="text" name="date" placeholder="Date (e.g., 2025)" class="w-full p-2 bg-slate-700 rounded" value="${itemData.date || ''}">
                <input type="text" name="title" placeholder="Title (Optional)" class="w-full p-2 bg-slate-700 rounded" value="${itemData.title || ''}">
                <input type="text" name="location" placeholder="Location Name (Optional)" class="w-full p-2 bg-slate-700 rounded" value="${itemData.location || ''}">
                <input type="url" name="locationUrl" placeholder="Google Maps URL (Optional)" class="w-full p-2 bg-slate-700 rounded" value="${itemData.locationUrl || ''}">
                <button type="submit" class="w-full py-2 bg-blue-600 hover:bg-blue-700 rounded">Save Changes</button>
            </form>
        `);
        const form = document.getElementById('edit-polaroid-form');
        const dropZone = document.getElementById('drop-zone-polaroid-edit');
        const imageUrlInput = form.querySelector('input[name="imageUrl"]');
        
        // Show current image
        dropZone.innerHTML = `<img src="${itemData.imageUrl}" class="h-full w-full object-cover rounded">`;

        const setupImageHandler = (file) => handleImageFile(file, dropZone, (dataUrl) => { imageUrlInput.value = dataUrl; });
        
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); setupImageHandler(e.dataTransfer.files[0]); });
        document.addEventListener('paste', e => { if (document.activeElement.form === form) setupImageHandler(e.clipboardData.files[0]); });

        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            formData.forEach((value, key) => {
                timelineData.timeline[itemIndex][key] = value;
            });
            renderTimeline();
            closeModal(modalId);
        };
    };

    // NEW: Function to edit an existing Background
    const openEditBackgroundModal = (itemId) => {
        const itemIndex = timelineData.timeline.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return;
        const itemData = timelineData.timeline[itemIndex];

        const modalId = 'edit-bg-modal';
        showModal(modalId, `
            <h3 class="text-xl font-bold mb-4">Edit Background Theme</h3>
            <form id="edit-bg-form" class="space-y-4">
                <div id="drop-zone-bg-edit" class="drop-zone h-32 rounded-lg flex items-center justify-center text-slate-400"></div>
                <input type="hidden" name="imageUrl" value="${itemData.imageUrl}" required>
                <input type="text" name="themeName" placeholder="Theme Name" class="w-full p-2 bg-slate-700 rounded" value="${itemData.themeName || ''}" required>
                <button type="submit" class="w-full py-2 bg-sky-600 hover:bg-sky-700 rounded">Save Changes</button>
            </form>
        `);
        const form = document.getElementById('edit-bg-form');
        const dropZone = document.getElementById('drop-zone-bg-edit');
        const imageUrlInput = form.querySelector('input[name="imageUrl"]');
        
        dropZone.innerHTML = `<img src="${itemData.imageUrl}" class="h-full w-full object-cover rounded">`;

        const setupImageHandler = (file) => handleImageFile(file, dropZone, (dataUrl) => { imageUrlInput.value = dataUrl; });

        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); setupImageHandler(e.dataTransfer.files[0]); });
        document.addEventListener('paste', e => { if (document.activeElement.form === form) setupImageHandler(e.clipboardData.files[0]); });

        form.onsubmit = (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            formData.forEach((value, key) => {
                timelineData.timeline[itemIndex][key] = value;
            });
            renderTimeline();
            closeModal(modalId);
        };
    };

    const openAddMultipleSecretPhotosModal = () => {
        const modalId = 'add-secret-photos-modal';
        showModal(modalId, `
            <h3 class="text-xl font-bold mb-4">Add Secret Photos</h3>
            <form id="add-secret-form" class="space-y-4">
                <div id="drop-zone-secret" class="drop-zone h-48 rounded-lg flex items-center justify-center text-slate-400 p-4">Drop multiple images here or click to select</div>
                <input type="file" id="secret-file-input" class="hidden" multiple accept="image/*">
                <button type="submit" class="w-full py-2 bg-green-600 hover:bg-green-700 rounded">Add Photos</button>
            </form>
        `, 'z-60');
        
        const form = document.getElementById('add-secret-form');
        const dropZone = document.getElementById('drop-zone-secret');
        const fileInput = document.getElementById('secret-file-input');
        let filesToUpload = [];

        const updateDropZoneText = () => {
            if (filesToUpload.length > 0) dropZone.innerHTML = `${filesToUpload.length} file(s) selected.`;
            else dropZone.innerHTML = 'Drop multiple images here or click to select';
        };

        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => {
            filesToUpload.push(...e.target.files);
            updateDropZoneText();
        };

        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            filesToUpload.push(...e.dataTransfer.files);
            updateDropZoneText();
        });

        form.onsubmit = (e) => {
            e.preventDefault();
            if (filesToUpload.length === 0) { alert("Please select or drop some images first."); return; }

            filesToUpload.forEach(file => {
                handleImageFile(file, null, (dataUrl) => {
                    const newPhoto = {
                        id: Date.now() + Math.random(), url: dataUrl,
                        top: `${Math.random() * 50 + 10}%`, left: `${Math.random() * 70 + 10}%`,
                        rotation: Math.random() * 20 - 10
                    };
                    timelineData.secretPhotos.push(newPhoto);
                });
            });
            
            setTimeout(() => {
                renderSecretPhotos();
                closeModal(modalId);
            }, 100 * filesToUpload.length);
        };
    };

    const makeDraggableAndRotatable = (element) => {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const rotateHandle = element.querySelector('.rotate-handle');
        if (rotateHandle) rotateHandle.onmousedown = rotateMouseDown;
        element.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            if (e.target === rotateHandle) return;
            e.preventDefault();
            pos3 = e.clientX; pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
            pos3 = e.clientX; pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function rotateMouseDown(e) {
            e.preventDefault(); e.stopPropagation();
            document.onmouseup = closeDragElement;
            document.onmousemove = elementRotate;
        }

        function elementRotate(e) {
            const rect = element.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
            element.style.transform = `rotate(${angle + 90}deg)`;
        }

        function closeDragElement() {
            document.onmouseup = null; document.onmousemove = null;
            const photoId = parseFloat(element.dataset.id);
            const photoIndex = timelineData.secretPhotos.findIndex(p => p.id === photoId);
            if (photoIndex > -1) {
                const parentRect = photoGrid.getBoundingClientRect();
                const newTop = `${(element.offsetTop / parentRect.height) * 100}%`;
                const newLeft = `${(element.offsetLeft / parentRect.width) * 100}%`;
                const transform = element.style.transform;
                const rotationMatch = transform.match(/rotate\(([^deg]+)deg\)/);
                const newRotation = rotationMatch ? parseFloat(rotationMatch[1]) : 0;
                timelineData.secretPhotos[photoIndex].top = newTop;
                timelineData.secretPhotos[photoIndex].left = newLeft;
                timelineData.secretPhotos[photoIndex].rotation = newRotation;
            }
        }
    };

    const handleImageZoom = (imgSrc) => {
        const zoomId = 'image-zoom-overlay';
        const overlay = document.createElement('div');
        overlay.id = zoomId;
        overlay.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-70 cursor-zoom-out';
        overlay.innerHTML = `<img src="${imgSrc}" class="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl">`;
        overlay.onclick = () => document.getElementById(zoomId)?.remove();
        document.body.appendChild(overlay);
    };

// --- 5. EVENT LISTENERS ---
const setupEventListeners = () => {
    adminLoginBtn.addEventListener('click', handleAdminLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    
    // Updated to pause the photo loading when closed
    document.getElementById('close-embarrassing').onclick = () => {
        embarrassingPhotosSection.classList.add('hidden');
        clearTimeout(secretPhotoLoadTimeoutId); // Stop the loading loop
    };

    document.getElementById('export-btn').addEventListener('click', handleExport);
    document.getElementById('import-btn').addEventListener('click', handleImport);
    document.getElementById('add-secret-photos-btn').addEventListener('click', openAddMultipleSecretPhotosModal);

    // Using event delegation for all timeline clicks (add, edit, delete)
    timelineContainer.addEventListener('click', (e) => {
        const target = e.target;
        const addPolaroidBtn = target.closest('.add-polaroid-btn');
        const addBgBtn = target.closest('.add-bg-btn');
        const editPolaroidBtn = target.closest('.edit-polaroid-btn');
        const editBgBtn = target.closest('.edit-bg-btn');
        const deleteBtn = target.closest('.delete-btn');

        if (addPolaroidBtn) openAddPolaroidModal(parseInt(addPolaroidBtn.dataset.index));
        if (addBgBtn) openAddBackgroundModal(parseInt(addBgBtn.dataset.index));
        if (editPolaroidBtn) openEditPolaroidModal(parseInt(editPolaroidBtn.dataset.id));
        if (editBgBtn) openEditBackgroundModal(parseInt(editBgBtn.dataset.id));
        
        if (deleteBtn && deleteBtn.dataset.type === 'timeline' && confirm('Are you sure you want to delete this item?')) {
            const itemId = parseFloat(deleteBtn.dataset.id);
            timelineData.timeline = timelineData.timeline.filter(item => item.id !== itemId);
            renderTimeline();
        }
    });

    // Using event delegation for all secret photo clicks (delete)
    photoGrid.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn && deleteBtn.dataset.type === 'secret' && confirm('Are you sure?')) {
            const itemId = parseFloat(deleteBtn.dataset.id);
            timelineData.secretPhotos = timelineData.secretPhotos.filter(photo => photo.id !== itemId);
            // After deleting, clear the grid and restart the loading from the beginning
            clearTimeout(secretPhotoLoadTimeoutId);
            secretPhotoLoadIndex = 0;
            photoGrid.innerHTML = '';
            renderSecretPhotos();
        }
    });

    document.body.addEventListener('dblclick', (e) => {
        const zoomable = e.target.closest('.zoomable');
        if (zoomable) {
            const fullResSrc = zoomable.dataset.fullResSrc || zoomable.src;
            handleImageZoom(fullResSrc);
        }
    });
    
    // Restored the secret button functionality
    secretBtn.addEventListener('click', () => {
        const modalId = 'secret-password-modal';
        showModal(modalId, `
            <div class="win7-popup rounded-md overflow-hidden"><div class="win7-header flex justify-between items-center"><span>Enter Password</span><button class="close-modal-btn text-black font-bold">×</button></div><div class="p-6 text-center bg-gray-200/80"><p class="mb-4 text-black">This content is protected.</p><form id="secret-login-form"><input type="password" id="secret-password-input" class="w-full p-2 border border-gray-400 rounded-sm mb-2" autofocus/><button id="secret-hint-btn" type="button" class="text-xs text-blue-600 hover:underline mb-4">Hint</button><div id="secret-hint-text" class="hidden text-sm text-gray-600 mb-4">You used this password in the old laptop.</div><button id="secret-submit-btn" type="submit" class="win7-button px-6 py-1 rounded-sm">OK</button></form></div></div>
        `);
        document.getElementById('secret-password-input')?.focus();
        document.getElementById('secret-hint-btn').onclick = () => document.getElementById('secret-hint-text').classList.toggle('hidden');
        document.getElementById('secret-login-form').onsubmit = (e) => {
            e.preventDefault();
            const input = document.getElementById('secret-password-input');
            if (input.value === 'Welcome123') {
                closeModal(modalId);
                embarrassingPhotosSection.classList.remove('hidden');
                
                // If the grid is empty, start loading from the beginning. Otherwise, it will resume.
                if (photoGrid.children.length === 0) {
                    secretPhotoLoadIndex = 0;
                }
                renderSecretPhotos();
            } else { alert('Incorrect Password!'); }
        };
    });

    photoGrid.addEventListener('dragover', (e) => { e.preventDefault(); if (isAdmin) photoGrid.classList.add('bg-pink-300/50'); });
    photoGrid.addEventListener('dragleave', () => photoGrid.classList.remove('bg-pink-300/50'));
    photoGrid.addEventListener('drop', (e) => {
        e.preventDefault();
        photoGrid.classList.remove('bg-pink-300/50');
        if (!isAdmin) return;
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            Array.from(files).forEach(file => {
                handleImageFile(file, null, (dataUrl) => {
                    const newPhoto = { id: Date.now() + Math.random(), url: dataUrl, top: `${Math.random() * 50 + 10}%`, left: `${Math.random() * 70 + 10}%`, rotation: Math.random() * 20 - 10 };
                    timelineData.secretPhotos.push(newPhoto);
                });
            });
            setTimeout(() => {
                // After adding new photos, clear the grid and restart loading from the beginning
                clearTimeout(secretPhotoLoadTimeoutId);
                secretPhotoLoadIndex = 0;
                photoGrid.innerHTML = '';
                renderSecretPhotos();
            }, 100 * files.length);
        }
    });
};

// --- 6. INITIAL LOAD ---
initializeData();
setupEventListeners();
})