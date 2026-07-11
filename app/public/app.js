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
let chartEvolucion = null;
let chartRadar = null, chartComparacion = null;
let editingAppId = null;

// ===== APLICACIONES =====
async function cargarAplicaciones() {
    try {
        const res = await fetch('/api/aplicaciones');
        aplicaciones = await res.json();
        actualizarDropdowns();
        renderAppsRegistradas();
    } catch (e) {
        console.error('Error cargando aplicaciones:', e);
    }
}

function renderAppsRegistradas() {
    const tbody = document.getElementById('appsRegistradasBody');
    if (!tbody) return;
    if (!aplicaciones || aplicaciones.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#999;">No hay aplicaciones registradas aún.</td></tr>';
        return;
    }
    tbody.innerHTML = aplicaciones.map(app => {
        const repo = app.repositorio
            ? `<a href="${app.repositorio}" target="_blank" style="color:#6c63ff;font-size:12px;">${app.repositorio.replace('https://github.com/','')}</a>`
            : '<span style="color:#666;">—</span>';
        const url = app.url_objetivo
            ? `<a href="${app.url_objetivo}" target="_blank" style="color:#6c63ff;font-size:12px;">${app.url_objetivo}</a>`
            : '<span style="color:#666;">—</span>';
        return `<tr>
            <td style="color:#888;">${app.id}</td>
            <td><strong>${app.nombre}</strong></td>
            <td style="font-size:12px;color:#aaa;">${app.descripcion || '—'}</td>
            <td>${url}</td>
            <td>${repo}</td>
            <td>
                <button class="btn-link" style="color:#1976d2; margin-right: 8px;" onclick="editarAplicacion(${app.id})"><i class="fas fa-edit"></i> Editar</button>
                <button class="btn-link" style="color:#f44336;" onclick="eliminarAplicacion(${app.id}, '${app.nombre.replace(/'/g, "&apos;")}')"><i class="fas fa-trash"></i> Eliminar</button>
            </td>
        </tr>`;
    }).join('');
}

async function editarAplicacion(id) {
    const app = aplicaciones.find(a => a.id === id);
    if (!app) return;
    document.getElementById('regAppName').value = app.nombre;
    document.getElementById('regAppDesc').value = app.descripcion || '';
    document.getElementById('regAppUrl').value = app.url_objetivo || '';
    document.getElementById('regAppRepo').value = app.repositorio || '';
    editingAppId = id;
    const btn = document.getElementById('appPrimaryBtn');
    if (btn) {
        btn.innerHTML = '<i class="fas fa-save"></i> Actualizar Aplicación';
        btn.onclick = actualizarAplicacion;
    }
}

