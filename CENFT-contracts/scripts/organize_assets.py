import os
import shutil
from PIL import Image

def create_directories():
    """创建必要的目录结构"""
    directories = [
        'pixel_assets/backgrounds',
        'pixel_assets/characters',
        'pixel_assets/expressions',
        'pixel_assets/equipment',
        'pixel_assets/hats',
        'pixel_assets/accessories',
        'pixel_assets/badges',
        'pixel_assets/frames'
    ]
    for directory in directories:
        os.makedirs(directory, exist_ok=True)

def process_image(input_path, output_path, size=(32, 32)):
    """处理单个图片"""
    try:
        with Image.open(input_path) as img:
            # 转换为RGBA模式
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # 调整大小，使用最近邻插值以保持像素风格
            img = img.resize(size, Image.NEAREST)
            
            # 保存处理后的图片
            img.save(output_path, 'PNG')
            print(f"Successfully processed: {output_path}")
    except Exception as e:
        print(f"Error processing {input_path}: {str(e)}")

def organize_assets():
    """组织素材到对应目录"""
    base_path = 'pixel_assets/Ninja Adventure - Asset Pack'
    
    # 处理背景
    bg_path = os.path.join(base_path, 'Backgrounds')
    if os.path.exists(bg_path):
        for root, dirs, files in os.walk(bg_path):
            for file in files:
                if file.endswith(('.png', '.jpg')):
                    input_path = os.path.join(root, file)
                    output_path = os.path.join('pixel_assets/backgrounds', f'bg_{file}')
                    process_image(input_path, output_path)
    
    # 处理角色
    char_path = os.path.join(base_path, 'Actor/Characters')
    if os.path.exists(char_path):
        for root, dirs, files in os.walk(char_path):
            for file in files:
                if file.endswith(('.png', '.jpg')):
                    input_path = os.path.join(root, file)
                    output_path = os.path.join('pixel_assets/characters', f'char_{file}')
                    process_image(input_path, output_path)
    
    # 处理装备
    items_path = os.path.join(base_path, 'Items')
    if os.path.exists(items_path):
        for root, dirs, files in os.walk(items_path):
            for file in files:
                if file.endswith(('.png', '.jpg')):
                    input_path = os.path.join(root, file)
                    # 根据文件名判断类型
                    if 'hat' in file.lower() or 'helmet' in file.lower():
                        output_path = os.path.join('pixel_assets/hats', f'hat_{file}')
                    elif 'weapon' in file.lower() or 'sword' in file.lower():
                        output_path = os.path.join('pixel_assets/accessories', f'acc_{file}')
                    else:
                        output_path = os.path.join('pixel_assets/equipment', f'equip_{file}')
                    process_image(input_path, output_path)
    
    # 处理UI元素作为徽章和边框
    ui_path = os.path.join(base_path, 'Ui')
    if os.path.exists(ui_path):
        for root, dirs, files in os.walk(ui_path):
            for file in files:
                if file.endswith(('.png', '.jpg')):
                    input_path = os.path.join(root, file)
                    if 'badge' in file.lower() or 'icon' in file.lower():
                        output_path = os.path.join('pixel_assets/badges', f'badge_{file}')
                    elif 'frame' in file.lower() or 'border' in file.lower():
                        output_path = os.path.join('pixel_assets/frames', f'frame_{file}')
                    process_image(input_path, output_path)

def main():
    print("开始组织素材...")
    create_directories()
    organize_assets()
    print("素材组织完成！")

if __name__ == '__main__':
    main() 