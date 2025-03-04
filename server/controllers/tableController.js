const sequelize = require('../config/database');

/**
 * 更新表中的数据
 */
async function updateTableData(req, res) {
  const { tableName, id } = req.params;
  const data = req.body;

  console.log('1. 接收到的参数：', {
    tableName,
    id,
    data
  });

  if (!tableName || !id || !data) {
    return res.status(400).json({
      success: false,
      message: '缺少必要的参数'
    });
  }

  try {
    // 准备更新字段和值
    const entries = Object.entries(data);
    const fieldNames = entries.map(([key]) => `"${key}"`);
    const placeholders = entries.map((_, index) => `$${index + 1}`);
    const values = entries.map(([_, value]) => value);
    values.push(id); // 添加id作为最后一个参数

    // 构建SQL语句
    const query = `
      UPDATE "${tableName}"
      SET (${fieldNames.join(', ')}) = (${placeholders.join(', ')})
      WHERE id = $${values.length}
    `;

    console.log('2. 构建的SQL语句：', query);
    console.log('3. SQL参数：', values);

    // 执行更新
    const result = await sequelize.query(query, {
      bind: values,
      type: sequelize.QueryTypes.UPDATE
    });

    console.log('4. 更新结果：', result);

    res.json({
      success: true,
      message: '数据更新成功'
    });
  } catch (error) {
    console.error('5. 更新失败，错误信息：', {
      message: error.message,
      stack: error.stack,
      sql: error.sql,
      parameters: error.parameters
    });

    res.status(500).json({
      success: false,
      message: `更新数据失败: ${error.message}`,
      error: error.message,
      details: {
        sql: error.sql,
        parameters: error.parameters
      }
    });
  }
}

module.exports = {
  // ... existing exports ...
  updateTableData
}; 