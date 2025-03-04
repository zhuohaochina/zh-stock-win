const sequelize = require('../config/database');

/**
 * 获取表的列元数据
 */
async function getTableMetadata(tableName) {
  try {
    const [metadataResults] = await sequelize.query(
      'SELECT metadata FROM table_metadata WHERE table_name = ?',
      {
        replacements: [tableName],
        type: sequelize.QueryTypes.SELECT
      }
    );
    return metadataResults ? metadataResults.metadata : null;
  } catch (error) {
    console.error('获取表元数据失败:', error);
    return null;
  }
}

/**
 * 执行SQL查询
 */
const executeSql = async (req, res) => {
  const { sql, pageSize = 10, page = 1, sortField, sortOrder } = req.body;

  if (!sql) {
    return res.status(400).json({
      success: false,
      message: '请提供SQL查询语句'
    });
  }

  // 检查SQL语句是否是SELECT查询
  if (!sql.trim().toLowerCase().startsWith('select')) {
    return res.status(400).json({
      success: false,
      message: '只允许执行SELECT查询'
    });
  }

  try {
    console.log('执行SQL查询:', sql);
    
    // 构建基础查询
    let baseQuery = sql.trim();
    
    // 添加排序
    if (sortField && sortOrder) {
      const direction = sortOrder === 'ascend' ? 'ASC' : 'DESC';
      baseQuery = `SELECT * FROM (${baseQuery}) as sorted_data ORDER BY "${sortField}" ${direction}`;
    }
    
    // 计算总记录数
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as subquery`;
    const [countResult] = await sequelize.query(countSql, {
      type: sequelize.QueryTypes.SELECT
    });
    const total = parseInt(countResult.total);
    
    // 计算偏移量
    const offset = (page - 1) * pageSize;
    
    // 添加分页
    let finalSql = `SELECT * FROM (${baseQuery}) as paged_data LIMIT ${pageSize} OFFSET ${offset}`;
    
    // 执行最终查询
    const results = await sequelize.query(finalSql, {
      type: sequelize.QueryTypes.SELECT
    });

    // 从SQL语句中提取表名
    const tableNameMatch = sql.match(/from\s+([^\s,;]+)/i);
    const tableName = tableNameMatch ? tableNameMatch[1].replace(/['"]/g, '') : null;
    
    // 获取表的元数据
    let metadata = null;
    if (tableName) {
      metadata = await getTableMetadata(tableName);
    }

    // 处理列信息
    let columns = [];
    if (results && results.length > 0) {
      const sampleRow = results[0];
      columns = Object.keys(sampleRow)
        .filter(key => key !== 'id') // 过滤掉 id 列
        .map(key => {
          const columnMetadata = metadata?.columnHeaders?.[key] || key;
          return {
            field: key,
            header: columnMetadata
          };
        });
    }

    console.log('查询结果:', results);
    console.log('总记录数:', total);
    console.log('列信息:', columns);

    // 从结果中移除 id 字段
    const processedResults = results.map(row => {
      const { id, ...rest } = row;
      return rest;
    });

    res.json({
      success: true,
      data: processedResults,
      columns: columns,
      total: total,
      page: page,
      pageSize: pageSize
    });
  } catch (error) {
    console.error('SQL查询出错:', error);
    res.status(500).json({
      success: false,
      message: `SQL查询失败: ${error.message}`
    });
  }
};

module.exports = {
  executeSql
}; 