import React, { useState } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu, theme } from 'antd';
import {
  DashboardOutlined,
  ExperimentOutlined,
  AlertOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import BatchList from './pages/BatchList';
import BatchDetail from './pages/BatchDetail';
import ProblemList from './pages/ProblemList';
import RectificationWorkbench from './pages/RectificationWorkbench';
import RetestForm from './pages/RetestForm';
import RiskBoard from './pages/RiskBoard';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: <Link to="/">项目看板</Link> },
  { key: '/batches', icon: <ExperimentOutlined />, label: <Link to="/batches">试模批次</Link> },
  { key: '/problems', icon: <AlertOutlined />, label: <Link to="/problems">问题列表</Link> },
  { key: '/rectification', icon: <ToolOutlined />, label: <Link to="/rectification">整改工作台</Link> },
  { key: '/retest', icon: <CheckCircleOutlined />, label: <Link to="/retest">复测验证</Link> },
  { key: '/risks', icon: <WarningOutlined />, label: <Link to="/risks">风险看板</Link> },
];

function App() {
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  return (
    <Layout>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        <div className="logo">
          <ExperimentOutlined />
          模具试模问题闭环系统
        </div>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>
          质量人员 | 整改负责人 | 复测人员
        </div>
      </Header>
      <Layout>
        <Sider width={200} style={{ background: colorBgContainer }}>
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            defaultOpenKeys={['sub1']}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems}
          />
        </Sider>
        <Layout style={{ padding: '24px' }}>
          <Content
            style={{
              padding: 24,
              margin: 0,
              minHeight: 280,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/batches" element={<BatchList />} />
              <Route path="/batches/:id" element={<BatchDetail />} />
              <Route path="/problems" element={<ProblemList />} />
              <Route path="/rectification" element={<RectificationWorkbench />} />
              <Route path="/retest" element={<RetestForm />} />
              <Route path="/risks" element={<RiskBoard />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
}

export default App;
