<template>
  <div class="container">
    <div class="main-content">
      <!-- SQL查询块 -->
      <a-card class="sql-card" :bordered="false">
        <template #title>
          <div class="card-header">
            <span><code-outlined /> SQL查询</span>
            <div class="header-right">
              <div class="table-info" v-if="sqlTableColumns.length > 0">
                <a-tag color="default">
                  共 {{ sqlTotal }} 条记录
                </a-tag>
              </div>
            </div>
          </div>
        </template>
        
        <a-textarea
          v-model:value="sqlQuery"
          :rows="4"
          placeholder="请输入SQL查询语句，例如: SELECT * FROM table_name"
          :maxlength="1000"
          show-count
        />
        <div class="sql-buttons">
          <a-button type="primary" @click="executeSql" :loading="sqlLoading">
            执行查询
          </a-button>
          <a-button @click="clearSql" style="margin-left: 8px">
            清空
          </a-button>
        </div>
        
        <!-- SQL查询结果表格 -->
        <div v-if="sqlTableColumns.length > 0" class="sql-table">
          <!-- 添加筛选功能说明 -->
          <div v-if="Object.keys(filterInfo).length > 0 || Object.keys(searchKeywords).length > 0" class="filter-info">
            <a-alert type="info" show-icon>
              <template #message>
                当前筛选条件已应用于所有数据，而非仅当前页面。
                <a-button type="link" size="small" @click="clearAllFilters">清除所有筛选</a-button>
              </template>
            </a-alert>
          </div>

          <a-table
            :dataSource="sqlTableData"
            :columns="sqlAntTableColumns"
            :pagination="{
              current: sqlPagination.current,
              pageSize: sqlPagination.pageSize,
              total: sqlTotal,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              showTotal: total => `共 ${total} 条记录`,
              onChange: handleSqlPageChange,
              onShowSizeChange: handleSqlSizeChange,
              size: 'small',
              position: ['bottomCenter']
            }"
            :scroll="{ x: true }"
            size="small"
            bordered
            :loading="sqlLoading"
            rowKey="rowIndex"
            :rowClassName="(record, index) => (index % 2 === 1 ? 'table-striped' : '')"
          >
            <template #bodyCell="{ column, text }">
              <template v-if="column?.ellipsis">
                <a-tooltip :title="text">
                  <span class="ellipsis-cell">{{ text || '-' }}</span>
                </a-tooltip>
              </template>
              <template v-else>
                <span>{{ text || '-' }}</span>
              </template>
            </template>
            <template #emptyText>
              <a-empty 
                description="暂无数据" 
                :image="Empty.PRESENTED_IMAGE_SIMPLE"
              />
            </template>
          </a-table>
        </div>
      </a-card>

      <!-- 上传区域（包含Excel上传和动态表列表） -->
      <a-card class="upload-all-card" :bordered="false">
        <template #title>
          <div class="card-header">
            <span><upload-outlined /> 上传</span>
          </div>
        </template>
        
        <div class="upload-content">
          <!-- 上传Excel部分 -->
          <div class="upload-section">            
            <a-upload-dragger
              name="file"
              :multiple="false"
              :maxCount="1"
              :fileList="fileList"
              :beforeUpload="beforeUploadHandler"
              :customRequest="customUploadRequest"
              accept=".xlsx,.xls"
              class="upload-excel">
              <p class="ant-upload-drag-icon">
                <inbox-outlined />
              </p>
              <p class="ant-upload-text">
                拖拽文件到此处或<a>点击上传</a>
              </p>
              <p class="ant-upload-hint">
                请上传Excel文件（.xlsx或.xls格式）
              </p>
              <p class="ant-upload-hint" style="color: #ff4d4f; font-weight: bold;">
                注意: 选择文件后，将弹出对话框确认表名
              </p>
            </a-upload-dragger>
          </div>

          <!-- 动态表列表部分 -->
          <div class="tables-section" v-if="dynamicTables.length > 0">
            <div class="section-header">
              <span><database-outlined /> 动态创建的表</span>
              <a-tag color="success">{{ dynamicTables.length }}个表</a-tag>
            </div>
            
            <a-table 
              :dataSource="dynamicTables" 
              :columns="dynamicTableColumns"
              :pagination="false"
              bordered
              :loading="tableLoading"
              :rowKey="record => record.name"
              class="tables-list">
              <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'action'">
                  <a-button type="primary" size="small" @click="() => viewTableData(record.name)" style="margin-right: 8px;">
                    <template #icon><eye-outlined /></template>
                    查看数据
                  </a-button>
                  
                  <template v-if="!record.locked">
                    <a-button type="primary" size="small" @click="() => lockTable(record.name)" style="margin-right: 8px;">
                      <template #icon><lock-outlined /></template>
                      锁定
                    </a-button>
                    
                    <a-button danger size="small" @click="() => confirmDeleteTable(record.name)">
                      <template #icon><delete-outlined /></template>
                      删除表
                    </a-button>
                  </template>
                  
                  <template v-else>
                    <a-button type="dashed" size="small" @click="() => unlockTable(record.name)" style="margin-right: 8px;">
                      <template #icon><unlock-outlined /></template>
                      解锁
                    </a-button>
                    
                    <a-button danger size="small" disabled>
                      <template #icon><delete-outlined /></template>
                      删除表
                    </a-button>
                  </template>
                </template>
              </template>
            </a-table>
          </div>

          <!-- 当没有动态表时显示空状态 -->
          <div class="tables-section" v-else>
            <div class="section-header">
              <span><database-outlined /> 动态创建的表</span>
              <a-tag color="default">0个表</a-tag>
            </div>
            <div class="empty-tables">
              <a-empty description="暂无动态表" :image="Empty.PRESENTED_IMAGE_SIMPLE" />
            </div>
          </div>
        </div>
      </a-card>
      
      <!-- 添加表名确认对话框 -->
      <a-modal
        v-model:visible="tableNameModalVisible"
        title="确认表名"
        @ok="confirmUpload"
        @cancel="cancelUpload"
        :confirmLoading="uploadLoading"
      >
        <a-alert
          v-if="selectedFile"
          type="info"
          show-icon
          style="margin-bottom: 16px"
        >
          <template #message>
            已选择文件: {{ selectedFile?.name }}
          </template>
        </a-alert>
        
        <a-form :model="uploadForm" layout="vertical">
          <a-form-item
            label="表名"
            name="tableName"
            :rules="[{ required: true, message: '请输入表名!' }]"
          >
            <a-input 
              v-model:value="uploadForm.tableName" 
              placeholder="请输入表名">
              <template #prefix><file-outlined /></template>
            </a-input>
          </a-form-item>
          
          <a-form-item name="createDynamicTable" :wrapper-col="{ offset: 0 }">
            <a-checkbox v-model:checked="uploadForm.createDynamicTable">
              根据Excel列动态创建表
            </a-checkbox>
          </a-form-item>
          
          <div class="table-name-warning" v-if="isTableLocked(uploadForm.tableName)">
            <a-alert
              type="error"
              show-icon
              message="警告：此表已被锁定，无法覆盖"
            />
          </div>
          
          <div class="table-name-info" v-else-if="uploadForm.tableName">
            <a-alert
              type="warning"
              show-icon
              message="注意：如果表已存在，将会自动重建覆盖原表数据"
            />
          </div>
        </a-form>
      </a-modal>
      
      <!-- 数据展示区域 -->
      <a-card v-if="tableColumns.length > 0" class="data-card" :bordered="false">
        <template #title>
          <div class="card-header">
            <span><bar-chart-outlined /> 数据展示</span>
            <div class="header-right">
              <div class="table-info">
                <a-tag v-if="currentTableName" color="blue">
                  表名: {{ currentTableName }}
                </a-tag>
                <a-tag v-else-if="currentFileName" color="green">
                  文件: {{ currentFileName }}
                </a-tag>
                <a-tag color="default">
                  共 {{ total }} 条记录
                </a-tag>
              </div>
            </div>
          </div>
        </template>
        
        <!-- 添加修改对话框 -->
        <a-modal
          v-model:visible="editModalVisible"
          title="修改数据"
          @ok="handleEditOk"
          @cancel="handleEditCancel"
          :confirmLoading="tableLoading"
        >
          <a-form :model="editForm" layout="vertical">
            <template v-for="col in tableColumns" :key="col.prop">
              <a-form-item
                v-if="col.prop !== 'id'"
                :label="col.label"
                :name="col.prop"
              >
                <a-input v-model:value="editForm[col.prop]" />
              </a-form-item>
            </template>
          </a-form>
        </a-modal>

        <!-- 搜索区域 -->
        <div class="search-area">
          <div class="search-container">
            <a-select
              v-model:value="selectedSearchColumn"
              style="width: 180px; margin-right: 12px; height: 46px;"
              placeholder="选择搜索列"
              :options="searchColumnOptions"
              size="large"
            />
            <a-input-search
              v-model:value="globalSearchKeyword"
              placeholder="输入关键字进行搜索"
              style="width: 420px; height: 46px;"
              @search="handleGlobalSearch"
              :loading="tableLoading"
              size="large"
              enter-button
            />
          </div>
        </div>

        <!-- 筛选功能说明 -->
        <div v-if="Object.keys(filterInfo).length > 0 || Object.keys(searchKeywords).length > 0" class="filter-info">
          <a-alert type="info" show-icon>
            <template #message>
              当前筛选条件已应用于所有数据，而非仅当前页面。
              <a-button type="link" size="small" @click="clearAllFilters">清除所有筛选</a-button>
            </template>
          </a-alert>
        </div>
        
        <!-- 无数据提示 -->
        <a-empty v-if="tableData.length === 0" description="暂无数据"></a-empty>
        
        <a-table
          v-else
          :dataSource="tableData"
          :columns="antTableColumns"
          :pagination="{
            current: tablePagination.current,
            pageSize: tablePagination.pageSize,
            total: tablePagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: handlePageChange,
            onShowSizeChange: handleSizeChange,
            size: 'small',
            position: ['bottomCenter']
          }"
          :scroll="{ x: true }"
          bordered
          :loading="tableLoading"
          rowKey="rowIndex"
          :rowClassName="(record, index) => (index % 2 === 1 ? 'table-striped' : '')"
          :customFilterDropdown="true"
          :remote="true"
          @sorterChange="handleSorterChange"
          @filterChange="handleFilterChange"
        >
          <template #bodyCell="{ column, text, record }">
            <template v-if="column?.ellipsis">
              <a-tooltip :title="text">
                <span class="ellipsis-cell">{{ text || '-' }}</span>
              </a-tooltip>
            </template>
            <template v-if="column.key === 'action'">
              <a-button type="primary" size="small" @click="handleEdit(record)">
                <template #icon><edit-outlined /></template>
                修改
              </a-button>
            </template>
            <template v-else>
              <span>{{ text || '-' }}</span>
            </template>
          </template>
        </a-table>
      </a-card>
      
      <!-- 无数据提示 -->
      <a-empty v-if="!tableColumns.length && !dynamicTables.length" description="暂无数据，请上传Excel文件"></a-empty>
    </div>
    
    <!-- 回到顶部按钮 -->
    <a-tooltip placement="left" title="回到顶部">
      <a-button 
        class="back-to-top-btn" 
        type="primary" 
        shape="circle" 
        size="large"
        @click="scrollToTop">
        <template #icon><up-outlined /></template>
      </a-button>
    </a-tooltip>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive, h } from 'vue'
