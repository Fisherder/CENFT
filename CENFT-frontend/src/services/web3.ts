import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, NETWORK_CONFIG } from '../config/contract';

interface ContractEvent {
  id: bigint;
  name: string;
  description: string;
  organizer: string;
  startTime: bigint;
  endTime: bigint;
  maxParticipants: bigint;
  currentParticipants: bigint;
  status: number;
  qrCodeHash: string;
}

export class Web3Service {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private contract: ethers.Contract | null = null;
  private static readonly WALLET_CONNECTED_KEY = 'wallet_connected';

  async connect() {
    if (typeof window.ethereum === 'undefined') {
      throw new Error('请安装 MetaMask 钱包');
    }

    try {
      // 请求切换到 Sepolia 网络
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: NETWORK_CONFIG.chainId }],
      });
    } catch (switchError: any) {
      // 如果网络不存在，则添加网络
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: NETWORK_CONFIG.chainId,
              chainName: NETWORK_CONFIG.chainName,
              nativeCurrency: NETWORK_CONFIG.nativeCurrency,
              rpcUrls: NETWORK_CONFIG.rpcUrls,
              blockExplorerUrls: NETWORK_CONFIG.blockExplorerUrls
            }],
          });
        } catch (addError) {
          throw new Error('添加 Sepolia 网络失败');
        }
      } else {
        throw new Error('切换网络失败');
      }
    }

    this.provider = new ethers.BrowserProvider(window.ethereum);
    this.signer = await this.provider.getSigner();
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.signer);
    
    // 保存连接状态
    localStorage.setItem(Web3Service.WALLET_CONNECTED_KEY, 'true');
    
    return await this.signer.getAddress();
  }

  async autoConnect(): Promise<string | null> {
    if (typeof window.ethereum === 'undefined') {
      return null;
    }

    const isConnected = localStorage.getItem(Web3Service.WALLET_CONNECTED_KEY) === 'true';
    if (!isConnected) {
      return null;
    }

    try {
      // 检查是否已经连接
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length === 0) {
        return null;
      }

      // 尝试重新连接
      return await this.connect();
    } catch (error) {
      console.error('Auto connect failed:', error);
      localStorage.removeItem(Web3Service.WALLET_CONNECTED_KEY);
      return null;
    }
  }

  async disconnect() {
    this.provider = null;
    this.signer = null;
    this.contract = null;
    localStorage.removeItem(Web3Service.WALLET_CONNECTED_KEY);
  }

  async getCurrentAddress(): Promise<string> {
    if (!this.signer) {
      throw new Error('请先连接钱包');
    }
    return await this.signer.getAddress();
  }

  async isAdmin(address: string): Promise<boolean> {
    if (!this.contract) throw new Error('请先连接钱包');
    return await this.contract.admins(address);
  }

  async createEvent(name: string, description: string, startTime: number, endTime: number, maxParticipants: number) {
    if (!this.contract) throw new Error('请先连接钱包');
    const tx = await this.contract.createEvent(name, description, startTime, endTime, maxParticipants);
    const receipt = await tx.wait();
    console.log('Event creation receipt:', receipt);
    return receipt;
  }

  async approveEvent(eventId: number) {
    if (!this.contract) throw new Error('请先连接钱包');
    const tx = await this.contract.approveEvent(eventId);
    return await tx.wait();
  }

  async rejectEvent(eventId: number) {
    if (!this.contract) throw new Error('请先连接钱包');
    const tx = await this.contract.rejectEvent(eventId);
    return await tx.wait();
  }

  async getEvent(eventId: number): Promise<ContractEvent> {
    if (!this.contract) {
      throw new Error('请先连接钱包');
    }
    
    console.log('Fetching event:', eventId);
    const result = await this.contract.getFunction('getEvent')(BigInt(eventId));
    console.log('Raw event data:', result);
    
    return {
      id: result.id,
      name: result.name,
      description: result.description,
      organizer: result.organizer,
      startTime: result.startTime,
      endTime: result.endTime,
      maxParticipants: result.maxParticipants,
      currentParticipants: result.currentParticipants,
      status: result.status,
      qrCodeHash: result.qrCodeHash
    };
  }

  async getEventCount() {
    if (!this.contract) throw new Error('请先连接钱包');
    try {
      const count = await this.contract.getEventCount();
      console.log('Total event count:', count.toString());
      return count;
    } catch (error: any) {
      console.error('Error getting event count:', error);
      throw error;
    }
  }

  async checkIn(eventId: number, qrCode: string) {
    if (!this.contract) throw new Error('请先连接钱包');
    const tx = await this.contract.checkIn(eventId, qrCode);
    return await tx.wait();
  }

  async connectWallet() {
    try {
      if (!window.ethereum) {
        throw new Error('请安装 MetaMask 钱包');
      }

      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length === 0) {
        throw new Error('未获取到钱包地址');
      }

      return accounts[0];
    } catch (error: any) {
      console.error('连接钱包失败:', error);
      throw new Error(error.message || '连接钱包失败');
    }
  }

  async disconnectWallet() {
    // 清除本地存储的钱包信息
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('walletAddress');
  }

  // 获取用户拥有的NFT
  async getUserNFTs() {
    console.log('%c[NFT] 开始获取用户NFT...', 'color: #2196f3; font-weight: bold;');
    
    if (!this.contract || !this.signer) {
      throw new Error('请先连接钱包');
    }
    
    try {
      // 获取用户地址
      const address = await this.signer.getAddress();
      console.log(`%c[NFT] 当前用户地址: ${address}`, 'color: #2196f3; font-weight: bold;');
      
      // 存储结果的数组
      const nfts = [];
      
      // 方法1: 使用balanceOf获取用户拥有的NFT数量
      try {
        const balance = await this.contract.balanceOf(address);
        console.log(`%c[NFT] 用户拥有 ${balance.toString()} 个NFT`, 'color: #2196f3; font-weight: bold;');
        
        // 如果余额为0，直接返回空数组
        if (balance.toString() === '0') {
          console.log('%c[NFT] 用户没有拥有任何NFT', 'color: #2196f3; font-weight: bold;');
          return [];
        }
        
        // 尝试使用CheckedIn事件查询
        const tokenIdsFromEvents = new Set<string>();
        try {
          console.log('%c[NFT] 尝试使用CheckedIn事件获取NFT', 'color: #2196f3; font-weight: bold;');
          const checkInEvents = await this.contract.queryFilter(this.contract.filters.CheckedIn(null, address, null));
          console.log(`%c[NFT] 找到 ${checkInEvents.length} 个CheckedIn事件`, 'color: #2196f3; font-weight: bold;');
          
          for (const event of checkInEvents) {
            try {
              const typedEvent = event as unknown as { args: any };
              if (typedEvent.args && typedEvent.args[2]) {
                const tokenId = typedEvent.args[2].toString();
                tokenIdsFromEvents.add(tokenId);
                console.log(`%c[NFT] 从CheckedIn事件中找到tokenId: ${tokenId}`, 'color: #2196f3; font-weight: bold;');
              }
            } catch (err) {
              // 忽略单个事件解析错误
            }
          }
        } catch (err) {
          console.log('%c[NFT] 查询CheckedIn事件失败', 'color: #2196f3; font-weight: bold;', err);
        }
        
        // 如果从事件中找到了tokenId
        if (tokenIdsFromEvents.size > 0) {
          console.log(`%c[NFT] 从事件中找到 ${tokenIdsFromEvents.size} 个可能的tokenId`, 'color: #2196f3; font-weight: bold;');
          
          // 验证并获取元数据
          const tokenIdsArray = Array.from(tokenIdsFromEvents);
          for (const tokenId of tokenIdsArray) {
            try {
              // 验证是否真的属于该用户
              const ownerOf = await this.contract.ownerOf(tokenId);
              if (ownerOf.toLowerCase() === address.toLowerCase()) {
                console.log(`%c[NFT] 确认tokenId ${tokenId} 属于用户 ${address}`, 'color: #2196f3; font-weight: bold;');
                
                try {
                  const tokenURI = await this.contract.tokenURI(tokenId);
                  const metadata = this.parseTokenURI(tokenURI);
                  nfts.push({
                    tokenId: tokenId.toString(),
                    ...metadata
                  });
                  console.log(`%c[NFT] 成功添加NFT #${tokenId} 到列表`, 'color: #2196f3; font-weight: bold;');
                } catch (metadataErr) {
                  console.log(`%c[NFT] 获取NFT #${tokenId} 元数据失败`, 'color: #2196f3; font-weight: bold;', metadataErr);
                  nfts.push({
                    tokenId: tokenId.toString(),
                    name: `NFT #${tokenId}`,
                    description: '无法获取元数据',
                    attributes: []
                  });
                }
              } else {
                console.log(`%c[NFT] TokenId ${tokenId} 不属于用户 ${address}，实际所有者: ${ownerOf}`, 'color: #2196f3; font-weight: bold;');
              }
            } catch (err) {
              console.log(`%c[NFT] 验证tokenId ${tokenId} 所有权失败`, 'color: #2196f3; font-weight: bold;', err);
            }
          }
        }
        
        // 如果通过事件没有找到，或找到的数量小于balance，尝试直接遍历tokenId
        if (nfts.length < Number(balance)) {
          console.log('%c[NFT] 从事件中未找到足够的NFT，尝试扫描可能的tokenId范围', 'color: #2196f3; font-weight: bold;');
          
          // 获取活动数量，估算最大可能的tokenId
          let maxTokenId = 100; // 默认值
          try {
            const eventCount = await this.getEventCount();
            // 通常tokenId会从1开始，最大不会超过总事件数的若干倍
            maxTokenId = Math.max(100, Number(eventCount) * 3); // 给一个宽松的估计
            console.log(`%c[NFT] 估算最大可能的tokenId为 ${maxTokenId}`, 'color: #2196f3; font-weight: bold;');
          } catch (err) {
            console.log('%c[NFT] 获取活动数量失败，使用默认最大值100', 'color: #2196f3; font-weight: bold;');
          }
          
          // 批量处理，避免过多的请求
          const remainingToFind = Number(balance) - nfts.length;
          console.log(`%c[NFT] 尝试查找剩余的 ${remainingToFind} 个NFT`, 'color: #2196f3; font-weight: bold;');
          
          // 创建一个已知的tokenId集合，避免重复检查
          const knownTokenIds = new Set(nfts.map(nft => nft.tokenId));
          
          // 从较小的tokenId开始检查，因为通常较早的tokenId更可能存在
          let found = 0;
          for (let i = 1; i <= maxTokenId && found < remainingToFind; i++) {
            // 跳过已知的tokenId
            if (knownTokenIds.has(i.toString())) {
              continue;
            }
            
            try {
              const ownerOf = await this.contract.ownerOf(i);
              if (ownerOf.toLowerCase() === address.toLowerCase()) {
                found++;
                console.log(`%c[NFT] 发现用户拥有的tokenId: ${i}`, 'color: #2196f3; font-weight: bold;');
                
                try {
                  const tokenURI = await this.contract.tokenURI(i);
                  const metadata = this.parseTokenURI(tokenURI);
                  nfts.push({
                    tokenId: i.toString(),
                    ...metadata
                  });
                  console.log(`%c[NFT] 成功添加NFT #${i} 到列表`, 'color: #2196f3; font-weight: bold;');
                } catch (metadataErr) {
                  console.log(`%c[NFT] 获取NFT #${i} 元数据失败`, 'color: #2196f3; font-weight: bold;', metadataErr);
                  nfts.push({
                    tokenId: i.toString(),
                    name: `NFT #${i}`,
                    description: '无法获取元数据',
                    attributes: []
                  });
                }
                
                // 如果找到了所有NFT，直接跳出循环
                if (found >= remainingToFind) {
                  console.log('%c[NFT] 已找到所有NFT，停止扫描', 'color: #2196f3; font-weight: bold;');
                  break;
                }
              }
            } catch (err) {
              // tokenId不存在或其他错误，继续检查下一个
              // 为了减少日志输出，这里不记录每个失败的tokenId
              if (i % 50 === 0) {
                console.log(`%c[NFT] 已扫描到tokenId ${i}`, 'color: #2196f3; font-weight: bold;');
              }
            }
          }
          
          if (found < remainingToFind) {
            console.log(`%c[NFT] 扫描结束，但仍有 ${remainingToFind - found} 个NFT未找到`, 'color: #2196f3; font-weight: bold;');
          }
        }
      } catch (err) {
        console.log('%c[NFT] 获取用户NFT数量失败', 'color: #2196f3; font-weight: bold;', err);
      }
      
      // 根据tokenId排序结果
      nfts.sort((a, b) => {
        const idA = parseInt(a.tokenId);
        const idB = parseInt(b.tokenId);
        return idA - idB;
      });
      
      console.log(`%c[NFT] 扫描完成，共找到 ${nfts.length} 个NFT`, 'color: #2196f3; font-weight: bold;');
      
      // 在返回前显示结果
      if (nfts.length > 0) {
        console.log('%c[NFT] 找到的NFT列表', 'color: #2196f3; font-weight: bold;', nfts);
      } else {
        console.log('%c[NFT] 没有找到任何NFT', 'color: #2196f3; font-weight: bold;');
      }
      
      return nfts;
    } catch (error) {
      console.error('%c[NFT] 获取用户NFT失败', 'color: #2196f3; font-weight: bold;', error);
      throw error;
    }
  }
  
  // 解析data URI格式的元数据
  private parseTokenURI(tokenURI: string) {
    try {
      console.log('准备解析tokenURI:', tokenURI.substring(0, 50) + '...');
      
      // 检测是否是data URI（base64编码的JSON）
      if (tokenURI.startsWith('data:application/json;base64,')) {
        // 提取base64部分
        const base64 = tokenURI.split('data:application/json;base64,')[1];
        console.log('提取到base64:', base64.substring(0, 20) + '...');
        
        // 解码base64字符串，正确处理UTF-8编码
        let jsonString;
        try {
          // 使用现代浏览器API处理UTF-8字符
          if (typeof window !== 'undefined' && window.atob) {
            // 先使用atob解码base64为原始二进制数据
            const binaryString = window.atob(base64);
            // 创建Uint8Array依次存储每个字节
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            // 使用TextDecoder来正确解码UTF-8数据
            const decoder = new TextDecoder('utf-8');
            jsonString = decoder.decode(bytes);
            console.log('使用TextDecoder解码UTF-8数据');
          } else {
            // 如果不支持现代API，回退到基本方法
            jsonString = atob(base64);
            console.log('使用基本atob方法解码，汉字可能会乱码');
          }
        } catch (e) {
          console.error('Base64解码失败，尝试替代方法:', e);
          
          try {
            // 尝试使用基本的atob函数
            jsonString = atob(base64);
            console.log('回退到基本atob方法');
          } catch (e2) {
            console.error('无法解码base64:', e2);
            throw e2;
          }
        }
        
        console.log('解码后的JSON字符串:', jsonString.substring(0, 100) + '...');
        
        // 解析JSON
        try {
          const parsed = JSON.parse(jsonString);
          console.log('成功解析JSON:', parsed);
          return parsed;
        } catch (jsonError) {
          console.error('JSON解析失败，可能是编码问题:', jsonError);
          
          // 尝试修复可能的编码问题
          try {
            // 尝试将序列化字符串转换为Unicode编码的字符串
            const cleanedString = jsonString.replace(/[\x00-\x1F\x7F-\x9F]/g, ''); // 移除不可打印字符
            const parsed = JSON.parse(cleanedString);
            console.log('清理标记后成功解析JSON');
            return parsed;
          } catch (e) {
            // 如果还是失败，返回一个手动构造的对象
            console.error('第二次解析失败，尝试提取关键内容');
            
            // 尝试提取名称和描述等关键字段
            const nameMatch = jsonString.match(/"name"\s*:\s*"([^"]+)"/);
            const descMatch = jsonString.match(/"description"\s*:\s*"([^"]+)"/);
            
            return {
              name: nameMatch ? nameMatch[1] : 'Unknown NFT',
              description: descMatch ? descMatch[1] : '无法解析描述',
              attributes: [
                { trait_type: 'TokenId', value: tokenURI.includes('tokenId=') ? tokenURI.split('tokenId=')[1] : 'Unknown' },
                { trait_type: 'Data Source', value: 'Extracted from metadata' }
              ]
            };
          }
        }
      } else if (tokenURI.startsWith('http')) {
        // 如果是HTTP URL，我们需要在客户端抽取数据
        console.log('检测到HTTP URL，但当前无法处理');
        return {
          name: 'External NFT',
          description: '内容需要从外部URL获取',
          attributes: [{ trait_type: 'URL', value: tokenURI }]
        };
      } else {
        // 尝试直接解析为JSON
        console.log('尝试直接解析JSON');
        return JSON.parse(tokenURI);
      }
    } catch (error) {
      // 如果出错，返回默认元数据
      console.error('解析NFT元数据失败:', error);
      return {
        name: 'Unknown NFT',
        description: '无法解析元数据',
        attributes: [
          { trait_type: 'Error', value: '解析失败' },
          { trait_type: 'Raw URI', value: tokenURI.substring(0, 30) + '...' }
        ]
      };
    }
  }
}

export const web3Service = new Web3Service();