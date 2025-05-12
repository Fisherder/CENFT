<template>
  <div class="app">
    <el-container>
      <el-header>
        <div class="header-content">
          <h1>CENFT - 校园活动 NFT 平台</h1>
          <wallet-connect 
            :is-connected="isConnected"
            :current-address="currentAddress"
            @connect="connectWallet"
            @disconnect="disconnectWallet"
          />
        </div>
      </el-header>
      
      <el-main>
        <admin-panel v-if="isAdmin" />
        <user-panel v-else />
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { web3Service } from './services/web3';
import { ElMessage } from 'element-plus';
import WalletConnect from './components/WalletConnect.vue';
import AdminPanel from './components/AdminPanel.vue';
import UserPanel from './components/UserPanel.vue';

const isConnected = ref(false);
const currentAddress = ref('');
const isAdmin = ref(false);

const connectWallet = async () => {
  try {
    const address = await web3Service.connect();
    currentAddress.value = address;
    isConnected.value = true;
    isAdmin.value = await web3Service.isAdmin(address);
  } catch (error: any) {
    ElMessage.error(error.message || '连接钱包失败');
  }
};

const disconnectWallet = async () => {
  await web3Service.disconnect();
  isConnected.value = false;
  currentAddress.value = '';
  isAdmin.value = false;
};

onMounted(async () => {
  try {
    const address = await web3Service.autoConnect();
    if (address) {
      currentAddress.value = address;
      isConnected.value = true;
      isAdmin.value = await web3Service.isAdmin(address);
    }
  } catch (error) {
    console.error('Auto connect failed:', error);
  }
});
</script>

<style scoped lang="scss">
.app {
  min-height: 100vh;
  background-color: #f5f7fa;
  width: 100%;
  box-sizing: border-box;
}

.el-header {
  background-color: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 0 20px;
  width: 100%;
  box-sizing: border-box;
}

.header-content {
  height: 60px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  width: 100%;

  h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #409eff;
    white-space: normal;
    word-break: break-word;
  }
  
  @media (max-width: 768px) {
    h1 {
      font-size: 1.2rem;
      max-width: 60%;
    }
  }
  
  @media (max-width: 480px) {
    height: auto;
    padding: 10px 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    
    h1 {
      font-size: 1.1rem;
      max-width: 100%;
    }
  }
}

.el-main {
  padding: 20px;
}
</style>
