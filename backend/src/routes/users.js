const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at').all();
  res.json({ success: true, data: users });
});

router.get('/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: '用户不存在' });
  }
  res.json({ success: true, data: user });
});

router.get('/role/:role', (req, res) => {
  const users = db.prepare('SELECT * FROM users WHERE role = ?').all(req.params.role);
  res.json({ success: true, data: users });
});

module.exports = router;
