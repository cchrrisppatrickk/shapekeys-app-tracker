// ==========================================
// MANEJADOR DE UI (DOM y eventos del modal)
// ==========================================

import { RIG_PATTERNS } from './constants.js';
import { deleteTake, togglePlayback, setActiveTake } from './recorder.js';
import { stopAllMedia } from './media-manager.js'; // NUEVO IMPORT

// Variable exportada para que main.js sepa qué IA ejecutar
export let currentWorkspace = 'face';

// Variables de estado internas
let allDetectedBones = [];
let uiElements = {};
let isDetecting = false; // Flag para evitar el bug del multi-clic en auto-detect

// Inicializa el manejador con las referencias del DOM
export function initUI(elements) {
    uiElements = elements;
    attachEventListeners();
}

// === Actualizar Cronómetro ===
export function updateTimerDisplay(timeString) {
    if (uiElements.timerDisplay) uiElements.timerDisplay.innerText = timeString;
}

export function setTimerActive(isActive) {
    if (uiElements.timerDisplay) {
        if (isActive) uiElements.timerDisplay.classList.add('active');
        else uiElements.timerDisplay.classList.remove('active');
    }
}

// === Renderizar Lista de Clips ===
export function renderClipsList(takes, activeId) {
    const listContainer = uiElements.clipsList;
    if (!listContainer) return;
    
    // Actualizar contador
    if (uiElements.takesCount) uiElements.takesCount.innerText = takes.length;
    
    // Habilitar/Deshabilitar botón de exportar
    if (uiElements.exportButton) {
        uiElements.exportButton.disabled = (takes.length === 0 || !activeId);
    }

    // Limpiar lista
    listContainer.innerHTML = '';

    if (takes.length === 0) {
        listContainer.innerHTML = '<li class="empty-state">No hay grabaciones aún.</li>';
        return;
    }

    // Generar items
    takes.forEach(take => {
        const li = document.createElement('li');
        li.className = `clip-item ${take.id === activeId ? 'selected' : ''}`;
        
        // Al hacer click en la fila, seleccionamos la toma
        li.onclick = (e) => {
            if (e.target.closest('button')) return; // Evitar conflicto con los botones hijos
            setActiveTake(take.id);
            renderClipsList(takes, take.id); 
        };

        li.innerHTML = `
            <div class="clip-info">
                <span class="clip-name">${take.name}</span>
                <span class="clip-meta">Duración: ${take.duration.toFixed(2)}s • ${take.timestamp}</span>
            </div>
            <div class="clip-actions">
                <button class="icon-btn play" title="Reproducir">
                    <i class="material-icons">play_arrow</i>
                </button>
                <button class="icon-btn delete" title="Eliminar">
                    <i class="material-icons">delete</i>
                </button>
            </div>
        `;

        // Eventos de botones (Deteniendo la propagación para no accionar el onclick del li)
        const btnPlay = li.querySelector('.play');
        const btnDelete = li.querySelector('.delete');

        btnPlay.onclick = (e) => {
            e.stopPropagation();
            togglePlayback(take.id);
        };
        
        btnDelete.onclick = (e) => {
            e.stopPropagation();
            if(confirm('¿Seguro que deseas borrar esta toma?')) {
                deleteTake(take.id);
            }
        };

        listContainer.appendChild(li);
    });
}

// Poblar los selectores con la lista de huesos detectados
export function populateBoneSelectors(bonesList) {
    allDetectedBones = bonesList;
    if (uiElements.headSearchInput) uiElements.headSearchInput.value = "";
    if (uiElements.neckSearchInput) uiElements.neckSearchInput.value = "";
    renderOptions(uiElements.headSelect, allDetectedBones);
    renderOptions(uiElements.neckSelect, allDetectedBones);
}

// Renderizar opciones en un elemento select
function renderOptions(selectElement, bones) {
    if (!selectElement) return;
    const currentVal = selectElement.value;
    selectElement.innerHTML = '<option value="">-- Selecciona --</option>';
    bones.forEach(bone => selectElement.add(new Option(bone, bone)));
    // Mantiene la selección si sigue siendo válida tras un filtrado
    if (currentVal && bones.includes(currentVal)) selectElement.value = currentVal;
}

