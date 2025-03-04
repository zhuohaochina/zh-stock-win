const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

/**
 * 解析Excel文件
 * @param {string} filePath - Excel文件路径
 * @param {Object} options - 解析选项
 * @returns {Promise<{data: Array, columns: Array}>} - 解析结果
 */
async function parseExcel(filePath, options = {}) {
  // 确保文件存在
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  
  // 提取文件名
  const fileName = path.basename(filePath);
  
  // 尝试不同的解析策略，从最简单到最复杂
  try {
    // 方法1: 使用最安全的方式 - 完全禁用表格处理
    return await parseSafeMode(filePath, fileName, options);
  } catch (error1) {
    console.warn('安全模式解析失败，尝试直接模式:', error1.message);
    
    try {
      // 方法2: 尝试直接模式
      return await parseDirectMode(filePath, fileName, options);
    } catch (error2) {
      console.warn('直接模式解析失败，尝试替代库解析:', error2.message);
      
      try {
        // 方法3: 使用替代方法（仅提取数据）
        return await parseFallbackMode(filePath, fileName, options);
      } catch (error3) {
        console.error('所有解析方法均失败:', error3.message);
        throw new Error(`无法解析Excel文件，已尝试所有方法: ${error3.message}`);
      }
    }
  }
}

/**
 * 安全模式 - 使用修改过的ExcelJS读取，完全禁用表格处理
 */
async function parseSafeMode(filePath, fileName, options = {}) {
  // 创建一个新的工作簿
  const workbook = new ExcelJS.Workbook();
  
  // 应用XLSX修补
  const XLSX = require('exceljs/lib/xlsx/xlsx');
  const originalProcessTableEntry = XLSX.prototype._processTableEntry;
  const originalReconcile = XLSX.prototype.reconcile;
  
  // 禁用表格处理
  XLSX.prototype._processTableEntry = async function() {
    return Promise.resolve();
  };
  
  // 简化reconcile方法
  XLSX.prototype.reconcile = function() {
    this.tables = [];
    return this;
  };
  
  try {
    // 读取文件，设置所有可能的选项来增强容错性
    await workbook.xlsx.readFile(filePath, {
      ignoreNodes: [
        'sortState', 'conditionalFormatting', 'extLst',
        'pivotSelection', 'phoneticPr', 'tableParts',
        'webPublishItems', 'filterColumn', 'autoFilter'
      ],
      ignoreDeclaration: true,
      saxOptions: { 
        strictEntities: false,
        trim: true,
        normalize: true,
        xmlns: true,
        position: false
      },
      ignoreStyles: true,
      ignoreWorkbookLinks: true
    });
    
    // 返回解析的数据
    return extractWorkbookData(workbook, fileName);
  } finally {
    // 恢复原始函数
    XLSX.prototype._processTableEntry = originalProcessTableEntry;
    XLSX.prototype.reconcile = originalReconcile;
  }
}

/**
 * 直接模式 - 使用流解析方式
 */
async function parseDirectMode(filePath, fileName, options = {}) {
  const workbook = new ExcelJS.Workbook();
  
  // 读取文件缓冲区
  const fileBuffer = fs.readFileSync(filePath);
  const stream = new Readable();
  stream.push(fileBuffer);
  stream.push(null);
  
  // 配置解析选项
  const parseOptions = {
    ignoreNodes: [
      'sortState', 'conditionalFormatting', 'extLst',
      'pivotSelection', 'phoneticPr', 'tableParts',
      'webPublishItems', 'filterColumn', 'autoFilter'
    ],
    ignoreDeclaration: true,
    sheetName: options.sheetName || undefined,
    ignoreStyles: true,
    ignoreWorkbookLinks: true
  };
  
  // 修改ExcelJS内部函数
  patchExcelJSParserDeep();
  
  // 读取流
  await workbook.xlsx.read(stream, parseOptions);
  
  // 提取数据
  return extractWorkbookData(workbook, fileName);
}

/**
 * 备用模式 - 最后的尝试，仅提取基本数据
 */
