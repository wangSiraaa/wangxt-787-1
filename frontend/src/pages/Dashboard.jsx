import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, List, Tag, Space, Table, Progress } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  ExperimentOutlined,
  AlertOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { dashboardAPI } from '../services/api';
import { getStatusLabel, getStatusColor, formatDate } from '../utils/constants';

function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [byStatus, setByStatus] = useState([]);
  const [byLevel, setByLevel] = useState([]);
  const [overdue, setOverdue] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ov, st, lv, od, ac] = await Promise.all([
        dashboardAPI.overview(),
        dashboardAPI.problemsByStatus(),
        dashboardAPI.problemsByLevel(),
        dashboardAPI.overdueProblems(),
        dashboardAPI.recentActivities(10),
      ]);
      setOverview(ov.data);
      setByStatus(st.data);
      setByLevel(lv.data);
      setOverdue(od.data);
      setActivities(ac.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div>
      <h2 className="page-title">项目看板</h2>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="试模批次"
              value={overview?.totalBatches || 0}
              prefix={<ExperimentOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="问题总数"
              value={overview?.totalProblems || 0}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="已关闭问题"
              value={overview?.closedProblems || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="通过批次数"
              value={overview?.passedBatches || 0}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="未关闭严重问题"
              value={overview?.criticalOpenCount || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="关闭率"
              value={overview?.closureRate || 0}
              suffix="%"
              prefix={<Progress type="circle" percent={overview?.closureRate || 0} size={40} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="问题状态分布" style={{ marginBottom: 16 }} loading={loading}>
            <Row gutter={[16, 16]}>
              {byStatus.map((item) => (
                <Col span={8} key={item.status}>
                  <Card size="small" className="dashboard-card">
                    <div className="number" style={{ color: item.count > 0 ? '#1890ff' : '#999' }}>
                      {item.count}
                    </div>
                    <div className="label">
                      <Tag color={getStatusColor(item.status)}>{item.label}</Tag>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="缺陷等级分布" style={{ marginBottom: 16 }} loading={loading}>
            <Row gutter={[16, 16]}>
              {byLevel.map((item) => (
                <Col span={6} key={item.id}>
                  <Card size="small" className="dashboard-card">
                    <div className="number" style={{ color: item.level === 1 ? '#ff4d4f' : '#faad14' }}>
                      {item.count}
                    </div>
                    <div className="label">{item.name}</div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card 
            title={
              <Space>
                <ClockCircleOutlined style={{ color: '#ff4d4f' }} />
                逾期整改 ({overdue?.overdue || 0}项)
              </Space>
            } 
            style={{ marginBottom: 16 }} 
            loading={loading}
            bodyStyle={{ maxHeight: 400, overflow: 'auto' }}
          >
            <List
              dataSource={overdue?.list || []}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <span className="critical-problem">{item.title}</span>
                        <Tag color="red">逾期</Tag>
                        <Tag color={getStatusColor(item.status)}>{getStatusLabel(item.status)}</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={0}>
                        <span>批次: {item.batch_no} | 模具: {item.mold_name}</span>
                        <span>责任人: {item.responsible_person_name || '未指派'} | 截止: {item.deadline}</span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col span={12}>
          <Card title="最近动态" style={{ marginBottom: 16 }} loading={loading}>
            <List
              dataSource={activities}
              renderItem={(item) => (
                <List.Item key={item.id}>
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{item.problem_title}</span>
                        <Tag color="blue">{item.new_status && getStatusLabel(item.new_status)}</Tag>
                      </Space>
                    }
                    description={
                      <Space>
                        <span>{item.operator_name}</span>
                        <span>{item.remark}</span>
                        <span style={{ color: '#999' }}>{formatDate(item.created_at)}</span>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
