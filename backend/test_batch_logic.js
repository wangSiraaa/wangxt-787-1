const db = require('./src/db/database');
const { canPassBatch, hasUnclosedCriticalProblems, PROBLEM_STATUS } = require('./src/services/businessRules');
const { generateId } = require('./src/utils/helpers');

console.log('=== 测试批次发布通过拦截逻辑 ===\n');

// 1. 创建测试批次
const batchId = generateId('batch_test_');
db.prepare(`
  INSERT INTO mold_batches (id, batch_no, mold_code, mold_name, project_name, trial_date, trial_params, created_by, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(batchId, 'TEST-BATCH-001', 'MOLD-001', '测试模具', '测试项目', '2024-01-01', '{}', 'user_test', 'processing');
console.log('✅ 创建测试批次:', batchId);

// 2. 获取严重缺陷等级ID
const criticalLevel = db.prepare("SELECT id FROM defect_levels WHERE name = '严重'").get();
console.log('✅ 严重缺陷等级ID:', criticalLevel?.id);

// 3. 测试1：没有问题时，应该可以通过
console.log('\n--- 测试1：批次无问题 ---');
const check1 = canPassBatch(batchId);
console.log('canPassBatch 返回:', check1);
console.log('预期: allowed=true, 实际: allowed=' + check1.allowed);
console.log(check1.allowed ? '✅ 通过' : '❌ 失败');

// 4. 创建一个严重问题（未关闭）
const problemId = generateId('prob_test_');
db.prepare(`
  INSERT INTO problems (id, batch_id, title, description, defect_level_id, status, reported_by)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(problemId, batchId, '测试严重问题', '测试描述', criticalLevel.id, PROBLEM_STATUS.REGISTERED, 'user_test');
console.log('\n✅ 创建严重问题:', problemId, '状态:', PROBLEM_STATUS.REGISTERED);

// 5. 测试2：有未关闭的严重问题时，应该不能通过
console.log('\n--- 测试2：批次有未关闭的严重问题 ---');
const check2 = canPassBatch(batchId);
console.log('canPassBatch 返回:', check2);
console.log('预期: allowed=false, 实际: allowed=' + check2.allowed);
console.log(!check2.allowed ? '✅ 通过' : '❌ 失败');

// 6. 测试 hasUnclosedCriticalProblems 函数
console.log('\n--- 测试 hasUnclosedCriticalProblems 函数 ---');
const hasUnclosed = hasUnclosedCriticalProblems(batchId);
console.log('hasUnclosedCriticalProblems 返回:', hasUnclosed);
console.log(hasUnclosed ? '✅ 正确检测到未关闭的严重问题' : '❌ 未检测到未关闭的严重问题');

// 7. 关闭问题后再测试
console.log('\n--- 测试3：关闭严重问题后 ---');
db.prepare('UPDATE problems SET status = ? WHERE id = ?').run(PROBLEM_STATUS.CLOSED, problemId);
console.log('✅ 问题状态已改为:', PROBLEM_STATUS.CLOSED);

const check3 = canPassBatch(batchId);
console.log('canPassBatch 返回:', check3);
console.log('预期: allowed=true, 实际: allowed=' + check3.allowed);
console.log(check3.allowed ? '✅ 通过' : '❌ 失败');

// 清理测试数据
console.log('\n=== 清理测试数据 ===');
db.prepare('DELETE FROM problems WHERE batch_id = ?').run(batchId);
db.prepare('DELETE FROM mold_batches WHERE id = ?').run(batchId);
console.log('✅ 测试数据已清理');

console.log('\n=== 测试完成 ===');
