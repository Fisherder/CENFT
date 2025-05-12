<template>
  <div class="user-panel">
    <!-- 钱包编辑状态提示 -->
    <div v-if="!walletConnected" class="wallet-alert">
      <el-alert title="请先连接钱包" type="warning" :closable="false">
        <template #default>
          <p>请先连接钱包以查看活动和参与NFT签到</p>
          <el-button size="small" type="primary" @click="connectWallet">连接钱包</el-button>
        </template>
      </el-alert>
    </div>
    
    <!-- 错误信息显示 -->
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="true" @close="error = ''" style="margin-bottom: 15px;"/>
    
    <el-tabs v-model="activeTab" class="fullwidth-tabs">
      <el-tab-pane label="活动签到" name="scan">
        <div class="scan-tab">
          <h3>扫描签到码参加活动</h3>
          <p class="scan-description">扫描管理员提供的二维码，参加活动并获取活动NFT</p>
          <SimpleQRScanner @check-in-success="handleCheckInSuccess" />
        </div>
      </el-tab-pane>
      
      <el-tab-pane label="我的 NFT" name="nft">
        <!-- 添加调试信息 -->
        <div class="debug-info">
          <div class="status-info">
            <div class="status-item">
              <span class="status-label">钱包状态:</span>
              <el-tag size="small" :type="walletConnected ? 'success' : 'danger'">
                {{ walletConnected ? '已连接' : '未连接' }}
              </el-tag>
            </div>
            <div class="status-item">
              <span class="status-label">加载状态:</span>
              <el-tag size="small" :type="loading ? 'warning' : 'info'">
                {{ loading ? '加载中...' : '已完成' }}
              </el-tag>
            </div>
            <div class="status-item">
              <span class="status-label">NFT数量:</span>
              <el-tag size="small" type="primary">{{ nfts ? nfts.length : 0 }}</el-tag>
            </div>
          </div>
          <el-button size="small" type="primary" @click="forceRefreshNFTs" :loading="loading" icon="Refresh">
            刷新NFT列表
          </el-button>
        </div>
        
        <!-- 显示加载状态 -->
        <el-skeleton :loading="loading" animated>
          <template #template>
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
              <div v-for="i in 3" :key="i" style="width: 30%; margin-bottom: 20px;">
                <el-skeleton-item variant="image" style="width: 100%; height: 200px;" />
                <el-skeleton-item variant="p" style="width: 60%" />
                <el-skeleton-item variant="text" style="width: 100%" />
              </div>
            </div>
          </template>
          
          <template #default>
            <!-- 无NFT时显示的内容 -->
            <el-empty v-if="!loading && (!nfts || nfts.length === 0)" description="您还没有NFT证书">
              <template #description>
                <p>您还没有任何NFT证书，请先参加活动并签到。</p>
              </template>
              <el-button type="primary" @click="activeTab = 'scan'">去签到</el-button>
            </el-empty>
        
            <!-- NFT网格展示 -->
            <div v-else class="nft-grid">
              <el-card v-for="nft in nfts" :key="nft.tokenId" class="nft-card" shadow="hover">
                <template #header>
                  <div class="nft-header">
                    <span>{{ nft.name || '未命名NFT' }}</span>
                    <el-tag size="small" type="success">#{{ nft.tokenId }}</el-tag>
                  </div>
                </template>
                <div class="nft-content">
                  <p class="nft-description">{{ nft.description || '没有描述' }}</p>
                  <div class="nft-attributes">
                    <div v-for="(attr, index) in (nft.attributes || [])" :key="index" class="attribute">
                      <span class="label">{{ formatAttributeName(attr.trait_type) }}:</span>
                      <span class="value">{{ formatAttributeValue(attr.trait_type, attr.value) }}</span>
                    </div>
                  </div>
                </div>
              </el-card>
            </div>
          </template>
        </el-skeleton>
      </el-tab-pane>

      <el-tab-pane label="活动列表" name="events">
        <el-table :data="events" style="width: 100%" v-loading="loading">
          <el-table-column prop="id" label="ID" width="80" />
          <el-table-column prop="name" label="活动名称" />
          <el-table-column prop="description" label="描述" />
          <el-table-column label="状态">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row)">
                {{ getStatusText(row) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200">
            <template #default="{ row }">
              <!-- 已签到活动显示“已签到”按钮，并禁用 -->
              <el-button
                v-if="hasCheckedIn(row.id)"
                type="success"
                size="small"
                disabled
              >
                已签到
              </el-button>
              
              <!-- 未签到活动显示“签到”按钮，点击跳转到扫码界面 -->
              <el-button
                v-else
                type="primary"
                size="small"
                @click="redirectToScan()"
              >
                签到
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>

    <!-- 已移除签到对话框，改为直接跳转到扫码页面 -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { web3Service } from '../services/web3';
import { ElMessage } from 'element-plus';
import SimpleQRScanner from './SimpleQRScanner.vue';

interface NFT {
  tokenId: string;
  name: string;
  description: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

interface Event {
  id: number;
  name: string;
  description: string;
  organizer: string;
  startTime: Date;
  endTime: Date;
  maxParticipants: number;
  currentParticipants: number;
  status: number;
  qrCodeHash: string;
}

const activeTab = ref('scan'); // 默认显示扫码签到页面
const events = ref<Event[]>([]);
const nfts = ref<NFT[]>([]);
const loading = ref(false);
const walletConnected = ref(false); // 添加钱包连接状态跟踪
const error = ref(''); // 添加错误信息标记

// 格式化属性名称
const formatAttributeName = (name: string): string => {
  // 将属性名称映射为中文
  const nameMap: Record<string, string> = {
    'Event ID': '活动ID',
    'Event Name': '活动名称',
    'startTime': '开始时间',
    'endTime': '结束时间',
    'Organizer': '组织者',
    'CheckIn Time': '签到时间',
    'Participant': '参与者'
  };
  
  return nameMap[name] || name;
};

// 格式化属性值
const formatAttributeValue = (type: string, value: string | number): string => {
  // 检测是否是时间相关的属性名称
  const timeRelatedFields = [
    'startTime', 'endTime', 'CheckIn Time', 'timestamp', 'time',
    '开始时间', '结束时间', '签到时间', '时间', '日期'
  ];
  
  // 先转换类型为小写以进行大小写不敏感的比对
  const normalizedType = type.toLowerCase();
  const isTimeField = timeRelatedFields.some(field => normalizedType.includes(field.toLowerCase()));
  
  // 处理时间类型的属性，或者数字很大的属性（可能是时间戳）
  if (isTimeField || (
      // 自动检测是否可能是时间戳（超过10位数字）
      (typeof value === 'number' || !isNaN(Number(value)))
      && String(value).length >= 10 
      && String(value).match(/^[0-9]+$/)
    )) {
    try {
      const timestamp = Number(value);
      if (timestamp > 1000000000) { // 确保是一个有效的时间戳
        // 判断是秒还是毫秒
        // 13位的数字表示毫秒，10位的数字表示秒
        const date = timestamp > 9999999999 ? new Date(timestamp) : new Date(timestamp * 1000);
        
        // 检查日期是否有效
        if (!isNaN(date.getTime())) {
          console.log(`转换时间戳 ${value} 为可读日期: ${date.toLocaleString('zh-CN')}`);
          return date.toLocaleString('zh-CN', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          });
        }
      }
    } catch (e) {
      console.error('格式化时间失败:', e, value);
    }
  }
  
  // 如果不是时间属性或转换失败，直接返回原值
  return value?.toString() || '';
};

const getStatusType = (event: Event): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  // 判断活动状态：未开始、进行中、已结束
  const now = Date.now(); // 当前时间戳（毫秒）
  const startTime = new Date(event.startTime).getTime(); // 转换为毫秒时间戳
  const endTime = new Date(event.endTime).getTime(); // 转换为毫秒时间戳
  
  if (now < startTime) {
    return 'info'; // 未开始
  } else if (now > endTime) {
    return 'danger'; // 已结束
  } else {
    return 'success'; // 进行中
  }
};

const getStatusText = (event: Event): string => {
  // 判断活动状态：未开始、进行中、已结束
  const now = Date.now(); // 当前时间戳（毫秒）
  const startTime = new Date(event.startTime).getTime(); // 转换为毫秒时间戳
  const endTime = new Date(event.endTime).getTime(); // 转换为毫秒时间戳
  
  if (now < startTime) {
    return '未开始'; // 未开始
  } else if (now > endTime) {
    return '已结束'; // 已结束
  } else {
    return '进行中'; // 进行中
  }
};

const hasCheckedIn = (eventId: number) => {
  // 这里简单通过查看用户是否有这个活动的NFT来检测是否已签到
  // 在真实实现中，可能需要调用智能合约或后端API来验证
  return nfts.value.some(nft => {
    const eventIdAttr = nft.attributes.find(attr => attr.trait_type === 'Event ID');
    return eventIdAttr && eventIdAttr.value === eventId;
  });
};

// 连接钱包方法
const connectWallet = async () => {
  try {
    loading.value = true;
    error.value = '';
    
    await web3Service.connect();
    walletConnected.value = true;
    ElMessage.success('钱包连接成功');
    
    // 连接成功后加载数据
    loadEvents();
    loadNFTs();
  } catch (err: any) {
    console.error('钱包连接失败:', err);
    error.value = err.message || '钱包连接失败';
    walletConnected.value = false;
  } finally {
    loading.value = false;
  }
};

// 判断钱包是否已经连接
// 确保移子搜现有和全新加载不影响已有数据的交互
const checkWalletConnection = async () => {
  try {
    // 尝试自动连接钱包
    const address = await web3Service.autoConnect();
    walletConnected.value = !!address;
    return !!address;
  } catch (err) {
    console.error('检查钱包连接失败:', err);
    walletConnected.value = false;
    return false;
  }
};

// 优化的活动列表加载逻辑
const loadEvents = async () => {
  if (loading.value) return;
  
  // 先检查钱包连接
  if (!walletConnected.value && !await checkWalletConnection()) {
    error.value = '请先连接钱包再试一次';
    return;
  }
  
  loading.value = true;
  error.value = ''; // 清除之前的错误
  
  try {
    // 使用管理员面板的简单递进式加载逻辑
    const count = await web3Service.getEventCount();
    console.log('Total events:', count.toString());
    const eventList = [];
    
    // 简单递进式加载
    for (let i = 1; i <= Number(count); i++) {
      try {
        const event = await web3Service.getEvent(i);
        // 只将已通过审核的活动显示给普通用户
        if (Number(event.status) === 1) {
          eventList.push({
            id: Number(event.id),
            name: event.name,
            description: event.description,
            organizer: event.organizer,
            startTime: new Date(Number(event.startTime) * 1000),
            endTime: new Date(Number(event.endTime) * 1000),
            maxParticipants: Number(event.maxParticipants),
            currentParticipants: Number(event.currentParticipants),
            status: Number(event.status),
            qrCodeHash: event.qrCodeHash
          });
        }
      } catch (err) {
        // 在异常情况下，忽略单个活动的加载失败，继续处理下一个
        console.error(`Error loading event ${i}:`, err);
        continue;
      }
    }
    
    // 更新活动列表
    events.value = eventList;
    console.log('活动加载成功，总数:', eventList.length);
  } catch (err: any) {
    console.error('Error loading events:', err);
    error.value = err.message || '加载活动列表失败';
  } finally {
    loading.value = false;
  }
};

const loadNFTs = async () => {
  if (loading.value) return;
  
  // 先检查钱包连接
  if (!walletConnected.value && !await checkWalletConnection()) {
    error.value = '请先连接钱包再试一次';
    return;
  }
  
  try {
    loading.value = true;
    error.value = ''; // 清除之前的错误
    
    // 使用web3Service获取用户的NFT
    const userNFTs = await web3Service.getUserNFTs();
    console.log('获取到用户NFT:', userNFTs);
    
    if (userNFTs && userNFTs.length > 0) {
      // 更新显示的NFT列表
      nfts.value = userNFTs;
      // 自动切换到NFT标签页（如果用户有NFT且是签到后首次加载）
      if (activeTab.value === 'scan' && sessionStorage.getItem('justCheckedIn') === 'true') {
        activeTab.value = 'nft';
        sessionStorage.removeItem('justCheckedIn'); // 清除标记
        ElMessage.success('签到成功，请查看您的活动NFT证书！');
      }
    } else {
      nfts.value = [];
      console.log('用户没有NFT或NFT列表为空');
    }
  } catch (err: any) {
    console.error('加载 NFT 失败:', err);
    nfts.value = [];
    error.value = err.message || '加载 NFT 列表失败';
  } finally {
    loading.value = false;
  }
};

// 直接使用扫码签到，不再需要对话框

const redirectToScan = () => {
  activeTab.value = 'scan';
};

// 已移除对话框签到功能，改为直接扫码签到

// 处理签到成功事件
const handleCheckInSuccess = () => {
  // 在日志中记录成功信息
  console.log('签到成功！正在重新加载数据...');
  
  // 设置会话标记，用于下次加载时自动切换到NFT标签页
  sessionStorage.setItem('justCheckedIn', 'true');
  
  // 刷新事件和NFT列表
  loadEvents();
  loadNFTs();
};

// 手动刷新NFT列表
const forceRefreshNFTs = async () => {
  console.log('手动刷新NFT列表...');
  try {
    // 先检查钱包连接
    if (!walletConnected.value) {
      await connectWallet();
      if (!walletConnected.value) {
        ElMessage.warning('无法连接钱包，请手动连接后重试');
        return;
      }
    }
    
    // 清除当前NFT列表
    nfts.value = [];
    
    // 刷新数据
    await loadNFTs();
    
    // 显示完成消息
    if (nfts.value.length > 0) {
      ElMessage.success(`已加载 ${nfts.value.length} 个NFT`);
    } else {
      ElMessage.info('没有找到任何NFT');
    }
  } catch (err: any) {
    console.error('刷新NFT列表失败:', err);
    ElMessage.error('刷新NFT列表失败: ' + (err.message || ''));
  }
};

onMounted(async () => {
  // 先尝试自动连接钱包，然后加载数据
  try {
    const isConnected = await checkWalletConnection();
    
    if (isConnected) {
      // 如果钱包已连接，则加载数据
      console.log('钱包已连接，开始加载数据...');
      // 做项并加载，加快界面响应速度
      await Promise.all([
        loadEvents(),
        loadNFTs()
      ]);
    } else {
      // 如果钱包未连接，只显示连接提示，不主动加载数据
      console.log('钱包未连接，请用户手动连接');
      error.value = ''; // 清除可能的错误信息
    }
  } catch (err: any) {
    console.error('初始化错误:', err);
    error.value = '应用初始化错误，请刷新页面并重试';
  }
});

// 创建定时刷新间隔变量
let refreshInterval: number | null = null;

// 启动定时刷新
const startAutoRefresh = () => {
  // 先清除之前可能存在的定时器
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  // 设置新的定时刷新
  refreshInterval = window.setInterval(() => {
    if (walletConnected.value) {
      loadEvents();
      loadNFTs();
    }
  }, 60000); // 每60秒刷新一次
};

// 组件挂载后启动定时刷新
onMounted(() => {
  startAutoRefresh();
});

// 组件卸载时清除定时器
onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
});
</script>

