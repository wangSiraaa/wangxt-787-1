import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Modal, Form, Input, message, Card, Timeline, Row, Col, Statistic } from 'antd';
import { ToolOutlined, PlayCircleOutlined, SendOutlined } from '@ant-design/icons';
import { problemAPI, userAPI, defectLevelAPI } from '../services/api';
import { getStatusLabel, getStatusColor, formatDate } from '../utils/constants';

function RectificationWorkbench() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [defectLevels, setDefectLevels] = useState([]);
  const [measureModal, setMeasureModal] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [measureForm] = Form.useForm();
  const [stats, setStats] = useState({ total: 0, rectifying: 0, overdue: 0, done: 0 });

  useEffect(() => {
    loadData();
    loadUsers();
    loadDefectLevels();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await problemAPI.list();
      const myTasks = res.data.filter(p => 
        p.responsible_person_id === 'user_resp' || 
        ['assigned', 'rectifying', 'rectified'].includes(p.status)
      );
      setData(myTasks);
      
      setStats({
        total: myTasks.length,
        rectifying: myTasks.filter(p => ['assigned', 'rectifying'].includes(p.status)).length,
        overdue: myTasks.filter(p => p.is_overdue).length,
        done: myTasks.filter(p => p.status === 'rectified').length,
      });
    } catch (e) {
      message.error('加载失败');
    }
    setLoading(false);
  };

  const loadUsers = async () => {
    const res = await userAPI.list();
    setUsers(res.data);
  };

  const loadDefectLevels = async () => {
    const res = await defectLevelAPI.list();
    setDefectLevels(res.data);
  };

  const handleStartRectify = async (record) => {
    try {
      await problemAPI.startRectify(record.id, { operator_id: 'user_resp' });
      message.success('已开始整改');
      loadData();
    } catch (e) {
      message.error('操作失败');
    }
  };

  const handleSubmitMeasure = async (values) => {
    try {
      await problemAPI.addMeasure(selectedProblem.id, {
        measure_text: values.measure_text,
        submitted_by: 'user_resp',
      });
      message.success('整改措施已提交');
      setMeasureModal(false);
      measureForm.resetFields();
      loadData();
    } catch (e) {
      message.error(e.response?.data?.message || '提交失败');
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
    { title: '截止日期', dataIndex: 'deadline', key: 'deadline', width: 120,
      render: (d, record) => (
        <Space>
          <span style={{ color: record.is_overdue ? '#ff4d4f' : 'inherit' }}>{d || '-'}</span>
          {record.is_overdue && <Tag color="red">逾期</Tag>}
        </Space>
      )
    },
    { title: '登记时间', dataIndex: 'created_at', key: 'created_at', width: 170,
      render: (t) => formatDate(t)
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space>
          {record.status === 'assigned' && (
            <Button 
              type="primary" 
              size="small" 
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartRectify(record)}
            >
              开始整改
            </Button>
          )}
          {record.status === 'rectifying' && (
            <Button 
              type="primary" 
              size="small" 
              icon={<SendOutlined />}
              onClick={() => { setSelectedProblem(record); setMeasureModal(true); }}
            >
              提交措施
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">整改工作台</h2>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="待整改任务" value={stats.total} prefix={<ToolOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="整改中" value={stats.rectifying} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已逾期" value={stats.overdue} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="已完成" value={stats.done} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        rowClassName={(record) => record.is_overdue ? 'overdue-row' : ''}
        pagination={{ pageSize: 10 }}
        expandable={{
          expandedRowRender: (record) => (
            <div>
              <p style={{ marginBottom: 8 }}><strong>问题描述:</strong> {record.description || '无'}</p>
              {record.measures && record.measures.length > 0 && (
                <div>
                  <strong>整改措施历史:</strong>
                  <Timeline size="small" style={{ marginTop: 8 }}>
                    {record.measures.map((m, idx) => (
                      <Timeline.Item key={idx}>
                        <Space>
                          <span>{m.measure_text}</span>
                          <span style={{ color: '#999' }}>{formatDate(m.submitted_at)}</span>
                        </Space>
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </div>
              )}
            </div>
          ),
        }}
      />

      <Modal
        title="提交整改措施"
        open={measureModal}
        onCancel={() => setMeasureModal(false)}
        footer={null}
        width={500}
      >
        <Form form={measureForm} layout="vertical" onFinish={handleSubmitMeasure}>
          <Form.Item name="measure_text" label="整改措施" rules={[{ required: true, message: '请输入整改措施' }]}>
            <Input.TextArea 
              rows={6} 
              placeholder="请详细描述整改措施，包括：1. 原因分析 2. 整改方案 3. 完成时间"
            />
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setMeasureModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default RectificationWorkbench;
