const { Client } = require('pg');

// 使用之前.env中发现的信息
const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'stock', // 使用之前的数据库名
  user: 'postgres',
  password: '123456' // 使用之前的密码
});

async function testConnection() {
  try {
    // 连接数据库
    await client.connect();
    console.log('✅ 成功连接到数据库!');
    
    // 尝试执行简单查询
    const res = await client.query('SELECT NOW() as current_time');
    console.log('当前数据库时间:', res.rows[0].current_time);
    
    // 关闭连接
    await client.end();
    console.log('数据库连接已关闭');
  } catch (err) {
    console.error('❌ 连接数据库失败:', err.message);
    console.log('\n请确认以下信息:');
    console.log('1. PostgreSQL服务是否正在运行');
    console.log('2. 数据库名称"stock"是否正确');
    console.log('3. 用户名"postgres"和密码"123456"是否正确');
  }
}

testConnection(); 