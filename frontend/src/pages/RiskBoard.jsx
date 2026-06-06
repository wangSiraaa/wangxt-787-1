import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Alert, List, Tag, Space, Table, Statistic, Progress } from 'antd';
import { WarningOutlined, AlertOutlined, ClockCircleOutlined, FireOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { dashboardAPI, batchAPI, problemAPI, defectLevelAPI } from '../services/api';
import { getStatusLabel, getStatusColor, formatDate } from '../utils/constants';

function RiskBoard() {
  const [overdueProblems, setOverdueProblems] = useState([]);
  const [criticalProblems, setCriticalProblems] = useState([]);
  const [batchRisks, setBatchRisks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [defectLevels, setDefectLevels] = useState([]);

  useEffect(() => {
    loadData();
    loadDefectLevels();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const overdueRes = await dashboardAPI.overdueProblems();
      setOverdueProblems(overdueRes.data.list || []);

      const criticalLevel = await fetch('/api/defect-levels').then(r => r.json());
      const severeLevel = criticalLevel.data.find(d => d.name === '严重');
      if (severeLevel) {
        const problemsRes = await problemAPI.list({ defect_level_id: severeLevel.id });
        setCriticalProblems(problemsRes.data.filter(p => p.status !== 'closed'));
      }

      const batchesRes = await batchAPI.list();
      const risks = [];
      for (const batch of batchesRes.data) {
        const riskRes = await dashboardAPI.batchRisks(batch.id);
        risks.push({
          ...batch,
          risk: riskRes.data
        });
      }
      setBatchRisks(risks);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadDefectLevels = async () => {
    const res = await defectLevelAPI.list();
    setDefectLevels(res.data);
  };

  const getRiskColor = (level) => {
    switch (level) {
      case 'high': return '#ff4d4f';
      case 'medium': return '#faad14';
      case 'low': return '#52c41a';
      default: return '#d9d9d9';
    }
  };

  const getRiskText = (level) => {
    switch (level) {
      case 'high': return '高风险';
      case 'medium': return '中风险';
      case 'low': return '低风险';
      default: return '未知';
    }
  };

  const batchColumns = [
    { title: '批次号', dataIndex: 'batch_no', key: 'batch_no', width: 140 },
    { title: '模具', dataIndex: 'mold_name', key: 'mold_name' },
    { 
      title: '风险等级', 
      dataIndex: ['risk', 'riskLevel'], 
      key: 'riskLevel', 
      width: 100,
      render: (level) => (
        <Tag color={getRiskColor(level)} style={{ fontWeight: 'bold' }}>
          {getRiskText(level)}
        </Tag>
      )
    },
    { 
      title: '严重问题', 
      dataIndex: ['risk', 'criticalCount'], 
      key: 'criticalCount', 
      width: 100,
      render: (count) => count > 0 ? <Tag color="red">{count} 项</Tag> : <span style={{ color: '#999' }}>0</span>
    },
    { 
      title: '逾期问题', 
      dataIndex: ['risk', 'overdueCount'], 
      key: 'overdueCount', 
      width: 100,
      render: (count) => count > 0 ? <Tag color="orange">{count} 项</Tag> : <span style={{ color: '#999' }}>0</span>
    },
    { 
      title: '关闭进度', 
      key: 'progress', 
      width: 150,
      render: (_, record) => {
        const total = record.risk?.totalProblems || 0;
        const closed = record.risk?.closedCount || 0;
        const percent = total > 0 ? Math.round((closed / total) * 100) : 0;
        return (
          <Space>
            <Progress percent={percent} size="small" style={{ width: 100 }} />
            <span>{closed}/{total}</span>
          </Space>
        );
      }
    },
    { title: '试模日期', dataIndex: 'trial_date', key: 'trial_date', width: 120 },
  ];

  return (
    <div>
      <h2 className="page-title">风险看板</h2>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card style={{ borderLeft: '4px solid #ff4d4f' }}>
            <Statistic 
              title={
                <Space><FireOutlined style={{ color: '#ff4d4f' }} />高风险批次</Space>
              } 
              value={batchRisks.filter(b => b.risk?.riskLevel === 'high').length}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderLeft: '4px solid #faad14' }}>
            <Statistic 
              title={
                <Space><WarningOutlined style={{ color: '#faad14' }} />中风险批次</Space>
              } 
              value={batchRisks.filter(b => b.risk?.riskLevel === 'medium').length}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderLeft: '4px solid #ff4d4f' }}>
            <Statistic 
              title={
                <Space><AlertOutlined style={{ color: '#ff4d4f' }} />未关闭严重问题</Space>
              } 
              value={criticalProblems.length}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card style={{ borderLeft: '4px solid #faad14' }}>
            <Statistic 
              title={
                <Space><ClockCircleOutlined style={{ color: '#faad14' }} />逾期整改</Space>
              } 
              value={overdueProblems.length}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {criticalProblems.length > 0 && (
        <Alert
          message={`存在 ${criticalProblems.length} 个未关闭的严重问题，可能影响试模通过结论`}
          type="error"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      {overdueProblems.length > 0 && (
        <Alert
          message={`存在 ${overdueProblems.length} 个逾期未完成的整改任务`}
          type="warning"
          showIcon
          style={{ marginBottom: 24 }}
        />
      )}

      <Row gutter={16}>
        <Col span={12}>
          <Card 
            title={
              <Space>
                <AlertOutlined style={{ color: '#ff4d4f' }} />
                未关闭严重问题
              </Space>
            } 
            style={{ marginBottom: 16 }} 
            loading={loading}
            bodyStyle={{ maxHeight: 400, overflow: 'auto' }}
          >
            <List
              dataSource={criticalProblems}
              renderItem={(item) => (
                <List.Item key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <span className="critical-problem">{item.title}</span>
                        <Tag color={getStatusColor(item.status)}>{getStatusLabel(item.status)}</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <span>责任人: {item.responsible_person_id ? '王整改' : '未指派'}</span>
                        <span>截止: {item.deadline || '未设置'}</span>
                        <span style={{ color: '#999' }}>{formatDate(item.created_at)}</span>
                      </Space>
                    }
                  />
                  <Tag color="red" icon={<FireOutlined />}>严重</Tag>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col span={12}>
          <Card 
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#faad14' }} />
                逾期整改清单
              </Space>
            } 
            style={{ marginBottom: 16 }} 
            loading={loading}
            bodyStyle={{ maxHeight: 400, overflow: 'auto' }}
          >
            <List
              dataSource={overdueProblems}
              renderItem={(item) => (
                <List.Item key={item.id} style={{ background: '#fff1f0', marginBottom: 8, borderRadius: 4 }}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <span style={{ fontWeight: 500 }}>{item.title}</span>
                        <Tag color="red">逾期</Tag>
                        <Tag color={getStatusColor(item.status)}>{getStatusLabel(item.status)}</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <span>批次: {item.batch_no} | 模具: {item.mold_name}</span>
                        <span>责任人: {item.responsible_person_name || '未指派'}</span>
                        <span style={{ color: '#ff4d4f' }}>截止日期: {item.deadline}</span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Card title="各批次风险概览" loading={loading}>
        <Table
          columns={batchColumns}
          dataSource={batchRisks}
          rowKey="id"
          rowClassName={(record) => record.risk?.riskLevel === 'high' ? 'overdue-row' : ''}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}

export default RiskBoard;
