const dayjs = require('dayjs');
const { v4: uuidv4 } = require('uuid');

function generateId(prefix = '') {
  return prefix + uuidv4().replace(/-/g, '').substring(0, 16);
}

function getCurrentTime() {
  return dayjs().format('YYYY-MM-DD HH:mm:ss');
}

function parseJSON(str, defaultValue = null) {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch (e) {
    return defaultValue;
  }
}

function stringifyJSON(obj) {
  return JSON.stringify(obj);
}

function isOverdue(deadline) {
  if (!deadline) return false;
  return dayjs().isAfter(dayjs(deadline));
}

module.exports = {
  generateId,
  getCurrentTime,
  parseJSON,
  stringifyJSON,
  isOverdue
};
