<template>
  <div class="admin-panel">
    <el-tabs v-model="activeTab" @tab-click="handleTabClick" class="fullwidth-tabs">
      <el-tab-pane label="活动列表" name="list">
        <div v-show="activeTab === 'list'">
          <el-table :data="events" style="width: 100%" v-loading="loading">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column prop="name" label="活动名称" />
            <el-table-column prop="description" label="描述" />
            <el-table-column prop="organizer" label="组织者" />
            <el-table-column label="状态">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)">
                  {{ getStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="280">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 0"
                  type="success"
                  size="small"
                  @click="approveEvent(row.id)"
                >
                  通过
                </el-button>
                <el-button
                  v-if="row.status === 0"
                  type="danger"
                  size="small"
                  @click="rejectEvent(row.id)"
                >
                  拒绝
                </el-button>
                <el-button
                  v-if="row.status === 1"
                  type="primary"
                  size="small"
                  @click="showQRCode(row)"
                >
                  签到二维码
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane label="创建活动" name="create">
        <div v-show="activeTab === 'create'" class="create-form-container">
          <el-form :model="eventForm" label-width="120px" class="event-form">
            <el-form-item label="活动名称">
              <el-input v-model="eventForm.name" />
            </el-form-item>
            <el-form-item label="活动描述">
              <el-input type="textarea" v-model="eventForm.description" :rows="4" />
            </el-form-item>
            <el-form-item label="开始时间">
              <el-date-picker
                v-model="eventForm.startTime"
                type="datetime"
                placeholder="选择开始时间"
                :disabled-date="disabledDate"
                format="YYYY年MM月DD日 HH:mm"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
                :editable="false"
                :clearable="true"
              />
            </el-form-item>
            <el-form-item label="结束时间">
              <el-date-picker
                v-model="eventForm.endTime"
                type="datetime"
                placeholder="选择结束时间" 
                :disabled-date="disabledDate"
                format="YYYY年MM月DD日 HH:mm"
                value-format="YYYY-MM-DD HH:mm:ss"
                style="width: 100%"
                :editable="false"
                :clearable="true"
              />
            </el-form-item>
            <el-form-item label="最大参与人数">
              <el-input-number v-model="eventForm.maxParticipants" :min="1" style="width: 100%" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="createEvent">创建活动</el-button>
            </el-form-item>
          </el-form>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 签到二维码对话框 -->
    <el-dialog
      v-model="qrCodeDialogVisible"
      title="活动签到二维码"
      width="400px"
      center
    >
      <div class="qr-code-container">
        <div v-if="selectedEvent" class="event-info">
          <h3>{{ qrCodeInfo.title }}</h3>
          <p>活动时间: {{ qrCodeInfo.time }}</p>
          <p>当前状态: <el-tag :type="getStatusType(selectedEvent.status)">{{ qrCodeInfo.status }}</el-tag></p>
          <p>人数统计: {{ qrCodeInfo.currentCount }} / {{ qrCodeInfo.maxCount }}</p>
          <div class="event-description">
            <p>活动描述: {{ selectedEvent.description }}</p>
          </div>
        </div>
        <div class="qr-code-wrapper">
          <qrcode-vue
            v-if="selectedEvent"
            :value="qrCodeValue"
            :size="200"
            level="H"
            render-as="svg"
          />
        </div>
        <div class="qr-code-tip">
          <p><el-tag type="warning">仅供活动参与者扫描</el-tag></p>
          <p>请使用手机扫描二维码进行签到</p>
          <p class="small">扫描后将自动铸造活动 NFT</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { web3Service } from '../services/web3';
import { ElMessage } from 'element-plus';
import dayjs from 'dayjs';
import QrcodeVue from 'qrcode.vue';

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

const events = ref<Event[]>([]);
const eventForm = ref({
  name: '',
  description: '',
  startTime: undefined as Date | undefined,
  endTime: undefined as Date | undefined,
  maxParticipants: 100
});



// 禁用过去的日期
const disabledDate = (time: Date) => {
  return time.getTime() < Date.now() - 8.64e7; // 禁用昨天及以前的日期
};

// 不再需要时间范围监听，因为现在直接操作表单属性

const loading = ref(false);
const activeTab = ref('list');

const qrCodeDialogVisible = ref(false);
const selectedEvent = ref<Event | null>(null);

// 生成二维码内容
// 关键：必须使用与合约中完全相同的字符串格式
const qrCodeValue = computed(() => {
  if (!selectedEvent.value) return '';
  
  // 必须与智能合约中的格式完全一致
  // 根据合约代码，合约将地址转换为数字，这是关键点：
  // Strings.toString(uint256(uint160(event_.organizer)))
  
  // 将地址转换为数字字符串，模拟合约中的操作
  const addressWithoutPrefix = selectedEvent.value.organizer.slice(2); // 去除'0x'前缀
  const bigIntValue = BigInt('0x' + addressWithoutPrefix); // 将十六进制转换为BigInt
  const decimalString = bigIntValue.toString(); // 转换为十进制字符串
  
  // 生成与合约中完全相同的格式
  return `event_${selectedEvent.value.id}_${decimalString}`;
});

// 显示二维码相关信息
const qrCodeInfo = computed(() => {
  if (!selectedEvent.value) return { title: '', tip: '' };
  
  return {
    title: `活动名称: ${selectedEvent.value.name}`,
    time: dayjs(selectedEvent.value.startTime).format('YYYY年MM月DD日 HH:mm') + 
          ' ~ ' + 
          dayjs(selectedEvent.value.endTime).format('YYYY年MM月DD日 HH:mm'),
    status: getStatusText(selectedEvent.value.status),
    maxCount: `最大人数: ${selectedEvent.value.maxParticipants}`,
    currentCount: `当前已签到: ${selectedEvent.value.currentParticipants}`
  };
});

const getStatusType = (status: number): 'success' | 'warning' | 'info' | 'primary' | 'danger' => {
  const types: ('success' | 'warning' | 'info' | 'primary' | 'danger')[] = ['info', 'success', 'danger', 'warning'];
  return types[status] || 'info';
};

const getStatusText = (status: number) => {
  const texts = ['待审核', '已通过', '已拒绝', '已结束'];
  return texts[status] || '未知';
};

const loadEvents = async () => {
  if (loading.value) return;
  
  loading.value = true;
  try {
    const count = await web3Service.getEventCount();
    console.log('Total events:', count.toString());
    const eventList = [];
    
    for (let i = 1; i <= Number(count); i++) {
      try {
        const event = await web3Service.getEvent(i);
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
      } catch (error) {
        console.error(`Error loading event ${i}:`, error);
        continue;
      }
    }
    
    events.value = eventList;
  } catch (error) {
    console.error('Error loading events:', error);
    ElMessage.error('加载活动列表失败');
  } finally {
    loading.value = false;
  }
};

const handleTabClick = (tab: any) => {
  if (tab.props.name === 'list') {
    loadEvents();
  } else if (tab.props.name === 'create') {
    // 重置基本信息
    eventForm.value = {
      name: '',
      description: '',
      startTime: undefined,
      endTime: undefined,
      maxParticipants: 100
    };
    
    // 设置默认时间范围（从当前时间开始，持续一周）
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);
    
    // 设置合理的默认时间：当天上午8点到一周后下午6点
    const start = new Date(now);
    start.setHours(8, 0, 0, 0);
    
    const end = new Date(nextWeek);
    end.setHours(18, 0, 0, 0);
    
    // 直接更新表单的时间字段
    eventForm.value.startTime = start;
    eventForm.value.endTime = end;
  }
};

const createEvent = async () => {
  try {
    const { name, description, startTime, endTime, maxParticipants } = eventForm.value;
    if (!name || !description || !startTime || !endTime) {
      ElMessage.warning('请填写完整信息');
      return;
    }

    await web3Service.createEvent(
      name,
      description,
      dayjs(startTime).unix(),
      dayjs(endTime).unix(),
      maxParticipants
    );

    ElMessage.success('活动创建成功');
    activeTab.value = 'list';
    loadEvents();
  } catch (error: any) {
    console.error('Error creating event:', error);
    ElMessage.error(error.message || '创建活动失败');
  }
};

const approveEvent = async (eventId: number) => {
  try {
    const currentAddress = await web3Service.getCurrentAddress();
    const isAdmin = await web3Service.isAdmin(currentAddress);
    
    if (!isAdmin) {
      ElMessage.error('您没有管理员权限');
      return;
    }

    await web3Service.approveEvent(eventId);
    ElMessage.success('活动已通过');
    loadEvents();
  } catch (error: any) {
    console.error('Error approving event:', error);
    ElMessage.error(error.message || '操作失败');
  }
};

const rejectEvent = async (eventId: number) => {
  try {
    const currentAddress = await web3Service.getCurrentAddress();
    const isAdmin = await web3Service.isAdmin(currentAddress);
    
    if (!isAdmin) {
      ElMessage.error('您没有管理员权限');
      return;
    }

    await web3Service.rejectEvent(eventId);
    ElMessage.success('活动已拒绝');
    loadEvents();
  } catch (error: any) {
    console.error('Error rejecting event:', error);
    ElMessage.error(error.message || '操作失败');
  }
};

const showQRCode = (event: Event) => {
  selectedEvent.value = event;
  qrCodeDialogVisible.value = true;
};

onMounted(() => {
  loadEvents();
});

onUnmounted(() => {
  events.value = [];
});
</script>

<style scoped>
.admin-panel {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 32px;
  background-color: var(--apple-bg);
  font-family: var(--apple-font-family);
}

.create-form-container {
  width: 100%;
  display: block;
}

.event-form {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  background-color: var(--apple-card-bg);
  border-radius: var(--apple-radius-md);
  padding: 24px;
  box-shadow: var(--apple-shadow-sm);
  border: 1px solid var(--apple-border);
}

.fullwidth-tabs {
  width: 100%;
  
  :deep(.el-tabs__content) {
    width: 100%;
  }
  
  :deep(.el-tab-pane) {
    width: 100%;
  }
}

.qr-code-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: var(--apple-card-bg);
  border-radius: var(--apple-radius-md);
  padding: 32px;
  box-shadow: var(--apple-shadow-sm);
  border: 1px solid var(--apple-border);
  max-width: 400px;
  margin: 0 auto;
}

.qr-code-wrapper {
  margin: 24px 0;
  background-color: white;
  padding: 16px;
  border-radius: var(--apple-radius-md);
  box-shadow: var(--apple-shadow-sm);
  border: 1px solid var(--apple-border);
}

.event-info {
  text-align: center;
  margin-bottom: 24px;
  width: 100%;
}

.event-info h3 {
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--apple-text-primary);
}

.event-info p {
  margin: 8px 0;
  color: var(--apple-text-secondary);
}

.event-description {
  margin-top: 16px;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  padding: 12px;
  background-color: #f8f8fc;
  border-radius: var(--apple-radius-sm);
  font-style: italic;
  color: var(--apple-text-tertiary);
}

.qr-code-tip {
  text-align: center;
  margin-top: 24px;
  font-size: 14px;
  background-color: #f8f8fc;
  padding: 16px;
  border-radius: var(--apple-radius-md);
  padding-top: 10px;
  width: 100%;
}

.qr-code-tip .small {
  font-size: 0.9em;
  color: #666;
}
</style>