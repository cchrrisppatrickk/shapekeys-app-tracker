// ==========================================
// MANEJADOR DE UI (DOM y eventos del modal)
// ==========================================
import { RIG_PATTERNS } from './constants.js';

// Variables de estado internas
let allDetectedBones = [];
let uiElements = {};

// Inicializa el manejador con las referencias del DOM
export function initUI(elements) {
    uiElements = elements;
    attachEventListeners();
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
    // Filtros de búsqueda
    if (uiElements.headSearchInput) {
        uiElements.headSearchInput.addEventListener('input', () => filterBones(uiElements.headSearchInput, uiElements.headSelect));
    }
    if (uiElements.neckSearchInput) {
        uiElements.neckSearchInput.addEventListener('input', () => filterBones(uiElements.neckSearchInput, uiElements.neckSelect));
    }

    // Resaltar selección
    if (uiElements.headSelect) {
        uiElements.headSelect.addEventListener('change', (e) => highlightBoneInUI(e.target.value));
    }
    if (uiElements.neckSelect) {
        uiElements.neckSelect.addEventListener('change', (e) => highlightBoneInUI(e.target.value));
    }

    // Auto-detección
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