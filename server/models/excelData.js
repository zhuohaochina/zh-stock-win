const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// 定义一个动态的Excel数据模型
// 我们使用JSONB类型来存储每行数据，这样可以灵活处理不同结构的Excel文件
const ExcelData = sequelize.define('ExcelData', {
  // 文件信息
  file_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  originalName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  // 数据内容，使用JSONB存储Excel的每一行
  data: {
    type: DataTypes.JSONB,
    allowNull: false
  },
  // 记录此行数据来自Excel的哪一行
  rowIndex: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  // 存储表名或工作表名
  sheetName: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  // 其他模型选项
  tableName: 'excel_data',
  timestamps: true,
  indexes: [
    {
      name: 'excel_data_file_name_idx',
      fields: ['file_name']
    },
    {
      name: 'excel_data_sheet_name_idx',
      fields: ['sheetName']
    }
  ]
});

module.exports = ExcelData; 