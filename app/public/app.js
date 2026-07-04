// ===== AUTENTICACIÓN =====
async function doLogin() {
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    const errorDiv = document.getElementById('loginError');
    const btn = document.getElementById('btnLogin');

    if (!username || !password) {
        errorDiv.textContent = 'Ingresá usuario y contraseña.';
        errorDiv.style.display = 'block';
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';
    errorDiv.style.display = 'none';

    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
            localStorage.setItem('nfr_user', JSON.stringify(data.user));
            document.getElementById('sidebarUsername').textContent = data.user.nombre || data.user.username;
            document.getElementById('loginScreen').classList.add('hidden');
            cargarAplicaciones();
            cargarDashboard();
        } else {
            errorDiv.textContent = data.error || 'Credenciales incorrectas.';
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.textContent = 'Error de conexión con el servidor.';
        errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Ingresar';
    }
}

function doLogout() {
    localStorage.removeItem('nfr_user');
    document.getElementById('loginPass').value = '';
    document.getElementById('loginError').style.display = 'none';
    document.getElementById('loginScreen').classList.remove('hidden');
}

function checkAuth() {
    const user = localStorage.getItem('nfr_user');
    if (user) {
        try {
            const parsed = JSON.parse(user);
            document.getElementById('sidebarUsername').textContent = parsed.nombre || parsed.username;
            document.getElementById('loginScreen').classList.add('hidden');
            return true;
        } catch(e) {
            localStorage.removeItem('nfr_user');
        }
    }
    return false;
}

// Permitir login con Enter
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginPass').addEventListener('keydown', e => {
        if (e.key === 'Enter') doLogin();
    });
    document.getElementById('loginUser').addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('loginPass').focus();
    });
    // Verificar si ya hay sesión activa
    if (checkAuth()) {
        cargarAplicaciones();
        cargarDashboard();
    }
});

// ===== NAVEGACIÓN ENTRE PANTALLAS =====
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav li').forEach(l => l.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    document.querySelector(`[data-screen="${screenId}"]`).classList.add('active');
    window.scrollTo(0, 0);

    if (screenId === 'dashboard') cargarDashboard();
    if (screenId === 'resultados') cargarResultados();
}

document.querySelectorAll('.sidebar-nav li').forEach(item => {
    item.addEventListener('click', () => showScreen(item.dataset.screen));
});

// ===== ESTADO GLOBAL =====
let aplicaciones = [];
let chartEvolucion = null, chartCategorias = null;
let chartRadar = null, chartComparacion = null;

// ===== APLICACIONES =====
async function cargarAplicaciones() {
    try {
        const res = await fetch('/api/aplicaciones');
        aplicaciones = await res.json();
        actualizarDropdowns();
    } catch (e) {
        console.error('Error cargando aplicaciones:', e);
    }
}

function actualizarDropdowns() {
    const selects = ['configAppSelect', 'execAppSelect', 'resultadosAppSelect', 'dashboardAppSelect'];
    selects.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const defaultText = id === 'dashboardAppSelect' ? 'Todas las aplicaciones' : 'Seleccione una aplicación...';
        const currentVal = sel.value;
        sel.innerHTML = `<option value="">${defaultText}</option>`;
        aplicaciones.forEach(app => {
            sel.innerHTML += `<option value="${app.id}">${app.nombre}</option>`;
        });
        if (currentVal) sel.value = currentVal;
    });
}

async function registrarAplicacion() {
    const nombre = document.getElementById('regAppName').value;
    const desc = document.getElementById('regAppDesc').value;
    const url = document.getElementById('regAppUrl').value;
    const repo = document.getElementById('regAppRepo').value;

    if (!nombre) { alert('El nombre de la aplicación es obligatorio.'); return; }

    try {
        const res = await fetch('/api/aplicaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, descripcion: desc, url_objetivo: url, repositorio: repo })
        });
        const data = await res.json();
        alert('¡Aplicación registrada con éxito!');
        document.getElementById('regAppName').value = '';
        document.getElementById('regAppDesc').value = '';
        document.getElementById('regAppUrl').value = '';
        document.getElementById('regAppRepo').value = '';
        await cargarAplicaciones();
        const configSel = document.getElementById('configAppSelect');
        if (configSel) configSel.value = data.id;
        showScreen('configuracion');
        actualizarEstadoConfiguracion();
    } catch (e) {
        alert('Error al registrar: ' + e.message);
    }
}

