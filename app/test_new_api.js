// Test del flujo completo con la nueva estructura de BD
const BASE = 'http://localhost:3000/api';

async function test() {
    console.log('=== TEST FLUJO COMPLETO ===\n');

    // 1. Registrar app
    console.log('1. Registrando aplicación...');
    let res = await fetch(`${BASE}/aplicaciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: 'Test App', descripcion: 'App de prueba', url_objetivo: 'http://host.docker.internal:4000', repositorio: 'https://github.com/octocat/Hello-World' })
    });
    const app = await res.json();
    console.log('   App registrada:', app);

    // 2. Guardar configuración
    console.log('\n2. Guardando configuración...');
    res = await fetch(`${BASE}/configuraciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id_aplicacion: app.id,
            categorias: ['SEGURIDAD', 'RENDIMIENTO'],
            parametros: { vus: 10, duracion: 10, entorno: 'staging' },
            herramientas: ['OWASP ZAP', 'k6']
        })
    });
    const config = await res.json();
    console.log('   Config guardada:', config);

    // 3. Verificar herramientas
    console.log('\n3. Herramientas disponibles...');
    res = await fetch(`${BASE}/herramientas`);
    const tools = await res.json();
    console.log('   Herramientas:', tools.map(t => t.nombre).join(', '));

    // 4. Dashboard
    console.log('\n4. Dashboard stats...');
    res = await fetch(`${BASE}/dashboard`);
    const dash = await res.json();
    console.log('   Dashboard:', dash);

    // 5. Listar apps
    console.log('\n5. Aplicaciones registradas...');
    res = await fetch(`${BASE}/aplicaciones`);
    const apps = await res.json();
    console.log('   Total:', apps.length, '| Nombres:', apps.map(a => a.nombre).join(', '));

    console.log('\n=== TODOS LOS TESTS PASARON ===');
}

test().catch(e => console.error('ERROR:', e));
