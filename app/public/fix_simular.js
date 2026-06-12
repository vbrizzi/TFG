const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// Modificar simularEjecucion para usar select y checkboxes
appJs = appJs.replace(/async function simularEjecucion\(\) \{[\s\S]*?\/\/ ===== DESCARGAR PDF =====/, 
`async function simularEjecucion() {
    const appId = document.getElementById('execAppSelect').value;
    if (!appId) {
        alert("Por favor seleccione una aplicación para evaluar.");
        return;
    }
    const app = aplicaciones.find(a => a.id == appId);

    const runSonar = document.getElementById('runSonar').checked;
    const runZap = document.getElementById('runZap').checked;
    const runK6 = document.getElementById('runK6').checked;

    if (!runSonar && !runZap && !runK6) {
        alert("Debe seleccionar al menos una herramienta para ejecutar.");
        return;
    }

    const btn = document.getElementById('btnEjecutar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ejecutando... (Puede tardar la 1ra vez)';
    btn.style.background = '#888';
    document.getElementById('exec-log').style.display = 'block';
    const log = document.getElementById('logArea');
    log.innerHTML = '[INFO] Iniciando evaluación real...\\n';
    
    try {
        log.innerHTML += \`[INFO] Aplicación: \${app.nombre}\\n\`;
        if (runSonar) log.innerHTML += \`[INFO] Repo: \${app.repositorio}\\n\`;
        if (runZap || runK6) log.innerHTML += \`[INFO] Target: \${app.url_objetivo}\\n\`;
        
        const tools = [];
        if (runSonar) tools.push("SonarQube");
        if (runZap) tools.push("ZAP");
        if (runK6) tools.push("k6");
        log.innerHTML += \`[INFO] Ejecutando contenedores (\${tools.join(', ')}). Por favor espere...\\n\`;
        
        // Trigger evaluation
        const evalRes = await fetch('/api/evaluar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                id_aplicacion: app.id,
                repositoryUrl: app.repositorio,
                targetUrl: app.url_objetivo,
                projectName: 'eval_' + app.id + '_' + Date.now(),
                runSonar: runSonar,
                runZap: runZap,
                runK6: runK6
            })
        });
        
        const evalData = await evalRes.json();
        log.innerHTML += \`[INFO] Evaluación procesada exitosamente.\\n\`;
        
        if (evalData.scores) {
            log.innerHTML += \`[SCORE] ✓ Calidad: \${evalData.scores.quality}\\n\`;
            log.innerHTML += \`[SCORE] ✓ Seguridad: \${evalData.scores.security}\\n\`;
            log.innerHTML += \`[SCORE] ✓ Rendimiento: \${evalData.scores.performance}\\n\`;
            log.innerHTML += \`[SCORE] ✓ Score global: \${evalData.scores.global}/100\\n\`;
            
            // Guardar el ID para el PDF
            window.lastEvalId = evalData.id_evaluacion;
        } else {
             log.innerHTML += \`[INFO] Respuesta: \${JSON.stringify(evalData)}\\n\`;
        }
        
        btn.innerHTML = '<i class="fas fa-check"></i> Evaluación Finalizada';
        btn.style.background = '#4caf50';
    } catch (e) {
        log.innerHTML += \`[ERROR] Ocurrió un error en la petición: \${e.message}\\n\`;
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
        btn.style.background = '#f44336';
    }
    btn.disabled = false;
}

// ===== DESCARGAR PDF =====`);

fs.writeFileSync('app.js', appJs);
console.log('simularEjecucion updated.');
