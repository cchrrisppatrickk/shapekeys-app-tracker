// ==========================================
// MÓDULO DE EXPORTACIÓN (exporter.js)
// Genera archivos .glb listos para producción
// ==========================================
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { blendshapeMap } from './constants.js';

/**
 * Función principal: Toma una toma (take), el modelo y el hueso, y descarga un GLB.
 */
export function exportTakeToGLB(take, model, headBone) {
    if (!take || !model || !headBone) {
        console.error("Faltan datos para exportar (Take, Modelo o Hueso).");
        return;
    }

    console.log(`📦 Iniciando exportación de: ${take.name}...`);

    // 1. Identificar TODAS las Mallas con Blendshapes (Morph Targets)
    // CORRECCIÓN: Antes solo buscábamos la primera, ahora buscamos todas (ojos, dientes, cabeza, etc.)
    const targetMeshes = [];
    model.traverse((child) => {
        if (child.isMesh && child.morphTargetDictionary) {
            // Asegurar que la malla tenga nombre único (Three.js lo necesita para el track)
            if (!child.name) child.name = `Mesh_${child.uuid}`;
            targetMeshes.push(child);
        }
    });

    if (targetMeshes.length === 0) {
        alert("Error: El modelo no tiene Blendshapes (Morph Targets). No se pueden exportar expresiones.");
        return;
    }

    // 2. Preparar los datos base (Tiempos y Rotación)
    const times = [];
    const headRotations = []; // Quaternion (4 valores por frame)
    
    // Mapa temporal para guardar los valores de blendshapes por frame
    // Estructura: [ { 'jawOpen': 0.5, 'blink': 0 }, { ... }, ... ]
    const framesMorphValues = []; 

    take.data.forEach(frame => {
        times.push(frame.t);

        // a) Rotación de Cabeza
        headRotations.push(frame.rot.x, frame.rot.y, frame.rot.z, frame.rot.w);

        // b) Procesar Blendshapes del frame
        const frameValues = {};
        frame.bs.forEach(b => {
            const mappedName = blendshapeMap[b.categoryName]; // Mapear nombre de MediaPipe a nombre del Modelo
            if (mappedName) {
                frameValues[mappedName] = b.score;
            }
        });
        framesMorphValues.push(frameValues);
    });

    // 3. Crear los KeyframeTracks de Three.js
    const tracks = [];

    // --- TRACK 1: Rotación de Cabeza ---
    const headTrackName = `${headBone.name}.quaternion`;
    const headTrack = new THREE.QuaternionKeyframeTrack(headTrackName, times, headRotations);
    tracks.push(headTrack);

    // --- TRACKS 2...N: Blendshapes para CADA Malla ---
    // Recorremos cada malla encontrada (Cabeza, Dientes, Ojos...)
    targetMeshes.forEach(mesh => {
        
        // Para esta malla, buscamos qué blendshapes tiene disponibles
        const availableMorphs = Object.keys(mesh.morphTargetDictionary);

        availableMorphs.forEach(morphName => {
            // Recolectar los valores de este morph a lo largo de todos los frames
            const values = [];
            framesMorphValues.forEach(frameVal => {
                // Si el frame tiene valor para este morph, úsalo. Si no, 0.
                values.push(frameVal[morphName] || 0);
            });

            // Crear el track específico para esta malla y este morph
            // Sintaxis: MeshName.morphTargetInfluences[MorphName]
            const trackName = `${mesh.name}.morphTargetInfluences[${morphName}]`;
            const morphTrack = new THREE.NumberKeyframeTrack(trackName, times, values);
            tracks.push(morphTrack);
        });
    });

    // 4. Crear el AnimationClip
    const clip = new THREE.AnimationClip(take.name, -1, tracks);

    console.log(`🎬 Clip creado con ${tracks.length} pistas para ${targetMeshes.length} mallas.`);

    // 5. Configurar el Exportador GLTF
    const exporter = new GLTFExporter();
    const options = {
        binary: true,           // Crea un .glb (un solo archivo)
        animations: [clip],     // Adjunta nuestra animación creada
        truncateDrawRange: false
    };

    // 6. Parsear y Descargar
    exporter.parse(
        model, // Exportamos todo el modelo (con la animación incrustada)
        (result) => {
            saveArrayBuffer(result, `${take.name}_FaceCap.glb`);
            console.log("✅ Exportación completada.");
        },
        (error) => {
            console.error('Error al exportar:', error);
            alert("Hubo un error al generar el archivo GLB.");
        },
        options
    );
}

// Función auxiliar para forzar la descarga en el navegador
function saveArrayBuffer(buffer, filename) {
    const blob = new Blob([buffer], { type: 'application/octet-stream' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href); // Limpiar memoria
}