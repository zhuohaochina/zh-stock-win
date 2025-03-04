const express = require('express');
const router = express.Router();
const dynamicTableController = require('../controllers/dynamicTableController');

// 获取所有动态表
router.get('/', dynamicTableController.getAllTables);

// 获取表结构
router.get('/:tableName/structure', dynamicTableController.getTableStructure);

// 获取表数据
router.get('/:tableName/data', dynamicTableController.getTableData);

// 删除表
router.delete('/:tableName', dynamicTableController.deleteTable);

// 修改表数据
router.put('/:tableName/data/:id', dynamicTableController.updateTableData);

module.exports = router; 