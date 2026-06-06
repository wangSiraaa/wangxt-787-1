const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  const levels = db.prepare('SELECT * FROM defect_levels ORDER BY level').all();
  res.json({ success: true, data: levels });
});

router.get('/:id', (req, res) => {
  const level = db.prepare('SELECT * FROM defect_levels WHERE id = ?').get(req.params.id);
  if (!level) {
    return res.status(404).json({ success: false, message: '缺陷等级不存在' });
  }
  res.json({ success: true, data: level });
});

module.exports = router;