// Filtrar huesos basado en el término de búsqueda
function filterBones(searchInput, selectElement) {
    if (!searchInput || !selectElement) return;
    const term = searchInput.value.toLowerCase();
    const filtered = allDetectedBones.filter(bone => bone.toLowerCase().includes(term));
    renderOptions(selectElement, filtered);
}

// Resaltar el hueso activo en la UI
function highlightBoneInUI(boneName) {
    if (!uiElements.activeBoneDisplay) return;
    if (!boneName) {
        uiElements.activeBoneDisplay.textContent = "Ninguno";
        uiElements.activeBoneDisplay.className = 'active-bone-none';
        return;
    }
    uiElements.activeBoneDisplay.textContent = `🦴 ${boneName}`;
    uiElements.activeBoneDisplay.className = 'active-bone-selected';
}

// Búsqueda inteligente de huesos por patrones
function findBestMatch(availableBones, regexList) {
    for (const pattern of regexList) {
        const match = availableBones.find(bone => pattern.test(bone));
        if (match) return match;
    }
    return null;
}

// Adjuntar todos los listeners de eventos de la configuración 3D
function attachEventListeners() {
    if (uiElements.headSearchInput) {
        uiElements.headSearchInput.addEventListener('input', () => filterBones(uiElements.headSearchInput, uiElements.headSelect));
    }
    if (uiElements.neckSearchInput) {
        uiElements.neckSearchInput.addEventListener('input', () => filterBones(uiElements.neckSearchInput, uiElements.neckSelect));
    }
    if (uiElements.headSelect) {
        uiElements.headSelect.addEventListener('change', (e) => highlightBoneInUI(e.target.value));
    }
    if (uiElements.neckSelect) {
        uiElements.neckSelect.addEventListener('change', (e) => highlightBoneInUI(e.target.value));
    }
    if (uiElements.autoDetectBtn) {
        uiElements.autoDetectBtn.addEventListener('click', () => {
            if (isDetecting) return; // Evita clics múltiples concurrentes

            if (allDetectedBones.length === 0) {
                alert("¡Primero carga un modelo 3D!");
                return;
            }
            
            const foundHead = findBestMatch(allDetectedBones, RIG_PATTERNS.head);
            if (foundHead && uiElements.headSelect) {
                uiElements.headSelect.value = foundHead;
                highlightBoneInUI(foundHead);
            }
            
            const foundNeck = findBestMatch(allDetectedBones, RIG_PATTERNS.neck);
            if (foundNeck && uiElements.neckSelect) {
                uiElements.neckSelect.value = foundNeck;
                highlightBoneInUI(foundNeck);
            }
            
            if (foundHead || foundNeck) {
                isDetecting = true;
                const originalText = uiElements.autoDetectBtn.innerHTML;
                uiElements.autoDetectBtn.innerHTML = `<span class="mdc-button__label">¡ENCONTRADO! ✅</span>`;
                
                setTimeout(() => {
                    uiElements.autoDetectBtn.innerHTML = originalText;
                    isDetecting = false; // Liberamos el botón
                }, 2000);
            } else {
                alert("No se detectaron nombres estándar. Selecciona manualmente.");
            }
        });
    }
}

// Dibujar la lista de blendshapes en el panel de la interfaz
export function drawBlendShapes(categories) {
    if (!uiElements.videoBlendShapes || !categories) return;
    let html = "";
    categories.forEach(s => {
        html += `<li class="blend-shapes-item">
                    <span class="blend-shapes-label">${s.categoryName}</span>
                    <span class="blend-shapes-value" style="width:${Math.min(s.score * 100, 100)}px"></span>
                 </li>`;
    });
    uiElements.videoBlendShapes.innerHTML = html;
}