<style scoped lang="scss">
.user-panel {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 32px;
  background-color: var(--apple-bg);
  font-family: var(--apple-font-family);
  
  @media (max-width: 768px) {
    padding: 16px;
  }
  
  @media (max-width: 480px) {
    padding: 10px;
  }
}

.scan-tab {
  text-align: center;
  padding: 20px;
  
  @media (max-width: 768px) {
    padding: 15px 10px;
  }
  
  h3 {
    @media (max-width: 480px) {
      font-size: 1.1rem;
    }
  }
}

.scan-description {
  margin-bottom: 20px;
  color: #666;
}

.nft-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 20px;
  
  @media (max-width: 992px) {
    grid-template-columns: repeat(2, 1fr);
  }
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.nft-card {
  border: 1px solid var(--apple-border);
  border-radius: var(--apple-radius-md);
  transition: var(--apple-transition);
  overflow-wrap: break-word;
  word-wrap: break-word;
  word-break: break-word;
  
  &:hover {
    transform: translateY(-5px);
    box-shadow: var(--apple-shadow-md);
  }
  
  @media (max-width: 768px) {
    margin-bottom: 15px;
  }
}

.nft-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  padding: 16px;
  border-bottom: 1px solid var(--apple-border);
  background-color: #f9f9fb;
  flex-wrap: wrap;
  word-break: break-word;
  color: var(--apple-text-primary);
  
  @media (max-width: 480px) {
    padding: 12px;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}

