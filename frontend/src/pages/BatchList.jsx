import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Form, Input, DatePicker, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, EyeOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Link, useNavigate } from 'react-router-dom';
import { batchAPI, userAPI } from '../services/api';
import { getBatchStatusLabel, getBatchStatusColor } from '../utils/constants';
import dayjs from 'dayjs';

function BatchList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [users, setUsers] = useState([]);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
    loadUsers();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await batchAPI.list();
      setData(res.data);
    } catch (e) {
      message.error('加载数据失败');
    }
    setLoading(false);
  };

  const loadUsers = async () => {
    const res = await userAPI.list();
    setUsers(res.data);
  };

  const handleCreate = async (values) => {
    try {
      await batchAPI.create({
        ...values,
        trial_date: values.trial_date.format('YYYY-MM-DD'),
        created_by: values.created_by,
      });
      message.success('批次创建成功');
      setModalVisible(false);
      form.resetFields();
      loadData();
    } catch (e) {
      message.error(e.response?.data?.message || '创建失败');
    }
  };

  const handleConclusion = async (record, conclusion) => {
    try {
      await batchAPI.setConclusion(record.id, { conclusion, operator_id: 'user_engineer' });
      message.success(`试模结论已发布: ${conclusion === 'passed' ? '通过' : '未通过'}`);
      loadData();
    } catch (e) {
      message.error(e.response?.data?.message || '操作失败');
    }
  };

  const columns = [
    { title: '批次号', dataIndex: 'batch_no', key: 'batch_no', width: 150,
      render: (text, record) => <Link to={`/batches/${record.id}`}>{text}</Link>
    },
    { title: '模具编号', dataIndex: 'mold_code', key: 'mold_code', width: 120 },
    { title: '模具名称', dataIndex: 'mold_name', key: 'mold_name' },
    { title: '项目名称', dataIndex: 'project_name', key: 'project_name' },
    { title: '试模日期', dataIndex: 'trial_date', key: 'trial_date', width: 120 },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s) => <Tag color={getBatchStatusColor(s)}>{getBatchStatusLabel(s)}</Tag>
    },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170 },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(`/batches/${record.id}`)}>
            详情
          </Button>
          {record.status === 'processing' && (
            <>
              <Popconfirm
                title="确认发布试模通过？"
                description="发布前请确保所有严重问题已关闭"
                onConfirm={() => handleConclusion(record, 'passed')}
                okText="确认"
                cancelText="取消"
              >
                <Button type="link" icon={<CheckOutlined />} style={{ color: '#52c41a' }}>
                  通过
                </Button>
              </Popconfirm>
              <Button type="link" icon={<CloseOutlined />} danger onClick={() => handleConclusion(record, 'failed')}>
                不通过
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 className="page-title">试模批次管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
          新建批次
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title="新建试模批次"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="batch_no" label="批次号" rules={[{ required: true, message: '请输入批次号' }]}>
            <Input placeholder="例如: SM-2024-001" />
          </Form.Item>
          <Form.Item name="mold_code" label="模具编号" rules={[{ required: true, message: '请输入模具编号' }]}>
            <Input placeholder="例如: M-001" />
          </Form.Item>
          <Form.Item name="mold_name" label="模具名称" rules={[{ required: true, message: '请输入模具名称' }]}>
            <Input placeholder="例如: 注塑模具A" />
          </Form.Item>
          <Form.Item name="project_name" label="项目名称">
            <Input placeholder="例如: 汽车内饰件项目" />
          </Form.Item>
          <Form.Item name="trial_date" label="试模日期" rules={[{ required: true, message: '请选择试模日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="created_by" label="创建人" rules={[{ required: true, message: '请选择创建人' }]}>
            <Select placeholder="选择项目工程师">
              {users.filter(u => u.role === 'engineer').map(u => (
                <Select.Option key={u.id} value={u.id}>{u.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BatchList;