async function actualizarAplicacion() {
    if (!editingAppId) return;
    const payload = {
        nombre: document.getElementById('regAppName').value,
        descripcion: document.getElementById('regAppDesc').value,
        url_objetivo: document.getElementById('regAppUrl').value,
        repositorio: document.getElementById('regAppRepo').value
    };
    try {
        const res = await fetch(`/api/aplicaciones/${editingAppId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) { alert('Error: ' + data.error); return; }
        
        // Reset form
        document.getElementById('regAppName').value = '';
        document.getElementById('regAppDesc').value = '';
        document.getElementById('regAppUrl').value = '';
        document.getElementById('regAppRepo').value = '';
        editingAppId = null;
        
        const btn = document.getElementById('appPrimaryBtn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-save"></i> Registrar Aplicación';
            btn.onclick = registrarAplicacion;
        }
        await cargarAplicaciones();
    } catch (e) {
        alert('Error al actualizar: ' + e.message);
    }
}

async function eliminarAplicacion(id, nombre) {
    if (!confirm(`¿Eliminás la aplicación "${nombre}"? Esto no borra las evaluaciones asociadas.`)) return;
    try {
        const res = await fetch(`/api/aplicaciones/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) { alert('Error: ' + data.error); return; }
        await cargarAplicaciones();
    } catch (e) {
        alert('Error al eliminar: ' + e.message);
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
        actualizarEstadoConfiguracion(true);
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
    const containerEvol = document.getElementById('chartEvolucion').parentNode;
    const containerCats = document.getElementById('chartCategorias');
    
    // Si no hay app seleccionada (vista global)
    if (!appId) {
        if (chartEvolucion) { chartEvolucion.destroy(); chartEvolucion = null; }
        
        // Placeholder Evolución
        const canvasEvol = document.getElementById('chartEvolucion');
        if (canvasEvol) canvasEvol.style.display = 'none';
        let emptyStateEvol = document.getElementById('emptyStateEvol');
        if (!emptyStateEvol) {
            emptyStateEvol = document.createElement('div');
            emptyStateEvol.id = 'emptyStateEvol';
            emptyStateEvol.className = 'empty-state-container';
            emptyStateEvol.innerHTML = '<i class="fas fa-hand-pointer" style="font-size:30px;color:#ccc;margin-bottom:10px;"></i><br><span style="color:#888;">Seleccioná una aplicación para ver su evolución</span>';
            emptyStateEvol.style.textAlign = 'center';
            emptyStateEvol.style.padding = '40px 20px';
            containerEvol.appendChild(emptyStateEvol);
        } else {
            emptyStateEvol.style.display = 'block';
        }
        
        // Placeholder Categorías
        containerCats.innerHTML = '<div style="text-align:center;padding:40px 20px;"><i class="fas fa-hand-pointer" style="font-size:30px;color:#ccc;margin-bottom:10px;"></i><br><span style="color:#888;">Seleccioná una aplicación para ver el detalle</span></div>';
        return;
    }

    // Si hay app seleccionada, ocultar empty state y mostrar canvas
    const emptyStateEvol = document.getElementById('emptyStateEvol');
    if (emptyStateEvol) emptyStateEvol.style.display = 'none';
    const canvasEvol = document.getElementById('chartEvolucion');
    if (canvasEvol) canvasEvol.style.display = 'block';

    let evals = [];
    const res = await fetch(`/api/evaluaciones/${appId}`);
    evals = await res.json();
    evals = evals.filter(e => e.estado === 'FINALIZADA' && e.puntaje_global !== null).reverse();

    if (chartEvolucion) { chartEvolucion.destroy(); chartEvolucion = null; }

    const ctx1 = canvasEvol.getContext('2d');

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

        // Barras de progreso con últimos scores
        const last = evals[evals.length - 1];
        containerCats.innerHTML = `
            <div class="score-bar-item" style="margin-bottom:15px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:14px;font-weight:bold;">
                    <span style="color:#4caf50;"><i class="fas fa-code"></i> Mantenibilidad</span>
                    <span>${last.puntaje_mantenibilidad || 0}/100</span>
                </div>
                <div style="width:100%;background:#eee;border-radius:10px;height:12px;overflow:hidden;">
                    <div style="width:${last.puntaje_mantenibilidad || 0}%;background:#4caf50;height:100%;transition:width 0.5s ease;"></div>
                </div>
            </div>
            <div class="score-bar-item" style="margin-bottom:15px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:14px;font-weight:bold;">
                    <span style="color:#ff9800;"><i class="fas fa-shield-alt"></i> Seguridad</span>
                    <span>${last.puntaje_seguridad || 0}/100</span>
                </div>
                <div style="width:100%;background:#eee;border-radius:10px;height:12px;overflow:hidden;">
                    <div style="width:${last.puntaje_seguridad || 0}%;background:#ff9800;height:100%;transition:width 0.5s ease;"></div>
                </div>
            </div>
            <div class="score-bar-item">
                <div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:14px;font-weight:bold;">
                    <span style="color:#2196f3;"><i class="fas fa-tachometer-alt"></i> Rendimiento</span>
                    <span>${last.puntaje_rendimiento || 0}/100</span>
                </div>
                <div style="width:100%;background:#eee;border-radius:10px;height:12px;overflow:hidden;">
                    <div style="width:${last.puntaje_rendimiento || 0}%;background:#2196f3;height:100%;transition:width 0.5s ease;"></div>
                </div>
            </div>
        `;
    } else {
        chartEvolucion = new Chart(ctx1, { type: 'line', data: { labels: ['Sin datos'], datasets: [{ data: [0] }] }, options: { responsive: true } });
        containerCats.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#888;">Esta aplicación no tiene evaluaciones con scores todavía.</div>';
    }
}