import { 
  UploadOutlined, 
  InboxOutlined, 
  FileOutlined, 
  DatabaseOutlined, 
  EyeOutlined, 
  DeleteOutlined, 
  BarChartOutlined,
  LockOutlined,
  UnlockOutlined,
  UpOutlined,
  EditOutlined,
  CodeOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons-vue'
import { message, Modal, Empty } from 'ant-design-vue'
import axios from 'axios'

// 配置axios的基础URL
axios.defaults.baseURL = import.meta.env.VITE_API_BASE_URL

const tableData = ref([])
const tableColumns = ref([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)

// 添加分页状态对象
const tablePagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: true,
  showQuickJumper: true,
  pageSizeOptions: ['10', '20', '50', '100']
})

const fileList = ref([])
const currentFileName = ref('')
const dynamicTables = ref([])
const currentTableName = ref('')

// 动态表创建选项
const createDynamicTable = ref(true)
const tableName = ref('demo')

// 添加表格加载状态
const tableLoading = ref(false)

// 筛选参数
const filterInfo = ref({})
// 关键字搜索参数
const searchKeywords = ref({})

// 添加全局搜索关键字
const globalSearchKeyword = ref('')

// 添加搜索列选择
const selectedSearchColumn = ref('all')

// 在 script setup 部分添加新的响应式变量
const editingRecord = ref(null)
const editModalVisible = ref(false)
const editForm = ref({})

