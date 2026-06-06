const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { PROBLEM_STATUS, BATCH_STATUS, getProblemWithOverdueInfo } = require('../services/businessRules');
const { parseJSON } = require('../utils/helpers');
const dayjs = require('dayjs');

router.get('/overview', (req, res) => {
  const totalBatches = db.prepare('SELECT COUNT(*) as count FROM mold_batches').get().count;
  const totalProblems = db.prepare('SELECT COUNT(*) as count FROM problems').get().count;
  const closedProblems = db.prepare('SELECT COUNT(*) as count FROM problems WHERE status = ?').get(PROBLEM_STATUS.CLOSED).count;
  const passedBatches = db.prepare('SELECT COUNT(*) as count FROM mold_batches WHERE status = ?').get(BATCH_STATUS.PASSED).count;

  const criticalLevel = db.prepare("SELECT id FROM defect_levels WHERE name = '严重'").get();
  const criticalOpenCount = criticalLevel ? db.prepare(`
    SELECT COUNT(*) as count FROM problems
    WHERE defect_level_id = ? AND status != ?
  `).get(criticalLevel.id, PROBLEM_STATUS.CLOSED).count : 0;

  const rectifyingProblems = db.prepare(`
    SELECT COUNT(*) as count FROM problems
    WHERE status IN (?, ?, ?)
  `).get(PROBLEM_STATUS.ASSIGNED, PROBLEM_STATUS.RECTIFYING, PROBLEM_STATUS.RECTIFIED).count;

  const retestingProblems = db.prepare(`
    SELECT COUNT(*) as count FROM problems
    WHERE status = ?
  `).get(PROBLEM_STATUS.RETEST_PASSED).count;

  res.json({
    success: true,
    data: {
      totalBatches,
      totalProblems,
      closedProblems,
      passedBatches,
      criticalOpenCount,
      rectifyingProblems,
      retestingProblems,
      closureRate: totalProblems > 0 ? Math.round((closedProblems / totalProblems) * 100) : 0
    }
  });
});

router.get('/problems-by-status', (req, res) => {
  const statusMap = {
    [PROBLEM_STATUS.REGISTERED]: '已登记',
    [PROBLEM_STATUS.ASSIGNED]: '已派发',
    [PROBLEM_STATUS.RECTIFYING]: '整改中',
    [PROBLEM_STATUS.RECTIFIED]: '已整改',
    [PROBLEM_STATUS.RETEST_PASSED]: '复测通过',
    [PROBLEM_STATUS.CLOSED]: '已关闭'
  };

  const counts = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM problems
    GROUP BY status
  `).all();

  const data = Object.entries(statusMap).map(([status, label]) => {
    const item = counts.find(c => c.status === status);
    return { status, label, count: item ? item.count : 0 };
  });

  res.json({ success: true, data });
});

router.get('/problems-by-level', (req, res) => {
  const data = db.prepare(`
    SELECT dl.id, dl.name, dl.level, COUNT(p.id) as count
    FROM defect_levels dl
    LEFT JOIN problems p ON p.defect_level_id = dl.id
    GROUP BY dl.id, dl.name, dl.level
    ORDER BY dl.level
  `).all();

  res.json({ success: true, data });
});

router.get('/overdue-problems', (req, res) => {
  const problems = db.prepare(`
    SELECT p.*, 
           mb.batch_no, 
           mb.mold_code,
           mb.mold_name,
           dl.name as defect_level_name,
           u.name as responsible_person_name
    FROM problems p
    LEFT JOIN mold_batches mb ON p.batch_id = mb.id
    LEFT JOIN defect_levels dl ON p.defect_level_id = dl.id
    LEFT JOIN users u ON p.responsible_person_id = u.id
    WHERE p.status != ? AND p.deadline IS NOT NULL
    ORDER BY p.deadline ASC
  `).all(PROBLEM_STATUS.CLOSED).map(p => {
    const problem = getProblemWithOverdueInfo(p);
    problem.photo_urls = parseJSON(problem.photo_urls, []);
    return problem;
  });

  const overdueProblems = problems.filter(p => p.is_overdue);

  res.json({
    success: true,
    data: {
      total: problems.length,
      overdue: overdueProblems.length,
      list: overdueProblems
    }
  });
});

router.get('/recent-activities', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  const activities = db.prepare(`
    SELECT psl.*, 
           p.title as problem_title,
           u.name as operator_name
    FROM problem_status_logs psl
    LEFT JOIN problems p ON psl.problem_id = p.id
    LEFT JOIN users u ON psl.operator_id = u.id
    ORDER BY psl.created_at DESC
    LIMIT ?
  `).all(limit);

  res.json({ success: true, data: activities });
});

router.get('/batch/:batchId/risks', (req, res) => {
  const batchId = req.params.batchId;
  
  const problems = db.prepare(`
    SELECT p.*, dl.name as defect_level_name, dl.level, dl.require_retest
    FROM problems p
    LEFT JOIN defect_levels dl ON p.defect_level_id = dl.id
    WHERE p.batch_id = ?
    ORDER BY dl.level ASC, p.created_at DESC
  `).all(batchId).map(p => getProblemWithOverdueInfo(p));

  const criticalProblems = problems.filter(p => p.level === 1 && p.status !== PROBLEM_STATUS.CLOSED);
  const overdueProblems = problems.filter(p => p.is_overdue);

  const riskLevel = criticalProblems.length > 0 ? 'high' : 
                    overdueProblems.length > 0 ? 'medium' : 'low';

  res.json({
    success: true,
    data: {
      riskLevel,
      criticalCount: criticalProblems.length,
      overdueCount: overdueProblems.length,
      totalProblems: problems.length,
      closedCount: problems.filter(p => p.status === PROBLEM_STATUS.CLOSED).length,
      criticalProblems,
      overdueProblems,
      allProblems: problems
    }
  });
});

module.exports = router;
