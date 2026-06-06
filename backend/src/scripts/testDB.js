const db = require('../db/database');

console.log('测试数据库...');
console.log();

console.log('users 表数据:');
const users = db.prepare('SELECT * FROM users').all();
console.log(JSON.stringify(users, null, 2));
console.log();

console.log('defect_levels 表数据:');
const levels = db.prepare('SELECT * FROM defect_levels').all();
console.log(JSON.stringify(levels, null, 2));