// 计算搜索列选项
const searchColumnOptions = computed(() => {
  const options = [
    { value: 'all', label: '所有' }
  ]
  
  if (tableColumns.value && tableColumns.value.length > 0) {
    options.push(...tableColumns.value.map(col => ({
      value: col.prop,
      label: col.label
    })))
  }
  
  return options
})

// 为Ant Design Table准备列定义
const dynamicTableColumns = [
  {
    title: '表名',
    dataIndex: 'name',
    key: 'name',
    width: 180,
    customCell: (record) => {
      // 如果表被锁定，显示红色文字
      return {
        style: {
          color: record.locked ? '#ff4d4f' : 'inherit',
          fontWeight: record.locked ? 'bold' : 'normal'
        }
      };
    }
  },
  {
    title: '操作',
    key: 'action',
    width: 320
  }
]

// 排序参数
const sortInfo = ref({
  field: '',
  order: ''
})

// 构建表格的列配置
const antTableColumns = computed(() => {
  const columns = tableColumns.value.map(col => ({
    title: col.label,
    dataIndex: col.prop,
    key: col.prop,
    align: 'center',
    minWidth: 120,
    sorter: true,
    onFilter: (value, record) => {
      if (typeof value === 'string' && record[col.prop]) {
        return record[col.prop].toString().toLowerCase().includes(value.toLowerCase());
      }
      return false;
    },
    onFilterDropdownVisibleChange: (visible) => {
      if (visible) {
        console.log(`显示 ${col.label} 的筛选菜单`);
      }
    }
  }));
  
  // 添加操作列
  columns.push({
    title: '操作',
    key: 'action',
    width: 120,
    fixed: 'right',
    align: 'center'
  });
  
  return columns;
});

// 检查表是否被锁定
const isTableLocked = (tableName) => {
  if (!tableName) return false; // 如果表名为空，直接返回false
  const table = dynamicTables.value.find(t => t.name === tableName);
  return Boolean(table && table.locked); // 确保返回布尔值
}

// 查看表格数据
const viewTableData = async (tableName) => {
  if (!tableName) return;
  
  currentTableName.value = tableName;
  currentFileName.value = '';
  currentPage.value = 1;
  tablePagination.current = 1;
  tablePagination.pageSize = 10;
  
  // 清空筛选和排序状态
  filterInfo.value = {};
  searchKeywords.value = {};
  sortInfo.value = { field: '', order: '' };
  globalSearchKeyword.value = '';
  selectedSearchColumn.value = 'all';
  
  await fetchTableData();
};

// 获取表数据
const fetchTableData = async () => {
  if (!currentTableName.value) return;
  
  tableLoading.value = true;
  
  try {
    console.log('获取表数据，参数:', {
      tableName: currentTableName.value,
      page: tablePagination.current,
      pageSize: tablePagination.pageSize,
      sortField: sortInfo.value.field,
      sortOrder: sortInfo.value.order,
      filters: Object.keys(filterInfo.value).length > 0 ? '有筛选条件' : '无筛选条件',
      searchKeywords: Object.keys(searchKeywords.value).length > 0 ? '有搜索关键字' : '无搜索关键字'
    });

    const response = await axios.get(`tables/${currentTableName.value}/data`, {
      params: {
        page: tablePagination.current,
        pageSize: tablePagination.pageSize,
        sortField: sortInfo.value.field,
        sortOrder: sortInfo.value.order,
        filters: JSON.stringify(filterInfo.value),
        searchKeywords: JSON.stringify(searchKeywords.value)
      }
    });
    
    console.log('获取到数据，总记录数:', response.data.total);
    
    if (response.data.success) {
      // 确保数据是数组并添加行索引
      if (Array.isArray(response.data.data)) {
        tableData.value = response.data.data.map((item, index) => ({
          ...item,
          rowIndex: index + 1 + (tablePagination.current - 1) * tablePagination.pageSize
        }));
      } else {
        console.warn('服务器返回的数据不是数组:', response.data.data);
        tableData.value = [];
      }
      
      // 确保总记录数是有效的数字
      if (typeof response.data.total === 'number') {
        tablePagination.total = response.data.total;
        total.value = response.data.total; // 保持兼容
      } else if (response.data.total !== undefined) {
        tablePagination.total = parseInt(response.data.total) || 0;
        total.value = parseInt(response.data.total) || 0; // 保持兼容
      } else {
        tablePagination.total = 0;
        total.value = 0; // 保持兼容
        console.warn('服务器未返回总记录数或格式不正确');
      }
      
      console.log('设置总记录数为:', tablePagination.total);
      
      // 处理列信息
      if (response.data.columns && Array.isArray(response.data.columns)) {
        console.log('设置列信息:', response.data.columns);
        tableColumns.value = response.data.columns.map(col => ({
          prop: col.field,
          label: col.header || col.field,
          key: col.field
        }));
      } else {
        console.warn('服务器未返回列信息或列信息格式不正确');
        tableColumns.value = [];
      }

      console.log('处理后的数据:', {
        tableData: tableData.value,
        tableColumns: tableColumns.value,
        total: total.value
      });
    } else {
      console.error('获取数据失败:', response.data.message);
      message.error(response.data.message || '获取数据失败');
      tableData.value = [];
      tableColumns.value = [];
      total.value = 0;
    }
  } catch (error) {
    console.error('获取表数据错误:', error);
    message.error('获取表数据时发生错误: ' + (error.response?.data?.message || error.message));
    tableData.value = [];
    tableColumns.value = [];
    total.value = 0;
  } finally {
    tableLoading.value = false;
  }
};