.nft-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  font-size: 14px;
  word-break: break-word;
  overflow-wrap: break-word;
  
  @media (max-width: 768px) {
    padding: 12px;
  }
  
  @media (max-width: 480px) {
    padding: 10px;
  }
}

.nft-description {
  margin-bottom: 16px;
  color: var(--apple-text-secondary);
  line-height: 1.5;
  overflow-wrap: break-word;
  word-wrap: break-word;
}

.nft-attributes {
  width: 100%;
}

.attribute {
  margin: 6px 0;
  padding: 10px;
  border-radius: 6px;
  background-color: #f5f7fa;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  
  @media (max-width: 768px) {
    padding: 8px;
    flex-direction: column;
    align-items: flex-start;
  }
}

.label {
  font-weight: bold;
  color: #606266;
  margin-right: 8px;
  
  @media (max-width: 768px) {
    margin-bottom: 4px;
  }
}

.value {
  color: #409eff;
  word-break: break-word;
  text-align: right;
  
  @media (max-width: 768px) {
    text-align: left;
    width: 100%;
  }
}

.fullwidth-tabs {
  width: 100%;
  box-sizing: border-box;
  
  :deep(.el-tabs__content) {
    width: 100%;
    word-break: break-word;
  }
  
  :deep(.el-tab-pane) {
    width: 100%;
  }
  
  :deep(.el-tabs__header) {
    @media (max-width: 480px) {
      margin-bottom: 12px;
    }
  }
  
  :deep(.el-tabs__nav) {
    @media (max-width: 480px) {
      width: 100%;
      display: flex;
    }
  }
  
  :deep(.el-tabs__item) {
    @media (max-width: 480px) {
      flex: 1;
      text-align: center;
      font-size: 14px;
      padding: 0 10px;
    }
  }
}