// ===== DASHBOARD DINÁMICO =====
async function cargarDashboard() {
    const appId = document.getElementById('dashboardAppSelect').value;
    const url = appId ? `/api/dashboard?id_app=${appId}` : '/api/dashboard';

    try {
        const res = await fetch(url);
        const data = await res.json();

        document.getElementById('dashTotalApps').textContent = data.totalApps;
        document.getElementById('dashTotalEvals').textContent = data.totalEvals;
        document.getElementById('dashTotalHallazgos').textContent = data.totalHallazgos;
        document.getElementById('dashScorePromedio').textContent = data.scorePromedio || '—';

        // Tabla de últimas evaluaciones
        const tbody = document.getElementById('dashTableBody');
        if (data.ultimasEvals && data.ultimasEvals.length > 0) {
            tbody.innerHTML = data.ultimasEvals.map(ev => {
                const fecha = new Date(ev.fecha).toLocaleDateString('es-AR');
                const estadoBadge = ev.estado === 'FINALIZADA' ? 'badge-success' :
                                    ev.estado === 'ERROR' ? 'badge-danger' :
                                    ev.estado === 'EN_PROCESO' ? 'badge-warning' : 'badge-pending';
                const scoreClass = ev.puntaje_global >= 80 ? 'score-good' : ev.puntaje_global >= 60 ? 'score-medium' : 'score-bad';
                const scoreVal = ev.puntaje_global !== null ? ev.puntaje_global.toFixed(1) : '—';
                return `<tr>
                    <td>${ev.app_nombre}</td>
                    <td>${fecha}</td>
                    <td><span class="badge ${estadoBadge}">${ev.estado}</span></td>
                    <td><span class="score-pill ${scoreClass}">${scoreVal}</span></td>
                    <td><a href="#" class="btn-link" onclick="verEvaluacion(${ev.id})">Ver</a></td>
                </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#999;">Aún no hay evaluaciones registradas.</td></tr>';
        }

        // Gráficos de evolución (necesitamos historial completo)
        await cargarGraficosDashboard(appId);

    } catch (e) {
        console.error('Error cargando dashboard:', e);
    }
}

async function cargarGraficosDashboard(appId) {
    // Necesitamos evaluaciones con scores para los gráficos
    let evals = [];
    if (appId) {
        const res = await fetch(`/api/evaluaciones/${appId}`);
        evals = await res.json();
    } else if (aplicaciones.length > 0) {
        // Traer las de la primera app que tenga datos
        for (const app of aplicaciones) {
            const res = await fetch(`/api/evaluaciones/${app.id}`);
            const data = await res.json();
            if (data.length > 0) { evals = data; break; }
        }
    }

    // Filtrar solo finalizadas con score
    evals = evals.filter(e => e.estado === 'FINALIZADA' && e.puntaje_global !== null).reverse();

    // Destruir charts anteriores si existen
    if (chartEvolucion) { chartEvolucion.destroy(); chartEvolucion = null; }
    if (chartCategorias) { chartCategorias.destroy(); chartCategorias = null; }

    const ctx1 = document.getElementById('chartEvolucion').getContext('2d');
    const ctx2 = document.getElementById('chartCategorias').getContext('2d');

    if (evals.length > 0) {
        const labels = evals.map((e, i) => `Eval #${e.id}`);
        const mantData = evals.map(e => e.puntaje_mantenibilidad || 0);
        const segData = evals.map(e => e.puntaje_seguridad || 0);
        const perfData = evals.map(e => e.puntaje_rendimiento || 0);

        chartEvolucion = new Chart(ctx1, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Mantenibilidad', data: mantData, borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.1)', fill: true, tension: 0.3 },
                    { label: 'Seguridad', data: segData, borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.1)', fill: true, tension: 0.3 },
                    { label: 'Rendimiento', data: perfData, borderColor: '#2196f3', backgroundColor: 'rgba(33,150,243,0.1)', fill: true, tension: 0.3 }
                ]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { min: 0, max: 100 } } }
        });

        // Doughnut con últimos scores
        const last = evals[evals.length - 1];
        chartCategorias = new Chart(ctx2, {
            type: 'doughnut',
            data: {
                labels: ['Mantenibilidad', 'Seguridad', 'Rendimiento'],
                datasets: [{ data: [last.puntaje_mantenibilidad || 0, last.puntaje_seguridad || 0, last.puntaje_rendimiento || 0], backgroundColor: ['#4caf50', '#ff9800', '#2196f3'], borderWidth: 2 }]
            },
            options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
        });
    } else {
        chartEvolucion = new Chart(ctx1, { type: 'line', data: { labels: ['Sin datos'], datasets: [{ data: [0] }] }, options: { responsive: true } });
        chartCategorias = new Chart(ctx2, { type: 'doughnut', data: { labels: ['Sin datos'], datasets: [{ data: [1], backgroundColor: ['#ddd'] }] }, options: { responsive: true } });
    }
}

