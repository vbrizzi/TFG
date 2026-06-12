const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');

// Eliminar las insignias de CU
html = html.replace(/<span class="cu-badge">.*?<\/span>\s*/g, '');

// Arreglar el botón imprimir
html = html.replace(
    '<button class="btn btn-secondary"><i class="fas fa-print"></i> Imprimir</button>',
    '<button class="btn btn-secondary" onclick="window.print()"><i class="fas fa-print"></i> Imprimir</button>'
);

fs.writeFileSync('index.html', html);
console.log('UI limpiada.');
