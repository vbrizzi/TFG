const express = require('express');
const app = express();
const port = 4000;

// Vulnerabilidad a propósito: Falta de helmet o encabezados de seguridad, 
// y expone detalles del servidor en X-Powered-By
app.get('/', (req, res) => {
    res.send('<h1>Bienvenido a la App de Prueba NFR</h1><p>Esta app tiene endpoints lentos y carece de seguridad para ser detectada por ZAP y SonarQube.</p>');
});

// Endpoint lento para k6
app.get('/api/lento', (req, res) => {
    // Simulamos una demora de 800ms para que k6 detecte problemas de rendimiento (p95 > 500ms)
    setTimeout(() => {
        res.json({ data: "Respuesta lenta simulada" });
    }, 800);
});

// Code smell a propósito para SonarQube: función inútil y compleja
function badFunction(a, b) {
    if (a == 1) {
        if (b == 2) {
            console.log("Too many nested ifs");
        }
    }
    var x = "unused variable";
    return a + b;
}

app.listen(port, () => {
    console.log(`Test App listening at http://localhost:${port}`);
});
