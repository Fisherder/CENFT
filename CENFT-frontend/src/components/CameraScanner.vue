<template>
  <div class="camera-scanner">
    <div v-if="!cameraActive" class="scanner-control">
      <el-button type="primary" @click="startCamera">
        开始扫码签到
      </el-button>
      <p class="scanner-tip">点击按钮启动相机扫描活动二维码</p>
    </div>
    
    <div v-else class="scanner-container">
      <!-- 相机视图 -->
      <div class="video-container">
        <video ref="videoElement" autoplay playsinline></video>
        <canvas ref="canvasElement" style="display: none;"></canvas>
        <div class="scanner-overlay">
          <div class="scanner-frame"></div>
          <div class="scanner-actions">
            <el-button type="danger" @click="stopCamera" size="small">
              取消扫描
            </el-button>
            <el-button 
              v-if="hasMultipleCameras" 
              type="info" 
              @click="switchCamera" 
              size="small"
            >
              切换相机
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 结果对话框 -->
    <el-dialog
      v-model="resultDialogVisible"
      title="扫描结果"
      width="80%"
      :close-on-click-modal="false"
      :show-close="false"
    >
      <div v-if="loading" class="dialog-loading">
        <el-icon class="is-loading"><loading /></el-icon>
        <span>处理中...</span>
      </div>
      <div v-else class="dialog-content">
        <div v-if="error" class="scan-error">
          <el-icon><circle-close /></el-icon>
          <p>{{ error }}</p>
        </div>
        <div v-else-if="scanSuccess" class="scan-success">
          <el-icon><circle-check /></el-icon>
          <p>签到成功！</p>
          <p class="event-name" v-if="eventName">活动: {{ eventName }}</p>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="closeResult">{{ scanSuccess ? '确定' : '重试' }}</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { web3Service } from '../services/web3';
import { ElMessage } from 'element-plus';
import { Loading, CircleCheck, CircleClose } from '@element-plus/icons-vue';

// 相机相关状态
const videoElement = ref<HTMLVideoElement | null>(null);
const canvasElement = ref<HTMLCanvasElement | null>(null);
const cameraActive = ref(false);
const hasMultipleCameras = ref(false);
const currentDeviceId = ref('');
const cameraDevices = ref<MediaDeviceInfo[]>([]);

// 扫描结果状态
const resultDialogVisible = ref(false);
const loading = ref(false);
const error = ref('');
const scanSuccess = ref(false);
const eventName = ref('');

// 扫描定时器
let scanInterval: number | null = null;

// 后端API基础路径
const API_BASE_URL = 'http://localhost:5000';

// 获取可用相机设备
const getAvailableCameras = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    cameraDevices.value = videoDevices;
    hasMultipleCameras.value = videoDevices.length > 1;
    
    if (videoDevices.length > 0 && !currentDeviceId.value) {
      currentDeviceId.value = videoDevices[0].deviceId;
    }
    
    return videoDevices;
  } catch (error) {
    console.error('获取相机列表失败:', error);
    return [];
  }
};

// 启动相机
const startCamera = async () => {
  try {
    // 首先获取设备列表
    await getAvailableCameras();
    
    if (!currentDeviceId.value && cameraDevices.value.length > 0) {
      currentDeviceId.value = cameraDevices.value[0].deviceId;
    }
    
    // 获取媒体流
    const constraints = {
      video: {
        deviceId: currentDeviceId.value ? { exact: currentDeviceId.value } : undefined,
        facingMode: 'environment', // 优先使用后置摄像头
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    if (videoElement.value) {
      videoElement.value.srcObject = stream;
      cameraActive.value = true;
      
      // 启动定时扫描
      startQRCodeScanning();
    }
  } catch (error: any) {
    console.error('启动相机失败:', error);
    if (error.name === 'NotAllowedError') {
      ElMessage.error('请允许访问相机权限');
    } else if (error.name === 'NotFoundError') {
      ElMessage.error('未检测到相机设备');
    } else {
      ElMessage.error(`启动相机失败: ${error.message}`);
    }
  }
};

// 停止相机
const stopCamera = () => {
  // 停止视频流
  if (videoElement.value && videoElement.value.srcObject) {
    const tracks = (videoElement.value.srcObject as MediaStream).getTracks();
    tracks.forEach(track => track.stop());
    videoElement.value.srcObject = null;
  }
  
  // 停止扫描
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  
  cameraActive.value = false;
};

// 切换相机
const switchCamera = async () => {
  // 停止当前相机
  stopCamera();
  
  // 获取下一个相机设备
  const devices = await getAvailableCameras();
  if (devices.length <= 1) return;
  
  // 找到当前设备索引
  const currentIndex = devices.findIndex(device => device.deviceId === currentDeviceId.value);
  const nextIndex = (currentIndex + 1) % devices.length;
  currentDeviceId.value = devices[nextIndex].deviceId;
  
  // 启动新相机
  startCamera();
};

// 开始QR码扫描
const startQRCodeScanning = () => {
  // 设置扫描间隔 (200ms)
  scanInterval = window.setInterval(() => {
    captureAndScanFrame();
  }, 200);
};

// 捕获帧并扫描
const captureAndScanFrame = async () => {
  if (!videoElement.value || !canvasElement.value || !cameraActive.value) return;
  
  try {
    const video = videoElement.value;
    const canvas = canvasElement.value;
    const context = canvas.getContext('2d');
    
    if (!context) return;
    
    // 设置canvas尺寸与视频一致
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // 绘制视频帧到canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // 获取帧图像数据
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    // 发送图像到后端进行二维码解析
    await sendImageToBackend(imageData);
    
  } catch (error) {
    console.error('帧处理错误:', error);
  }
};

// 发送图像到后端
const sendImageToBackend = async (imageData: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/scan-qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: imageData
      })
    });
    
    const result = await response.json();
    
    // 如果找到了有效的二维码，停止扫描并处理签到
    if (result.success && result.eventId && result.qrCodeHash) {
      // 停止扫描
      if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
      }
      
      // 处理签到
      await processCheckIn(result.eventId, result.qrCodeHash);
    }
    
  } catch (error) {
    // 静默失败，继续扫描
    console.error('发送图像到后端失败:', error);
  }
};

