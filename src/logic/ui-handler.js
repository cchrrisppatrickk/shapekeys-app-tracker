// ==========================================
// MANEJADOR DE UI (DOM y eventos del modal)
// ==========================================
import { RIG_PATTERNS } from './constants.js';
import { deleteTake, togglePlayback, setActiveTake } from './recorder.js';

// Variable exportada para que main.js sepa qué IA ejecutar
export let currentWorkspace = 'face';

// Variables de estado internas
let allDetectedBones = [];
let uiElements = {};

// Inicializa el manejador con las referencias del DOM
export function initUI(elements) {
    uiElements = elements;
    attachEventListeners();
}

// === NUEVO: Actualizar Cronómetro ===
export function updateTimerDisplay(timeString) {
    if (uiElements.timerDisplay) uiElements.timerDisplay.innerText = timeString;
}

export function setTimerActive(isActive) {
    if (uiElements.timerDisplay) {
        if (isActive) uiElements.timerDisplay.classList.add('active');
        else uiElements.timerDisplay.classList.remove('active');
    }
}

// === NUEVO: Renderizar Lista de Clips ===
export function renderClipsList(takes, activeId) {
    const listContainer = uiElements.clipsList;
    if (!listContainer) return;
    
    // Actualizar contador
    if (uiElements.takesCount) uiElements.takesCount.innerText = takes.length;
    
    // Habilitar/Deshabilitar botón de exportar
    if (uiElements.exportButton) {
        uiElements.exportButton.disabled = takes.length === 0 || !activeId;
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
            if (e.target.closest('button')) return; // Evitar conflicto con botones
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

        // Eventos de botones
        const btnPlay = li.querySelector('.play');
        const btnDelete = li.querySelector('.delete');

        btnPlay.onclick = (e) => {
            e.stopPropagation();
            togglePlayback(take.id);
        };
        
        btnDelete.onclick = (e) => {
            e.stopPropagation();
            if(confirm('¿Borrar esta toma?')) {
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
    if (currentVal && bones.includes(currentVal)) selectElement.value = currentVal;
}

// Filtrar huesos basado en el término de búsqueda
function filterBones(searchInput, selectElement) {
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

// Adjuntar todos los listeners de eventos
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
            if (allDetectedBones.length === 0) {
                alert("¡Primero carga un modelo!");
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
                const originalText = uiElements.autoDetectBtn.innerHTML;
                uiElements.autoDetectBtn.innerHTML = `<span class="mdc-button__label">¡ENCONTRADO! ✅</span>`;
                setTimeout(() => uiElements.autoDetectBtn.innerHTML = originalText, 2000);
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
        html += `<li class="blend-shapes-item"><span class="blend-shapes-label">${s.categoryName}</span><span class="blend-shapes-value" style="width:${Math.min(s.score * 100, 100)}px"></span></li>`;
    });
    uiElements.videoBlendShapes.innerHTML = html;
}

// === NUEVO: Gestor de Espacios de Trabajo (Navegación Lateral) ===
export function initWorkspaceSwitcher() {
    const navButtons = document.querySelectorAll('.nav-btn[data-workspace]');
    const blendshapesPanel = document.getElementById('blendshapes-panel');
    
    const emptyStateTitle = document.querySelector('.empty-workspace h2');
    const emptyStateDesc = document.querySelector('.empty-workspace p');
    const openSetupBtn = document.getElementById('open-setup-btn'); // NUEVO: Referencia al botón

    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            navButtons.forEach(b => b.classList.remove('active'));
            
            const targetBtn = e.currentTarget;
            targetBtn.classList.add('active');

            currentWorkspace = targetBtn.dataset.workspace;

            if (currentWorkspace === 'body') {
                console.log("🚀 Cambiando a entorno: Body Tracking");
                if (blendshapesPanel) blendshapesPanel.classList.add('hidden');
                
                // NUEVO: Adaptación para solo tracking
                if (emptyStateTitle) emptyStateTitle.innerText = "Motor de Captura Corporal";
                if (emptyStateDesc) emptyStateDesc.innerText = "Enciende tu webcam o carga un video en el panel derecho para iniciar el tracking esquelético en 2D.";
                if (openSetupBtn) openSetupBtn.style.display = 'none'; // Ocultamos el botón 3D

            } else if (currentWorkspace === 'face') {
                console.log("🎭 Cambiando a entorno: Face Tracking");
                if (blendshapesPanel) blendshapesPanel.classList.remove('hidden');
                
                // Restauramos estado para 3D
                if (emptyStateTitle) emptyStateTitle.innerText = "Face Tracking Workspace";
                if (emptyStateDesc) emptyStateDesc.innerText = "Importa un modelo 3D (.glb) con rig facial y blendshapes para empezar a trackear.";
                if (openSetupBtn) openSetupBtn.style.display = 'inline-flex'; // Mostramos el botón 3D
            }
        });
    });
}