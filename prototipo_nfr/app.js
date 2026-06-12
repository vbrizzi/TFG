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
function simularEjecucion() {
    const btn = document.getElementById('btnEjecutar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ejecutando...';
    btn.style.background = '#888';
    document.getElementById('exec-log').style.display = 'block';
    const log = document.getElementById('logArea');
    log.innerHTML = '';

    const steps = [
        { time: 500,  tool: 'sonar', status: 'En proceso', badge: 'badge-running', progress: 10, log: '[INFO] Iniciando evaluación #12...' },
        { time: 1200, tool: 'sonar', status: 'En proceso', badge: 'badge-running', progress: 40, log: '[SONAR] Conectando con SonarQube...' },
        { time: 2000, tool: 'sonar', status: 'En proceso', badge: 'badge-running', progress: 70, log: '[SONAR] Analizando código fuente...' },
        { time: 3000, tool: 'sonar', status: 'Finalizado', badge: 'badge-success', progress: 100, log: '[SONAR] ✓ Análisis completado. Rating: A' },
        { time: 3500, tool: 'zap',   status: 'En proceso', badge: 'badge-running', progress: 20, log: '[ZAP] Iniciando escaneo de seguridad...' },
        { time: 4500, tool: 'zap',   status: 'En proceso', badge: 'badge-running', progress: 60, log: '[ZAP] Escaneando endpoints...' },
        { time: 5500, tool: 'zap',   status: 'Finalizado', badge: 'badge-success', progress: 100, log: '[ZAP] ✓ Escaneo completado. 2 alertas detectadas.' },
        { time: 6000, tool: 'k6',    status: 'En proceso', badge: 'badge-running', progress: 30, log: '[K6] Iniciando prueba de carga (50 VUs, 60s)...' },
        { time: 7000, tool: 'k6',    status: 'En proceso', badge: 'badge-running', progress: 65, log: '[K6] Ejecutando... 35s restantes' },
        { time: 8000, tool: 'k6',    status: 'Finalizado', badge: 'badge-success', progress: 100, log: '[K6] ✓ Prueba completada. p95: 487ms' },
        { time: 8500, tool: null, log: '[INFO] Procesando resultados...' },
        { time: 9000, tool: null, log: '[SCORE] Calculando puntajes...' },
        { time: 9500, tool: null, log: '[SCORE] ✓ Score global: 82.3/100' },
        { time: 10000, tool: null, log: '[INFO] ✓ Evaluación #12 finalizada exitosamente.' },
    ];

    steps.forEach(step => {
        setTimeout(() => {
            if (step.tool) {
                const card = document.getElementById('tool-' + step.tool);
                card.querySelector('.tool-status .badge').className = 'badge ' + step.badge;
                card.querySelector('.tool-status .badge').textContent = step.status;
                card.querySelector('.progress-fill').style.width = step.progress + '%';
            }
            if (step.log) {
                log.innerHTML += step.log + '\n';
                log.scrollTop = log.scrollHeight;
            }
            // Final step
            if (step.time === 10000) {
                btn.innerHTML = '<i class="fas fa-check"></i> Evaluación Finalizada';
                btn.style.background = '#4caf50';
            }
        }, step.time);
    });
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
