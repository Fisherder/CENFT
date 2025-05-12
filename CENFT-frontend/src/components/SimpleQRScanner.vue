<template>
  <div class="qr-scanner">
    <div v-if="!scanActive" class="scanner-control">
      <!-- 扫码按钮 -->
      <el-button type="primary" @click="startScan" class="apple-btn apple-btn-primary" :icon="ScanIcon">
        开始扫码签到
      </el-button>
      <p class="scanner-tip">点击按钮启动相机扫描二维码</p>
      
      <!-- 测试功能：手动输入二维码内容 -->
      <div class="manual-input-test">
        <h4>测试功能：直接输入二维码内容</h4>
        <el-input
          v-model="manualQrContent"
          placeholder="请输入二维码文本内容"
          type="textarea"
          :rows="3"
          class="manual-input"
        />
        <el-button type="success" @click="processManualInput" :disabled="!manualQrContent" class="apple-btn apple-btn-success">
          测试签到
        </el-button>
      </div>
    </div>
    
    <div v-else class="scanner-container">
      <!-- 视频元素用于显示相机预览 -->
      <div class="video-container">
        <video ref="video" autoplay playsinline></video>
        <canvas ref="canvas" style="display: none;"></canvas>
        
        <!-- 显示扫描框和操作按钮 -->
        <div class="scanner-overlay">
          <div class="scanner-frame"></div>
          <div class="scanner-actions">
            <el-button type="danger" @click="stopScan" size="small" class="apple-btn apple-btn-danger">
              取消扫描
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
      class="apple-dialog"
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
          <el-button @click="closeResult" class="apple-btn" :class="{'apple-btn-primary': scanSuccess, 'apple-btn-warning': !scanSuccess}">
            {{ scanSuccess ? '确定' : '重试' }}
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, onBeforeUnmount, defineEmits } from 'vue';
import { web3Service } from '../services/web3';
import { ElMessage } from 'element-plus';
import { Loading, CircleCheck, CircleClose, View } from '@element-plus/icons-vue';

// 定义扫描图标
const ScanIcon = View;
import jsQR from 'jsqr';

// 定义emit
const emit = defineEmits(['check-in-success']);

// 相机和扫描相关状态
const scanActive = ref(false);
const video = ref<HTMLVideoElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const stream = ref<MediaStream | null>(null);
const resultDialogVisible = ref(false);
const loading = ref(false);
const error = ref('');
const scanSuccess = ref(false);
const eventName = ref('');
const cameraAvailable = ref(false);

// 手动输入测试相关
const manualQrContent = ref(''); // 手动输入的二维码内容

// 扫描帧并检测二维码
const scanFrame = () => {
  if (!scanActive.value || !video.value || !canvas.value) return;
  
  const videoEl = video.value;
  const canvasEl = canvas.value;
  const ctx = canvasEl.getContext('2d');
  
  if (!ctx || videoEl.videoWidth === 0) {
    // 视频还没准备好或上下文无法获取，继续等待
    requestAnimationFrame(scanFrame);
    return;
  }
  
  // 设置canvas大小与视频一致
  canvasEl.width = videoEl.videoWidth;
  canvasEl.height = videoEl.videoHeight;
  
  // 绘制当前视频帧到canvas
  ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
  
  // 获取图像数据
  const imageData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height);
  
  // 使用jsQR库检测二维码
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'dontInvert', // 加快扫描，不尝试反转图像
  });
  
  if (code) {
    // 检测到二维码
    console.log('QR code found!', code.data);
    ElMessage.success('检测到二维码!');
    
    // 处理扫描结果
    processQRCodeResult(code.data);
    return;
  }
  
  // 如果没有检测到二维码，继续扫描
  if (scanActive.value) {
    requestAnimationFrame(scanFrame);
  }
};