// ===== CONFIGURACIÓN (RF02, RF03, RF04) =====
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
        if (!app.url_objetivo) warnings.push('Falta URL objetivo (Requerido para ZAP y k6).');
        if (!app.repositorio) warnings.push('Falta Repositorio (Requerido para SonarQube).');

        if (warnings.length > 0) {
            statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + warnings.join(' ');
            statusDiv.style.color = '#c62828';
        } else {
            statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Configuración completa.';
            statusDiv.style.color = '#2e7d32';
        }
    }
}

async function guardarConfiguracion() {
    const appId = document.getElementById('configAppSelect').value;
    if (!appId) { alert('Seleccione una aplicación.'); return; }

    const checkboxes = document.querySelectorAll('#configuracion .category-grid input[type="checkbox"]');
    const categorias = [];
    const herramientas = [];
    checkboxes.forEach((cb, i) => {
        if (cb.checked) {
            if (i === 0) { categorias.push('MANTENIBILIDAD'); herramientas.push('SonarQube'); }
            if (i === 1) { categorias.push('SEGURIDAD'); herramientas.push('OWASP ZAP'); }
            if (i === 2) { categorias.push('RENDIMIENTO'); herramientas.push('k6'); }
        }
    });

    if (categorias.length === 0) { alert('Seleccione al menos una categoría.'); return; }

    const parametros = {
        url_objetivo: document.getElementById('targetUrlInput').value,
        repositorio: document.getElementById('repoUrlInput').value,
        entorno: document.getElementById('configEntorno').value,
        vus: parseInt(document.getElementById('configVUs').value) || 10,
        duracion: parseInt(document.getElementById('configDuracion').value) || 10
    };

    try {
        const res = await fetch('/api/configuraciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_aplicacion: parseInt(appId), categorias, parametros, herramientas })
        });
        const data = await res.json();
        if (data.error) { alert('Error: ' + data.error); return; }
        alert('¡Configuración guardada con éxito!');
        // Auto-seleccionar en ejecución
        const execSel = document.getElementById('execAppSelect');
        if (execSel) execSel.value = appId;
        showScreen('ejecucion');
    } catch (e) {
        alert('Error al guardar configuración: ' + e.message);
    }
}

// ===== EJECUCIÓN (RF05, RF10) =====