// ===== CONFIGURACIÓN (RF02, RF03, RF04) =====
function actualizarEstadoConfiguracion(fromDropdown = false) {
    const appId = document.getElementById('configAppSelect').value;
    const statusDiv = document.getElementById('configStatus');
    const targetUrl = document.getElementById('targetUrlInput');
    const repoUrl = document.getElementById('repoUrlInput');
    const catSonar = document.getElementById('catSonar');
    const catZap = document.getElementById('catZap');
    const catK6 = document.getElementById('catK6');
    const btnGuardar = document.getElementById('btnGuardarConfig');

    if (!statusDiv) return;

    if (!appId) {
        statusDiv.innerHTML = '<i class="fas fa-info-circle"></i> Seleccione una aplicación para configurar.';
        statusDiv.style.color = '#666';
        if (targetUrl) { targetUrl.value = ''; targetUrl.disabled = true; }
        if (repoUrl) { repoUrl.value = ''; repoUrl.disabled = true; }
        if (catSonar) { catSonar.checked = false; catSonar.disabled = true; }
        if (catZap) { catZap.checked = false; catZap.disabled = true; }
        if (catK6) { catK6.checked = false; catK6.disabled = true; }
        if (btnGuardar) btnGuardar.disabled = true;
        return;
    } else {
        if (targetUrl) targetUrl.disabled = false;
        if (repoUrl) repoUrl.disabled = false;
        if (btnGuardar) btnGuardar.disabled = false;
    }

    const app = aplicaciones.find(a => a.id == appId);
    if (app && fromDropdown === true) {
        if (targetUrl) targetUrl.value = app.url_objetivo || '';
        if (repoUrl) repoUrl.value = app.repositorio || '';
    }

    const currentUrl = targetUrl ? targetUrl.value.trim() : '';
    const currentRepo = repoUrl ? repoUrl.value.trim() : '';

    let warnings = [];
    
    if (catSonar) {
        catSonar.disabled = !currentRepo;
        if (!currentRepo) { catSonar.checked = false; warnings.push('Falta Repositorio (para SonarQube).'); }
        else if (fromDropdown) catSonar.checked = true; // Auto check if valid when selecting
    }
    
    if (catZap) {
        catZap.disabled = !currentUrl;
        if (!currentUrl) { catZap.checked = false; warnings.push('Falta URL (para ZAP y k6).'); }
        else if (fromDropdown) catZap.checked = true;
    }
    
    if (catK6) {
        catK6.disabled = !currentUrl;
        if (!currentUrl) { catK6.checked = false; }
        else if (fromDropdown) catK6.checked = true;
    }

    if (warnings.length > 0) {
        statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ' + warnings.join(' ');
        statusDiv.style.color = '#c62828';
    } else {
        statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> Listo para ejecutar.';
        statusDiv.style.color = '#2e7d32';
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
        if (execSel) {
            execSel.value = appId;
            await cargarConfigParaEjecucion();
        }
        showScreen('ejecucion');
    } catch (e) {
        alert('Error al guardar configuración: ' + e.message);
    }
}

// ===== EJECUCIÓN (RF05, RF10) =====

async function cargarConfigParaEjecucion() {
    const appId = document.getElementById('execAppSelect').value;
    const runSonar = document.getElementById('runSonar');
    const runZap = document.getElementById('runZap');
    const runK6 = document.getElementById('runK6');
    const btn = document.getElementById('btnEjecutar');

    if (!appId) {
        if (runSonar) { runSonar.checked = false; runSonar.disabled = true; }
        if (runZap) { runZap.checked = false; runZap.disabled = true; }
        if (runK6) { runK6.checked = false; runK6.disabled = true; }
        if (btn) btn.disabled = true;
        return;
    }

    try {
        const res = await fetch(`/api/configuraciones/${appId}`);
        const configs = await res.json();
        
        if (runSonar) { runSonar.checked = false; runSonar.disabled = true; }
        if (runZap) { runZap.checked = false; runZap.disabled = true; }
        if (runK6) { runK6.checked = false; runK6.disabled = true; }
        if (btn) btn.disabled = true;

        if (configs && configs.length > 0) {
            const config = configs[0]; // La más reciente
            const cats = JSON.parse(config.categorias || '[]');
            
            if (cats.includes('MANTENIBILIDAD') && runSonar) { runSonar.checked = true; runSonar.disabled = false; }
            if (cats.includes('SEGURIDAD') && runZap) { runZap.checked = true; runZap.disabled = false; }
            if (cats.includes('RENDIMIENTO') && runK6) { runK6.checked = true; runK6.disabled = false; }
            
            if (cats.length > 0 && btn) btn.disabled = false;
        } else {
            alert('Esta aplicación no tiene configuraciones previas. Por favor, configúrela primero.');
        }
    } catch (e) {
        console.error('Error cargando configuración:', e);
    }
}

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