// 处理签到
const processCheckIn = async (eventId: number, qrCodeHash: string) => {
  // 停止相机
  stopCamera();
  
  // 显示结果对话框
  resultDialogVisible.value = true;
  loading.value = true;
  error.value = '';
  scanSuccess.value = false;
  
  try {
    // 获取当前钱包地址
    const address = await web3Service.getCurrentAddress();
    
    // 在后端执行签到
    const response = await fetch(`${API_BASE_URL}/api/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        eventId,
        qrCodeHash,
        walletAddress: address
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      scanSuccess.value = true;
      eventName.value = result.event?.name || `活动 #${eventId}`;
      
      // 通知父组件签到成功
      emit('check-in-success');
    } else {
      error.value = result.error || '签到失败，请重试';
    }
    
  } catch (error: any) {
    console.error('签到处理失败:', error);
    error.value = error.message || '签到过程中出现错误';
  } finally {
    loading.value = false;
  }
};

// 关闭结果对话框
const closeResult = () => {
  resultDialogVisible.value = false;
  if (!scanSuccess.value) {
    // 如果失败，允许重新扫描
    startCamera();
  }
};

// 监听组件挂载和卸载
onMounted(() => {
  // 初始化时获取相机设备列表
  getAvailableCameras();
});

onUnmounted(() => {
  // 确保组件卸载时释放相机资源
  stopCamera();
});

// 定义组件事件
const emit = defineEmits(['check-in-success']);
</script>

<style scoped lang="scss">
.camera-scanner {
  width: 100%;
  padding: 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  
  .scanner-control {
    text-align: center;
    margin-bottom: 20px;
    
    .scanner-tip {
      margin-top: 10px;
      font-size: 14px;
      color: #606266;
    }
  }
  
  .scanner-container {
    position: relative;
    width: 100%;
    max-width: 500px;
    margin: 0 auto;
    
    .video-container {
      position: relative;
      width: 100%;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
      
      video {
        width: 100%;
        height: auto;
        display: block;
      }
      
      .scanner-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        padding: 20px 0;
        
        .scanner-frame {
          width: 200px;
          height: 200px;
          border: 2px solid #409eff;
          border-radius: 10px;
          position: relative;
          
          &:before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 2px;
            background-color: #409eff;
            animation: scanning 1.5s linear infinite;
          }
        }
        
        .scanner-actions {
          background: rgba(0, 0, 0, 0.5);
          border-radius: 20px;
          padding: 8px 15px;
          display: flex;
          gap: 10px;
        }
      }
    }
  }
}

@keyframes scanning {
  0% {
    top: 0;
  }
  50% {
    top: calc(100% - 2px);
  }
  100% {
    top: 0;
  }
}

.dialog-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  
  .el-icon {
    font-size: 32px;
    margin-bottom: 10px;
  }
}

.dialog-content {
  text-align: center;
  padding: 10px 0;
  
  .scan-error, .scan-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    
    .el-icon {
      font-size: 48px;
      margin-bottom: 15px;
    }
  }
  
  .scan-error {
    color: #f56c6c;
  }
  
  .scan-success {
    color: #67c23a;
    
    .event-name {
      font-weight: bold;
      margin-top: 10px;
    }
  }
}
</style>