function setToolCardState(toolKey, state) {
    const card = document.getElementById(`tool-${toolKey}`);
    if (!card) return;
    const statusEl = card.querySelector('.tool-status span');
    const progressFill = card.querySelector('.progress-fill');
    const states = {
        pending:  { cls: 'badge-pending',  text: 'Pendiente',   width: '0%',   color: '#ccc' },
        running:  { cls: 'badge-running',  text: 'En Proceso…', width: '60%',  color: '#2196f3' },
        done:     { cls: 'badge-success',  text: 'Finalizado',  width: '100%', color: '#4caf50' },
        error:    { cls: 'badge-danger',   text: 'Error',       width: '100%', color: '#f44336' },
        skipped:  { cls: 'badge-pending',  text: 'Omitido',     width: '0%',   color: '#ccc' },
    };
    const s = states[state] || states.pending;
    statusEl.className = `badge ${s.cls}`;
    statusEl.textContent = s.text;
    progressFill.style.width = s.width;
    progressFill.style.background = s.color;
    // Animación pulsante en proceso
    card.classList.toggle('tool-running', state === 'running');
}

async function simularEjecucion() {
    const appId = document.getElementById('execAppSelect').value;
    if (!appId) { alert('Por favor seleccione una aplicación para evaluar.'); return; }
    const app = aplicaciones.find(a => a.id == appId);

    const runSonar = document.getElementById('runSonar').checked;
    const runZap   = document.getElementById('runZap').checked;
    const runK6    = document.getElementById('runK6').checked;

    if (!runSonar && !runZap && !runK6) { alert('Debe seleccionar al menos una herramienta.'); return; }

    const btn = document.getElementById('btnEjecutar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ejecutando...';
    btn.style.background = '#555';

    // Estado inicial de tarjetas
    setToolCardState('sonar', runSonar ? 'pending' : 'skipped');
    setToolCardState('zap',   runZap   ? 'pending' : 'skipped');
    setToolCardState('k6',    runK6    ? 'pending' : 'skipped');

    document.getElementById('exec-log').style.display = 'block';
    const log = document.getElementById('logArea');
    log.innerHTML = `[INFO] Iniciando evaluación para: ${app.nombre}\n`;
    log.innerHTML += `[INFO] Herramientas: ${[runSonar&&'SonarQube', runZap&&'ZAP', runK6&&'k6'].filter(Boolean).join(', ')}\n`;

    let evalId = null;
    let pollInterval = null;

    // Función de polling para actualizar tarjetas en tiempo real
    const startPolling = () => {
        pollInterval = setInterval(async () => {
            if (!evalId) return;
            try {
                const r = await fetch(`/api/evaluar/progreso/${evalId}`);
                const data = await r.json();
                const p = data.progreso || {};

                if (runSonar) setToolCardState('sonar', p.sonar || 'pending');
                if (runZap)   setToolCardState('zap',   p.zap   || 'pending');
                if (runK6)    setToolCardState('k6',    p.k6    || 'pending');

                if (data.estado === 'FINALIZADA' || data.estado === 'ERROR') {
                    clearInterval(pollInterval);
                }
            } catch(e) { /* servidor ocupado, reintenta */ }
        }, 1500);
    };

    try {
        // Iniciar evaluación en background (no await todavía)
        const evalPromise = fetch('/api/evaluar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_aplicacion: app.id,
                repositoryUrl: app.repositorio,
                targetUrl: app.url_objetivo,
                projectName: app.nombre.replace(/\s+/g, '_').toLowerCase() + '_' + Date.now(),
                runSonar, runZap, runK6
            })
        });

        // Pequeña espera para que el backend cree el registro y tengamos el evalId
        await new Promise(r => setTimeout(r, 800));

        // Obtener el evalId de la última evaluación creada para esta app
        const histRes = await fetch(`/api/evaluaciones/${app.id}`);
        const histData = await histRes.json();
        if (histData && histData.length > 0) {
            evalId = histData[0].id;
            log.innerHTML += `[INFO] Evaluación #${evalId} iniciada en servidor.\n`;
            startPolling();
        }

        // Ahora sí esperamos el resultado final
        const evalRes = await evalPromise;
        const evalData = await evalRes.json();
        clearInterval(pollInterval);

        if (evalData.error) throw new Error(evalData.error);

        // Estado final de las tarjetas
        if (runSonar) setToolCardState('sonar', 'done');
        if (runZap)   setToolCardState('zap',   'done');
        if (runK6)    setToolCardState('k6',    'done');

        log.innerHTML += `[✓] Evaluación #${evalData.id_evaluacion} finalizada.\n`;
        log.innerHTML += `[SCORE] Mantenibilidad: ${evalData.scores.quality} | Seguridad: ${evalData.scores.security} | Rendimiento: ${evalData.scores.performance}\n`;
        log.innerHTML += `[SCORE] Score Global: ${evalData.scores.global}/100\n`;
        log.innerHTML += `[INFO] Hallazgos: ${evalData.hallazgos_count} | Métricas: ${evalData.metricas_count}\n`;

        window.lastEvalId = evalData.id_evaluacion;
        btn.innerHTML = '<i class="fas fa-check"></i> ¡Evaluación Completada!';
        btn.style.background = '#4caf50';

    } catch (e) {
        clearInterval(pollInterval);
        log.innerHTML += `[ERROR] ${e.message}\n`;
        if (runSonar) setToolCardState('sonar', 'error');
        if (runZap)   setToolCardState('zap',   'error');
        if (runK6)    setToolCardState('k6',    'error');
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error en evaluación';
        btn.style.background = '#f44336';
    }

    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play"></i> Ejecutar Evaluación';
        btn.style.background = '';
    }, 4000);
}


