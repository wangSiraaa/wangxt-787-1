const db = require('../db/database');
const { isOverdue } = require('../utils/helpers');

const PROBLEM_STATUS = {
  REGISTERED: 'registered',
  ASSIGNED: 'assigned',
  RECTIFYING: 'rectifying',
  RECTIFIED: 'rectified',
  RETESTING: 'retesting',
  RETEST_PASSED: 'retest_passed',
  RETEST_FAILED: 'retest_failed',
  CLOSED: 'closed',
  APPROVING: 'approving'
};

const BATCH_STATUS = {
  PROCESSING: 'processing',
  PASSED: 'passed',
  FAILED: 'failed'
};

function getDefectLevel(defectLevelId) {
  return db.prepare('SELECT * FROM defect_levels WHERE id = ?').get(defectLevelId);
}

function getProblem(problemId) {
  return db.prepare('SELECT * FROM problems WHERE id = ?').get(problemId);
}

function getBatch(batchId) {
  return db.prepare('SELECT * FROM mold_batches WHERE id = ?').get(batchId);
}

function hasUnclosedCriticalProblems(batchId) {
  const criticalLevel = db.prepare("SELECT id FROM defect_levels WHERE name = '严重'").get();
  if (!criticalLevel) return false;

  const problems = db.prepare('SELECT * FROM problems WHERE batch_id = ?').all(batchId);
  return problems.some(p => (p.defect_level_id || p.DEFECT_LEVEL_ID) === criticalLevel.id && (p.status || p.STATUS) !== PROBLEM_STATUS.CLOSED);
}

function canCloseProblem(problemId) {
  const problem = getProblem(problemId);
  if (!problem) return { allowed: false, reason: '问题不存在' };

  const defectLevel = getDefectLevel(problem.defect_level_id);
  if (!defectLevel) return { allowed: false, reason: '缺陷等级不存在' };

  if (defectLevel.require_retest) {
    if (problem.status !== PROBLEM_STATUS.RETEST_PASSED) {
      return { allowed: false, reason: `【${defectLevel.name}】问题必须复测通过后才能关闭` };
    }
  }

  return { allowed: true };
}

function canPassBatch(batchId) {
  const batch = getBatch(batchId);
  if (!batch) return { allowed: false, reason: '批次不存在' };

  if (hasUnclosedCriticalProblems(batchId)) {
    return { allowed: false, reason: '该批次存在未关闭的严重问题，不能发布试模通过结论' };
  }

  return { allowed: true };
}

function handleRetestFailed(problemId) {
  const problem = getProblem(problemId);
  if (!problem) return { success: false, reason: '问题不存在' };

  const updateStmt = db.prepare(`
    UPDATE problems
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  updateStmt.run(PROBLEM_STATUS.RECTIFYING, problemId);

  return { success: true, newStatus: PROBLEM_STATUS.RECTIFYING };
}

function getProblemWithOverdueInfo(problem) {
  return {
    ...problem,
    is_overdue: isOverdue(problem.deadline) && 
                problem.status !== PROBLEM_STATUS.CLOSED &&
                problem.status !== PROBLEM_STATUS.RETEST_PASSED
  };
}

function getBatchProblemsWithOverdue(batchId) {
  const problems = db.prepare('SELECT * FROM problems WHERE batch_id = ?').all(batchId);
  return problems.map(p => getProblemWithOverdueInfo(p));
}

module.exports = {
  PROBLEM_STATUS,
  BATCH_STATUS,
  getDefectLevel,
  getProblem,
  getBatch,
  hasUnclosedCriticalProblems,
  canCloseProblem,
  canPassBatch,
  handleRetestFailed,
  getProblemWithOverdueInfo,
  getBatchProblemsWithOverdue
};