// 确认删除表
const confirmDeleteTable = (tableName) => {
  // 检查表是否被锁定
  if (isTableLocked(tableName)) {
    message.error('无法删除锁定的表，请先解锁');
    return;
  }
  
  Modal.confirm({
    title: '删除确认',
    content: `确定要删除表 "${tableName}" 吗？此操作将删除表及其所有数据，且不可恢复。`,
    okText: '确定',
    okType: 'danger',
    cancelText: '取消',
    onOk() {
      return deleteTable(tableName)
    }
  })
}

// 删除表
const deleteTable = async (tableName) => {
  try {
    const response = await axios.delete(`tables/${tableName}`)
    
    if (response.data.success) {
      message.success(response.data.message)
      
      // 重新获取表列表
      await fetchDynamicTables()
      
      // 如果当前正在查看被删除的表，清空数据
      if (currentTableName.value === tableName) {
        currentTableName.value = ''
        tableData.value = []
        tableColumns.value = []
        total.value = 0
      }
    } else {
      message.error(response.data.message || '删除表失败')
    }
  } catch (error) {
    console.error('删除表错误:', error)
    message.error('删除表时发生错误')
  }
}

// 锁定表格
const lockTable = async (tableName) => {
  try {
    const table = dynamicTables.value.find(t => t.name === tableName);
    if (table) {
      // 直接在前端完成锁定
      table.locked = true;
      message.success(`已锁定表 "${tableName}"，该表现在受保护不会被意外删除或修改`);
      
      // 保存锁定状态到本地存储
      saveLockStatus();
    } else {
      message.error(`未找到名为 "${tableName}" 的表`);
    }
  } catch (error) {
    console.error('锁定表时出错:', error);
    message.error('锁定表时发生错误，请稍后重试');
  }
}

// 解锁表格
const unlockTable = async (tableName) => {
  try {
    const table = dynamicTables.value.find(t => t.name === tableName);
    if (table) {
      // 直接在前端完成解锁
      table.locked = false;
      message.warning(`已解锁表 "${tableName}"，该表现在可以被修改或删除`);
      
      // 保存锁定状态到本地存储
      saveLockStatus();
    } else {
      message.error(`未找到名为 "${tableName}" 的表`);
    }
  } catch (error) {
    console.error('解锁表时出错:', error);
    message.error('解锁表时发生错误，请稍后重试');
  }
}

// 保存锁定状态到本地存储
const saveLockStatus = () => {
  try {
    // 创建锁定表状态的映射
    const lockStatusMap = {};
    dynamicTables.value.forEach(table => {
      if (table.locked) {
        lockStatusMap[table.name] = true;
      }
    });
    
    // 保存到本地存储
    localStorage.setItem('lockedTables', JSON.stringify(lockStatusMap));
    console.log('表锁定状态已保存到本地存储');
  } catch (error) {
    console.error('保存锁定状态时出错:', error);
  }
}