.debug-info {
  background-color: #f8f8fc;
  padding: 16px 20px;
  border-radius: var(--apple-radius-md);
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  box-shadow: var(--apple-shadow-sm);
  width: 100%;
  border: 1px solid var(--apple-border);
  box-sizing: border-box;
  word-break: break-word;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px;
  }
  
  @media (max-width: 480px) {
    padding: 12px;
    gap: 12px;
  }
  
  .status-info {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    width: 100%;
    
    @media (max-width: 768px) {
      gap: 12px;
    }
    
    @media (max-width: 480px) {
      gap: 8px;
    }
    
    .status-item {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
      width: auto;
      
      @media (max-width: 768px) {
        width: 100%;
        justify-content: space-between;
      }
      
      .status-label {
        margin-right: 8px;
        font-weight: 500;
        color: var(--apple-text-secondary);
        white-space: nowrap;
      }
    }
  }
  
  .status-item {
    display: flex;
    align-items: center;
    gap: 8px;
    
    @media (max-width: 768px) {
      width: 100%;
      justify-content: space-between;
    }
  }
  
  .status-label {
    font-size: 14px;
    color: #606266;
    white-space: nowrap;
  }
  
  .el-button {
    margin-left: auto;
    
    @media (max-width: 768px) {
      margin-left: 0;
      width: 100%;
    }
  }
}
</style>