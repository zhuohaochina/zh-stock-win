const sequelize = require('../config/database');
const ExcelData = require('./excelData');

// 设置模型之间的关联（如果有其他模型的话）

module.exports = {
  sequelize,
  ExcelData
}; 