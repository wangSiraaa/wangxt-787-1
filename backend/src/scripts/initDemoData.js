const db = require('../db/database');
const { generateId } = require('../utils/helpers');
const { PROBLEM_STATUS } = require('../services/businessRules');

function initDemoData() {
  console.log('开始创建演示数据...');

  const batchId = generateId('batch_');
  db.prepare(`
    INSERT INTO mold_batches (id, batch_no, mold_code, mold_name, project_name, trial_date, trial_params, created_by, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing')
  `).run(
    batchId, 'SM-2024-001', 'M-001', '注塑模具A', '汽车内饰件项目',
    '2024-01-15',
    JSON.stringify({ temperature: 220, pressure: 150, cycleTime: 45, material: 'PP' }),
    'user_engineer'
  );

  const criticalLevel = db.prepare("SELECT id FROM defect_levels WHERE name = '严重'").get();
  const majorLevel = db.prepare("SELECT id FROM defect_levels WHERE name = '重要'").get();

  const problemId1 = generateId('prob_');
  db.prepare(`
    INSERT INTO problems (id, batch_id, title, description, defect_level_id, photo_urls, reported_by, responsible_person_id, status, deadline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    problemId1, batchId,
    '关键尺寸超差',
    '产品内孔直径尺寸超出公差范围，实测Φ20.2mm，要求Φ20.0±0.05mm',
    criticalLevel.id,
    JSON.stringify(['/uploads/photo1.jpg', '/uploads/photo2.jpg']),
    'user_quality',
    'user_resp',
    PROBLEM_STATUS.RECTIFIED,
    '2024-01-20'
  );

  const problemId2 = generateId('prob_');
  db.prepare(`
    INSERT INTO problems (id, batch_id, title, description, defect_level_id, photo_urls, reported_by, responsible_person_id, status, deadline)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    problemId2, batchId,
    '表面有流痕',
    '产品表面可见明显流痕，影响外观质量',
    majorLevel.id,
    JSON.stringify(['/uploads/photo3.jpg']),
    'user_quality',
    'user_resp',
    PROBLEM_STATUS.RECTIFYING,
    '2024-01-18'
  );

  const measureId = generateId('meas_');
  db.prepare(`
    INSERT INTO rectification_measures (id, problem_id, measure_text, submitted_by, status)
    VALUES (?, ?, ?, ?, 'submitted')
  `).run(
    measureId, problemId1,
    '1. 调整模具镶块尺寸，重新加工内孔成型芯子；2. 优化注塑工艺参数，降低注射速度；3. 重新试模验证尺寸',
    'user_resp'
  );

  console.log('✅ 演示数据创建完成');
  console.log(`   - 试模批次: SM-2024-001`);
  console.log(`   - 问题数量: 2 (1个严重, 1个重要)`);
  console.log(`   - 整改措施: 已提交1项`);

  return { batchId, problemId1, problemId2 };
}

if (require.main === module) {
  initDemoData();
  process.exit(0);
}

module.exports = { initDemoData };
