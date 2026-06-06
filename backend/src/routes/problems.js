const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { generateId, parseJSON, stringifyJSON } = require('../utils/helpers');
const { PROBLEM_STATUS, canCloseProblem, handleRetestFailed, getProblemWithOverdueInfo } = require('../services/businessRules');

function logStatusChange(problemId, oldStatus, newStatus, operatorId, remark = '') {
  const id = generateId('log_');
  db.prepare(`
    INSERT INTO problem_status_logs (id, problem_id, old_status, new_status, operator_id, remark)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, problemId, oldStatus, newStatus, operatorId, remark);
}

router.get('/', (req, res) => {
  const { batch_id, status, responsible_person_id, defect_level_id } = req.query;
  let sql = 'SELECT * FROM problems WHERE 1=1';
  const params = [];

  if (batch_id) { sql += ' AND batch_id = ?'; params.push(batch_id); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (responsible_person_id) { sql += ' AND responsible_person_id = ?'; params.push(responsible_person_id); }
  if (defect_level_id) { sql += ' AND defect_level_id = ?'; params.push(defect_level_id); }

  sql += ' ORDER BY created_at DESC';
  const problems = db.prepare(sql).all(...params).map(p => {
    const problem = getProblemWithOverdueInfo(p);
    problem.photo_urls = parseJSON(problem.photo_urls, []);
    return problem;
  });

  res.json({ success: true, data: problems });
});

router.get('/:id', (req, res) => {
  const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
  if (!problem) {
    return res.status(404).json({ success: false, message: '问题不存在' });
  }

  const problemData = getProblemWithOverdueInfo(problem);
  problemData.photo_urls = parseJSON(problemData.photo_urls, []);

  const measures = db.prepare(`
    SELECT rm.*, u.name as submitter_name
    FROM rectification_measures rm
    LEFT JOIN users u ON rm.submitted_by = u.id
    WHERE rm.problem_id = ?
    ORDER BY rm.submitted_at DESC
  `).all(req.params.id);

  const retests = db.prepare(`
    SELECT rr.*, u.name as tester_name
    FROM retest_records rr
    LEFT JOIN users u ON rr.tested_by = u.id
    WHERE rr.problem_id = ?
    ORDER BY rr.tested_at DESC
  `).all(req.params.id).map(r => ({
    ...r,
    photo_urls: parseJSON(r.photo_urls, [])
  }));

  const approvals = db.prepare(`
    SELECT ar.*, u.name as approver_name
    FROM approval_records ar
    LEFT JOIN users u ON ar.approver_id = u.id
    WHERE ar.problem_id = ?
    ORDER BY ar.approved_at DESC
  `).all(req.params.id);

  const statusLogs = db.prepare(`
    SELECT psl.*, u.name as operator_name
    FROM problem_status_logs psl
    LEFT JOIN users u ON psl.operator_id = u.id
    WHERE psl.problem_id = ?
    ORDER BY psl.created_at DESC
  `).all(req.params.id);

  res.json({
    success: true,
    data: {
      ...problemData,
      measures,
      retests,
      approvals,
      statusLogs
    }
  });
});

router.post('/', (req, res) => {
  const { batch_id, title, description, defect_level_id, photo_urls, reported_by } = req.body;

  if (!batch_id || !title || !defect_level_id || !reported_by) {
    return res.status(400).json({ success: false, message: '缺少必填字段' });
  }

  const id = generateId('prob_');
  const insertStmt = db.prepare(`
    INSERT INTO problems (id, batch_id, title, description, defect_level_id, photo_urls, reported_by, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run(
    id, batch_id, title, description || '', defect_level_id,
    stringifyJSON(photo_urls || []), reported_by, PROBLEM_STATUS.REGISTERED
  );

  logStatusChange(id, null, PROBLEM_STATUS.REGISTERED, reported_by, '问题登记');

  const newProblem = db.prepare('SELECT * FROM problems WHERE id = ?').get(id);
  newProblem.photo_urls = parseJSON(newProblem.photo_urls, []);

  res.json({ success: true, data: getProblemWithOverdueInfo(newProblem), message: '问题登记成功' });
});

router.put('/:id/assign', (req, res) => {
  const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
  if (!problem) {
    return res.status(404).json({ success: false, message: '问题不存在' });
  }

  const { responsible_person_id, deadline, operator_id } = req.body;
  if (!responsible_person_id || !operator_id) {
    return res.status(400).json({ success: false, message: '缺少必填字段' });
  }

  const oldStatus = problem.status;
  const updateStmt = db.prepare(`
    UPDATE problems
    SET responsible_person_id = ?, deadline = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  updateStmt.run(responsible_person_id, deadline || null, PROBLEM_STATUS.ASSIGNED, req.params.id);
  logStatusChange(req.params.id, oldStatus, PROBLEM_STATUS.ASSIGNED, operator_id, '整改派发');

  const updated = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: getProblemWithOverdueInfo(updated), message: '已派发整改任务' });
});

router.put('/:id/start-rectify', (req, res) => {
  const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
  if (!problem) {
    return res.status(404).json({ success: false, message: '问题不存在' });
  }

  const { operator_id } = req.body;
  const oldStatus = problem.status;

  db.prepare(`
    UPDATE problems SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(PROBLEM_STATUS.RECTIFYING, req.params.id);

  logStatusChange(req.params.id, oldStatus, PROBLEM_STATUS.RECTIFYING, operator_id, '开始整改');

  const updated = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: getProblemWithOverdueInfo(updated), message: '已开始整改' });
});

