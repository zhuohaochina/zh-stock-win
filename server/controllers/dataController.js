const { ExcelData } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

/**
 * 获取数据列表，支持分页
 */
const getDataList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;
    const sortField = req.query.sortField;
    const sortOrder = req.query.sortOrder;
    let filters = {};
    let searchKeywords = {};
    
    // 解析筛选参数
    if (req.query.filters) {
      try {
        filters = JSON.parse(req.query.filters);
      } catch (error) {
        console.error('解析筛选参数时出错:', error);
      }
    }
    
    // 解析搜索关键字参数
    if (req.query.searchKeywords) {
      try {
        searchKeywords = JSON.parse(req.query.searchKeywords);
      } catch (error) {
        console.error('解析搜索关键字参数时出错:', error);
      }
    }
    
    // 查询最新上传的文件
    const latestFile = await ExcelData.findOne({
      attributes: ['filename'],
      order: [['createdAt', 'DESC']]
    });
    
    if (!latestFile) {
      return res.status(200).json({
        success: true,
        message: '没有数据',
        data: [],
        total: 0
      });
    }
    
    // 设置默认排序
    let orderConfig = [['rowIndex', 'ASC']];
    
    // 处理自定义排序
    if (sortField && sortField !== 'rowIndex') {
      // 注意：由于数据存储在JSON列中，排序字段需要作为JSON路径处理
      // 使用sequelize.json方法来访问data列中的JSON字段
      const direction = sortOrder === 'ascend' ? 'ASC' : sortOrder === 'descend' ? 'DESC' : 'ASC';
      
      // 这里我们需要构建一个排序路径到data JSON列中指定字段
      // 由于JSON数据结构可能因不同框架和数据库而异，以下是一种常见的方法
      // 使用sequelize的literal函数来创建一个自定义的排序表达式
      orderConfig = [
        [sequelize.literal(`data->>'${sortField}'`), direction]
      ];
    }
    
    // 构建筛选条件
    const whereCondition = {
      filename: latestFile.filename
    };
    
    // 处理筛选条件
    if (Object.keys(filters).length > 0) {
      const filterConditions = [];
      
      for (const [field, values] of Object.entries(filters)) {
        if (Array.isArray(values) && values.length > 0) {
          // 对于JSON数据列，我们需要使用特殊的查询语法
          // 注意：具体语法可能因数据库类型而异（这里假设使用PostgreSQL）
          const jsonCondition = sequelize.literal(
            `data->>'${field}' IN (${values.map(v => `'${v}'`).join(',')})`
          );
          filterConditions.push(jsonCondition);
        }
      }
      
      if (filterConditions.length > 0) {
        whereCondition[Op.and] = filterConditions;
      }
    }
    
    // 处理搜索关键字
    if (searchKeywords && Object.keys(searchKeywords).length > 0) {
      const searchConditions = [];
      
      // 为每个搜索字段构建ILIKE条件
      for (const [field, keyword] of Object.entries(searchKeywords)) {
        if (keyword) {
          // 使用ILIKE进行不区分大小写的模糊匹配
          searchConditions.push(`data->>'${field}' ILIKE ?`);
          queryParams.push(`%${keyword}%`);
        }
      }
      
      // 如果有搜索条件，添加到主条件中
      if (searchConditions.length > 0) {
        // 使用OR连接所有搜索条件
        whereCondition[Op.or] = searchConditions;
      }
    }
    
    // 使用最新文件名查询数据
    const { count, rows } = await ExcelData.findAndCountAll({
      where: whereCondition,
      order: orderConfig,
      limit: pageSize,
      offset: offset
    });
    
    // 提取数据部分
    const data = rows.map(item => item.data);
    
    res.status(200).json({
      success: true,
      data,
      total: count,
      page,
      pageSize
    });
  } catch (error) {
    console.error('获取数据列表时出错:', error);
    res.status(500).json({
      success: false,
      message: `获取数据失败: ${error.message}`
    });
  }
};

/**
 * 获取文件列表
 */
