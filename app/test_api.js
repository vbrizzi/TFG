const http = require('http');

const appData = JSON.stringify({
  nombre: 'Hello World App',
  repositorio: 'https://github.com/octocat/Hello-World'
});

const reqApp = http.request('http://localhost:3000/api/aplicaciones', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': appData.length
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
      const appCreated = JSON.parse(body);
      console.log('App created:', appCreated);
      
      const evalData = JSON.stringify({
        id_aplicacion: appCreated.id,
        repositoryUrl: 'https://github.com/octocat/Hello-World',
        targetUrl: 'https://example.com',
        projectName: 'hello_world'
      });

      const reqEval = http.request('http://localhost:3000/api/evaluar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': evalData.length
        }
      }, (resEval) => {
        let evalBody = '';
        resEval.on('data', chunk => evalBody += chunk);
        resEval.on('end', () => console.log('Eval Response:', evalBody));
      });
      reqEval.write(evalData);
      reqEval.end();
  });
});

reqApp.on('error', e => console.error('Error:', e));
reqApp.write(appData);
reqApp.end();
