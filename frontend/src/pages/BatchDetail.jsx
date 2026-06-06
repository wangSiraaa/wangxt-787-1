import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Table, Button, Space, Tag, Modal, Form, Input, Select, DatePicker, Upload, message, Row, Col, Progress } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import { batchAPI, problemAPI, defectLevelAPI, userAPI } from '../services/api';
import { getStatusLabel, getStatusColor, formatDate } from '../utils/constants';
import dayjs from 'dayjs';

function BatchDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [problemModalVisible, setProblemModalVisible] = useState(false);
  const [defectLevels, setDefectLevels] = useState([]);
  const [users, setUsers] = useState([]);
  const [form] = Form.useForm();
  const [riskInfo, setRiskInfo] = useState(null);

  useEffect(() => {
    loadData();
    loadDefectLevels();
    loadUsers();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await batchAPI.get(id);
      setBatch(res.data);
      
      const riskRes = await fetch(`/api/dashboard/batch/${id}/risks`).then(r => r.json());
      setRiskInfo(riskRes.data);
    } catch (e) {
      message.error('加载数据失败');
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

  const handleCreateProblem = async (values) => {
    try {
      await problemAPI.create({
        ...values,
        batch_id: id,
        photo_urls: [],
        reported_by: values.reported_by,
      });
      message.success('问题登记成功');
      setProblemModalVisible(false);
      form.resetFields();
      loadData();
    } catch (e) {
      message.error(e.response?.data?.message || '登记失败');
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

  const problemColumns = [
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
  ];

  if (!batch) return <div>加载中...</div>;

  const riskLevelClass = riskInfo?.riskLevel === 'high' ? 'risk-high' :
                         riskInfo?.riskLevel === 'medium' ? 'risk-medium' : 'risk-low';
  const riskLevelText = { high: '高风险', medium: '中风险', low: '低风险' }[riskInfo?.riskLevel || 'low'];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
      </div>

      <Card title="批次基本信息" style={{ marginBottom: 16 }} loading={loading}>
        <Row gutter={24}>
          <Col span={18}>
            <Descriptions column={3}>
              <Descriptions.Item label="批次号">{batch.batch_no}</Descriptions.Item>
              <Descriptions.Item label="模具编号">{batch.mold_code}</Descriptions.Item>
              <Descriptions.Item label="模具名称">{batch.mold_name}</Descriptions.Item>
              <Descriptions.Item label="项目名称">{batch.project_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="试模日期">{batch.trial_date}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={getStatusColor(batch.status)}>{getStatusLabel(batch.status)}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Col>
          <Col span={6}>
            <Card size="small" title="风险评估">
              <div className={riskLevelClass} style={{ fontSize: 24, textAlign: 'center' }}>
                {riskLevelText}
              </div>
              <div style={{ textAlign: 'center', marginTop: 8, color: '#666' }}>
                严重问题: {riskInfo?.criticalCount || 0} | 逾期: {riskInfo?.overdueCount || 0}
              </div>
              <Progress 
                percent={riskInfo?.totalProblems > 0 ? Math.round((riskInfo?.closedCount || 0) / riskInfo.totalProblems * 100) : 0} 
                style={{ marginTop: 12 }}
              />
              <div style={{ textAlign: 'center', fontSize: 12, color: '#999' }}>
                关闭率 {riskInfo?.totalProblems > 0 ? Math.round((riskInfo?.closedCount || 0) / riskInfo.totalProblems * 100) : 0}%
              </div>
            </Card>
          </Col>
        </Row>
      </Card>

      <Card 
        title="问题列表" 
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setProblemModalVisible(true)}>
            登记问题
          </Button>
        }
        loading={loading}
      >
        <Table
          columns={problemColumns}
          dataSource={batch.problems || []}
          rowKey="id"
          rowClassName={(record) => record.is_overdue ? 'overdue-row' : ''}
          pagination={{ pageSize: 10 }}
          expandable={{
            expandedRowRender: (record) => (
              <p style={{ margin: 0, color: '#666' }}>
                <strong>问题描述:</strong> {record.description || '无'}
              </p>
            ),
          }}
        />
      </Card>

      <Modal
        title="登记质量问题"
        open={problemModalVisible}
        onCancel={() => setProblemModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateProblem}>
          <Form.Item name="title" label="问题标题" rules={[{ required: true, message: '请输入问题标题' }]}>
            <Input placeholder="简要描述问题" />
          </Form.Item>
          <Form.Item name="description" label="问题描述">
            <Input.TextArea rows={4} placeholder="详细描述问题现象和位置" />
          </Form.Item>
          <Form.Item name="defect_level_id" label="缺陷等级" rules={[{ required: true, message: '请选择缺陷等级' }]}>
            <Select placeholder="选择缺陷等级">
              {defectLevels.map(d => (
                <Select.Option key={d.id} value={d.id}>
                  {d.name} {d.require_retest ? '(需复测)' : ''}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="reported_by" label="登记人" rules={[{ required: true, message: '请选择登记人' }]}>
            <Select placeholder="选择质量人员">
              {users.filter(u => u.role === 'quality').map(u => (
                <Select.Option key={u.id} value={u.id}>{u.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item label="问题照片">
            <Upload multiple listType="picture">
              <Button icon={<UploadOutlined />}>上传照片</Button>
            </Upload>
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setProblemModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交登记</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BatchDetail;
