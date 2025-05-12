<template>
  <div class="check-in-page">
    <div v-if="loading" class="loading-container">
      <el-spinner />
      <p>正在处理签到...</p>
    </div>
    <div v-else-if="error" class="error-container">
      <el-result
        icon="error"
        :title="error"
        sub-title="请确保您已连接钱包并拥有正确的权限"
      >
        <template #extra>
          <el-button type="primary" @click="retryCheckIn">重试</el-button>
        </template>
      </el-result>
    </div>
    <div v-else-if="success" class="success-container">
      <el-result
        icon="success"
        title="签到成功"
        :sub-title="`您已成功获得 ${eventName} 的 NFT`"
      >
        <template #extra>
          <el-button type="primary" @click="viewNFT">查看我的 NFT</el-button>
        </template>
      </el-result>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { web3Service } from '../services/web3';
import { ElMessage } from 'element-plus';

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref('');
const success = ref(false);
const eventName = ref('');

const checkIn = async () => {
  try {
    const eventId = Number(route.params.eventId);
    const qrCodeHash = route.params.qrCodeHash as string;

    if (!eventId || !qrCodeHash) {
      throw new Error('无效的签到链接');
    }

    // 获取活动信息
    const event = await web3Service.getEvent(eventId);
    eventName.value = event.name;

    // 验证二维码哈希
    if (event.qrCodeHash !== qrCodeHash) {
      throw new Error('无效的签到二维码');
    }

    // 执行签到
    await web3Service.checkIn(eventId, qrCodeHash);
    success.value = true;
  } catch (err: any) {
    console.error('Check-in error:', err);
    error.value = err.message || '签到失败';
  } finally {
    loading.value = false;
  }
};

const retryCheckIn = () => {
  loading.value = true;
  error.value = '';
  checkIn();
};

const viewNFT = () => {
  router.push('/user');
};

onMounted(() => {
  checkIn();
});
</script>

<style scoped lang="scss">
.check-in-page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f7fa;
  padding: 20px;

  .loading-container,
  .error-container,
  .success-container {
    background: white;
    padding: 40px;
    border-radius: 8px;
    box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
    text-align: center;
  }

  .loading-container {
    p {
      margin-top: 20px;
      color: #606266;
    }
  }
}
</style> 