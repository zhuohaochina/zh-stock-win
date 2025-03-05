const { Client } = require('pg');

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'stock',
  user: 'postgres',
  password: '123456'
});

async function createTable() {
  try {
    await client.connect();
    console.log('已连接到数据库');
    
    // 创建excel_data表
    await client.query(`
      CREATE TABLE IF NOT EXISTS excel_data (
        id SERIAL PRIMARY KEY,
        "file_name" VARCHAR(255) NOT NULL,
        "originalName" VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        "rowIndex" INTEGER NOT NULL,
        "sheet_name" VARCHAR(255),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    // 创建索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS excel_data_file_name_idx ON excel_data("file_name");
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS excel_data_sheet_name_idx ON excel_data("sheet_name");
    `);
    
    console.log('成功创建excel_data表和索引');
    
    await client.end();
  } catch (err) {
    console.error('创建表时出错:', err.message);
  }
}

createTable(); 