// 获取数据列表
const fetchData = async () => {
  if (!currentTableName.value) return;
  
  tableLoading.value = true;
  try {
    const params = new URLSearchParams({
      page: currentPage.value,
      pageSize: pageSize.value,
      sortField: sortInfo.value.field,
      sortOrder: sortInfo.value.order,
      filters: JSON.stringify(filterInfo.value),
      searchKeywords: JSON.stringify(searchKeywords.value)
    });

    const response = await fetch(`tables/${currentTableName.value}/data?${params}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    
    if (result.success) {
      tableData.value = result.data;
      total.value = result.total;
      if (result.columns) {
        tableColumns.value = result.columns;
      }
    } else {
      message.error(result.message || '获取数据失败');
    }
  } catch (error) {
    console.error('获取数据失败:', error);
    message.error('获取数据失败: ' + error.message);
  } finally {
    tableLoading.value = false;
  }
};

// 添加上传表单相关状态
const tableNameModalVisible = ref(false);
const uploadForm = reactive({
  tableName: 'demo',
  createDynamicTable: true
});
const selectedFile = ref(null);
const uploadLoading = ref(false);

// 文件上传前处理 - 现在只做验证，不直接上传
const beforeUploadHandler = (file) => {
  console.log('开始验证上传文件:', file.name, file.type, file.size);
  
  // 检查文件类型
  const isExcel = /\.(xlsx|xls)$/.test(file.name.toLowerCase());
  
  // 检查MIME类型 (更严格的验证)
  const validMimeTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream'  // 某些浏览器可能使用这个通用类型
  ];
  
  if (!isExcel) {
    message.error('只能上传Excel文件!');
    return false;
  }
  
  // MIME类型验证
  if (file.type && !validMimeTypes.includes(file.type)) {
    console.warn(`文件MIME类型不匹配: ${file.type}，但文件扩展名正确，将继续上传`);
  }
  
  // 检查文件大小 (限制为20MB)
  const isLessThan20M = file.size / 1024 / 1024 < 20;
  if (!isLessThan20M) {
    message.error('文件必须小于20MB!');
    return false;
  }
  
  // 文件验证通过，保存选中文件并显示表名对话框
  selectedFile.value = file;
  
  // 显示表名确认对话框
  showTableNameModal();
  
  // 返回false，阻止自动上传
  return false;
};

// 自定义上传请求
const customUploadRequest = ({ file, onSuccess, onError }) => {
  // 这个函数在点击上传按钮选择文件后被调用
  // 但我们不在这里执行上传，而是通过对话框确认后手动上传
  // 所以这里不需要实现任何逻辑
  console.log("Custom request handler invoked but not doing anything here");
};

// 显示表名确认对话框
const showTableNameModal = () => {
  // 预填写表单
  uploadForm.tableName = tableName.value || 'demo';
  uploadForm.createDynamicTable = createDynamicTable.value;
  
  // 显示对话框
  tableNameModalVisible.value = true;
};

// 取消上传
const cancelUpload = () => {
  tableNameModalVisible.value = false;
  selectedFile.value = null;
  fileList.value = [];
};

// 确认上传文件
const confirmUpload = async () => {
  if (!selectedFile.value) {
    message.error('未选择文件');
    return;
  }
  
  if (!uploadForm.tableName) {
    message.error('请输入表名');
    return;
  }
  
  // 检查表是否被锁定
  if (isTableLocked(uploadForm.tableName)) {
    message.error(`表 "${uploadForm.tableName}" 已被锁定，无法修改其数据。请先解锁表或使用其他表名。`);
    return;
  }
  
  // 设置上传中状态
  uploadLoading.value = true;
  message.loading('正在上传文件，请稍候...', 0);
  
  try {
    // 创建表单数据
    const formData = new FormData();
    formData.append('file', selectedFile.value);
    formData.append('createDynamicTable', uploadForm.createDynamicTable.toString());
    formData.append('tableName', uploadForm.tableName || 'demo');
    formData.append('forceRecreate', 'true');
    formData.append('targetTableLocked', isTableLocked(uploadForm.tableName).toString());
    
    // 执行上传
    const response = await axios.post('/upload', formData);
    
    message.destroy(); // 清除所有消息，包括"上传中"
    
    if (response.data.success) {
      // 检查表是否被重建
      if (response.data.tableRecreated) {
        message.success(`成功重建表 "${response.data.tableName}" 并导入数据！`);
      } else {
        // 显示成功消息
        message.success({
          content: response.data.message || '上传成功！',
          duration: 4,
        });
      }
      
      currentFileName.value = selectedFile.value.name;
      
      // 清空并设置新的文件列表，用于显示
      fileList.value = [{
        uid: '1',
        name: selectedFile.value.name,
        status: 'done'
      }];
      
      // 设置列信息 - 确保使用Excel第一行作为表头
      if (response.data.columns) {
        console.log('服务器返回的列信息:', response.data.columns);
        tableColumns.value = response.data.columns.map(col => ({
          prop: col.field,
          label: col.header // 使用header作为标签文本，这就是Excel第一行的内容
        }));
        
        // 记录一下列数据，以便调试
        console.log('设置列信息：', tableColumns.value);
      }
      
      // 强制刷新表列表并添加视觉反馈
      refreshTablesWithAnimation();
      
      // 如果创建了表，更新当前表名并查看表数据
      if (response.data.tableCreated && response.data.tableName) {
        currentTableName.value = response.data.tableName;
        currentFileName.value = '';
        
        // 显示表创建成功的特殊消息
        setTimeout(() => {
          message.success({
            content: `已创建新表: ${response.data.tableName}`,
            duration: 3
          });
        }, 1000);
      } else {
        currentTableName.value = '';
      }
      
      // 重新获取数据
      fetchTableData();
      
      // 关闭对话框
      tableNameModalVisible.value = false;
    } else {
      // 显示错误消息
      message.error({
        content: response?.message || '上传失败，服务器未返回成功状态',
        duration: 5
      });
      console.error('上传失败:', response);
      fileList.value = [];
    }
  } catch (error) {
    message.destroy(); // 清除所有消息
    
    console.error('上传错误:', error);
    
    let errorMsg = '未知错误，请稍后重试';
    
    // 尝试获取更详细的错误信息
    if (error.response) {
      if (error.response.data && error.response.data.message) {
        errorMsg = error.response.data.message;
      } else if (error.response.status === 400) {
        errorMsg = '请求格式不正确，请检查参数设置';
      } else if (error.response.status === 413) {
        errorMsg = '文件过大，请上传较小的文件';
      } else if (error.response.status) {
        errorMsg = `服务器返回错误状态码: ${error.response.status}`;
      }
    } else if (error.message) {
      errorMsg = error.message;
    }
    
    // 显示详细错误信息
    message.error({
      content: `上传失败: ${errorMsg}`,
      duration: 5
    });
    fileList.value = [];
  } finally {
    uploadLoading.value = false;
    selectedFile.value = null;
  }
};

// 带动画效果刷新表列表
const refreshTablesWithAnimation = async () => {
  // 显示加载状态
  const hide = message.loading('刷新表列表...', 0);
  
  try {
    console.log('开始刷新表列表');
    // 确保获取最新的表列表
    await fetchDynamicTables();
    console.log('表列表已更新:', dynamicTables.value);
    
    // 短暂延迟以确保DOM已更新
    setTimeout(() => {
      // 尝试添加高亮效果
      const tablesSection = document.querySelector('.tables-section');
      if (tablesSection) {
        console.log('应用高亮动画效果');
        tablesSection.classList.add('highlight-animation');
        
        // 移除高亮效果
        setTimeout(() => {
          tablesSection.classList.remove('highlight-animation');
        }, 2000);
      } else {
        console.log('未找到表格部分DOM元素');
      }
    }, 500);
  } catch (error) {
    console.error('刷新表列表时出错:', error);
    message.error('刷新表列表失败，请手动刷新页面');
  } finally {
    // 确保关闭加载状态
    hide();
  }
}

// 初始化表锁定状态
const initLockedTablesStatus = () => {
  try {
    // 从本地存储加载锁定状态
    const savedData = localStorage.getItem('lockedTables');
    if (savedData) {
      const savedLockStatus = JSON.parse(savedData);
      console.log('从本地存储加载的表锁定状态:', savedLockStatus);
      
      // 应用锁定状态到现有表
      dynamicTables.value.forEach(table => {
        if (savedLockStatus[table.name]) {
          table.locked = true;
        }
      });
    }
  } catch (error) {
    console.error('初始化表锁定状态时出错:', error);
  }
}

// 回到顶部函数
const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
}

// 清除所有筛选条件
const clearAllFilters = () => {
  // 清空筛选信息
  filterInfo.value = {};
  searchKeywords.value = {};
  
  // 显示加载状态
  tableLoading.value = true;
  
  // 加载未筛选的数据
  fetchTableData().then(() => {
    message.success('已清除所有筛选条件');
  });
}

// 处理全局搜索
const handleGlobalSearch = (value) => {
  if (!value) {
    searchKeywords.value = {}
    fetchTableData()
    return
  }
  
  tableLoading.value = true
  const hide = message.loading('正在搜索数据...', 0)
  
  const searchConditions = {}
  
  if (selectedSearchColumn.value === 'all') {
    tableColumns.value.forEach(col => {
      searchConditions[col.prop] = value
    })
  } else {
    searchConditions[selectedSearchColumn.value] = value
  }
  
  searchKeywords.value = searchConditions
  currentPage.value = 1
  
  fetchTableData().finally(() => {
    hide()
  })
}

// 处理修改按钮点击
const handleEdit = (record) => {
  editingRecord.value = { ...record };
  editForm.value = {};
  // 复制需要编辑的字段
  tableColumns.value.forEach(col => {
    if (col.prop !== 'id') {
      editForm.value[col.prop] = record[col.prop];
    }
  });
  editModalVisible.value = true;
};

// 处理取消修改
const handleEditCancel = () => {
  editModalVisible.value = false;
  editingRecord.value = null;
  editForm.value = {};
};

// 处理确认修改
const handleEditOk = async () => {
  if (!currentTableName.value || !editingRecord.value?.id) {
    message.error('缺少必要的修改信息');
    return;
  }

  tableLoading.value = true;
  try {
    const response = await axios.put(
      `tables/${currentTableName.value}/data/${editingRecord.value.id}`,
      { data: editForm.value }
    );

    if (response.data.success) {
      message.success('修改成功');
      editModalVisible.value = false;
      editingRecord.value = null;
      editForm.value = {};
      // 重新加载数据
      await fetchTableData();
    } else {
      throw new Error(response.data.message || '修改失败');
    }
  } catch (error) {
    console.error('修改数据错误:', error);
    message.error('修改数据时发生错误: ' + (error.response?.data?.message || error.message));
  } finally {
    tableLoading.value = false;
  }
};

// SQL查询相关
const sqlQuery = ref('select * from demo');
const sqlTableData = ref([]);
const sqlTableColumns = ref([]);
const sqlLoading = ref(false);
const sqlTotal = ref(0);
const sqlPagination = reactive({
  current: 1,
  pageSize: 10
});

// SQL分页处理
const handleSqlPageChange = async (page, pageSize) => {
  sqlPagination.current = page;
  sqlPagination.pageSize = pageSize;
  await executeSql(true);
};

const handleSqlSizeChange = async (current, size) => {
  sqlPagination.current = 1;
  sqlPagination.pageSize = size;
  await executeSql(true);
};

// 执行SQL查询
const executeSql = async (isPageChange = false) => {
  if (!sqlQuery.value.trim() && !isPageChange) {
    message.warning('请输入SQL查询语句');
    return;
  }

  sqlLoading.value = true;
  try {
    const response = await axios.post('/sql/execute', {
      sql: sqlQuery.value,
      pageSize: sqlPagination.pageSize,
      page: sqlPagination.current
    });

    if (response.data.success) {
      // 确保数据是数组
      const data = Array.isArray(response.data.data) ? response.data.data : [];
      
      // 处理返回的数据，添加key属性和行索引
      sqlTableData.value = data.map((item, index) => ({
        ...item,
        key: index,
        rowIndex: index + 1 + (sqlPagination.current - 1) * sqlPagination.pageSize
      }));

      // 设置总记录数
      sqlTotal.value = response.data.total || 0;

      // 使用服务器返回的列信息
      if (response.data.columns && Array.isArray(response.data.columns)) {
        sqlTableColumns.value = response.data.columns;
      } else if (sqlTableData.value.length > 0) {
        // 如果服务器没有返回列信息，从第一条记录中提取
        sqlTableColumns.value = Object.keys(sqlTableData.value[0])
          .filter(key => !['key', 'rowIndex'].includes(key))
          .map(key => ({
            field: key,
            header: key
          }));
      } else {
        sqlTableColumns.value = [];
      }

      if (!isPageChange) {
        message.success('查询执行成功');
      }
    } else {
      message.error(response.data.message || '查询执行失败');
      sqlTableData.value = [];
      sqlTableColumns.value = [];
      sqlTotal.value = 0;
    }
  } catch (error) {
    console.error('SQL查询出错:', error);
    message.error(error.response?.data?.message || '查询执行失败');
    sqlTableData.value = [];
    sqlTableColumns.value = [];
    sqlTotal.value = 0;
  } finally {
    sqlLoading.value = false;
  }
};

// 清空SQL查询
const clearSql = () => {
  sqlQuery.value = '';
  sqlTableData.value = [];
  sqlTableColumns.value = [];
  sqlTotal.value = 0;
  sqlPagination.current = 1;
};

// SQL表格列配置
const sqlAntTableColumns = computed(() => {
  return sqlTableColumns.value.map(col => {
    return {
      title: col.header || col.field,
      dataIndex: col.field,
      key: col.field,
      align: 'center',
      minWidth: 120,
    }
  });
});

// 测试上传参数
const testUploadParams = async () => {
  try {
    // 构建与上传相同的参数
    const testParams = {
      createDynamicTable: createDynamicTable.value,
      tableName: tableName.value || 'demo',
      forceRecreate: true,
      targetTableLocked: isTableLocked(tableName.value)
    };
    
    console.log('测试上传参数:', testParams);
    
    // 向后端发送测试请求
    const response = await axios.post('/upload/test-params', testParams, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    if (response.data.success) {
      console.log('参数测试成功，后端解析结果:', response.data);
      message.success('参数验证成功，配置正确');
    } else {
      console.error('参数测试失败:', response.data.message);
      message.error('参数验证失败: ' + response.data.message);
    }
  } catch (error) {
    console.error('测试上传参数时出错:', error);
    message.error('测试参数时发生错误: ' + (error.response?.data?.message || error.message));
  }
};

// 添加测试强制重建表的函数
const testForceRecreate = async () => {
  if (!tableName.value) {
    message.warning('请输入表名');
    return;
  }
  
  if (isTableLocked(tableName.value)) {
    message.error(`表 "${tableName.value}" 已被锁定，无法修改`);
    return;
  }
  
  try {
    const hide = message.loading(`正在测试强制重建表 "${tableName.value}"...`, 0);
    
    const response = await axios.post('/tables/recreate', {
      tableName: tableName.value,
      forceRecreate: true
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    hide();
    
    if (response.data.success) {
      message.success(`表 "${tableName.value}" 重建测试成功: ${response.data.message}`);
      console.log('重建表响应:', response.data);
      
      // 刷新表列表
      await refreshTablesWithAnimation();
    } else {
      message.error(`表重建失败: ${response.data.message}`);
      console.error('重建表失败:', response.data);
    }
  } catch (error) {
    message.error(`测试重建表时出错: ${error.response?.data?.message || error.message}`);
    console.error('测试重建表错误:', error);
  }
};

// 修改handlePageChange函数确保只发送一次请求并正确保留筛选条件
const handlePageChange = (page, pageSizeVal) => {
  console.log('页码变化 handlePageChange:', page, '每页数量:', pageSizeVal);
  
  // 更新页码和每页数量
  tablePagination.current = page;
  tablePagination.pageSize = pageSizeVal;
  
  // 安全地更新兼容性变量
  if (typeof currentPage === 'object' && currentPage !== null) {
    currentPage.value = page;
  }
  if (typeof pageSize === 'object' && pageSize !== null) {
    pageSize.value = pageSizeVal;
  }
  
  // 获取数据
  tableLoading.value = true;
  fetchTableData().finally(() => {
    tableLoading.value = false;
  });
};

// 修改handleSizeChange函数
const handleSizeChange = (page, pageSizeVal) => {
  console.log('每页数量变化 handleSizeChange:', page, pageSizeVal);
  
  // 当页面大小改变时，重置当前页为1
  tablePagination.current = 1;
  tablePagination.pageSize = pageSizeVal;
  
  // 安全地更新兼容性变量
  if (typeof currentPage === 'object' && currentPage !== null) {
    currentPage.value = 1;
  }
  if (typeof pageSize === 'object' && pageSize !== null) {
    pageSize.value = pageSizeVal;
  }
  
  // 获取数据
  tableLoading.value = true;
  fetchTableData().finally(() => {
    tableLoading.value = false;
  });
};

// 添加表格排序处理函数
const handleSorterChange = (sorter) => {
  console.log('表格排序变化:', sorter);
  
  // 更新排序信息
  if (sorter && sorter.column) {
    sortInfo.value.field = sorter.field;
    sortInfo.value.order = sorter.order;
  } else {
    sortInfo.value = { field: '', order: '' };
  }
  
  // 重置到第一页
  currentPage.value = 1;
  
  // 设置表格加载状态
  tableLoading.value = true;
  
  // 重新获取数据
  fetchTableData().finally(() => {
    tableLoading.value = false;
  });
};

// 添加表格筛选处理函数
const handleFilterChange = (filters) => {
  console.log('表格筛选变化:', filters);
  
  // 更新筛选信息
  filterInfo.value = {};
  searchKeywords.value = {};
  
  // 处理筛选条件
  if (filters) {
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        if (Array.isArray(filters[key]) && filters[key].length > 0) {
          filterInfo.value[key] = filters[key];
          console.log(`添加筛选条件 ${key}:`, filters[key]);
        }
        
        if (filters[key]._custom && typeof filters[key]._custom === 'string' && filters[key]._custom.trim()) {
          searchKeywords.value[key] = filters[key]._custom.trim();
          console.log(`添加搜索关键字 ${key}:`, filters[key]._custom.trim());
        }
      }
    });
  }
  
  // 重置到第一页
  currentPage.value = 1;
  
  // 设置表格加载状态
  tableLoading.value = true;
  
  // 显示筛选应用中的提示
  let filterApplyMsg;
  if (Object.keys(filterInfo.value).length > 0 || Object.keys(searchKeywords.value).length > 0) {
    filterApplyMsg = message.loading('正在对所有数据应用筛选条件...', 0);
  }
  
  // 重新获取数据
  fetchTableData().finally(() => {
    if (filterApplyMsg) {
      filterApplyMsg();
      
      if (Object.keys(filterInfo.value).length > 0 || Object.keys(searchKeywords.value).length > 0) {
        message.success('已对全部数据应用筛选条件');
      }
    }
    tableLoading.value = false;
  });
};

// 获取所有动态表
const fetchDynamicTables = async () => {
  try {
    console.log('正在获取动态表列表...');
    const response = await axios.get('/tables');
    
    if (response.data.success) {
      console.log('成功获取动态表列表:', response.data.tables);
      
      // 从本地存储加载锁定状态
      let savedLockStatus = {};
      try {
        const savedData = localStorage.getItem('lockedTables');
        if (savedData) {
          savedLockStatus = JSON.parse(savedData);
          console.log('从本地存储加载的表锁定状态:', savedLockStatus);
        }
      } catch (e) {
        console.error('加载本地锁定状态时出错:', e);
      }
      
      // 过滤掉系统表和保留表
      const userTables = response.data.tables.filter(name => 
        name !== 'table_metadata' && 
        !name.startsWith('system_') && 
        !name.startsWith('_')
      );
      
      // 保持已有表的锁定状态，优先使用内存中的状态，其次是本地存储中的状态
      dynamicTables.value = userTables.map(name => {
        const existingTable = dynamicTables.value.find(t => t.name === name);
        return { 
          name, 
          locked: existingTable ? existingTable.locked : (savedLockStatus[name] || false)
        };
      });
    } else {
      console.error('获取表列表失败:', response.data.message);
      message.error('获取表列表失败');
    }
  } catch (error) {
    console.error('获取动态表列表请求失败:', error);
    message.error('获取表列表失败，请检查网络连接');
  }
};

onMounted(() => {
  fetchDynamicTables()
  // 只在有当前表名时才获取数据
  if (currentTableName.value) {
    fetchTableData()
  }
  
  setTimeout(initLockedTablesStatus, 500)
})
</script>

<style scoped>
.container {
  padding: 20px;
  background-color: #f0f2f5;
  min-height: 100vh;
}

.main-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.upload-content {
  display: flex;
  flex-direction: row;
  gap: 20px;
  align-items: flex-start;
}

/* 设置两个区域的宽度比例为1:1 */
.upload-section {
  width: 50%;
  flex-shrink: 0;
}

.tables-section {
  width: 50%;
  flex-shrink: 0;
}

/* 小屏幕下切换为垂直布局 */
@media (max-width: 992px) {
  .upload-content {
    flex-direction: column;
  }
  
  .upload-section,
  .tables-section {
    width: 100%;
  }
}

.sql-card {
  margin-bottom: 16px;
  transition: all 0.3s;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 2px -2px rgba(0, 0, 0, 0.08), 
              0 3px 6px 0 rgba(0, 0, 0, 0.06), 
              0 5px 12px 4px rgba(0, 0, 0, 0.04);
}

.sql-card:hover {
  transform: translateY(-3px);
}

.upload-all-card, .data-card {
  margin-bottom: 20px;
  transition: all 0.3s;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 2px -2px rgba(0, 0, 0, 0.08), 
              0 3px 6px 0 rgba(0, 0, 0, 0.06), 
              0 5px 12px 4px rgba(0, 0, 0, 0.04);
}

.upload-all-card:hover, .data-card:hover {
  transform: translateY(-3px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  color: #1890ff;
  padding: 10px 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-area {
  margin: 20px 0 24px;
  padding: 24px;
  background: #f9fafb;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
}

.search-area:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  border-color: #d1d5db;
}

.search-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-container :deep(.ant-select-selector) {
  height: 46px !important;
  display: flex;
  align-items: center;
  border-radius: 8px !important;
}

.search-container :deep(.ant-input-search) {
  border-radius: 8px !important;
}

.search-container :deep(.ant-input) {
  height: 46px !important;
  font-size: 16px;
  padding-left: 16px;
}

.search-container :deep(.ant-input-search-button) {
  height: 46px !important;
  width: 80px;
  border-radius: 0 8px 8px 0 !important;
  font-size: 16px;
}

.card-header .anticon, .section-header .anticon {
  margin-right: 8px;
  font-size: 18px;
  vertical-align: middle;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  color: #1890ff;
  padding: 10px 0;
  margin-bottom: 10px;
  border-bottom: 1px dashed #e8e8e8;
}

.table-info {
  display: flex;
  gap: 8px;
}

.upload-excel {
  width: 100%;
  margin-top: 10px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 2px -2px rgba(0, 0, 0, 0.08), 
              0 3px 6px 0 rgba(0, 0, 0, 0.06), 
              0 5px 12px 4px rgba(0, 0, 0, 0.04);
  transition: all 0.3s;
}

.upload-excel:hover {
  transform: translateY(-2px);
  box-shadow: 0 3px 6px -4px rgba(0, 0, 0, 0.12), 
              0 6px 16px 0 rgba(0, 0, 0, 0.08), 
              0 9px 28px 8px rgba(0, 0, 0, 0.05);
}

.upload-excel :deep(.ant-upload-drag) {
  border-radius: 8px;
  border: 1px dashed #d9d9d9;
  background: #fafafa;
  transition: all 0.3s;
}

.upload-excel :deep(.ant-upload-drag:hover) {
  border-color: #1890ff;
  background: #f0f7ff;
}

.upload-excel :deep(.ant-upload-drag-icon) {
  color: #1890ff;
  font-size: 48px;
  margin-bottom: 16px;
}

.tables-list {
  width: 100%;
}

/* 高亮动画效果 */
@keyframes highlight {
  0% {
    background-color: rgba(24, 144, 255, 0.1);
  }
  50% {
    background-color: rgba(24, 144, 255, 0.2);
  }
  100% {
    background-color: transparent;
  }
}

.highlight-animation {
  animation: highlight 2s ease-in-out;
}

.ant-upload-text {
  margin: 8px 0;
  font-size: 16px;
  color: rgba(0, 0, 0, 0.85);
}

.ant-upload-text a {
  color: #1890ff;
  font-weight: bold;
}

.ant-upload-hint {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.45);
}

.filter-info {
  margin-bottom: 16px;
}

[class*="ant-"] {
  box-sizing: border-box;
}

.back-to-top-btn {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.sql-buttons {
  margin-top: 16px;
}

.sql-table {
  margin-top: 16px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 2px -2px rgba(0, 0, 0, 0.08), 
              0 3px 6px 0 rgba(0, 0, 0, 0.06), 
              0 5px 12px 4px rgba(0, 0, 0, 0.04);
}

.sql-table :deep(.ant-table) {
  border-radius: 8px;
}

.sql-table :deep(.ant-table-thead > tr > th) {
  background: #f7f9fc;
  color: #1f2937;
  font-weight: 600;
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
}

.sql-table :deep(.ant-table-tbody > tr > td) {
  padding: 12px 16px;
  color: #374151;
}

.sql-table :deep(.table-striped) {
  background-color: #f9fafb;
}

.sql-table :deep(.ant-table-tbody > tr:hover > td) {
  background: #f0f7ff !important;
}

.sql-table :deep(.ellipsis-cell) {
  display: inline-block;
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.sql-table :deep(.ant-pagination),
.data-card :deep(.ant-pagination),
.tables-section :deep(.ant-pagination) {
  margin: 16px 0;
  padding: 0 16px;
}

.sql-table :deep(.ant-table-empty .ant-table-tbody > tr:hover > td),
.data-card :deep(.ant-table-empty .ant-table-tbody > tr:hover > td),
.tables-section :deep(.ant-table-empty .ant-table-tbody > tr:hover > td) {
  background: none !important;
}

/* 禁用表格内部滚动条 */
:deep(.ant-table-body) {
  overflow-y: visible !important;
}

:deep(.ant-table-body-inner) {
  overflow-y: visible !important;
}

:deep(.ant-table-header) {
  overflow-y: visible !important;
  margin-bottom: 0 !important;
  padding-bottom: 0 !important;
}

:deep(.ant-table-header::-webkit-scrollbar),
:deep(.ant-table-body::-webkit-scrollbar),
:deep(.ant-table-body-inner::-webkit-scrollbar) {
  display: none !important;
}

.empty-tables {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 2px -2px rgba(0, 0, 0, 0.08), 
              0 3px 6px 0 rgba(0, 0, 0, 0.06), 
              0 5px 12px 4px rgba(0, 0, 0, 0.04);
}

.option-hint {
  font-size: 12px;
  color: #ff4d4f;
  margin-top: 8px;
  padding-left: 25px;
  line-height: 1.5;
}

.table-name-warning, .table-name-info {
  margin-top: 8px;
  margin-bottom: 16px;
}
</style> 