// ===== RESULTADOS DINÁMICOS (RF11, RF13) =====
async function cargarResultados() {
    const appId = document.getElementById('resultadosAppSelect').value;
    const evalSelect = document.getElementById('resultadosEvalSelect');
    evalSelect.innerHTML = '<option value="">Seleccione una evaluación...</option>';

    if (!appId) return;

    try {
        const res = await fetch(`/api/evaluaciones/${appId}`);
        const evals = await res.json();

        evals.forEach(ev => {
            const fecha = new Date(ev.fecha).toLocaleDateString('es-AR');
            const score = ev.puntaje_global !== null ? ev.puntaje_global.toFixed(1) : '—';
            evalSelect.innerHTML += `<option value="${ev.id}">Eval #${ev.id} — ${fecha} — Score: ${score} (${ev.estado})</option>`;
        });

        // Auto-seleccionar la más reciente
        if (evals.length > 0) {
            evalSelect.value = evals[0].id;
            cargarDetalleEvaluacion();
        }
    } catch (e) {
        console.error('Error cargando resultados:', e);
    }
}

async function cargarDetalleEvaluacion() {
    const evalId = document.getElementById('resultadosEvalSelect').value;
    if (!evalId) return;

    try {
        const res = await fetch(`/api/evaluaciones/${evalId}/detalle`);
        const data = await res.json();

        // Scores
        const score = data.score || {};
        document.getElementById('resScoreGlobal').textContent = score.puntaje_global !== null && score.puntaje_global !== undefined ? score.puntaje_global.toFixed(1) : '—';
        document.getElementById('resScoreMant').textContent = score.puntaje_mantenibilidad !== null ? Math.round(score.puntaje_mantenibilidad) : '—';
        document.getElementById('resScoreSeg').textContent = score.puntaje_seguridad !== null ? Math.round(score.puntaje_seguridad) : '—';
        document.getElementById('resScorePerf').textContent = score.puntaje_rendimiento !== null ? Math.round(score.puntaje_rendimiento) : '—';

        // Clase del score global
        const circle = document.getElementById('resScoreCircle');
        circle.className = 'score-circle ' + (score.puntaje_global >= 80 ? 'score-good' : score.puntaje_global >= 60 ? 'score-medium' : 'score-bad');

        // Hallazgos
        const hallBody = document.getElementById('resHallazgosBody');
        if (data.hallazgos && data.hallazgos.length > 0) {
            hallBody.innerHTML = data.hallazgos.map(h => {
                const sevBadge = h.severidad === 'ALTO' ? 'badge-danger' : h.severidad === 'MEDIO' ? 'badge-warning' : h.severidad === 'BAJO' ? 'badge-info' : 'badge-pending';
                return `<tr><td>${h.categoria_calidad}</td><td>${h.descripcion}</td><td><span class="badge ${sevBadge}">${h.severidad}</span></td><td>${h.herramienta_utilizada}</td></tr>`;
            }).join('');
        } else {
            hallBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;">No se detectaron hallazgos.</td></tr>';
        }

        // Guardar datos para el reporte
        window.lastEvalId = evalId;
        window.lastEvalData = data;

        // Actualizar reporte en vivo
        actualizarReporte(data);

        // Gráficos
        actualizarGraficosResultados(data);

    } catch (e) {
        console.error('Error cargando detalle:', e);
    }
}

