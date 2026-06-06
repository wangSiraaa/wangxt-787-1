const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

require('./db/database');

const usersRouter = require('./routes/users');
const defectLevelsRouter = require('./routes/defectLevels');
const batchesRouter = require('./routes/batches');
const problemsRouter = require('./routes/problems');
const dashboardRouter = require('./routes/dashboard');

app.use('/api/users', usersRouter);
app.use('/api/defect-levels', defectLevelsRouter);
app.use('/api/batches', batchesRouter);
app.use('/api/problems', problemsRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: '模具试模问题闭环系统 API 运行正常', timestamp: new Date().toISOString() });
});

app.use(express.static(path.join(__dirname, '../../frontend/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({ success: false, message: '服务器内部错误', error: err.message });
});

function startServer() {
  return app.listen(PORT, () => {
    console.log(`
  ╔══════════════════════════════════════════════════════════════╗
  ║                                                              ║
  ║   模具试模问题闭环系统 - 后端服务已启动                        ║
  ║                                                              ║
  ║   API 地址: http://localhost:${PORT}                           ║
  ║   健康检查: http://localhost:${PORT}/api/health                 ║
  ║                                                              ║
  ╚══════════════════════════════════════════════════════════════╝
  `);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, PORT };
