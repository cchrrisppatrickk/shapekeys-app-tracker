// ==========================================
// UI DE RETARGETING (body-setup-ui.js)
// Generación dinámica del formulario y asignación
// ==========================================

import { BODY_RIG_DICT } from './rig-dictionary.js';

let allDetectedBodyBones = [];

// 1. Inyectar el HTML dinámicamente
export function injectBodyForm() {
    const container = document.getElementById('body-bone-form-container');
    if (!container) {
        console.error("❌ No se encontró el contenedor #body-bone-form-container");
        return;
    }

    console.log("🛠️ Iniciando inyección del formulario de huesos para Retargeting...");
    container.innerHTML = ''; // Limpiar el mensaje de estado vacío

    // Iterar sobre el diccionario y crear los inputs
    Object.keys(BODY_RIG_DICT).forEach(boneKey => {
        const boneData = BODY_RIG_DICT[boneKey];
        
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        formGroup.innerHTML = `
            <label for="body-bone-${boneKey}" class="bone-label">${boneData.label}</label>
            <div class="input-group">
                <input type="text" id="search-${boneKey}" class="bone-search-input" placeholder="Filtrar..." autocomplete="off">
                <select id="body-bone-${boneKey}" class="bone-select" data-bone-key="${boneKey}">
                    <option value="">-- Selecciona --</option>
                </select>
            </div>
        `;
        
        container.appendChild(formGroup);

        // Eventos para el buscador/filtro de cada hueso
        const searchInput = formGroup.querySelector(`#search-${boneKey}`);
        const selectElement = formGroup.querySelector(`#body-bone-${boneKey}`);
        
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allDetectedBodyBones.filter(b => b.toLowerCase().includes(term));
            renderOptions(selectElement, filtered);
            console.log(`🔍 Filtrando opciones para '${boneKey}' con término: "${term}"`);
        });
        
        selectElement.addEventListener('change', (e) => {
            console.log(`🦴 Hueso manual asignado para [${boneKey}]: ${e.target.value}`);
        });
    });
    
    console.log(`✅ Formulario inyectado con éxito: ${Object.keys(BODY_RIG_DICT).length} campos creados.`);
}

// 2. Llenar los selectores cuando se arrastra un .glb
export function populateBodyBoneSelectors(bonesList) {
    console.log(`📦 Poblando formulario con ${bonesList.length} huesos encontrados en el modelo 3D.`);
    allDetectedBodyBones = bonesList;
    
    Object.keys(BODY_RIG_DICT).forEach(boneKey => {
        const selectElement = document.getElementById(`body-bone-${boneKey}`);
        if (selectElement) {
            renderOptions(selectElement, allDetectedBodyBones);
        }
    });
}

// Utilidad para renderizar las opciones HTML
function renderOptions(selectElement, bones) {
    const currentVal = selectElement.value;
    selectElement.innerHTML = '<option value="">-- Selecciona --</option>';
    bones.forEach(bone => selectElement.add(new Option(bone, bone)));
    
    // Mantener la selección si sigue siendo válida tras el filtro
    if (currentVal && bones.includes(currentVal)) {
        selectElement.value = currentVal;
    }
}

// 3. Auto-Detección basada en RegEx
export function autoDetectBodyBones() {
    console.log("🤖 Ejecutando auto-detección de huesos del cuerpo (Mixamo/Standard)...");
    let matchCount = 0;

    Object.keys(BODY_RIG_DICT).forEach(boneKey => {
        const regexList = BODY_RIG_DICT[boneKey].regex;
        const selectElement = document.getElementById(`body-bone-${boneKey}`);
        
        if (selectElement) {
            // Buscar una coincidencia en los huesos detectados usando los RegEx del diccionario
            const match = allDetectedBodyBones.find(bone => 
                regexList.some(rx => rx.test(bone))
            );
            
            if (match) {
                selectElement.value = match;
                matchCount++;
                console.log(`✅ [${boneKey}] asignado automáticamente a: "${match}"`);
            } else {
                console.warn(`⚠️ No se encontró coincidencia automática para: [${boneKey}]`);
            }
        }
    });
    
    console.log(`🎉 Auto-detección finalizada: ${matchCount}/${Object.keys(BODY_RIG_DICT).length} huesos mapeados.`);
    return matchCount;
}