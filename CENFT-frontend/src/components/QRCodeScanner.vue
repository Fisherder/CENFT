<template>
  <div class="qr-scanner">
    <div v-if="!scanActive" class="scanner-control">
      <el-button type="primary" @click="startScan">
        开始扫码签到
      </el-button>
      <p class="scanner-tip">点击按钮启动相机扫描二维码</p>
    </div>
    
    <div v-else class="scanner-container">
      <qrcode-stream 
        @decode="onDecode" 
        @init="onInit"
        :camera="camera"
      />
      <div class="scanner-overlay">
        <div class="scanner-actions">
          <el-button type="danger" @click="stopScan" size="small">
            取消扫描
          </el-button>
          <el-button 
            v-if="cameras.length > 1" 
            type="info" 
            @click="switchCamera" 
            size="small"
          >
            切换相机
          </el-button>
        </div>
      </div>
    </div>

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
import { ref, computed } from 'vue';
import { QrcodeStream } from 'vue-qrcode-reader';
import { web3Service } from '../services/web3';
import { ElMessage } from 'element-plus';
import { Loading, CircleCheck, CircleClose } from '@element-plus/icons-vue';

// 扫描相关状态
const scanActive = ref(false);
const cameras = ref<string[]>([]);
const currentCameraIndex = ref(0);
const error = ref('');
const loading = ref(false);

// 签到结果状态
const resultDialogVisible = ref(false);
const scanSuccess = ref(false);
const eventName = ref('');

// 计算当前使用的相机
const camera = computed(() => {
  if (cameras.value.length === 0) return 'auto';
  return cameras.value[currentCameraIndex.value % cameras.value.length];
});

// 初始化扫描器
const onInit = async (promise: Promise<any>) => {
  try {
    const { capabilities } = await promise;
    cameras.value = capabilities.map((cap: MediaDeviceInfo) => cap.deviceId);
  } catch (error: any) {
    if (error.name === 'NotAllowedError') {
      ElMessage.error('请允许访问相机权限以启用扫描功能');
    } else if (error.name === 'NotFoundError') {
      ElMessage.error('未检测到相机设备');
    } else if (error.name === 'NotSupportedError') {
      ElMessage.error('您的设备或浏览器不支持相机API');
    } else if (error.name === 'NotReadableError') {
      ElMessage.error('相机可能正被其他应用使用');
    } else if (error.name === 'OverconstrainedError') {
      ElMessage.error('无法满足相机参数要求');
    } else if (error.name === 'StreamApiNotSupportedError') {
      ElMessage.error('此浏览器不支持流媒体API');
    } else {
      ElMessage.error('相机初始化失败: ' + error.message);
    }
    stopScan();
  }
};

// 处理二维码解码结果
const onDecode = async (decodedString: string) => {
  console.log('QR Code decoded:', decodedString);
  
  try {
    // 停止扫描并显示加载对话框
    stopScan();
    resultDialogVisible.value = true;
    loading.value = true;
    error.value = '';
    scanSuccess.value = false;
    
    // 解析二维码内容
    // 预期格式: /checkin/{eventId}/{qrCodeHash}
    const url = new URL(decodedString);
    const pathSegments = url.pathname.split('/').filter(segment => segment);
    
    if (pathSegments.length < 3 || pathSegments[0] !== 'checkin') {
      throw new Error('无效的二维码格式');
    }
    
    const eventId = parseInt(pathSegments[1]);
    const qrCodeHash = pathSegments[2];
    
    if (isNaN(eventId) || !qrCodeHash) {
      throw new Error('二维码信息不完整');
    }
    
    console.log('Checking in to event:', { eventId, qrCodeHash });
    
    // 调用签到方法
    await web3Service.checkIn(eventId, qrCodeHash);
    
    // 获取活动信息以显示
    try {
      const event = await web3Service.getEvent(eventId);
      eventName.value = event.name;
    } catch (e) {
      console.error('获取活动信息失败:', e);
      eventName.value = `活动 #${eventId}`;
    }
    
    // 标记签到成功
    scanSuccess.value = true;
    
    // 触发更新
    emit('check-in-success');
  } catch (err: any) {
    console.error('签到失败:', err);
    error.value = err.message || '签到失败，请重试';
  } finally {
    loading.value = false;
  }
};

// 开始扫描
const startScan = () => {
  scanActive.value = true;
  error.value = '';
};

// 停止扫描
const stopScan = () => {
  scanActive.value = false;
};

// 切换相机
const switchCamera = () => {
  if (cameras.value.length <= 1) return;
  currentCameraIndex.value = (currentCameraIndex.value + 1) % cameras.value.length;
};

// 关闭结果对话框
const closeResult = () => {
  resultDialogVisible.value = false;
  if (!scanSuccess.value) {
    // 如果失败，允许重新扫描
    startScan();
  }
};

// 定义组件事件
const emit = defineEmits(['check-in-success']);
</script>

<style scoped lang="scss">
.qr-scanner {
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
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    
    .scanner-overlay {
      position: absolute;
      bottom: 20px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      z-index: 100;
      
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