// === Gestor de Espacios de Trabajo (Navegación Lateral) ===
// === Gestor de Espacios de Trabajo (Navegación Lateral) ===
export function initWorkspaceSwitcher() {
    const navButtons = document.querySelectorAll('.nav-btn[data-workspace]');
    
    // Referencias al DOM
    const blendshapesPanel = document.getElementById('blendshapes-panel');
    const emptyStateContainer = document.getElementById('empty-workspace-state');
    const trackingPreviewCanvas = document.getElementById('tracking-preview-canvas');
    
    // Textos dinámicos del estado vacío
    const wsIcon = document.getElementById('workspace-icon');
    const wsTitle = document.getElementById('workspace-title');
    const wsDesc = document.getElementById('workspace-desc');
    const btnFaceSetup = document.getElementById('open-setup-btn');
    const btnRetargetSetup = document.getElementById('open-retarget-setup-btn');

    // Listener para abrir el nuevo modal de Retargeting
    // Listener para abrir el nuevo modal de Retargeting
    if (btnRetargetSetup) {
        btnRetargetSetup.addEventListener('click', () => {
            const bodyModal = document.getElementById('body-setup-modal');
            
            // NUEVO: Movemos el canvas 3D al lado izquierdo de este modal
            const previewBodyContainer = document.getElementById('preview-body-three-container');
            const mainContainer = document.getElementById('three-container');
            // Buscamos el canvas de Three.js (el que NO tiene la clase tracking-canvas)
            const threeCanvas = mainContainer.querySelector('canvas:not(.tracking-canvas)');
            
            if (threeCanvas && previewBodyContainer) {
                previewBodyContainer.appendChild(threeCanvas);
                // Forzamos un reajuste de tamaño
                window.dispatchEvent(new Event('resize'));
            }

            if (bodyModal) bodyModal.style.display = 'flex';
        });
    }
    
    if (navButtons.length === 0) return;

    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.currentTarget.dataset.workspace === currentWorkspace) return;

            navButtons.forEach(b => b.classList.remove('active'));
            const targetBtn = e.currentTarget;
            targetBtn.classList.add('active');

            currentWorkspace = targetBtn.dataset.workspace;
            stopAllMedia(); // Detenemos medios al cambiar

            // Lógica de cambio de entorno
            if (currentWorkspace === 'body') {
                console.log("🚀 Entorno: Body Tracking (Solo Grabación)");
                if (blendshapesPanel) blendshapesPanel.classList.add('hidden');
                
                // En body solo mostramos la cámara 2D, no pedimos modelo 3D
                if (emptyStateContainer) emptyStateContainer.classList.add('hidden');
                if (trackingPreviewCanvas) trackingPreviewCanvas.classList.remove('hidden');

            } else if (currentWorkspace === 'face') {
                console.log("🎭 Entorno: Face Tracking");
                if (blendshapesPanel) blendshapesPanel.classList.remove('hidden');
                if (trackingPreviewCanvas) trackingPreviewCanvas.classList.add('hidden');
                
                if (emptyStateContainer) {
                    emptyStateContainer.classList.remove('hidden');
                    wsIcon.innerText = 'face';
                    wsTitle.innerText = 'Face Tracking Workspace';
                    wsDesc.innerText = 'Importa un modelo 3D (.glb) con rig facial y blendshapes para empezar a trackear.';
                    btnFaceSetup.classList.remove('hidden');
                    btnRetargetSetup.classList.add('hidden');
                }

            } else if (currentWorkspace === 'retargeting') {
                console.log("🏃‍♂️ Entorno: 3D Retargeting");
                if (blendshapesPanel) blendshapesPanel.classList.add('hidden');
                if (trackingPreviewCanvas) trackingPreviewCanvas.classList.add('hidden');
                
                if (emptyStateContainer) {
                    emptyStateContainer.classList.remove('hidden');
                    wsIcon.innerText = 'directions_run';
                    wsTitle.innerText = 'Retargeting Workspace';
                    wsDesc.innerText = 'Importa un modelo de cuerpo completo (.glb) para aplicar las tomas grabadas en "Body".';
                    btnFaceSetup.classList.add('hidden');
                    btnRetargetSetup.classList.remove('hidden');
                }
            }
        });
    });
}