const getFileList = async (req, res) => {
  try {
    const files = await ExcelData.findAll({
      attributes: [
        'filename', 
        'originalName', 
        'sheetName',
        [sequelize.fn('COUNT', sequelize.col('id')), 'rowCount'],
        [sequelize.fn('MAX', sequelize.col('createdAt')), 'uploadedAt']
      ],
      group: ['filename', 'originalName', 'sheetName'],
      order: [[sequelize.fn('MAX', sequelize.col('createdAt')), 'DESC']]
    });
    
    res.status(200).json({
      success: true,
      files
    });
  } catch (error) {
    console.error('获取文件列表时出错:', error);
    res.status(500).json({
      success: false,
      message: `获取文件列表失败: ${error.message}`
    });
  }
};

/**
 * 按文件名获取数据
 */
const getDataByFileName = async (req, res) => {
  try {
    const { filename } = req.params;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;
    const sortField = req.query.sortField;
    const sortOrder = req.query.sortOrder;
    let filters = {};
    let searchKeywords = {};
    
    // 解析筛选参数
    if (req.query.filters) {
      try {
        filters = JSON.parse(req.query.filters);
      } catch (error) {
        console.error('解析筛选参数时出错:', error);
      }
    }
    
    // 解析搜索关键字参数
    if (req.query.searchKeywords) {
      try {
        searchKeywords = JSON.parse(req.query.searchKeywords);
      } catch (error) {
        console.error('解析搜索关键字参数时出错:', error);
      }
    }
    
    // 设置默认排序
    let orderConfig = [['rowIndex', 'ASC']];
    
    // 处理自定义排序
    if (sortField && sortField !== 'rowIndex') {
      // 构建排序配置，访问JSON数据中的字段
      const direction = sortOrder === 'ascend' ? 'ASC' : sortOrder === 'descend' ? 'DESC' : 'ASC';
      orderConfig = [
        [sequelize.literal(`data->>'${sortField}'`), direction]
      ];
    }
    
    // 构建筛选条件
    const whereCondition = {
      filename: filename
    };
    
    // 处理筛选条件
    if (Object.keys(filters).length > 0) {
      const filterConditions = [];
      
      for (const [field, values] of Object.entries(filters)) {
        if (Array.isArray(values) && values.length > 0) {
          // 对于JSON数据列，我们需要使用特殊的查询语法
          const jsonCondition = sequelize.literal(
            `data->>'${field}' IN (${values.map(v => `'${v}'`).join(',')})`
          );
          filterConditions.push(jsonCondition);
        }
      }
      
      if (filterConditions.length > 0) {
        whereCondition[Op.and] = filterConditions;
      }
    }
    
    // 处理搜索关键字
    if (searchKeywords && Object.keys(searchKeywords).length > 0) {
      const searchConditions = [];
      
      // 为每个搜索字段构建ILIKE条件
      for (const [field, keyword] of Object.entries(searchKeywords)) {
        if (keyword) {
          // 使用ILIKE进行不区分大小写的模糊匹配
          searchConditions.push(`data->>'${field}' ILIKE ?`);
          queryParams.push(`%${keyword}%`);
        }
      }
      
      // 如果有搜索条件，添加到主条件中
      if (searchConditions.length > 0) {
        // 使用OR连接所有搜索条件
        whereCondition[Op.or] = searchConditions;
      }
    }
    
    const { count, rows } = await ExcelData.findAndCountAll({
      where: whereCondition,
      order: orderConfig,
      limit: pageSize,
      offset: offset
    });
    
    // 提取数据部分
    const data = rows.map(item => item.data);
    
    res.status(200).json({
      success: true,
      data,
      total: count,
      page,
      pageSize
    });
  } catch (error) {
    console.error('按文件名获取数据时出错:', error);
    res.status(500).json({
      success: false,
      message: `获取数据失败: ${error.message}`
    });
  }
};

module.exports = {
  getDataList,
  getFileList,
  getDataByFileName
}; 