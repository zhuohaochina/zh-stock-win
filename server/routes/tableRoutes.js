const express = require('express');
const router = express.Router();
const tableController = require('../controllers/tableController');

// 获取所有表
router.get('/', tableController.getDynamicTables);

// 获取表数据
router.get('/:tableName/data', tableController.getTableData);

// 更新表数据
router.put('/:tableName/data/:id', tableController.updateTableData);

// 删除表
router.delete('/:tableName', tableController.deleteTable);

module.exports = router; 