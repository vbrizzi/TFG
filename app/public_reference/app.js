// ===== NAVEGACIÓN ENTRE PANTALLAS =====
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    document.querySelector(`[data-screen="${screenId}"]`).classList.add('active');
    window.scrollTo(0, 0);
    // Inicializar charts si es necesario
    if (screenId === 'dashboard') initDashboardCharts();
    if (screenId === 'resultados') initResultadosCharts();
}

// Sidebar click
document.querySelectorAll('.sidebar-nav li').forEach(item => {
    item.addEventListener('click', () => showScreen(item.dataset.screen));
});

// ===== CHARTS DASHBOARD =====
let chartEvolucion, chartCategorias;
function initDashboardCharts() {
    if (chartEvolucion) return;
    const ctx1 = document.getElementById('chartEvolucion').getContext('2d');
    chartEvolucion = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: ['Eval #8', 'Eval #9', 'Eval #10', 'Eval #11', 'Eval #12'],
            datasets: [
                { label: 'Mantenibilidad', data: [75, 78, 82, 85, 88], borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.1)', fill: true, tension: 0.3 },
                { label: 'Seguridad', data: [60, 58, 65, 68, 72], borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.1)', fill: true, tension: 0.3 },
                { label: 'Rendimiento', data: [80, 82, 78, 84, 87], borderColor: '#2196f3', backgroundColor: 'rgba(33,150,243,0.1)', fill: true, tension: 0.3 }
            ]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { min: 40, max: 100 } } }
    });
    const ctx2 = document.getElementById('chartCategorias').getContext('2d');
    chartCategorias = new Chart(ctx2, {
        type: 'doughnut',
        data: {
            labels: ['Mantenibilidad', 'Seguridad', 'Rendimiento'],
            datasets: [{ data: [88, 72, 87], backgroundColor: ['#4caf50', '#ff9800', '#2196f3'], borderWidth: 2 }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

// ===== CHARTS RESULTADOS =====
let chartRadar, chartComparacion;
function initResultadosCharts() {
    if (chartRadar) return;
    const ctx3 = document.getElementById('chartRadar').getContext('2d');
    chartRadar = new Chart(ctx3, {
        type: 'radar',
        data: {
            labels: ['Mantenibilidad', 'Seguridad', 'Rendimiento', 'Complejidad', 'Duplicación', 'Cobertura'],
            datasets: [{ label: 'Eval #12', data: [88, 72, 87, 82, 97, 75], backgroundColor: 'rgba(108,99,255,0.2)', borderColor: '#6c63ff', borderWidth: 2 }]
        },
        options: { responsive: true, scales: { r: { min: 0, max: 100 } }, plugins: { legend: { position: 'bottom' } } }
    });
    const ctx4 = document.getElementById('chartComparacion').getContext('2d');
    chartComparacion = new Chart(ctx4, {
        type: 'bar',
        data: {
            labels: ['Mantenibilidad', 'Seguridad', 'Rendimiento'],
            datasets: [
                { label: 'Eval #11 (anterior)', data: [85, 68, 84], backgroundColor: '#ccc' },
                { label: 'Eval #12 (actual)', data: [88, 72, 87], backgroundColor: '#6c63ff' }
            ]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { min: 0, max: 100 } } }
    });
}

// ===== SIMULACIÓN DE EJECUCIÓN =====
// ===== EJECUCIÓN REAL (antes Simulación) =====
async function simularEjecucion() {
    const btn = document.getElementById('btnEjecutar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ejecutando... (Puede tardar la 1ra vez)';
    btn.style.background = '#888';
    document.getElementById('exec-log').style.display = 'block';
    const log = document.getElementById('logArea');
    log.innerHTML = '[INFO] Iniciando evaluación real... Registrando aplicación.\n';
    
    try {
        // Leer valores del formulario
        const targetUrl = document.getElementById('targetUrlInput').value || 'https://example.com';
        const repositoryUrl = document.getElementById('repoUrlInput').value || 'https://github.com/octocat/Hello-World';

        // Register app
        const appRes = await fetch('/api/aplicaciones', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({nombre: 'App desde Frontend', repositorio: repositoryUrl})
        });
        const appData = await appRes.json();
        
        log.innerHTML += `[INFO] Aplicación registrada con ID: ${appData.id}\n`;
        log.innerHTML += `[INFO] Repo: ${repositoryUrl}\n`;
        log.innerHTML += `[INFO] Target: ${targetUrl}\n`;
        log.innerHTML += `[INFO] Ejecutando contenedores (SonarQube, ZAP y k6). Por favor espere...\n`;
        
        // Trigger evaluation
        const evalRes = await fetch('/api/evaluar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                id_aplicacion: appData.id,
                repositoryUrl: repositoryUrl,
                targetUrl: targetUrl,
                projectName: 'frontend_test_' + appData.id
            })
        });
        
        const evalData = await evalRes.json();
        log.innerHTML += `[INFO] Evaluación procesada exitosamente.\n`;
        
        if (evalData.scores) {
            log.innerHTML += `[SCORE] ✓ Calidad: ${evalData.scores.quality}\n`;
            log.innerHTML += `[SCORE] ✓ Seguridad: ${evalData.scores.security}\n`;
            log.innerHTML += `[SCORE] ✓ Rendimiento: ${evalData.scores.performance}\n`;
            log.innerHTML += `[SCORE] ✓ Score global: ${evalData.scores.global}/100\n`;
            
            // Guardar el ID para el PDF
            window.lastEvalId = evalData.id_evaluacion;
        } else {
             log.innerHTML += `[INFO] Respuesta: ${JSON.stringify(evalData)}\n`;
        }
        
        btn.innerHTML = '<i class="fas fa-check"></i> Evaluación Finalizada';
        btn.style.background = '#4caf50';
    } catch (e) {
        log.innerHTML += `[ERROR] Ocurrió un error en la petición: ${e.message}\n`;
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
        btn.style.background = '#f44336';
    }
    btn.disabled = false;
}

// ===== DESCARGAR PDF =====
function descargarPDF() {
    if (!window.lastEvalId) {
        alert('Por favor, ejecuta una evaluación primero para generar su reporte.');
        return;
    }
    window.open('/api/reporte/' + window.lastEvalId, '_blank');
}

// Init on load — support hash routing for iframes
document.addEventListener('DOMContentLoaded', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
        showScreen(hash);
    } else {
        initDashboardCharts();
    }
});
