const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 3002;
const SERVER_PATH = path.join(__dirname, '../server2.js');

function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve({ status: res.statusCode, data: result });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function waitForServer(maxRetries = 30, interval = 500) {
  process.stdout.write('等待服务器启动');
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await request('GET', '/api/health');
      if (res.status === 200) {
        console.log(' ✅');
        return true;
      }
    } catch (e) {
    }
    process.stdout.write('.');
    await new Promise(r => setTimeout(r, interval));
  }
  console.log(' ❌ 超时');
  return false;
}

async function runTests() {
  console.log('='.repeat(70));
  console.log('  模具试模问题闭环系统 - Smoke 测试');
  console.log('='.repeat(70));
  console.log();

  console.log('📦 启动服务器...');
  const server = spawn('node', [SERVER_PATH], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PORT: PORT }
  });

  let serverOutput = '';
  server.stdout.on('data', (data) => { serverOutput += data.toString(); });
  server.stderr.on('data', (data) => { serverOutput += data.toString(); });

  const ready = await waitForServer();
  if (!ready) {
    console.log('服务器输出:', serverOutput);
    server.kill();
    process.exit(1);
  }

  let passed = 0;
  let failed = 0;

  function assert(condition, description) {
    if (condition) {
      passed++;
      console.log(`  ✅ ${description}`);
    } else {
      failed++;
      console.log(`  ❌ ${description}`);
    }
  }

  console.log();
  console.log('📋 步骤 1: 创建试模批次');
  console.log('-'.repeat(70));

  const batchRes = await request('POST', '/api/batches', {
    batch_no: 'SMOKE-TEST-001',
    mold_code: 'TEST-MOLD-001',
    mold_name: '测试模具',
    project_name: 'Smoke测试项目',
    trial_date: '2024-01-15',
    trial_params: { temperature: 200, pressure: 100 },
    created_by: 'user_engineer'
  });

  assert(batchRes.status === 200, '批次创建成功 (HTTP 200)');
  assert(batchRes.data.success === true, '返回 success: true');
  const batchId = batchRes.data.data?.id;
  assert(!!batchId, `获得批次ID: ${batchId}`);

  console.log();
  console.log('📋 步骤 2: 登记一个严重问题');
  console.log('-'.repeat(70));

  const defectLevels = await request('GET', '/api/defect-levels');
  assert(defectLevels.status === 200, '获取缺陷等级列表成功');
  
  const severeLevel = defectLevels.data.data?.find(d => d.name === '严重');
  assert(!!severeLevel, '找到"严重"缺陷等级');
  assert(severeLevel.require_retest === 1, '严重等级需要复测');

  const problemRes = await request('POST', '/api/problems', {
    batch_id: batchId,
    title: 'Smoke测试-严重尺寸超差问题',
    description: '这是一个用于测试的严重问题',
    defect_level_id: severeLevel.id,
    photo_urls: ['/test/photo1.jpg'],
    reported_by: 'user_quality'
  });

  assert(problemRes.status === 200, '问题登记成功');
  assert(problemRes.data.data?.status === 'registered', '问题初始状态为"已登记"(registered)');
  const problemId = problemRes.data.data?.id;
  assert(!!problemId, `获得问题ID: ${problemId}`);

  console.log();
  console.log('📋 步骤 3: 派发整改任务');
  console.log('-'.repeat(70));

  const assignRes = await request('PUT', `/api/problems/${problemId}/assign`, {
    responsible_person_id: 'user_resp',
    deadline: '2024-12-31',
    operator_id: 'user_quality'
  });

  assert(assignRes.status === 200, '整改派发成功');
  assert(assignRes.data.data?.status === 'assigned', '派发后状态变为"已派发"(assigned)');

  console.log();
  console.log('📋 步骤 4: 开始整改并提交整改措施');
  console.log('-'.repeat(70));

  await request('PUT', `/api/problems/${problemId}/start-rectify`, {
    operator_id: 'user_resp'
  });

  const measureRes = await request('POST', `/api/problems/${problemId}/measures`, {
    measure_text: '1. 调整模具尺寸；2. 优化工艺参数',
    submitted_by: 'user_resp'
  });

  assert(measureRes.status === 200, '整改措施提交成功');

  const problemAfterRectify = await request('GET', `/api/problems/${problemId}`);
  assert(problemAfterRectify.data.data?.status === 'rectified', '提交措施后状态变为"已整改"(rectified)');

  console.log();
  console.log('📋 步骤 5: 验证：未复测的严重问题不能关闭');
  console.log('-'.repeat(70));

  const canCloseRes = await request('GET', `/api/problems/${problemId}/can-close`);
  assert(canCloseRes.data.data?.allowed === false, '关闭检查返回不允许(allowed: false)');
  assert(canCloseRes.data.data?.reason?.includes('必须复测通过'), '提示原因包含"必须复测通过"');

  const closeRes = await request('PUT', `/api/problems/${problemId}/close`, {
    approver_id: 'user_approver',
    remark: '尝试直接关闭'
  });

  assert(closeRes.status === 400, '直接关闭接口被拒绝 (HTTP 400)');
  assert(closeRes.data.success === false, '关闭接口返回 success: false');
  assert(closeRes.data.message?.includes('必须复测通过'), '错误信息包含"必须复测通过"');
  console.log(`     ℹ️  拒绝原因: ${closeRes.data.message}`);

  console.log();
  console.log('📋 步骤 6: 提交复测失败，验证状态退回整改中');
  console.log('-'.repeat(70));

  const retestFailRes = await request('POST', `/api/problems/${problemId}/retest`, {
    result: 'failed',
    remark: '复测不通过，尺寸仍超差',
    photo_urls: ['/test/retest-fail.jpg'],
    tested_by: 'user_retest'
  });

  assert(retestFailRes.status === 200, '复测提交成功');
  assert(retestFailRes.data.message?.includes('复测失败'), '返回"复测失败"提示');

  const problemAfterRetest = await request('GET', `/api/problems/${problemId}`);
  assert(problemAfterRetest.data.data?.status === 'rectifying', '复测失败后状态退回到"整改中"(rectifying)');
  console.log(`     ℹ️  当前状态: ${problemAfterRetest.data.data?.status}`);

  console.log();
  console.log('📋 步骤 7: 验证：存在未关闭严重问题时不能发布试模通过');
  console.log('-'.repeat(70));

  const passBatchRes = await request('POST', `/api/batches/${batchId}/conclusion`, {
    conclusion: 'passed',
    operator_id: 'user_engineer'
  });

  assert(passBatchRes.status === 400, '发布试模通过被拒绝 (HTTP 400)');
  assert(passBatchRes.data.message?.includes('存在未关闭的严重问题'), '提示包含"存在未关闭的严重问题"');
  console.log(`     ℹ️  拒绝原因: ${passBatchRes.data.message}`);

  console.log();
  console.log('='.repeat(70));
  console.log('  测试结果汇总');
  console.log('='.repeat(70));
  console.log(`  通过: ${passed} 项`);
  console.log(`  失败: ${failed} 项`);
  console.log();

  server.kill();

  if (failed === 0) {
    console.log('🎉 所有测试通过！');
    console.log();
    console.log('✅ 验证的业务规则:');
    console.log('   1. 严重问题必须复测通过才能关闭');
    console.log('   2. 复测失败后自动退回整改中');
    console.log('   3. 存在未关闭严重问题时不能发布试模通过结论');
    process.exit(0);
  } else {
    console.log('❌ 部分测试失败');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('测试执行出错:', err);
  process.exit(1);
});
