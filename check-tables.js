const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'stock',
  user: 'postgres',
  password: '123456'
});

async function checkTables() {
  try {
    await client.connect();
    console.log('已连接到数据库');
    
    // 查询所有表
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    if (res.rows.length === 0) {
      console.log('数据库中没有表，需要创建新表');
    } else {
      console.log('数据库中已有的表:');
      res.rows.forEach(row => {
        console.log(`- ${row.table_name}`);
      });
    }
    
    await client.end();
  } catch (err) {
    console.error('检查表时出错:', err.message);
  }
}

checkTables(); 