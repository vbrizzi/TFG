const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// Dashboard dropdown
html = html.replace(
    '<h1>Dashboard</h1>',
    '<h1>Dashboard</h1>\n                <select id="dashboardAppSelect" style="margin-top:10px; padding:5px; border-radius:5px;"><option value="">Todas las aplicaciones</option></select>'
);

// Configurar Evaluación dropdown and IDs
html = html.replace(
    '<select><option>API Ventas v2.1</option><option>Portal Web</option></select>',
    '<select id="configAppSelect" onchange="actualizarEstadoConfiguracion()"><option value="">Seleccione una aplicación...</option></select>'
);

// Add missing data warnings in Configuración
html = html.replace(
    '<h3 style="margin:20px 0 10px;">Parámetros de ejecución</h3>',
    '<div id="configStatus" style="margin-bottom:15px; color:#c62828; font-size:13px; font-weight:bold;"></div>\n                <h3 style="margin:20px 0 10px;">Parámetros de ejecución</h3>'
);

// Ejecutar Evaluación dropdown and checkboxes
html = html.replace(
    '<div><h3>API Ventas v2.1</h3><p class="text-muted">Evaluación #12 · Mantenibilidad · Seguridad · Rendimiento</p></div>',
    '<div>\n                        <select id="execAppSelect" style="font-size:16px; font-weight:bold; padding:5px; border-radius:5px; margin-bottom:10px;"><option value="">Seleccione una aplicación...</option></select>\n                        <div class="checkbox-group" style="flex-direction:row; gap:15px;">\n                            <label class="checkbox-item checked"><input type="checkbox" id="runSonar" checked> SonarQube</label>\n                            <label class="checkbox-item checked"><input type="checkbox" id="runZap" checked> OWASP ZAP</label>\n                            <label class="checkbox-item checked"><input type="checkbox" id="runK6" checked> k6</label>\n                        </div>\n                    </div>'
);

// Resultados dropdown
html = html.replace(
    '<p class="screen-subtitle">API Ventas v2.1 — Evaluación #12</p>',
    '<select id="resultadosAppSelect" style="margin-top:10px; padding:5px; border-radius:5px;"><option value="">Seleccione una aplicación...</option></select>'
);

fs.writeFileSync('index.html', html);
console.log('index.html updated with dropdowns and config states.');

// Update app.js
let appJs = fs.readFileSync('app.js', 'utf8');

// Append new functions
const newFunctions = `

// ===== APLICACIONES Y DROPDOWNS =====
let aplicaciones = [];

async function cargarAplicaciones() {
    try {
        const res = await fetch('/api/aplicaciones');
        aplicaciones = await res.json();
        actualizarDropdowns();
    } catch (e) {
        console.error("Error cargando aplicaciones:", e);
    }
}

function actualizarDropdowns() {
    const selects = ['configAppSelect', 'execAppSelect', 'resultadosAppSelect', 'dashboardAppSelect'];
    selects.forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            const defaultText = id === 'dashboardAppSelect' ? 'Todas las aplicaciones' : 'Seleccione una aplicación...';
            const currentVal = sel.value;
            sel.innerHTML = '<option value="">' + defaultText + '</option>';
            aplicaciones.forEach(app => {
                sel.innerHTML += \`<option value="\${app.id}">\${app.nombre}</option>\`;
            });
            if (currentVal) sel.value = currentVal;
        }
    });
}

async function registrarAplicacion() {
    const nombre = document.getElementById('regAppName').value;
    const desc = document.getElementById('regAppDesc').value;
    const url = document.getElementById('regAppUrl').value;
    const repo = document.getElementById('regAppRepo').value;

    if (!nombre) {
        alert("El nombre de la aplicación es obligatorio.");
        return;
    }

    try {
        const res = await fetch('/api/aplicaciones', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ nombre: nombre, descripcion: desc, url_objetivo: url, repositorio: repo })
        });
        const data = await res.json();
        alert("¡Aplicación registrada con éxito!");
        
        // Limpiar form
        document.getElementById('regAppName').value = '';
        document.getElementById('regAppDesc').value = '';
        document.getElementById('regAppUrl').value = '';
        document.getElementById('regAppRepo').value = '';
        
        await cargarAplicaciones();
        
        // Autoseleccionar en configuracion
        const configSel = document.getElementById('configAppSelect');
        if(configSel) configSel.value = data.id;
        
        showScreen('configuracion');
        actualizarEstadoConfiguracion();
    } catch (e) {
        alert("Error al registrar: " + e.message);
    }
}

function actualizarEstadoConfiguracion() {
    const appId = document.getElementById('configAppSelect').value;
    const statusDiv = document.getElementById('configStatus');
    if (!statusDiv) return;
    
    if (!appId) {
        statusDiv.innerHTML = '';
        document.getElementById('targetUrlInput').value = '';
        document.getElementById('repoUrlInput').value = '';
        return;
    }
    
    const app = aplicaciones.find(a => a.id == appId);
    if (app) {
        document.getElementById('targetUrlInput').value = app.url_objetivo || '';
        document.getElementById('repoUrlInput').value = app.repositorio || '';
        
        let warnings = [];
        if (!app.url_objetivo) warnings.push("Falta URL objetivo (Requerido para ZAP y k6).");
        if (!app.repositorio) warnings.push("Falta Repositorio (Requerido para SonarQube).");
        
        if (warnings.length > 0) {
            statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + warnings.join(" ");
            statusDiv.style.color = '#c62828';
        } else {
            statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Configuración completa.';
            statusDiv.style.color = '#2e7d32';
        }
    }
}
`;

appJs = appJs.replace(
    'if (hash && document.getElementById(hash)) {',
    'cargarAplicaciones();\n    if (hash && document.getElementById(hash)) {'
);

fs.writeFileSync('app.js', appJs + newFunctions);
console.log('app.js updated.');