function actualizarGraficosResultados(data) {
    const score = data.score || {};

    if (chartRadar) { chartRadar.destroy(); chartRadar = null; }
    if (chartComparacion) { chartComparacion.destroy(); chartComparacion = null; }

    const ctx3 = document.getElementById('chartRadar').getContext('2d');
    chartRadar = new Chart(ctx3, {
        type: 'radar',
        data: {
            labels: ['Mantenibilidad', 'Seguridad', 'Rendimiento'],
            datasets: [{
                label: `Eval #${data.evaluacion.id}`,
                data: [score.puntaje_mantenibilidad || 0, score.puntaje_seguridad || 0, score.puntaje_rendimiento || 0],
                backgroundColor: 'rgba(108,99,255,0.2)',
                borderColor: '#6c63ff',
                borderWidth: 2
            }]
        },
        options: { responsive: true, scales: { r: { min: 0, max: 100 } }, plugins: { legend: { position: 'bottom' } } }
    });

    // Comparación: traer la evaluación anterior de la misma app
    const ctx4 = document.getElementById('chartComparacion').getContext('2d');
    chartComparacion = new Chart(ctx4, {
        type: 'bar',
        data: {
            labels: ['Mantenibilidad', 'Seguridad', 'Rendimiento'],
            datasets: [{
                label: `Eval #${data.evaluacion.id}`,
                data: [score.puntaje_mantenibilidad || 0, score.puntaje_seguridad || 0, score.puntaje_rendimiento || 0],
                backgroundColor: '#6c63ff'
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } }, scales: { y: { min: 0, max: 100 } } }
    });
}

