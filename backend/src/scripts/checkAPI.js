const http = require('http');

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3002,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function checkAPI() {
  console.log('检查 API 返回格式...');
  console.log();

  const levels = await request('GET', '/api/defect-levels');
  console.log('GET /api/defect-levels:');
  console.log(JSON.stringify(levels.data, null, 2));
  console.log();

  const users = await request('GET', '/api/users');
  console.log('GET /api/users:');
  console.log(JSON.stringify(users.data, null, 2));
  console.log();

  const batch = await request('POST', '/api/batches', {
    batch_no: 'TEST-001',
    mold_code: 'MOLD-001',
    mold_name: '测试模具',
    project_name: '测试项目',
    trial_date: '2024-01-15',
    created_by: 'user_engineer'
  });
  console.log('POST /api/batches:');
  console.log(JSON.stringify(batch.data, null, 2));
}

checkAPI().catch(console.error);
