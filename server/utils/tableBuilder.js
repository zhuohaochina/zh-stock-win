const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 根据Excel列信息动态创建数据库表
 * @param {string} tableName - 要创建的表名
 * @param {Array} columns - Excel的列信息
 * @param {boolean} forceRecreate - 如果表已存在是否强制重建
 */
async function createTableFromExcel(tableName, columns, forceRecreate = false) {
  const sanitizedTableName = sanitizeTableName(tableName);
  console.log(`开始创建表: ${sanitizedTableName}`);
  
  try {
    // 先检查表是否存在
    const tableExists = await sequelize.query(
      `SELECT to_regclass('public.${sanitizedTableName}');`
    );
    console.log('表检查结果:', tableExists);

    // 构建表结构
    const modelDefinition = {};
    columns.forEach(column => {
      modelDefinition[column.header] = {
        type: DataTypes.TEXT,
        allowNull: true
      };
    });

    // 添加 id 字段作为主键
    modelDefinition.id = {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    };

    // 使用事务创建表
    const transaction = await sequelize.transaction();
    try {
      const model = sequelize.define(sanitizedTableName, modelDefinition, {
        tableName: sanitizedTableName,
        timestamps: false,
        underscored: true
      });

      await model.sync({ force: true, transaction });
      await transaction.commit();
      console.log(`表 ${sanitizedTableName} 创建成功`);
      
      // 验证表是否真的创建成功
      const tables = await sequelize.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
      );
      console.log('当前数据库中的所有表:', tables[0]);
      
      return model;
    } catch (error) {
      await transaction.rollback();
      throw new Error(`创建表 ${sanitizedTableName} 失败: ${error.message}`);
    }
  } catch (error) {
    console.error('创建表时发生错误:', error);
    throw error;
  }
}

/**
 * 存储列表头映射关系
 */
async function storeColumnHeaders(tableName, columnHeaders) {
  try {
    // 检查是否存在元数据表
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS table_metadata (
        id SERIAL PRIMARY KEY,
        table_name TEXT NOT NULL,
        metadata JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 删除之前的记录
    await sequelize.query(`
      DELETE FROM table_metadata WHERE table_name = ?
    `, {
      replacements: [tableName]
    });
    
    // 插入新记录
    await sequelize.query(`
      INSERT INTO table_metadata (table_name, metadata)
      VALUES (?, ?)
    `, {
      replacements: [tableName, JSON.stringify({ columnHeaders })]
    });
    
    console.log(`已为表 "${tableName}" 存储列表头映射关系`);
  } catch (error) {
    console.error('存储列表头映射关系时出错:', error);
  }
}

/**
 * 将Excel数据插入到动态创建的表中
 * @param {Object} model - Sequelize模型
 * @param {Array} data - Excel数据
 * @param {Array} columns - Excel列信息
 * @returns {number} 插入的记录数量
 */
async function insertDataToTable(model, data, columns) {
  try {
    // 准备要插入的数据
    const records = data.map(item => {
      const record = {};
      
      // 处理每个字段
      columns.forEach(column => {
        // 使用原始表头作为字段名
        const fieldName = column.header.trim() || `column${column.field.replace(/[^0-9]/g, '')}`;
        record[fieldName] = item.rowData[column.field] || null;
      });
      
      return record;
    });
    
    // 批量插入数据
    let insertedCount = 0;
    if (records.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const result = await model.bulkCreate(batch);
        insertedCount += result.length;
      }
    }
    
    // 验证数据是否全部插入
    const totalCount = await model.count();
    console.log(`表 ${model.tableName} 中的总记录数: ${totalCount}`);
    
    return insertedCount;
  } catch (error) {
    console.error('插入数据时出错:', error);
    throw new Error(`向表插入数据失败: ${error.message}`);
  }
}

/**
 * 获取数据库中所有动态创建的表
 */
async function getDynamicTables() {
  try {
    const [results] = await sequelize.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT IN ('excel_data', 'SequelizeMeta')
      ORDER BY table_name
    `);
    
    return results.map(r => r.table_name);
  } catch (error) {
    console.error('获取表列表时出错:', error);
    return [];
  }
}

/**
 * 获取表的列信息，包括原始表头
 */
async function getTableColumns(tableName) {
  try {
    // 获取元数据
    const [metadataResults] = await sequelize.query(`
      SELECT metadata FROM table_metadata WHERE table_name = ?
    `, {
      replacements: [tableName]
    });
    
    let columnHeaders = {};
    
    if (metadataResults.length > 0) {
      columnHeaders = metadataResults[0].metadata.columnHeaders || {};
    }
    
    // 获取表结构
    const [columnsResults] = await sequelize.query(`
      SELECT column_name, data_type, character_maximum_length, column_default
      FROM information_schema.columns
      WHERE table_name = ?
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `, {
      replacements: [tableName]
    });
    
    // 映射列信息，添加原始表头
    return columnsResults
      .filter(col => !['id'].includes(col.column_name)) // 只过滤id字段
      .map(col => ({
        field: col.column_name,
        header: columnHeaders[col.column_name] || col.column_name, // 使用原始表头或默认值
        type: col.data_type,
        maxLength: col.character_maximum_length
      }));
  } catch (error) {
    console.error('获取表列信息时出错:', error);
    throw new Error(`获取表 "${tableName}" 的列信息失败: ${error.message}`);
  }
}

function sanitizeTableName(tableName) {
  // 确保生成一个有效的表名
  if (!tableName || typeof tableName !== 'string') {
    // 如果表名不是有效字符串，提供默认值
    return 'default_table';
  }
  
  // 移除非法字符，只保留字母、数字和下划线
  let sanitized = tableName.replace(/[^a-zA-Z0-9_]/g, '_');
  
  // 确保表名以字母开头
  if (!/^[a-zA-Z]/.test(sanitized)) {
    sanitized = 't_' + sanitized;
  }
  
  // 截断长度，防止表名过长
  if (sanitized.length > 63) { // PostgreSQL限制表名长度为63字符
    sanitized = sanitized.substring(0, 63);
  }
  
  return sanitized.toLowerCase();
}

module.exports = {
  createTableFromExcel,
  insertDataToTable,
  getDynamicTables,
  getTableColumns
}; 