// 处理二维码结果
const processQRCodeResult = async (qrCodeContent: string) => {
  try {
    // 停止扫描并显示加载对话框
    stopScan();
    resultDialogVisible.value = true;
    loading.value = true;
    error.value = '';
    scanSuccess.value = false;
    
    console.log('[调试] 处理QR码内容:', qrCodeContent);
    
    // 从二维码内容中提取活动ID
    let eventId = 0;

    // 1. 新格式: EVENT{id}-{timestamp}-{id}
    const newFormatRegex = /^EVENT(\d+)-/;
    const newFormatMatch = qrCodeContent.match(newFormatRegex);
    
    if (newFormatMatch) {
      console.log('[调试] 检测到新格式二维码');
      eventId = parseInt(newFormatMatch[1]);
    } 
    // 2. 兼容旧格式: CENFT_EVENT_{id}_VERIFY_{hash}
    else {
      const oldFormatRegex = /^CENFT_EVENT_(\d+)_VERIFY_/;
      const oldFormatMatch = qrCodeContent.match(oldFormatRegex);
      
      if (oldFormatMatch) {
        console.log('[调试] 检测到旧格式二维码');
        eventId = parseInt(oldFormatMatch[1]);
      } 
      // 3. 尝试其他格式匹配
      else {
        console.log('[调试] 尝试其他格式匹配');
        
        // 尝试从内容中提取数字作为活动ID
        const numberMatch = qrCodeContent.match(/(\d+)/);
        if (numberMatch) {
          eventId = parseInt(numberMatch[1]);
        }
      }
    }
    
    // 如果无法提取活动ID，返回错误
    if (eventId <= 0) {
      console.error('[错误] 无法解析活动ID');
      throw new Error('二维码格式错误，无法提取活动ID');
    }
    
    console.log('Checking in to event:', { eventId, qrCode: qrCodeContent });
    
    // 检查活动是否已批准
    const event = await web3Service.getEvent(eventId);
    console.log('Event status:', event.status);
    
    if (Number(event.status) !== 1) {
      throw new Error('活动尚未获得批准，无法签到');
    }
    
    console.log('发送给合约的原始二维码内容:', qrCodeContent);
    
    // 调用签到方法，直接传递原始的QR码内容
    // 智能合约会对此字符串计算keccak256哈希，然后和存储的哈希值比较
    await web3Service.checkIn(eventId, qrCodeContent);
    
    // 获取活动信息以显示
    eventName.value = event.name;
    
    // 标记签到成功
    scanSuccess.value = true;
    
    // 触发更新
    emit('check-in-success');
  } catch (err: any) {
    console.error('签到失败:', err);
    
    // 将错误信息存储为字符串便于分析
    const errorMsg = err.message || '';
    const errorReason = err.reason || '';
    const fullErrorText = errorMsg + ' ' + errorReason;
    console.log('错误详情:', fullErrorText);
    
    // 解析合约错误，提供更友好的错误消息
    if (fullErrorText.includes('Event has not started')) {
      error.value = '活动尚未开始，请在活动开始时间后再来签到';
      ElMessage.warning('当前扫描的活动还未开始！');
    } else if (fullErrorText.includes('Event is not approved')) {
      error.value = '该活动尚未获得批准，请等待管理员审核';
    } else if (fullErrorText.includes('already checked in')) {
      error.value = '您已经签到过该活动，无需重复签到';
      ElMessage.info('已经完成签到，您可以在NFT页面查看您的活动证书');
    } else if (fullErrorText.includes('Invalid QR code')) {
      // 显示原始错误信息以便调试
      error.value = `[调试模式] 原始错误: ${fullErrorText}`;
    } else if (fullErrorText.includes('Event has ended')) {
      error.value = '活动已结束，无法签到';
      ElMessage.warning('很抱歉，该活动已经结束！');
    } else if (fullErrorText.includes('Event is full')) {
      error.value = '活动名额已满，无法签到';
      ElMessage.warning('很抱歉，活动名额已经达到上限！');
    } else {
      // 其他一般性错误的友好提示
      error.value = '签到失败，请稍后重试或联系活动组织者';
      console.error('原始错误信息:', fullErrorText);
    }
  } finally {
    loading.value = false;
  }
};

// 处理手动输入的二维码内容
const processManualInput = async () => {
  if (!manualQrContent.value) {
    ElMessage.warning('请输入二维码内容');
    return;
  }
  
  console.log('手动测试模式 - 处理输入内容:', manualQrContent.value);
  // 直接调用现有的二维码结果处理函数
  await processQRCodeResult(manualQrContent.value);
  
  // 清空输入框
  manualQrContent.value = '';
};

// 检查浏览器是否支持相机 API
const checkCameraSupport = () => {
  if (!navigator.mediaDevices || !('getUserMedia' in navigator.mediaDevices)) {
    console.error('浏览器不支持相机 API');
    return false;
  }
  return true;
};

// 开始扫描
const startScan = async () => {
  try {
    console.log('Starting camera scan...');
    
    // 检查浏览器是否支持相机 API
    if (!checkCameraSupport()) {
      ElMessage.error('您的浏览器不支持摄像头API');
      return;
    }
    
    // 直接设置为激活状态，显示UI
    scanActive.value = true;
    
    // 明确告知用户正在请求相机权限
    ElMessage.info('正在请求摄像头权限以进行扫描，请允许访问...');
    
    // 现在只尝试获取一次摄像头权限，优先使用后置摄像头
    console.log('Requesting camera permission (preferring rear camera)...');
    
    // 定义摄像头选项，优先尝试后置摄像头
    const constraints = {
      video: {
        facingMode: { ideal: 'environment' }, // 优先使用后置摄像头，但如果不可用也可以接受前置
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };
    
    // 获取媒体流
    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('Camera access granted, stream obtained');
    
    // 保存流引用并连接到视频元素
    stream.value = mediaStream;
    if (video.value) {
      video.value.srcObject = mediaStream;
      console.log('Video element connected to stream');
      
      // 添加视频加载事件监听器
      video.value.onloadedmetadata = () => {
        console.log('Video metadata loaded, playing video');
        video.value?.play();
        
        // 开始扫描二维码
        scanFrame();
      };
    } else {
      console.error('Video element reference not found');
    }
    
    // 设置为活动状态
    error.value = '';
    
  } catch (err: any) {
    console.error('启动相机失败:', err);
    if (err.name === 'NotAllowedError') {
      ElMessage.error('请允许访问相机权限以启用扫描功能');
    } else if (err.name === 'NotFoundError') {
      ElMessage.error('未检测到相机设备');
    } else if (err.name === 'NotSupportedError') {
      ElMessage.error('您的设备或浏览器不支持相机API');
    } else if (err.name === 'NotReadableError') {
      ElMessage.error('相机可能正被其他应用使用');
    } else {
      ElMessage.error('相机初始化失败: ' + err.message);
    }
  }
};

// 停止扫描
const stopScan = () => {
  scanActive.value = false;
  
  // 停止媒体流中的所有轨道
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop());
    stream.value = null;
  }
  
  // 清除视频源
  if (video.value) {
    video.value.srcObject = null;
  }
};

