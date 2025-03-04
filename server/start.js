const { exec } = require('child_process');
const path = require('path');

// 查找并杀死占用3000端口的进程
function killPort3000Process() {
  return new Promise((resolve, reject) => {
    // Windows系统使用netstat和taskkill
    const findCommand = 'netstat -ano | findstr :3000';
    
    exec(findCommand, (error, stdout, stderr) => {
      if (error) {
        console.log('没有进程占用3000端口');
        resolve();
        return;
      }

      // 提取PID
      const lines = stdout.split('\n');
      const pids = new Set();
      
      lines.forEach(line => {
        const match = line.match(/LISTENING\s+(\d+)/);
        if (match) {
          pids.add(match[1]);
        }
      });

      if (pids.size === 0) {
        console.log('没有找到监听3000端口的进程');
        resolve();
        return;
      }

      // 杀死所有占用3000端口的进程
      const killPromises = Array.from(pids).map(pid => {
        return new Promise((resolveKill) => {
          console.log(`正在终止进程 ${pid}...`);
          exec(`taskkill /F /PID ${pid}`, (killError) => {
            if (killError) {
              console.log(`终止进程 ${pid} 失败:`, killError.message);
            } else {
              console.log(`已终止进程 ${pid}`);
            }
            resolveKill();
          });
        });
      });

      Promise.all(killPromises).then(() => {
        console.log('端口3000已释放');
        resolve();
      });
    });
  });
}

// 启动应用
function startApp() {
  const app = require('./app');
  console.log('服务器已启动，监听端口3000...');
}

// 主函数
async function main() {
  try {
    console.log('正在检查端口3000...');
    await killPort3000Process();
    
    console.log('正在启动服务器...');
    startApp();
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

// 运行主函数
main(); 