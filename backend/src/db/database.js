const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const dayjs = require('dayjs');

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbFile = path.join(dataDir, 'data.json');

function loadData() {
  if (fs.existsSync(dbFile)) {
    try {
      return JSON.parse(fs.readFileSync(dbFile, 'utf8'));
    } catch (e) {
      console.error('加载数据失败，使用初始数据');
    }
  }
  return getInitialData();
}

function saveData(data) {
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

function getInitialData() {
  return {
    users: [
      { id: 'user_engineer', username: 'engineer01', name: '张工程师', role: 'engineer', created_at: now() },
      { id: 'user_quality', username: 'quality01', name: '李质检', role: 'quality', created_at: now() },
      { id: 'user_resp', username: 'resp01', name: '王整改', role: 'rectification', created_at: now() },
      { id: 'user_retest', username: 'retest01', name: '赵复测', role: 'retest', created_at: now() },
      { id: 'user_approver', username: 'approver01', name: '孙审批', role: 'approver', created_at: now() },
    ],
    defect_levels: [
      { id: 'defect_critical', name: '严重', level: 1, description: '关键尺寸超差、功能失效，必须复测通过才能关闭', require_retest: 1, created_at: now() },
      { id: 'defect_major', name: '重要', level: 2, description: '重要特性不达标，需要整改', require_retest: 0, created_at: now() },
      { id: 'defect_minor', name: '一般', level: 3, description: '轻微外观或非关键问题', require_retest: 0, created_at: now() },
      { id: 'defect_suggestion', name: '建议', level: 4, description: '优化建议类问题', require_retest: 0, created_at: now() },
    ],
    mold_batches: [],
    problems: [],
    rectification_measures: [],
    retest_records: [],
    approval_records: [],
    problem_status_logs: [],
    subscriptions: [],
    notifications: [],
  };
}

function now() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

let db = loadData();

class Database {
  prepare(sql) {
    this._sql = sql;
    return this;
  }

  all(...params) {
    return this._execute('all', params);
  }

  get(...params) {
    const result = this._execute('all', params);
    return result[0] || undefined;
  }

  run(...params) {
    return this._execute('run', params);
  }

  _execute(mode, params) {
    const sql = this._sql.trim().toUpperCase();
    let paramIndex = 0;
    const getNextParam = () => params[paramIndex++];

    if (sql.startsWith('SELECT')) {
      return this._handleSelect(sql, params);
    } else if (sql.startsWith('INSERT')) {
      return this._handleInsert(sql, params);
    } else if (sql.startsWith('UPDATE')) {
      return this._handleUpdate(sql, params);
    } else if (sql.startsWith('DELETE')) {
      return this._handleDelete(sql, params);
    }
    return [];
  }

  _getRowValue(row, field) {
    const f = field.toLowerCase();
    return row[f] ?? row[f.toUpperCase()];
  }

  _handleSelect(sql, params) {
    const selectClause = sql.match(/SELECT\s+(.+?)\s+FROM/i)?.[1];
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) return [];
    const mainTableName = tableMatch[1].toLowerCase();
    const mainTable = db[mainTableName] || db[mainTableName.toUpperCase()];
    if (!mainTable) return [];

    let results = [...mainTable];
    let paramIdx = 0;

    const joinMatches = [...sql.matchAll(/(LEFT\s+)?JOIN\s+(\w+)\s+(?:ON\s+(.+?))?(?=\s+(?:LEFT\s+)?JOIN|WHERE|GROUP|ORDER|LIMIT|$)/gi)];
    for (const jm of joinMatches) {
      const joinTableName = jm[2]?.toLowerCase();
      const joinTable = db[joinTableName] || db[joinTableName?.toUpperCase()];
      const onClause = jm[3];
      if (joinTable && onClause) {
        const parts = onClause.split(/\s*=\s*/);
        const leftF = parts[0]?.split('.').pop()?.trim().toLowerCase();
        const rightF = parts[1]?.split('.').pop()?.trim().toLowerCase();
        if (leftF && rightF) {
          const isLeft = !!jm[1];
          results = results.flatMap(mainRow => {
            const mainVal = this._getRowValue(mainRow, leftF);
            const matches = joinTable.filter(jr => this._getRowValue(jr, rightF) === mainVal);
            if (matches.length === 0 && isLeft) {
              const empty = {};
              joinTable.length > 0 && Object.keys(joinTable[0]).forEach(k => { empty[k] = null; });
              return [{ ...mainRow, ...empty }];
            }
            return matches.map(jr => ({ ...mainRow, ...jr }));
          });
        }
      }
    }

    const hasCount = /COUNT\s*\(/i.test(selectClause || '');

    if (hasCount) {
      const aliasMatch = selectClause?.match(/AS\s+(\w+)/i);
      const alias = aliasMatch ? aliasMatch[1].toLowerCase() : 'count';
      const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/i);
      if (whereMatch) {
        results = results.filter(row => this._evaluateWhere(row, whereMatch[1].trim(), params));
      }
      return [{ [alias]: results.length }];
    }

    const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|GROUP|LIMIT|$)/i);
    if (whereMatch) {
      results = results.filter(row => this._evaluateWhere(row, whereMatch[1].trim(), params));
    }

    const orderMatch = sql.match(/ORDER\s+BY\s+(.+?)(?:LIMIT|$)/i);
    if (orderMatch) {
      const orderStr = orderMatch[1].trim();
      const [fieldRaw, direction] = orderStr.split(/\s+/);
      const field = fieldRaw.split('.').pop().toLowerCase();
      results.sort((a, b) => {
        const aVal = this._getRowValue(a, field);
        const bVal = this._getRowValue(b, field);
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return direction?.toUpperCase() === 'DESC' ? -cmp : cmp;
      });
    }

    const limitMatch = sql.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      results = results.slice(0, parseInt(limitMatch[1]));
    }

    return results;
  }

  _evaluateWhere(row, whereClause, params) {
    const conditions = whereClause.split(/\s+AND\s+/i);
    let paramIdx = 0;
    
    for (const cond of conditions) {
      const eqMatch = cond.match(/(\w+)\s*=\s*\?/);
      const nullMatch = cond.match(/(\w+)\s+IS\s+NOT\s+NULL/i);
      const notMatch = cond.match(/(\w+)\s*!=\s*\?/);
      const inMatch = cond.match(/(\w+)\s+IN\s*\((.+?)\)/i);

      if (eqMatch) {
        const field = eqMatch[1].toLowerCase();
        const value = params[paramIdx++];
        const rowVal = row[field] ?? row[field.toUpperCase()];
        if (rowVal !== value) return false;
      } else if (nullMatch) {
        const field = nullMatch[1].toLowerCase();
        const rowVal = row[field] ?? row[field.toUpperCase()];
        if (rowVal == null) return false;
      } else if (notMatch) {
        const field = notMatch[1].toLowerCase();
        const value = params[paramIdx++];
        const rowVal = row[field] ?? row[field.toUpperCase()];
        if (rowVal === value) return false;
      }
    }
    return true;
  }

  _handleInsert(sql, params) {
    const tableMatch = sql.match(/INTO\s+(\w+)\s*\((.+?)\)/i);
    if (!tableMatch) return { changes: 0 };
    
    const tableName = tableMatch[1].toLowerCase();
    const columns = tableMatch[2].split(',').map(s => s.trim().toLowerCase());
    
    const valuesMatch = sql.match(/VALUES\s*\((.+?)\)/i);
    if (!valuesMatch) return { changes: 0 };

    const newRow = {};
    let paramIdx = 0;
    columns.forEach((col, i) => {
      const valPart = valuesMatch[1].split(',')[i]?.trim();
      if (valPart === '?') {
        newRow[col] = params[paramIdx++];
      } else if (valPart.toUpperCase() === "DATETIME('NOW')") {
        newRow[col] = now();
      } else {
        newRow[col] = valPart.replace(/'/g, '');
      }
    });

    if (!db[tableName]) db[tableName] = [];
    db[tableName].push(newRow);
    saveData(db);

    return { changes: 1, lastInsertRowid: newRow.id };
  }

  _handleUpdate(sql, params) {
    const tableMatch = sql.match(/UPDATE\s+(\w+)/i);
    if (!tableMatch) return { changes: 0 };
    const tableName = tableMatch[1].toLowerCase();

    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/i);
    if (!setMatch) return { changes: 0 };
    
    const setClauses = setMatch[1].split(',').map(s => s.trim());
    const updates = {};
    let paramIdx = 0;

    for (const clause of setClauses) {
      const [field, valPart] = clause.split('=').map(s => s.trim());
      const fieldLower = field.toLowerCase();
      if (valPart === '?') {
        updates[fieldLower] = params[paramIdx++];
      } else if (valPart.toUpperCase() === "DATETIME('NOW')") {
        updates[fieldLower] = now();
      } else {
        updates[fieldLower] = valPart.replace(/'/g, '');
      }
    }

    const whereMatch = sql.match(/WHERE\s+(.+?)$/i);
    let updated = 0;

    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      const table = db[tableName] || [];
      const whereParams = params.slice(paramIdx);
      
      table.forEach(row => {
        if (this._evaluateWhere(row, whereClause, whereParams)) {
          Object.assign(row, updates);
          updated++;
        }
      });
    }

    saveData(db);
    return { changes: updated };
  }

  _handleDelete(sql, params) {
    const tableMatch = sql.match(/FROM\s+(\w+)/i);
    if (!tableMatch) return { changes: 0 };
    const tableName = tableMatch[1].toLowerCase();

    const whereMatch = sql.match(/WHERE\s+(.+?)$/i);
    let deleted = 0;

    if (whereMatch) {
      const whereClause = whereMatch[1].trim();
      const table = db[tableName] || [];
      
      for (let i = table.length - 1; i >= 0; i--) {
        if (this._evaluateWhere(table[i], whereClause, params)) {
          table.splice(i, 1);
          deleted++;
        }
      }
    }

    saveData(db);
    return { changes: deleted };
  }

  pragma() {
    return this;
  }

  exec() {
    return this;
  }
}

const database = new Database();

console.log('数据库初始化完成');

module.exports = database;
