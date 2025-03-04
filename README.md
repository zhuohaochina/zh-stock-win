# Excel数据上传与展示系统

这是一个全栈Web应用，允许用户上传Excel表格，将数据存储到PostgreSQL数据库中，并在前端以表格形式展示数据。

## 技术栈

- 前端：Vue.js 3 + Vite
- 后端：Node.js + Express
- 数据库：PostgreSQL
- 文件解析：ExcelJS

## 项目结构

```
/
├── client/             # Vue前端
├── server/             # Node.js后端
├── README.md           # 项目说明
└── docker-compose.yml  # Docker配置（可选）
```

## 功能特性

- Excel文件上传
- 数据解析与存储
- 数据表格展示
- 分页查询

## 安装与运行

### 前提条件

- Node.js 16+
- PostgreSQL
- npm 或 yarn

### 前端

```bash
cd client
npm install
npm run dev
```

### 后端

```bash
cd server
npm install
npm run dev
```

### 数据库设置

1. 创建PostgreSQL数据库
2. 配置server/.env文件中的数据库连接信息

## 使用方法

1. 启动前端和后端服务
2. 访问 http://localhost:5173
3. 点击"上传Excel"按钮选择文件
4. 上传成功后数据将自动显示在表格中 