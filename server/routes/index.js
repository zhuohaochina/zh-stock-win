const express = require('express');
const router = express.Router();
const { handleUpload } = require('../controllers/uploadController');
const { executeSql } = require('../controllers/sqlController');
const {
  getTableData,
  getAllTables,
  getTableStructure,
  deleteTable,
  updateTableData,
  recreateTable
} = require('../controllers/dynamicTableController');
const { getDataList, getFileList, getDataByFileName } = require('../controllers/dataController');

// SQL查询路由
router.post('/sql/execute', executeSql);

// 动态表相关路由
router.get('/tables', getAllTables);
router.get('/tables/:tableName/data', getTableData);
router.get('/tables/:tableName/structure', getTableStructure);
router.put('/tables/:tableName/data/:id', updateTableData);
router.delete('/tables/:tableName', deleteTable);

// 表重建路由
router.post('/tables/recreate', recreateTable);

// 文件上传路由
router.post('/upload', handleUpload);

// 数据查询路由
router.get('/data', getDataList);
router.get('/files', getFileList);
router.get('/data/:fileName', getDataByFileName);

module.exports = router; 