async function parseFallbackMode(filePath, fileName, options = {}) {
  // 创建一个全新的工作簿
  const workbook = new ExcelJS.Workbook();
  
  try {
    // 完全禁用所有高级功能
    const baseXform = require('exceljs/lib/xlsx/xform/base-xform');
    const originalParseMethod = baseXform.prototype.parse;
    
    // 如果解析失败就返回null
    baseXform.prototype.parse = function(parser) {
      try {
        return originalParseMethod.call(this, parser);
      } catch (e) {
        console.warn(`基础解析错误 (${this.constructor.name}): ${e.message}`);
        return null;
      }
    };
    
    // 使用最简单的CSV模式读取文件
    try {
      // 先尝试使用CSV模式
      await workbook.csv.readFile(filePath);
    } catch (csvError) {
      console.warn('CSV读取失败，尝试从头创建工作表:', csvError.message);
      
      // 如果CSV失败，尝试读取原始二进制并创建最简单的工作表
      try {
        // 创建一个空白工作表
        const worksheet = workbook.addWorksheet('Sheet1');
        
        // 读取文件并尝试提取文本内容
        const content = fs.readFileSync(filePath, 'utf8');
        const textLines = content.split(/\r?\n/).filter(line => line.trim());
        
        // 简单地将文本内容转换为行和列
        textLines.forEach((line, rowIndex) => {
          const values = line.split(/[,;\t]/).map(val => val.trim());
          worksheet.getRow(rowIndex + 1).values = values;
        });
      } catch (manualError) {
        console.warn('手动创建工作表失败:', manualError.message);
      }
    }
    
    // 恢复原始函数
    baseXform.prototype.parse = originalParseMethod;
    
    // 提取数据
    return extractWorkbookData(workbook, fileName);
  } catch (error) {
    throw new Error(`备用模式解析失败: ${error.message}`);
  }
}

/**
 * 从工作簿中提取数据和列信息
 */
