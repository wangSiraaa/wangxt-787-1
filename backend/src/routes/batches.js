const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { generateId, parseJSON, stringifyJSON } = require('../utils/helpers');
const { canPassBatch, BATCH_STATUS, getBatchProblemsWithOverdue } = require('../services/businessRules');

router.get('/', (req, res) => {
  const { status, created_by } = req.query;
  let sql = 'SELECT * FROM mold_batches WHERE 1=1';
  const params = [];

  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  if (created_by) {
    sql += ' AND created_by = ?';
    params.push(created_by);
  }

  sql += ' ORDER BY created_at DESC';
  const batches = db.prepare(sql).all(...params).map(b => ({
    ...b,
    trial_params: parseJSON(b.trial_params, {})
  }));

  res.json({ success: true, data: batches });
});

router.get('/:id', (req, res) => {
  const batch = db.prepare('SELECT * FROM mold_batches WHERE id = ?').get(req.params.id);
  if (!batch) {
    return res.status(404).json({ success: false, message: '批次不存在' });
  }

  batch.trial_params = parseJSON(batch.trial_params, {});
  
  const problems = getBatchProblemsWithOverdue(req.params.id).map(p => ({
    ...p,
    photo_urls: parseJSON(p.photo_urls, [])
  }));

  res.json({ 
    success: true, 
    data: {
      ...batch,
      problems
    }
  });
});

router.post('/', (req, res) => {
  const { batch_no, mold_code, mold_name, project_name, trial_date, trial_params, created_by } = req.body;

  if (!batch_no || !mold_code || !mold_name || !trial_date || !created_by) {
    return res.status(400).json({ success: false, message: '缺少必填字段' });
  }

  const existing = db.prepare('SELECT id FROM mold_batches WHERE batch_no = ?').get(batch_no);
  if (existing) {
    return res.status(400).json({ success: false, message: '批次号已存在' });
  }

  const id = generateId('batch_');
  const insertStmt = db.prepare(`
    INSERT INTO mold_batches (id, batch_no, mold_code, mold_name, project_name, trial_date, trial_params, created_by, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run(
    id, batch_no, mold_code, mold_name, project_name, trial_date,
    stringifyJSON(trial_params || {}), created_by, BATCH_STATUS.PROCESSING
  );

  const newBatch = db.prepare('SELECT * FROM mold_batches WHERE id = ?').get(id);
  newBatch.trial_params = parseJSON(newBatch.trial_params, {});

  res.json({ success: true, data: newBatch, message: '批次创建成功' });
});

router.put('/:id', (req, res) => {
  const batch = db.prepare('SELECT * FROM mold_batches WHERE id = ?').get(req.params.id);
  if (!batch) {
    return res.status(404).json({ success: false, message: '批次不存在' });
  }

  const { mold_code, mold_name, project_name, trial_date, trial_params } = req.body;

  const updateStmt = db.prepare(`
    UPDATE mold_batches
    SET mold_code = ?, mold_name = ?, project_name = ?, trial_date = ?, trial_params = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  updateStmt.run(
    mold_code || batch.mold_code,
    mold_name || batch.mold_name,
    project_name !== undefined ? project_name : batch.project_name,
    trial_date || batch.trial_date,
    trial_params !== undefined ? stringifyJSON(trial_params) : batch.trial_params,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM mold_batches WHERE id = ?').get(req.params.id);
  updated.trial_params = parseJSON(updated.trial_params, {});

  res.json({ success: true, data: updated, message: '批次更新成功' });
});

router.post('/:id/conclusion', (req, res) => {
  const { conclusion, operator_id } = req.body;
  
  if (conclusion === 'passed') {
    const check = canPassBatch(req.params.id);
    if (!check.allowed) {
      return res.status(400).json({ success: false, message: check.reason });
    }
  }

  const updateStmt = db.prepare(`
    UPDATE mold_batches
    SET status = ?, conclusion = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  const status = conclusion === 'passed' ? BATCH_STATUS.PASSED : 
                 conclusion === 'failed' ? BATCH_STATUS.FAILED : BATCH_STATUS.PROCESSING;

  updateStmt.run(status, conclusion, req.params.id);

  const updated = db.prepare('SELECT * FROM mold_batches WHERE id = ?').get(req.params.id);
  res.json({ success: true, data: updated, message: '试模结论已发布' });
});

module.exports = router;
