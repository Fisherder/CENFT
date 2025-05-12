<template>
  <div class="wallet-connect">
    <el-dropdown v-if="isConnected" trigger="click">
      <div class="wallet-address">
        {{ formatAddress(currentAddress) }}
        <el-icon class="el-icon--right"><arrow-down /></el-icon>
      </div>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item @click="disconnect">断开连接</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    <el-button v-else type="primary" @click="connectWallet">
      连接钱包
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { web3Service } from '../services/web3';
import { ElMessage } from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';

const props = defineProps<{
  isConnected: boolean;
  currentAddress: string;
}>();

const emit = defineEmits(['connect', 'disconnect']);

const isMobile = ref(false);

const checkMobile = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  isMobile.value = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  
  // 如果在移动设备上，检查控制台输出以便调试
  if (isMobile.value) {
    console.log('移动设备检测：', {
      userAgent,
      isMetaMask: window.ethereum?.isMetaMask,
      hasEthereum: !!window.ethereum
    });
  }
};

const connectWallet = async () => {
  try {
    // 检测是否在MetaMask内置浏览器中
    const isMetaMaskInAppBrowser = window.ethereum?.isMetaMask &&
      (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || isMobile.value);
    
    // 检测是否为移动设备但不在MetaMask浏览器中
    if (isMobile.value && !isMetaMaskInAppBrowser && !window.ethereum) {
      // 移动端使用 MetaMask 移动端应用
      const metamaskUrl = 'metamask://wc?uri=';
      const dappUrl = window.location.href;
      window.location.href = metamaskUrl + encodeURIComponent(dappUrl);
    } else {
      // 在MetaMask内置浏览器中或桌面端使用常规连接方式
      if (window.ethereum) {
        // 直接使用App.vue中使用的connect方法而不是connectWallet
        await web3Service.connect();
        emit('connect');
      } else {
        throw new Error('未检测到MetaMask，请安装或打开MetaMask');
      }
    }
  } catch (error: any) {
    console.error('连接钱包失败:', error);
    ElMessage.error(error.message || '连接钱包失败');
  }
};

const disconnect = () => {
  web3Service.disconnectWallet();
  emit('disconnect');
};

const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

onMounted(() => {
  checkMobile();
});
</script>

<style scoped lang="scss">
.wallet-connect {
  .wallet-address {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    background-color: #f5f7fa;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    color: #606266;

    &:hover {
      background-color: #e4e7ed;
    }
  }
}
</style> 