function extractWorkbookData(workbook, fileName) {
  // 检查是否有工作表
  if (!workbook.worksheets || workbook.worksheets.length === 0) {
    throw new Error('Excel文件中没有工作表');
  }
  
  // 获取第一个工作表
  const worksheet = workbook.worksheets[0];
  const sheetName = worksheet.name || 'Sheet1';
  
  // 存储列信息和数据
  const columns = [];
  const data = [];
  
  try {
    // 安全获取工作表的行数和列数
    const rowCount = worksheet.rowCount || 0;
    const columnCount = worksheet.columnCount || 0;
    
    // 如果无法检测到行和列，尝试估计
    if (rowCount === 0 || columnCount === 0) {
      // 扫描工作表寻找最大行和列
      let maxRow = 0;
      let maxCol = 0;
      
      worksheet.eachRow((row, rowNumber) => {
        maxRow = Math.max(maxRow, rowNumber);
        row.eachCell((cell, colNumber) => {
          maxCol = Math.max(maxCol, colNumber);
        });
      });
      
      // 如果仍然没有检测到，使用默认值
      if (maxRow === 0) maxRow = 10;
      if (maxCol === 0) maxCol = 5;
      
      // 生成默认列
      for (let i = 1; i <= maxCol; i++) {
        columns.push({
          field: `column${i}`,
          header: `列${i}`,
          colIndex: i
        });
      }
    }
      
    // 正确处理标题行 - 确保第一行作为表头
    try {
      const headerRow = worksheet.getRow(1);
      if (headerRow) {
        // 存储已经使用的字段名，确保唯一性
        const usedFieldNames = new Set();
        let hasValidHeaders = false;
        
        headerRow.eachCell((cell, colNumber) => {
          let rawValue = '';
          
          try {
            // 安全地获取单元格值
            if (cell.value !== null && cell.value !== undefined) {
              if (typeof cell.value === 'object') {
                rawValue = cell.value.text || cell.value.result || JSON.stringify(cell.value);
              } else {
                rawValue = String(cell.value);
              }
            }
          } catch (cellError) {
            console.warn(`读取表头单元格出错 (列:${colNumber}):`, cellError.message);
            rawValue = `列${colNumber}`;
          }
          
          // 如果有实际内容，则表示有有效的表头
          if (rawValue && rawValue.trim()) {
            hasValidHeaders = true;
          }
          
          let fieldName = `column${colNumber}`;
          // 确保字段名为有效变量名
          fieldName = fieldName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
          
          // 确保字段名唯一
          let uniqueFieldName = fieldName;
          let counter = 1;
          while (usedFieldNames.has(uniqueFieldName)) {
            uniqueFieldName = `${fieldName}_${counter++}`;
          }
          usedFieldNames.add(uniqueFieldName);
          
          // 重要：将原始表头值作为header属性
          columns.push({
            field: uniqueFieldName,
            header: rawValue.trim() || `列${colNumber}`,
            colIndex: colNumber
          });
        });
        
        console.log('提取的表头:', columns.map(col => col.header).join(', '));
      }
    } catch (headerError) {
      console.warn('读取标题行出错，使用默认列名:', headerError.message);
      
      // 生成默认列
      const maxCol = worksheet.columnCount || 10;
      for (let i = 1; i <= maxCol; i++) {
        columns.push({
          field: `column${i}`,
          header: `列${i}`,
          colIndex: i
        });
      }
    }
    
    // 如果没有列，使用默认列
    if (columns.length === 0) {
      console.warn('没有检测到列，使用默认列');
      for (let i = 1; i <= 5; i++) {
        columns.push({
          field: `column${i}`,
          header: `列${i}`,
          colIndex: i
        });
      }
    }
    
    // 处理数据行 - 从第二行开始，因为第一行是表头
    try {
      // 跟踪已处理的行，避免重复
      const processedRows = new Set();
      
      worksheet.eachRow((row, rowNumber) => {
        // 跳过标题行和已处理的行
        if (rowNumber === 1 || processedRows.has(rowNumber)) return;
        processedRows.add(rowNumber);
        
        const rowData = {};
        
        // 填充列数据
        columns.forEach(column => {
          try {
            let cell;
            try {
              cell = row.getCell(column.colIndex);
            } catch (cellError) {
              console.warn(`获取单元格出错 (行:${rowNumber}, 列:${column.colIndex}):`, cellError.message);
              cell = { value: '' };
            }
            
            let value = cell.value;
            
            // 安全地处理不同类型的值
            if (value !== null && value !== undefined) {
              if (typeof value === 'object') {
                if (value.result !== undefined) {
                  value = value.result;
                } else if (value.text !== undefined) {
                  value = value.text;
                } else if (value.formula !== undefined) {
                  value = value.result || '';
                } else if (value.richText !== undefined) {
                  try {
                    value = value.richText.map(rt => rt.text || '').join('');
                  } catch (richTextError) {
                    value = '';
                  }
                } else if (cell.type === ExcelJS.ValueType.Date) {
                  try {
                    value = cell.value.toISOString();
                  } catch (dateError) {
                    value = '';
                  }
                } else if (cell.type === ExcelJS.ValueType.Hyperlink) {
                  value = value.text || value.hyperlink || '';
                } else {
                  try {
                    value = JSON.stringify(value);
                  } catch (jsonError) {
                    value = '';
                  }
                }
              }
            } else {
              value = '';
            }
            
            rowData[column.field] = value;
          } catch (cellProcessError) {
            console.warn(`处理单元格值出错 (行:${rowNumber}, 列:${column.colIndex}):`, cellProcessError.message);
            rowData[column.field] = '';
          }
        });
        
        // 添加行索引
        rowData.rowIndex = rowNumber - 1;
        
        data.push({
          rowData,
          rowIndex: rowNumber - 1,
          fileName,
          sheetName
        });
      });
      
      // 如果没有检测到数据行，尝试直接访问行
      if (data.length === 0) {
        console.warn('没有检测到数据行，尝试直接访问');
        
        // 尝试直接访问行 (从第2行开始，因为第1行是标题)
        const maxRowToTry = worksheet.rowCount > 0 ? Math.min(worksheet.rowCount, 1000) : 100;
        
        for (let rowNumber = 2; rowNumber <= maxRowToTry; rowNumber++) {
          try {
            const row = worksheet.getRow(rowNumber);
            if (row && !row.cellCount) continue; // 跳过空行
            
            const rowData = {};
            let hasData = false;
            
            // 处理每一列
            columns.forEach(column => {
              try {
                const cell = row.getCell(column.colIndex);
                if (cell && cell.value) {
                  let value = cell.value;
                  if (typeof value === 'object') {
                    value = value.text || value.result || JSON.stringify(value);
                  }
                  rowData[column.field] = value;
                  hasData = true;
                } else {
                  rowData[column.field] = '';
                }
              } catch (e) {
                rowData[column.field] = '';
              }
            });
            
            if (hasData) {
              rowData.rowIndex = rowNumber - 1;
              data.push({
                rowData,
                rowIndex: rowNumber - 1,
                fileName,
                sheetName
              });
            }
          } catch (rowError) {
            console.warn(`访问行 ${rowNumber} 出错:`, rowError.message);
          }
        }
      }
    } catch (dataError) {
      console.error('处理数据行出错:', dataError.message);
      // 即使出错，也要返回检测到的列
    }
    
    // 返回结果
    return { data, columns, fileName, sheetName };
  } catch (extractError) {
    console.error('提取数据时出错:', extractError);
    throw new Error(`提取数据失败: ${extractError.message}`);
  }
}

