import os
import requests
from PIL import Image
import io

# 创建目录
def create_directories():
    directories = [
        'src/assets/images/nft/bg',
        'src/assets/images/nft/char',
        'src/assets/images/nft/exp',
        'src/assets/images/nft/clothes',
        'src/assets/images/nft/hats',
        'src/assets/images/nft/acc',
        'src/assets/images/nft/badges',
        'src/assets/images/nft/frames'
    ]
    for directory in directories:
        os.makedirs(directory, exist_ok=True)

# 下载并处理图片
def download_and_process_image(url, output_path, size=(32, 32)):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            # 打开图片
            img = Image.open(io.BytesIO(response.content))
            
            # 转换为RGBA模式（确保支持透明度）
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # 调整大小
            img = img.resize(size, Image.NEAREST)
            
            # 保存图片
            img.save(output_path, 'PNG')
            print(f"Successfully downloaded and processed: {output_path}")
        else:
            print(f"Failed to download: {url} (Status: {response.status_code})")
    except Exception as e:
        print(f"Error processing {url}: {str(e)}")

# 主函数
def main():
    create_directories()
    
    # 使用 Pixel Dungeon Asset Pack 的素材
    base_url = "https://img.itch.zone/aW1nLzIyMTcwNzUucG5n/original"
    
    # 背景图片
    backgrounds = {
        'pixel_forest.png': f'{base_url}/forest.png',
        'pixel_city.png': f'{base_url}/city.png',
        'pixel_castle.png': f'{base_url}/castle.png',
        'pixel_dungeon.png': f'{base_url}/dungeon.png',
        'pixel_cave.png': f'{base_url}/cave.png',
        'pixel_temple.png': f'{base_url}/temple.png'
    }
    
    # 角色图片
    characters = {
        'pixel_warrior.png': f'{base_url}/warrior.png',
        'pixel_mage.png': f'{base_url}/mage.png',
        'pixel_ninja.png': f'{base_url}/ninja.png',
        'pixel_knight.png': f'{base_url}/knight.png',
        'pixel_archer.png': f'{base_url}/archer.png',
        'pixel_rogue.png': f'{base_url}/rogue.png'
    }
    
    # 表情图片
    expressions = {
        'pixel_smile.png': f'{base_url}/smile.png',
        'pixel_surprise.png': f'{base_url}/surprise.png',
        'pixel_angry.png': f'{base_url}/angry.png',
        'pixel_thinking.png': f'{base_url}/thinking.png',
        'pixel_happy.png': f'{base_url}/happy.png',
        'pixel_cool.png': f'{base_url}/cool.png'
    }
    
    # 装备图片
    clothes = {
        'pixel_armor.png': f'{base_url}/armor.png',
        'pixel_robe.png': f'{base_url}/robe.png',
        'pixel_ninja_suit.png': f'{base_url}/ninja_suit.png',
        'pixel_leather.png': f'{base_url}/leather.png',
        'pixel_cloth.png': f'{base_url}/cloth.png',
        'pixel_chainmail.png': f'{base_url}/chainmail.png'
    }
    
    # 帽子
    hats = {
        'pixel_helmet.png': f'{base_url}/helmet.png',
        'pixel_wizard_hat.png': f'{base_url}/wizard_hat.png',
        'pixel_ninja_mask.png': f'{base_url}/ninja_mask.png',
        'pixel_crown.png': f'{base_url}/crown.png',
        'pixel_hood.png': f'{base_url}/hood.png',
        'pixel_cap.png': f'{base_url}/cap.png'
    }
    
    # 配件
    accessories = {
        'pixel_sword.png': f'{base_url}/sword.png',
        'pixel_staff.png': f'{base_url}/staff.png',
        'pixel_shield.png': f'{base_url}/shield.png',
        'pixel_bow.png': f'{base_url}/bow.png',
        'pixel_dagger.png': f'{base_url}/dagger.png',
        'pixel_wand.png': f'{base_url}/wand.png'
    }
    
    # 徽章
    badges = {
        'pixel_hero.png': f'{base_url}/hero_badge.png',
        'pixel_master.png': f'{base_url}/master_badge.png',
        'pixel_legend.png': f'{base_url}/legend_badge.png',
        'pixel_guardian.png': f'{base_url}/guardian_badge.png',
        'pixel_explorer.png': f'{base_url}/explorer_badge.png',
        'pixel_collector.png': f'{base_url}/collector_badge.png'
    }
    
    # 边框
    frames = {
        'pixel_gold.png': f'{base_url}/gold_frame.png',
        'pixel_silver.png': f'{base_url}/silver_frame.png',
        'pixel_bronze.png': f'{base_url}/bronze_frame.png',
        'pixel_magic.png': f'{base_url}/magic_frame.png',
        'pixel_crystal.png': f'{base_url}/crystal_frame.png',
        'pixel_minimal.png': f'{base_url}/minimal_frame.png'
    }
    
    # 下载所有图片
    categories = {
        'bg': backgrounds,
        'char': characters,
        'exp': expressions,
        'clothes': clothes,
        'hats': hats,
        'acc': accessories,
        'badges': badges,
        'frames': frames
    }
    
    for category, items in categories.items():
        print(f"\n开始下载 {category} 类别的素材...")
        for filename, url in items.items():
            output_path = os.path.join('src/assets/images/nft', category, filename)
            download_and_process_image(url, output_path)

if __name__ == '__main__':
    main() 