router.post('/:id/measures', (req, res) => {
  const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
  if (!problem) {
    return res.status(404).json({ success: false, message: '问题不存在' });
  }

  const { measure_text, submitted_by } = req.body;
  if (!measure_text || !submitted_by) {
    return res.status(400).json({ success: false, message: '缺少必填字段' });
  }

  const id = generateId('meas_');
  db.prepare(`
    INSERT INTO rectification_measures (id, problem_id, measure_text, submitted_by)
    VALUES (?, ?, ?, ?)
  `).run(id, req.params.id, measure_text, submitted_by);

  const oldStatus = problem.status;
  if (problem.status === PROBLEM_STATUS.RECTIFYING) {
    db.prepare(`
      UPDATE problems SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(PROBLEM_STATUS.RECTIFIED, req.params.id);
    logStatusChange(req.params.id, oldStatus, PROBLEM_STATUS.RECTIFIED, submitted_by, '提交整改措施');
  }

  const newMeasure = db.prepare('SELECT * FROM rectification_measures WHERE id = ?').get(id);
  res.json({ success: true, data: newMeasure, message: '整改措施已提交' });
});

router.post('/:id/retest', (req, res) => {
  const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
  if (!problem) {
    return res.status(404).json({ success: false, message: '问题不存在' });
  }

  const { result, remark, photo_urls, tested_by } = req.body;
  if (!result || !tested_by) {
    return res.status(400).json({ success: false, message: '缺少必填字段' });
  }

  const id = generateId('retest_');
  db.prepare(`
    INSERT INTO retest_records (id, problem_id, result, remark, photo_urls, tested_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, result, remark || '', stringifyJSON(photo_urls || []), tested_by);

  const oldStatus = problem.status;
  let newStatus;

  if (result === 'passed') {
    newStatus = PROBLEM_STATUS.RETEST_PASSED;
    db.prepare(`UPDATE problems SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(newStatus, req.params.id);
    logStatusChange(req.params.id, oldStatus, newStatus, tested_by, '复测通过');
  } else {
    const handleResult = handleRetestFailed(req.params.id);
    newStatus = handleResult.newStatus;
    logStatusChange(req.params.id, oldStatus, newStatus, tested_by, '复测失败，退回整改');
  }

  const updated = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
  res.json({ 
    success: true, 
    data: getProblemWithOverdueInfo(updated), 
    message: result === 'passed' ? '复测通过' : '复测失败，已退回整改'
  });
});

router.put('/:id/close', (req, res) => {
  const check = canCloseProblem(req.params.id);
  if (!check.allowed) {
    return res.status(400).json({ success: false, message: check.reason });
  }

  const problem = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
  const { approver_id, remark } = req.body;

  if (!approver_id) {
    return res.status(400).json({ success: false, message: '缺少审批人' });
  }

  const approvalId = generateId('appr_');
  db.prepare(`
    INSERT INTO approval_records (id, problem_id, approver_id, action, remark)
    VALUES (?, ?, ?, ?, ?)
  `).run(approvalId, req.params.id, approver_id, 'close', remark || '');

  const oldStatus = problem.status;
  db.prepare(`
    UPDATE problems SET status = ?, updated_at = datetime('now') WHERE id = ?
  `).run(PROBLEM_STATUS.CLOSED, req.params.id);

  logStatusChange(req.params.id, oldStatus, PROBLEM_STATUS.CLOSED, approver_id, '关闭审批通过');

  const updated = db.prepare('SELECT * FROM problems WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: getProblemWithOverdueInfo(updated), message: '问题已关闭' });
});

router.get('/:id/can-close', (req, res) => {
  const check = canCloseProblem(req.params.id);
  res.json({ success: true, data: check });
});

module.exports = router;