/**
 * 深度修补ExcelJS解析器，处理所有可能的错误点
 */
function patchExcelJSParserDeep() {
  try {
    // 修补基础解析器
    const baseXform = require('exceljs/lib/xlsx/xform/base-xform');
    if (baseXform && baseXform.prototype) {
      // 修补所有关键方法
      const methods = ['parseOpen', 'parseClose', 'parseText', 'parse'];
      
      methods.forEach(method => {
        if (baseXform.prototype[method]) {
          const original = baseXform.prototype[method];
          baseXform.prototype[method] = function(...args) {
            try {
              return original.apply(this, args);
            } catch (e) {
              return false;
            }
          };
        }
      });
    }
    
    // 修补所有可能出错的组件
    const components = [
      'exceljs/lib/xlsx/xform/table/auto-filter-xform',
      'exceljs/lib/xlsx/xform/table/table-xform',
      'exceljs/lib/xlsx/xform/table/table-column-xform',
      'exceljs/lib/xlsx/xform/core/core-xform',
      'exceljs/lib/xlsx/xform/drawing/drawing-xform'
    ];
    
    components.forEach(componentPath => {
      try {
        const component = require(componentPath);
        if (component && component.prototype) {
          // 修补组件的所有方法
          ['parseOpen', 'parseClose', 'parseText', 'parse', 'reconcile'].forEach(method => {
            if (component.prototype[method]) {
              const original = component.prototype[method];
              component.prototype[method] = function(...args) {
                try {
                  return original.apply(this, args);
                } catch (e) {
                  return method === 'reconcile' ? (args[0] || {}) : false;
                }
              };
            }
          });
        }
      } catch (componentError) {
        // 忽略不存在的组件
      }
    });
    
    // 修补XLSX主类
    try {
      const XLSX = require('exceljs/lib/xlsx/xlsx');
      if (XLSX && XLSX.prototype) {
        // 修补所有关键方法
        const xlsxMethods = ['load', 'parse', 'parseStream', 'reconcile', '_processTable', '_processTableEntry'];
        
        xlsxMethods.forEach(method => {
          if (XLSX.prototype[method]) {
            const original = XLSX.prototype[method];
            if (method === 'reconcile') {
              XLSX.prototype[method] = function() {
                try {
                  return original.apply(this, arguments);
                } catch (e) {
                  console.warn(`XLSX.${method} 错误:`, e.message);
                  this.tables = [];
                  return this;
                }
              };
            } else if (method.startsWith('_process')) {
              // 对于内部处理方法，返回Promise.resolve()
              XLSX.prototype[method] = function() {
                try {
                  return original.apply(this, arguments);
                } catch (e) {
                  console.warn(`XLSX.${method} 错误:`, e.message);
                  return Promise.resolve();
                }
              };
            } else {
              XLSX.prototype[method] = function() {
                try {
                  return original.apply(this, arguments);
                } catch (e) {
                  console.warn(`XLSX.${method} 错误:`, e.message);
                  return this;
                }
              };
            }
          }
        });
      }
    } catch (xlsxError) {
      console.warn('修补XLSX类失败:', xlsxError);
    }
  } catch (error) {
    console.warn('深度修补ExcelJS解析器失败:', error);
  }
}

// 应用程序启动时执行修补
patchExcelJSParserDeep();

module.exports = { parseExcel }; 