// 关闭结果对话框
const closeResult = () => {
  resultDialogVisible.value = false;
  if (!scanSuccess.value) {
    // 如果失败，允许重新扫描
    startScan();
  }
};

onMounted(() => {
  console.log('SimpleQRScanner component mounted');
  // 预先检查相机支持
  cameraAvailable.value = checkCameraSupport();
});

onBeforeUnmount(() => {
  console.log('SimpleQRScanner component will unmount');
  // 确保在组件卸载前停止扫描
  stopScan();
});

onUnmounted(() => {
  console.log('SimpleQRScanner component unmounted');
});
</script>

<style scoped lang="scss">
.qr-scanner {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  font-family: var(--apple-font-family);
  padding: 20px;
  box-sizing: border-box;
  
  @media (max-width: 768px) {
    max-width: 100%;
    padding: 15px 10px;
  }
}

.scanner-control {
  text-align: center;
  margin-bottom: 32px;
  background-color: var(--apple-card-bg);
  border-radius: var(--apple-radius-md);
  padding: 24px;
  box-shadow: var(--apple-shadow-sm);
  border: 1px solid var(--apple-border);
  
  @media (max-width: 768px) {
    padding: 16px;
    margin-bottom: 20px;
  }
  
  @media (max-width: 480px) {
    padding: 12px;
  }
}

.scanner-tip {
  margin-top: 16px;
  color: var(--apple-text-secondary);
  font-size: 14px;
}

.manual-input-test {
  margin-top: 24px;
  padding: 20px;
  border-radius: var(--apple-radius-md);
  background: #f8f8fc;
  border: 1px solid var(--apple-border);
  
  h4 {
    font-weight: 600;
    color: var(--apple-text-primary);
    margin-bottom: 16px;
    font-size: 15px;
  }
  
  .manual-input {
    margin-bottom: 16px;
  }
}

.scanner-container {
  position: relative;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  
  @media (max-width: 768px) {
    max-width: 100%;
  }
}

.video-container {
  position: relative;
  border-radius: var(--apple-radius-md);
  overflow: hidden;
  box-shadow: var(--apple-shadow-md);
  border: 1px solid var(--apple-border);
  background-color: #000;
  
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
  padding: 24px 0;
}

.scanner-frame {
  width: 250px;
  height: 250px;
  border: 2px solid var(--apple-primary);
  border-radius: var(--apple-radius-md);
  position: relative;
  box-shadow: 0 0 0 5000px rgba(0, 0, 0, 0.6);
  
  @media (max-width: 480px) {
    width: 200px;
    height: 200px;
  }
}

.scanner-frame:before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 3px;
  background-color: var(--apple-primary);
  animation: scanning 1.5s cubic-bezier(0.25, 0.1, 0.25, 1) infinite;
}

.scanner-actions {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: var(--apple-radius-sm);
  padding: 10px 16px;
  display: flex;
  gap: 12px;
  z-index: 100;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

@keyframes scanning {
  0% {
    top: 0;
  }
  50% {
    top: calc(100% - 3px);
  }
  100% {
    top: 0;
  }
}

.dialog-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 0;
  
  .el-icon {
    font-size: 36px;
    margin-bottom: 16px;
    color: var(--apple-primary);
  }
}

.dialog-content {
  text-align: center;
  padding: 24px 0;
  background-color: var(--apple-card-bg);
  border-radius: var(--apple-radius-md);
  margin: 0 auto;
  max-width: 400px;
  box-shadow: var(--apple-shadow-sm);
  
  .scan-error, .scan-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
    
    .el-icon {
      font-size: 56px;
      margin-bottom: 20px;
    }
    
    p {
      margin: 8px 0;
      line-height: 1.5;
      max-width: 320px;
    }
  }
  
  .scan-error {
    color: var(--apple-danger);
  }
  
  .scan-success {
    color: var(--apple-success);
    
    .event-name {
      font-weight: 600;
      margin: 16px 0;
      font-size: 18px;
      color: var(--apple-text-primary);
    }
  }
}
}
</style>
