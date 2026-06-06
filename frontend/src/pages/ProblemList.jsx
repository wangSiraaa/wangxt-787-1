import React, { useState, useEffect } from 'react';
import { Table, Tag, Space, Select, Button, Modal, Form, Input, message, Popconfirm } from 'antd';
import { EyeOutlined, UserAddOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons';
import { problemAPI, defectLevelAPI, userAPI } from '../services/api';
import { getStatusLabel, getStatusColor, formatDate } from '../utils/constants';

function ProblemList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [defectLevels, setDefectLevels] = useState([]);
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ status: '', defect_level_id: '' });
  const [assignModal, setAssignModal] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [assignForm] = Form.useForm();

  useEffect(() => {
    loadData();
    loadDefectLevels();
    loadUsers();
  }, [filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.status) params.status = filters.status;
      if (filters.defect_level_id) params.defect_level_id = filters.defect_level_id;
      const res = await problemAPI.list(params);
      setData(res.data);
    } catch (e) {
      message.error('加载失败');
    }
    setLoading(false);
  };

  const loadDefectLevels = async () => {
    const res = await defectLevelAPI.list();
    setDefectLevels(res.data);
  };

  const loadUsers = async () => {
    const res = await userAPI.list();
    setUsers(res.data);
  };

  const handleAssign = async (values) => {
    try {
      await problemAPI.assign(selectedProblem.id, {
        ...values,
        operator_id: 'user_quality',
        deadline: values.deadline?.format('YYYY-MM-DD'),
      });
      message.success('派发成功');
      setAssignModal(false);
      loadData();
    } catch (e) {
      message.error(e.response?.data?.message || '派发失败');
    }
  };

  const handleClose = async (record) => {
    try {
      const canClose = await problemAPI.canClose(record.id);
      if (!canClose.data.allowed) {
        message.error(canClose.data.reason);
        return;
      }
      await problemAPI.close(record.id, {
        approver_id: 'user_approver',
        remark: '审批通过',
      });
      message.success('问题已关闭');
      loadData();
    } catch (e) {
      message.error(e.response?.data?.message || '关闭失败');
    }
  };

  const getDefectLevelName = (levelId) => {
    const level = defectLevels.find(d => d.id === levelId);
    return level?.name || '-';
  };

  const getDefectLevelColor = (levelId) => {
    const level = defectLevels.find(d => d.id === levelId);
    if (!level) return 'default';
    if (level.level === 1) return 'red';
    if (level.level === 2) return 'orange';
    return 'blue';
  };

  const columns = [
    { title: '批次号', dataIndex: ['batch', 'batch_no'], key: 'batch_no', width: 140,
      render: (_, r) => r.batch?.batch_no || '-'
    },
    { title: '问题标题', dataIndex: 'title', key: 'title', width: 200,
      render: (text, record) => (
        <span className={record.is_overdue ? 'critical-problem' : ''}>{text}</span>
      )
    },
    { title: '缺陷等级', dataIndex: 'defect_level_id', key: 'defect_level_id', width: 100,
      render: (id) => <Tag color={getDefectLevelColor(id)}>{getDefectLevelName(id)}</Tag>
    },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s) => <Tag color={getStatusColor(s)}>{getStatusLabel(s)}</Tag>
    },
    { title: '责任人', dataIndex: 'responsible_person_id', key: 'responsible_person_id', width: 100,
      render: (uid) => {
        const u = users.find(x => x.id === uid);
        return u?.name || '未指派';
      }
    },
    { title: '截止日期', dataIndex: 'deadline', key: 'deadline', width: 120,
      render: (d, record) => (
        <Space>
          <span style={{ color: record.is_overdue ? '#ff4d4f' : 'inherit' }}>{d || '-'}</span>
          {record.is_overdue && <Tag color="red">逾期</Tag>}
        </Space>
      )
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170,
      render: (t) => formatDate(t)
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <Space>
          {!record.responsible_person_id && (
            <Button 
              type="link" 
              icon={<UserAddOutlined />}
              onClick={() => { setSelectedProblem(record); setAssignModal(true); }}
            >
              派发
            </Button>
          )}
          {record.status !== 'closed' && (
            <Popconfirm
              title="确认关闭此问题？"
              onConfirm={() => handleClose(record)}
              okText="确认"
              cancelText="取消"
            >
              <Button type="link" icon={<CloseOutlined />}>关闭</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">问题列表</h2>

      <div style={{ marginBottom: 16, display: 'flex', gap: 16 }}>
        <Select
          placeholder="按状态筛选"
          style={{ width: 150 }}
          allowClear
          value={filters.status || undefined}
          onChange={(v) => setFilters(f => ({ ...f, status: v || '' }))}
        >
          {Object.entries({
            registered: '已登记', assigned: '已派发', rectifying: '整改中',
            rectified: '已整改', retest_passed: '复测通过', closed: '已关闭'
          }).map(([k, v]) => (
            <Select.Option key={k} value={k}>{v}</Select.Option>
          ))}
        </Select>
        <Select
          placeholder="按等级筛选"
          style={{ width: 150 }}
          allowClear
          value={filters.defect_level_id || undefined}
          onChange={(v) => setFilters(f => ({ ...f, defect_level_id: v || '' }))}
        >
          {defectLevels.map(d => (
            <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
          ))}
        </Select>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        rowClassName={(record) => record.is_overdue ? 'overdue-row' : ''}
        pagination={{ pageSize: 10 }}
        expandable={{
          expandedRowRender: (record) => (
            <p style={{ margin: 0, color: '#666' }}>
              <strong>描述:</strong> {record.description || '无'}
            </p>
          ),
        }}
      />

      <Modal
        title="派发整改任务"
        open={assignModal}
        onCancel={() => setAssignModal(false)}
        footer={null}
        width={500}
      >
        <Form form={assignForm} layout="vertical" onFinish={handleAssign}>
          <Form.Item name="responsible_person_id" label="整改责任人" rules={[{ required: true }]}>
            <Select placeholder="选择整改负责人">
              {users.filter(u => u.role === 'rectification').map(u => (
                <Select.Option key={u.id} value={u.id}>{u.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="deadline" label="整改截止日期">
            <Input type="date" />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setAssignModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认派发</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ProblemList;
