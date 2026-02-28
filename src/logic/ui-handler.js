// ==========================================
// MANEJADOR DE UI (DOM y eventos del modal)
// ==========================================
import { RIG_PATTERNS } from './constants.js';
import { deleteTake, togglePlayback, setActiveTake } from './recorder.js';

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

    const allSelects = document.querySelectorAll('.bone-select');
    allSelects.forEach(select => {
        renderOptions(select, allDetectedBones);
    });
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
    // 1. Escuchar el botón de Auto-Detectar (NUEVA VERSIÓN ÚNICA)
    if (uiElements.autoDetectBtn) {
        uiElements.autoDetectBtn.addEventListener('click', () => {
            if (allDetectedBones.length === 0) {
                alert("¡Primero carga un modelo!");
                return;
            }

            let foundCount = 0;
            const allSelects = document.querySelectorAll('.bone-select');

            allSelects.forEach(select => {
                const boneKey = select.id.replace('-bone-select', ''); 

                if (RIG_PATTERNS[boneKey]) {
                    const bestMatch = findBestMatch(allDetectedBones, RIG_PATTERNS[boneKey]);
                    if (bestMatch) {
                        select.value = bestMatch; 
                        foundCount++;
                    }
                }
            });

            if (foundCount > 0) {
                const originalText = uiElements.autoDetectBtn.innerHTML;
                uiElements.autoDetectBtn.innerHTML = `<span class="mdc-button__label">¡${foundCount} ENCONTRADOS! ✅</span>`;
                setTimeout(() => uiElements.autoDetectBtn.innerHTML = originalText, 2500);
            } else {
                alert("No se detectaron nombres estándar para ningún hueso.");
            }
        });
    }

    // 2. Escuchar buscadores y selectores de Rostro/Cuello (Si aún se usan)
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