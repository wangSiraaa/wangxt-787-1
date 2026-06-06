export const PROBLEM_STATUS_MAP = {
  registered: { label: '已登记', color: 'default' },
  assigned: { label: '已派发', color: 'blue' },
  rectifying: { label: '整改中', color: 'orange' },
  rectified: { label: '已整改', color: 'cyan' },
  retest_passed: { label: '复测通过', color: 'green' },
  closed: { label: '已关闭', color: 'gray' },
};

export const BATCH_STATUS_MAP = {
  processing: { label: '进行中', color: 'blue' },
  passed: { label: '已通过', color: 'green' },
  failed: { label: '未通过', color: 'red' },
};

export const DEFECT_LEVEL_COLORS = {
  1: '#ff4d4f',
  2: '#faad14',
  3: '#faad14',
  4: '#52c41a',
};

export const getStatusLabel = (status) => {
  return PROBLEM_STATUS_MAP[status]?.label || status;
};

export const getStatusColor = (status) => {
  return PROBLEM_STATUS_MAP[status]?.color || 'default';
};

export const getBatchStatusLabel = (status) => {
  return BATCH_STATUS_MAP[status]?.label || status;
};

export const getBatchStatusColor = (status) => {
  return BATCH_STATUS_MAP[status]?.color || 'default';
};

export const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
