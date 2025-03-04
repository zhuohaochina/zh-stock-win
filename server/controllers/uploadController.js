const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { parseExcel } = require('../utils/excelParser');
const { ExcelData } = require('../models');
const { Op } = require('sequelize');
const { createTableFromExcel, insertDataToTable, getDynamicTables } = require('../utils/tableBuilder');

// 配置上传目录和文件命名
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
    
    // 确保上传目录存在
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 使用时间戳和随机数生成唯一文件名
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(6).toString('hex');
    const filename = `${uniqueSuffix}${path.extname(file.originalname)}`;
    cb(null, filename);
  }
});

// 配置文件过滤器，只允许上传Excel文件
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'
  ];
  
  const allowedExts = ['.xls', '.xlsx', '.csv'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`仅支持Excel文件(.xls, .xlsx)，当前文件类型: ${file.mimetype}, 扩展名: ${ext}`), false);
  }
};

// 创建multer上传中间件
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // 增大文件大小限制为20MB
}).single('file');

// 清理旧数据
const cleanupOldData = async (filename) => {
  try {
    // 删除与此文件名相关的所有现有数据
    await ExcelData.destroy({
      where: {
        filename: filename
      }
    });
  } catch (error) {
    console.warn('清理旧数据时出错:', error.message);
    // 继续执行，不要因为清理错误而中断上传
  }
};

// 处理文件上传请求
const handleUpload = (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: '没有上传文件'
      });
    }

    try {
      // 记录请求参数，方便调试
      console.log('上传请求参数:', {
        body: req.body,
        file: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });
      
      // 解析Excel文件
      const filePath = req.file.path;
      console.log(`开始解析文件: ${filePath}, 原始名称: ${req.file.originalname}`);
      
      let parseResult;
      try {
        parseResult = await parseExcel(filePath);
      } catch (parseError) {
        // 删除上传的文件
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkError) {
          console.warn(`无法删除上传的文件 ${filePath}:`, unlinkError.message);
        }
        
        throw new Error(`解析Excel文件失败: ${parseError.message}`);
      }
      
      const { data, columns, filename, sheetName } = parseResult;
      
      if (!data || data.length === 0) {
        return res.status(400).json({
          success: false,
          message: '上传的Excel文件没有数据',
          columns: columns
        });
      }
      
      // 获取是否要动态创建表及表名
      // 正确处理布尔值或字符串类型的参数
      const createDynamicTable = req.body.createDynamicTable === true || req.body.createDynamicTable === 'true';
      let tableName = req.body.tableName || 'demo';
      const forceRecreate = req.body.forceRecreate === true || req.body.forceRecreate === 'true';
      
      // 记录参数处理结果
      console.log('处理后的参数:', {
        createDynamicTable,
        tableName,
        forceRecreate,
        targetTableLocked: req.body.targetTableLocked
      });
      
      let tableCreated = false;
      let dynamicTable = null;
      let tableRecreated = false;
      
      // 如果需要动态创建表
      if (createDynamicTable) {
        try {
          console.log(`准备创建/更新表: ${tableName}, forceRecreate: ${forceRecreate}`);
          
          // 检查表是否已存在
          const tables = await getDynamicTables();
          const tableExists = tables.includes(tableName);
          
          if (tableExists) {
            console.log(`表 "${tableName}" 已存在，forceRecreate: ${forceRecreate}`);
            tableRecreated = true;
          }
          
          // 创建表
          dynamicTable = await createTableFromExcel(tableName, columns, forceRecreate);
          tableCreated = true;
          
          // 向表中插入数据
          const insertedCount = await insertDataToTable(dynamicTable, data, columns);
          
          console.log(`成功将 ${insertedCount} 条数据插入到表 "${tableName}"`);
        } catch (tableError) {
          console.error('动态创建表失败:', tableError);
          // 失败时回退到原始存储方式
        }
      }
      
      // 如果没有动态创建表，或者动态创建失败，使用原始存储方式
      if (!tableCreated) {
        // 先清理与此文件相关的旧数据
        await cleanupOldData(filename);
        
        // 批量保存数据到excel_data表
        const batchSize = 100; // 每批保存100条记录
        const batches = [];
        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize).map(row => ({
            filename: filename,
            originalName: req.file.originalname,
            data: row.rowData,
            rowIndex: row.rowIndex,
            sheetName: sheetName
          }));
          batches.push(batch);
        }
        
        // 逐批保存数据
        for (const batch of batches) {
          await ExcelData.bulkCreate(batch);
        }
      }
      
      // 发送成功响应
      res.status(200).json({
        success: true,
        message: tableCreated 
          ? tableRecreated 
            ? `文件上传成功并重建了表 "${tableName}"` 
            : `文件上传成功并创建了表 "${tableName}"`
          : '文件上传并处理成功',
        file: {
          name: req.file.originalname,
          size: req.file.size
        },
        columns,
        recordCount: data.length,
        tableCreated,
        tableRecreated,
        tableName: tableCreated ? tableName : null
      });
      
      console.log(`文件 ${req.file.originalname} 成功处理，保存了 ${data.length} 条记录`);
    } catch (error) {
      console.error('处理上传文件时出错:', error);
      res.status(500).json({
        success: false,
        message: `处理文件时出错: ${error.message}`
      });
    }
  });
};

async function processExcelFile(filePath, originalName) {
    try {
        // ... existing code ...

        // 创建动态表
        console.log('准备创建表，表头:', headers);
        const dynamicModel = await createTableFromExcel(sheetName, headers);
        
        if (!dynamicModel) {
            throw new Error('表创建失败，未返回模型实例');
        }

        // 尝试插入数据
        console.log(`开始向表 ${dynamicModel.tableName} 插入数据`);
        const insertResult = await dynamicModel.bulkCreate(
            rows.map(row => {
                const record = {};
                headers.forEach((header, index) => {
                    record[header] = row[index];
                });
                return record;
            })
        );
        
        console.log(`成功插入 ${insertResult.length} 条记录到表 ${dynamicModel.tableName}`);
        
        // 验证数据是否插入成功
        const count = await dynamicModel.count();
        console.log(`表 ${dynamicModel.tableName} 中的记录数: ${count}`);

        return {
            success: true,
            message: `文件 ${originalName} 成功处理，保存了 ${insertResult.length} 条记录`,
            tableName: dynamicModel.tableName
        };
    } catch (error) {
        console.error('处理Excel文件时出错:', error);
        throw error;
    }
}

module.exports = {
  handleUpload
}; 