// ===== TOGGLE LOG PANEL =====
function toggleLogPanel(tool) {
    const key = tool.charAt(0).toUpperCase() + tool.slice(1);
    const logArea = document.getElementById('log' + key);
    const chevron = document.getElementById('chevron-' + tool);
    if (!logArea) return;
    const isHidden = logArea.style.display === 'none';
    logArea.style.display = isHidden ? 'block' : 'none';
    if (chevron) chevron.classList.toggle('collapsed', !isHidden);
}

// ===== EJECUCION REAL CON LOGS EN TIEMPO REAL =====
async function simularEjecucion() {
    const appId = document.getElementById('execAppSelect').value;
    if (!appId) { alert('Por favor seleccione una aplicacion para evaluar.'); return; }
    const app = aplicaciones.find(a => a.id == appId);

    const runSonar = document.getElementById('runSonar').checked;
    const runZap   = document.getElementById('runZap').checked;
    const runK6    = document.getElementById('runK6').checked;

    if (!runSonar && !runZap && !runK6) { alert('Debe seleccionar al menos una herramienta.'); return; }

    const btn = document.getElementById('btnEjecutar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ejecutando...';
    btn.style.background = '#555';

    setToolCardState('sonar', runSonar ? 'pending' : 'skipped');
    setToolCardState('zap',   runZap   ? 'pending' : 'skipped');
    setToolCardState('k6',    runK6    ? 'pending' : 'skipped');

    // Mostrar paneles de log
    document.getElementById('logs-container').style.display = 'block';
    ['sonar', 'zap', 'k6'].forEach(tool => {
        const selected = (tool === 'sonar' ? runSonar : tool === 'zap' ? runZap : runK6);
        document.getElementById('log-panel-' + tool).style.display = selected ? 'block' : 'none';
        const key = tool.charAt(0).toUpperCase() + tool.slice(1);
        const logEl = document.getElementById('log' + key);
        if (logEl) logEl.textContent = '';
    });

    let evalId = null;
    let pollInterval = null;
    const sseConnections = [];

    const appendLog = (tool, line) => {
        const key = tool.charAt(0).toUpperCase() + tool.slice(1);
        const logEl = document.getElementById('log' + key);
        if (!logEl) return;
        logEl.textContent += line + '\n';
        logEl.scrollTop = logEl.scrollHeight;
    };

    const subscribeSSE = (tool) => {
        const sse = new EventSource('/api/evaluar/logs/' + evalId + '/' + tool);
        sse.onmessage = (e) => {
            try {
                const data = JSON.parse(e.data);
                if (data.log) appendLog(tool, data.log);
            } catch(err) {}
        };
        sse.onerror = () => sse.close();
        sseConnections.push(sse);
    };

    const startPolling = () => {
        pollInterval = setInterval(async () => {
            if (!evalId) return;
            try {
                const r = await fetch('/api/evaluar/progreso/' + evalId);
                const data = await r.json();
                const p = data.progreso || {};
                if (runSonar) setToolCardState('sonar', p.sonar || 'pending');
                if (runZap)   setToolCardState('zap',   p.zap   || 'pending');
                if (runK6)    setToolCardState('k6',    p.k6    || 'pending');
                if (data.estado === 'FINALIZADA' || data.estado === 'ERROR') {
                    clearInterval(pollInterval);
                }
            } catch(e) {}
        }, 1500);
    };

    try {
        // POST /api/evaluar ahora responde INMEDIATAMENTE con el evalId
        const evalRes = await fetch('/api/evaluar', {
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
        const evalData = await evalRes.json();
        if (evalData.error) throw new Error(evalData.error);

        evalId = evalData.id_evaluacion;

        // Suscribirse al SSE de cada herramienta activa AHORA que tenemos el evalId
        if (runSonar) subscribeSSE('sonar');
        if (runZap)   subscribeSSE('zap');
        if (runK6)    subscribeSSE('k6');

        // Arrancar polling de tarjetas
        startPolling();

        // Esperar que la evaluación finalice (polling hasta FINALIZADA o ERROR)
        await new Promise((resolve) => {
            const checkDone = setInterval(async () => {
                try {
                    const r = await fetch('/api/evaluar/progreso/' + evalId);
                    const d = await r.json();
                    if (d.estado === 'FINALIZADA' || d.estado === 'ERROR') {
                        clearInterval(checkDone);
                        resolve(d);
                    }
                } catch(e) {}
            }, 2000);
        });

        clearInterval(pollInterval);
        sseConnections.forEach(s => s.close());

        // Obtener el score final desde la BD
        const finalRes = await fetch('/api/evaluar/progreso/' + evalId);
        // El score real llega por SSE en los logs, pero también actualizamos tarjetas
        if (runSonar) setToolCardState('sonar', 'done');
        if (runZap)   setToolCardState('zap',   'done');
        if (runK6)    setToolCardState('k6',    'done');

        window.lastEvalId = evalId;
        btn.innerHTML = '<i class="fas fa-check"></i> Evaluacion Completada!';
        btn.style.background = '#4caf50';

    } catch (e) {
        clearInterval(pollInterval);
        sseConnections.forEach(s => s.close());
        if (runSonar) { appendLog('sonar', 'ERROR: ' + e.message); setToolCardState('sonar', 'error'); }
        if (runZap)   { appendLog('zap',   'ERROR: ' + e.message); setToolCardState('zap',   'error'); }
        if (runK6)    { appendLog('k6',    'ERROR: ' + e.message); setToolCardState('k6',    'error'); }
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error en evaluacion';
        btn.style.background = '#f44336';
    }

    setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-play"></i> Ejecutar Evaluacion';
        btn.style.background = '';
    }, 5000);
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

// Estado del comparador de evaluaciones
const comparacionDatasets = new Map(); // evalId → { label, data, color }
const COMPARACION_COLORS = [
    '#6c63ff', '#ff6584', '#43cfbc', '#ffb347', '#4fc3f7',
    '#a29bfe', '#fd79a8', '#00b894', '#fdcb6e', '#74b9ff'
];

function actualizarGraficosResultados(data) {
    const score = data.score || {};

    // ── Gráfico Radar — ahora lo maneja renderizarComparacion() ───────────────
    if (chartRadar) { chartRadar.destroy(); chartRadar = null; }

    // ── Gráfico de comparación ─────────────────────────────────────────────
    // Agregar la evaluación actual automáticamente al comparador
    const evalId   = data.evaluacion.id;
    const evalData = {
        label: `Eval #${evalId}`,
        data:  [score.puntaje_mantenibilidad || 0, score.puntaje_seguridad || 0, score.puntaje_rendimiento || 0],
        color: COMPARACION_COLORS[0]
    };
    comparacionDatasets.clear(); // limpiar al cambiar de evaluación activa
    comparacionDatasets.set(evalId, evalData);

    // Cargar historial completo de la app para poblar el selector
    const appId = data.evaluacion.id_aplicacion;
    poblarSelectorComparacion(appId, evalId).then(() => {
        // Auto-cargar la evaluación anterior si existe
        autoCargarEvalAnterior(appId, evalId);
    });

    renderizarComparacion();
}

async function poblarSelectorComparacion(appId, evalActualId) {
    try {
        const res  = await fetch('/api/evaluaciones/' + appId);
        const evals = await res.json();
        const sel  = document.getElementById('comparacionEvalAdd');

        // Guardar todas las evaluaciones en data attribute del select para uso posterior
        sel._allEvals = evals;

        // Poblar opciones (excluir la activa)
        sel.innerHTML = '<option value="">+ Agregar evaluación…</option>';
        for (const ev of evals) {
            if (ev.id === evalActualId) continue;
            const scoreGlobal = ev.puntaje_global !== null ? ` — Score ${ev.puntaje_global}` : '';
            const fecha = new Date(ev.fecha).toLocaleDateString('es-AR');
            const opt = document.createElement('option');
            opt.value = ev.id;
            opt.textContent = `Eval #${ev.id} — ${fecha}${scoreGlobal} (${ev.estado})`;
            sel.appendChild(opt);
        }

        // Listener del selector
        sel.onchange = async () => {
            const id = parseInt(sel.value);
            if (!id) return;
            sel.value = '';
            if (comparacionDatasets.has(id)) return; // ya está en el gráfico
            await agregarEvalAlComparador(id);
        };
    } catch (e) {
        console.error('Error cargando historial para comparador:', e);
    }
}

async function autoCargarEvalAnterior(appId, evalActualId) {
    const sel = document.getElementById('comparacionEvalAdd');
    const evals = sel._allEvals || [];
    // La eval anterior es la primera de la lista que no sea la actual y esté FINALIZADA
    const anterior = evals.find(ev => ev.id !== evalActualId && ev.estado === 'FINALIZADA');
    if (anterior) {
        await agregarEvalAlComparador(anterior.id);
    }
}

async function agregarEvalAlComparador(evalId) {
    try {
        const res  = await fetch(`/api/evaluaciones/${evalId}/detalle`);
        const data = await res.json();
        const score = data.score || {};

        // Asignar color secuencial
        const colorIdx = comparacionDatasets.size % COMPARACION_COLORS.length;

        comparacionDatasets.set(evalId, {
            label: `Eval #${evalId} (${new Date(data.evaluacion.fecha).toLocaleDateString('es-AR')})`,
            data:  [score.puntaje_mantenibilidad || 0, score.puntaje_seguridad || 0, score.puntaje_rendimiento || 0],
            color: COMPARACION_COLORS[colorIdx]
        });

        renderizarComparacion();
    } catch (e) {
        console.error('Error cargando evaluación para comparador:', e);
    }
}

function eliminarEvalDelComparador(evalId) {
    // No permitir eliminar si solo queda 1 dataset
    if (comparacionDatasets.size <= 1) return;
    comparacionDatasets.delete(evalId);
    renderizarComparacion();
}

function renderizarComparacion() {
    // ── Pills ──────────────────────────────────────────────────────────────
    const pillsContainer = document.getElementById('comparacionPills');
    pillsContainer.innerHTML = '';

    for (const [id, ds] of comparacionDatasets) {
        const pill = document.createElement('span');
        pill.style.cssText = `
            display:inline-flex; align-items:center; gap:5px;
            background:${ds.color}22; border:1px solid ${ds.color};
            color:${ds.color}; border-radius:20px;
            padding:2px 10px; font-size:0.8rem; cursor:default;
        `;
        pill.innerHTML = `
            <span style="width:8px;height:8px;border-radius:50%;background:${ds.color};display:inline-block;"></span>
            ${ds.label}
            <span onclick="eliminarEvalDelComparador(${id})" style="cursor:pointer; font-weight:bold; margin-left:2px; opacity:0.7;" title="Quitar">✕</span>
        `;
        pillsContainer.appendChild(pill);
    }

    // ── Chart ──────────────────────────────────────────────────────────────
    if (chartComparacion) { chartComparacion.destroy(); chartComparacion = null; }

    const ctx4 = document.getElementById('chartComparacion').getContext('2d');
    const datasets = [];
    for (const [, ds] of comparacionDatasets) {
        datasets.push({
            label: ds.label,
            data:  ds.data,
            backgroundColor: ds.color + 'cc',
            borderColor: ds.color,
            borderWidth: 1,
            borderRadius: 4
        });
    }

    chartComparacion = new Chart(ctx4, {
        type: 'bar',
        data: {
            labels: ['Mantenibilidad', 'Seguridad', 'Rendimiento'],
            datasets
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}/100`
                    }
                }
            },
            scales: {
                y: { min: 0, max: 100, ticks: { stepSize: 20 } },
                x: { grid: { display: false } }
            }
        }
    });

    // ── Radar Chart ────────────────────────────────────────────────────────
    if (chartRadar) { chartRadar.destroy(); chartRadar = null; }
    
    const ctxRadar = document.getElementById('chartRadar').getContext('2d');
    const radarDatasets = [];
    for (const [, ds] of comparacionDatasets) {
        radarDatasets.push({
            label: ds.label,
            data:  ds.data,
            backgroundColor: ds.color + '33',
            borderColor: ds.color,
            borderWidth: 2,
            pointBackgroundColor: ds.color
        });
    }

    chartRadar = new Chart(ctxRadar, {
        type: 'radar',
        data: {
            labels: ['Mantenibilidad', 'Seguridad', 'Rendimiento'],
            datasets: radarDatasets
        },
        options: {
            responsive: true,
            scales: { r: { min: 0, max: 100, ticks: { stepSize: 20 } } },
            plugins: { legend: { position: 'bottom' } }
        }
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

    // Hallazgos en el Reporte
    const hallBody = document.getElementById('repHallazgosBody');
    if (data.hallazgos && data.hallazgos.length > 0) {
        hallBody.innerHTML = data.hallazgos.map(h => {
            const sevBadge = h.severidad === 'ALTO' ? 'badge-danger' : h.severidad === 'MEDIO' ? 'badge-warning' : h.severidad === 'BAJO' ? 'badge-info' : 'badge-pending';
            return `<tr><td>${h.categoria_calidad || h.categoria}</td><td>${h.descripcion}</td><td><span class="badge ${sevBadge}">${h.severidad}</span></td><td>${h.herramienta_utilizada || '—'}</td></tr>`;
        }).join('');
    } else {
        hallBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#999;">No se detectaron hallazgos.</td></tr>';
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
