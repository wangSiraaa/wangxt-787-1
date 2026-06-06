import React, { useState, useEffect } from 'react';
import { Table, Tag, Button, Space, Modal, Form, Input, Radio, Upload, message, Card, Row, Col, Statistic, List } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, UploadOutlined, FileTextOutlined } from '@ant-design/icons';
import { problemAPI, defectLevelAPI, userAPI } from '../services/api';
import { getStatusLabel, getStatusColor, formatDate } from '../utils/constants';

function RetestForm() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [defectLevels, setDefectLevels] = useState([]);
  const [users, setUsers] = useState([]);
  const [retestModal, setRetestModal] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [retestForm] = Form.useForm();
  const [stats, setStats] = useState({ total: 0, pending: 0, passed: 0, failed: 0 });

  useEffect(() => {
    loadData();
    loadDefectLevels();
    loadUsers();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await problemAPI.list();
      const pendingRetest = res.data.filter(p => 
        ['rectified', 'retest_passed', 'closed'].includes(p.status)
      );
      setData(pendingRetest);
      
      setStats({
        total: pendingRetest.length,
        pending: pendingRetest.filter(p => p.status === 'rectified').length,
        passed: pendingRetest.filter(p => p.status === 'retest_passed').length,
        failed: pendingRetest.filter(p => p.retests?.some(r => r.result === 'failed')).length,
      });
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

  const handleRetest = async (values) => {
    try {
      await problemAPI.retest(selectedProblem.id, {
        ...values,
        photo_urls: [],
        tested_by: 'user_retest',
      });
      message.success(`复测${values.result === 'passed' ? '通过' : '失败'}`);
      setRetestModal(false);
      retestForm.resetFields();
      loadData();
    } catch (e) {
      message.error(e.response?.data?.message || '操作失败');
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
    { title: '问题标题', dataIndex: 'title', key: 'title', width: 200 },
    { title: '缺陷等级', dataIndex: 'defect_level_id', key: 'defect_level_id', width: 100,
      render: (id) => <Tag color={getDefectLevelColor(id)}>{getDefectLevelName(id)}</Tag>
    },
    { title: '当前状态', dataIndex: 'status', key: 'status', width: 100,
      render: (s) => <Tag color={getStatusColor(s)}>{getStatusLabel(s)}</Tag>
    },
    { title: '整改责任人', dataIndex: 'responsible_person_id', key: 'responsible_person_id', width: 100,
      render: (uid) => {
        const u = users.find(x => x.id === uid);
        return u?.name || '-';
      }
    },
    { 
      title: '复测历史', 
      key: 'retests', 
      width: 200,
      render: (_, record) => {
        const retests = record.retests || [];
        if (retests.length === 0) return <span style={{ color: '#999' }}>暂无</span>;
        return (
          <Space direction="vertical" size={0}>
            {retests.slice(0, 2).map((r, idx) => (
              <Tag key={idx} color={r.result === 'passed' ? 'green' : 'red'}>
                {r.result === 'passed' ? '通过' : '失败'} - {formatDate(r.tested_at)}
              </Tag>
            ))}
          </Space>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space>
          {record.status === 'rectified' && (
            <Button 
              type="primary" 
              size="small" 
              onClick={() => { setSelectedProblem(record); setRetestModal(true); }}
            >
              执行复测
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 className="page-title">复测验证</h2>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="复测任务总数" value={stats.total} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="待复测" value={stats.pending} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="复测通过" value={stats.passed} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="复测失败" value={stats.failed} prefix={<CloseCircleOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
        expandable={{
          expandedRowRender: (record) => (
            <div>
              <p style={{ marginBottom: 8 }}><strong>问题描述:</strong> {record.description || '无'}</p>
              {record.measures && record.measures.length > 0 && (
                <div>
                  <strong>整改措施:</strong>
                  <List
                    size="small"
                    dataSource={record.measures}
                    renderItem={(item) => (
                      <List.Item>
                        <List.Item.Meta
                          title={item.measure_text}
                          description={`提交人: ${item.submitter_name || '-'} | ${formatDate(item.submitted_at)}`}
                        />
                      </List.Item>
                    )}
                    style={{ marginTop: 8 }}
                  />
                </div>
              )}
            </div>
          ),
        }}
      />

      <Modal
        title="执行复测"
        open={retestModal}
        onCancel={() => setRetestModal(false)}
        footer={null}
        width={500}
      >
        <Form form={retestForm} layout="vertical" onFinish={handleRetest}>
          <Form.Item label="问题">
            <div style={{ padding: '8px 12px', background: '#f5f5f5', borderRadius: 4 }}>
              {selectedProblem?.title}
            </div>
          </Form.Item>
          <Form.Item name="result" label="复测结论" rules={[{ required: true, message: '请选择复测结论' }]}>
            <Radio.Group>
              <Radio.Button value="passed" style={{ color: '#52c41a' }}>
                <CheckCircleOutlined /> 复测通过
              </Radio.Button>
              <Radio.Button value="failed" style={{ color: '#ff4d4f' }}>
                <CloseCircleOutlined /> 复测失败
              </Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="remark" label="复测说明">
            <Input.TextArea 
              rows={4} 
              placeholder="请填写复测说明，复测失败请注明原因"
            />
          </Form.Item>
          <Form.Item label="复测照片">
            <Upload multiple listType="picture">
              <Button icon={<UploadOutlined />}>上传照片</Button>
            </Upload>
          </Form.Item>
          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button onClick={() => setRetestModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交复测</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default RetestForm;
