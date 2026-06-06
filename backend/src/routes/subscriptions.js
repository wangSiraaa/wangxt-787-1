const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { generateId } = require('../utils/helpers');

function getStatusLabel(status) {
  const map = {
    registered: '已登记',
    assigned: '已派发',
    rectifying: '整改中',
    rectified: '已整改',
    retest_passed: '复测通过',
    closed: '已关闭',
    approving: '审批中',
  };
  return map[status] || status;
}

function createNotification(problemId, userId, oldStatus, newStatus, operatorId, remark) {
  const id = generateId('notif_');
  const problem = db.prepare('SELECT title FROM problems WHERE id = ?').get(problemId);
  const operator = db.prepare('SELECT name FROM users WHERE id = ?').get(operatorId);
  
  const title = problem?.title || '问题';
  const operatorName = operator?.name || '系统';
  const oldLabel = getStatusLabel(oldStatus);
  const newLabel = getStatusLabel(newStatus);
  
  const content = '【' + title + '】状态由「' + oldLabel + '」变更为「' + newLabel + '」。操作人：' + operatorName + (remark ? '。备注：' + remark : '');
  
  db.prepare(`
    INSERT INTO notifications (id, user_id, problem_id, content, old_status, new_status, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))
  `).run(id, userId, problemId, content, oldStatus, newStatus);
  
  return id;
}

function notifySubscribers(problemId, oldStatus, newStatus, operatorId, remark) {
  const subscribers = db.prepare(`
    SELECT user_id FROM subscriptions WHERE problem_id = ? AND is_active = 1
  `).all(problemId);
  
  subscribers.forEach(sub => {
    if (sub.user_id !== operatorId) {
      createNotification(problemId, sub.user_id, oldStatus, newStatus, operatorId, remark);
    }
  });
  
  const problem = db.prepare('SELECT responsible_person_id, reported_by FROM problems WHERE id = ?').get(problemId);
  if (problem) {
    const involved = new Set(subscribers.map(s => s.user_id));
    if (problem.responsible_person_id && !involved.has(problem.responsible_person_id) && problem.responsible_person_id !== operatorId) {
      createNotification(problemId, problem.responsible_person_id, oldStatus, newStatus, operatorId, remark);
    }
    if (problem.reported_by && !involved.has(problem.reported_by) && problem.reported_by !== operatorId) {
      createNotification(problemId, problem.reported_by, oldStatus, newStatus, operatorId, remark);
    }
  }
}

router.get('/problems/:problemId', (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, message: '缺少用户ID' });
  }
  
  const sub = db.prepare(`
    SELECT * FROM subscriptions 
    WHERE problem_id = ? AND user_id = ? AND is_active = 1
  `).get(req.params.problemId, userId);
  
  res.json({ success: true, data: { is_subscribed: !!sub } });
});

router.post('/problems/:problemId', (req, res) => {
  const { userId } = req.body;
  const problemId = req.params.problemId;
  
  if (!userId) {
    return res.status(400).json({ success: false, message: '缺少用户ID' });
  }
  
  const problem = db.prepare('SELECT id FROM problems WHERE id = ?').get(problemId);
  if (!problem) {
    return res.status(404).json({ success: false, message: '问题不存在' });
  }
  
  const existing = db.prepare(`
    SELECT id FROM subscriptions WHERE problem_id = ? AND user_id = ?
  `).get(problemId, userId);
  
  if (existing) {
    db.prepare(`
      UPDATE subscriptions SET is_active = 1, updated_at = datetime('now') WHERE id = ?
    `).run(existing.id);
  } else {
    const id = generateId('sub_');
    db.prepare(`
      INSERT INTO subscriptions (id, problem_id, user_id, is_active, created_at)
      VALUES (?, ?, ?, 1, datetime('now'))
    `).run(id, problemId, userId);
  }
  
  res.json({ success: true, data: { is_subscribed: true }, message: '订阅成功' });
});

router.delete('/problems/:problemId', (req, res) => {
  const { userId } = req.body;
  const problemId = req.params.problemId;
  
  if (!userId) {
    return res.status(400).json({ success: false, message: '缺少用户ID' });
  }
  
  db.prepare(`
    UPDATE subscriptions SET is_active = 0, updated_at = datetime('now')
    WHERE problem_id = ? AND user_id = ?
  `).run(problemId, userId);
  
  res.json({ success: true, data: { is_subscribed: false }, message: '已取消订阅' });
});

router.get('/my', (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, message: '缺少用户ID' });
  }
  
  const subs = db.prepare(`
    SELECT s.*, p.title as problem_title, p.status as problem_status,
           dl.name as defect_level_name
    FROM subscriptions s
    LEFT JOIN problems p ON s.problem_id = p.id
    LEFT JOIN defect_levels dl ON p.defect_level_id = dl.id
    WHERE s.user_id = ? AND s.is_active = 1
    ORDER BY s.created_at DESC
  `).all(userId);
  
  res.json({ success: true, data: subs });
});

router.get('/notifications', (req, res) => {
  const { userId, unread_only, limit } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, message: '缺少用户ID' });
  }
  
  let sql = `
    SELECT n.*, p.title as problem_title, p.status as problem_status
    FROM notifications n
    LEFT JOIN problems p ON n.problem_id = p.id
    WHERE n.user_id = ?
  `;
  const params = [userId];
  
  if (unread_only === 'true') {
    sql += ' AND n.is_read = 0';
  }
  
  sql += ' ORDER BY n.created_at DESC';
  
  if (limit) {
    sql += ' LIMIT ?';
    params.push(parseInt(limit));
  }
  
  const notifications = db.prepare(sql).all(...params);
  
  res.json({ success: true, data: notifications });
});

router.put('/notifications/:id/read', (req, res) => {
  const { userId } = req.body;
  const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
  
  if (!notif) {
    return res.status(404).json({ success: false, message: '通知不存在' });
  }
  
  if (notif.user_id !== userId) {
    return res.status(403).json({ success: false, message: '无权限操作' });
  }
  
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  
  res.json({ success: true, message: '已标记为已读' });
});

router.put('/notifications/read-all', (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: '缺少用户ID' });
  }
  
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  
  res.json({ success: true, message: '已全部标记为已读' });
});

router.get('/notifications/unread-count', (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, message: '缺少用户ID' });
  }
  
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0
  `).get(userId);
  
  res.json({ success: true, data: { unread_count: result?.count || 0 } });
});

module.exports = { router, notifySubscribers, createNotification };