// ===== REPORTE DINÁMICO (RF12) =====
function actualizarReporte(data) {
    if (!data || !data.evaluacion) return;

    const ev = data.evaluacion;
    const score = data.score || {};

    document.getElementById('repAppName').textContent = ev.app_nombre || '—';
    document.getElementById('repFecha').textContent = new Date(ev.fecha).toLocaleDateString('es-AR');
    document.getElementById('repEvalId').textContent = ev.id;

    const global = score.puntaje_global !== null ? score.puntaje_global.toFixed(1) : '—';
    const calidad = global >= 80 ? 'satisfactorio' : global >= 60 ? 'aceptable con oportunidades de mejora' : 'deficiente, requiere atención';
    document.getElementById('repResumen').innerHTML = `La evaluación de requerimientos no funcionales de la aplicación <strong>${ev.app_nombre}</strong> arrojó un <strong>score global de ${global}/100</strong>, lo que indica un nivel de calidad ${calidad}.`;

    // Barras de score
    const repScores = document.getElementById('repScores');
    const mant = score.puntaje_mantenibilidad || 0;
    const seg = score.puntaje_seguridad || 0;
    const perf = score.puntaje_rendimiento || 0;
    repScores.innerHTML = `
        <div class="report-score-item"><span class="report-cat">Mantenibilidad</span><div class="report-bar"><div class="report-bar-fill" style="width:${mant}%;background:#4caf50;"></div></div><span>${Math.round(mant)}/100</span></div>
        <div class="report-score-item"><span class="report-cat">Seguridad</span><div class="report-bar"><div class="report-bar-fill" style="width:${seg}%;background:#ff9800;"></div></div><span>${Math.round(seg)}/100</span></div>
        <div class="report-score-item"><span class="report-cat">Rendimiento</span><div class="report-bar"><div class="report-bar-fill" style="width:${perf}%;background:#2196f3;"></div></div><span>${Math.round(perf)}/100</span></div>
    `;

    // Métricas
    const metricasBody = document.getElementById('repMetricasBody');
    const umbrales = {
        'Complejidad Ciclomática': { umbral: '≤ 10', check: v => v <= 10 },
        'Duplicación de Código': { umbral: '≤ 5%', check: v => v <= 5 },
        'Vulnerabilidades Altas': { umbral: '0', check: v => v === 0 },
        'Vulnerabilidades Medias': { umbral: '≤ 3', check: v => v <= 3 },
        'Tiempo respuesta p95': { umbral: '≤ 500ms', check: v => v <= 500 },
        'Tasa de error': { umbral: '≤ 1%', check: v => v <= 1 }
    };

    if (data.metricas && data.metricas.length > 0) {
        metricasBody.innerHTML = data.metricas.map(m => {
            const u = umbrales[m.nombre];
            const valorStr = m.unidad ? `${m.valor}${m.unidad}` : m.valor;
            if (u) {
                const cumple = u.check(m.valor);
                return `<tr><td>${m.nombre}</td><td>${valorStr}</td><td>${u.umbral}</td><td><span class="badge ${cumple ? 'badge-success' : 'badge-danger'}">${cumple ? 'Cumple' : 'No cumple'}</span></td></tr>`;
            }
            return `<tr><td>${m.nombre}</td><td>${valorStr}</td><td>—</td><td><span class="badge badge-info">Info</span></td></tr>`;
        }).join('');
    } else {
        metricasBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;">Sin métricas.</td></tr>';
    }

    // Observaciones
    const obsUl = document.getElementById('repObservaciones');
    const obs = [];
    if (data.hallazgos) {
        const altos = data.hallazgos.filter(h => h.severidad === 'ALTO').length;
        const medios = data.hallazgos.filter(h => h.severidad === 'MEDIO').length;
        if (altos > 0) obs.push(`Se detectaron ${altos} hallazgo(s) de severidad alta que requieren atención inmediata.`);
        if (medios > 0) obs.push(`Se encontraron ${medios} hallazgo(s) de severidad media a considerar.`);
        if (altos === 0 && medios === 0) obs.push('No se detectaron hallazgos de severidad alta ni media.');
    }
    if (mant >= 80) obs.push('La mantenibilidad del código se encuentra en niveles satisfactorios.');
    if (perf >= 80) obs.push('El rendimiento cumple con los umbrales definidos.');
    obs.push('Se recomienda ejecutar una nueva evaluación posterior a la corrección de hallazgos detectados.');

    obsUl.innerHTML = obs.map(o => `<li>${o}</li>`).join('');
}

function verEvaluacion(evalId) {
    window.lastEvalId = evalId;
    showScreen('resultados');
    // Intentar cargar detalle directo
    setTimeout(async () => {
        const evalSelect = document.getElementById('resultadosEvalSelect');
        // Cargar detalle directo
        try {
            const res = await fetch(`/api/evaluaciones/${evalId}/detalle`);
            const data = await res.json();
            if (data.evaluacion) {
                // Set app select
                const appSelect = document.getElementById('resultadosAppSelect');
                appSelect.value = data.evaluacion.id_aplicacion;
                await cargarResultados();
                evalSelect.value = evalId;
                await cargarDetalleEvaluacion();
            }
        } catch(e) { console.error(e); }
    }, 100);
}

// ===== PDF =====
function descargarPDF() {
    if (!window.lastEvalId) {
        alert('Por favor, ejecuta una evaluación primero para generar su reporte.');
        return;
    }
    window.open('/api/reporte/' + window.lastEvalId, '_blank');
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    cargarAplicaciones();
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
        showScreen(hash);
    } else {
        cargarDashboard();
    }

    // Dashboard app filter
    document.getElementById('dashboardAppSelect').addEventListener('change', cargarDashboard);
});
