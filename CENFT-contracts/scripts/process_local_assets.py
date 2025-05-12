import os
import shutil
from PIL import Image

def create_directories():
    """创建必要的目录结构"""
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

def process_sprite_sheet(input_path, output_dir, sprite_size=(16, 16), output_size=(32, 32)):
    """处理精灵图，将其分割成单独的图片"""
    try:
        with Image.open(input_path) as img:
            width, height = img.size
            for y in range(0, height, sprite_size[1]):
                for x in range(0, width, sprite_size[0]):
                    # 裁剪单个精灵
                    sprite = img.crop((x, y, x + sprite_size[0], y + sprite_size[1]))
                    
                    # 生成输出文件名
                    output_name = f"sprite_{x//sprite_size[0]}_{y//sprite_size[1]}.png"
                    output_path = os.path.join(output_dir, output_name)
                    
                    # 调整大小并保存
                    sprite = sprite.resize(output_size, Image.NEAREST)
                    sprite.save(output_path, 'PNG')
                    print(f"Extracted sprite: {output_path}")
    except Exception as e:
        print(f"Error processing sprite sheet {input_path}: {str(e)}")

def main():
    # 创建目录
    create_directories()
    
    # 定义素材路径
    asset_paths = {
        'bg': 'pixel_assets/backgrounds/*.png',
        'char': 'pixel_assets/characters/*.png',
        'exp': 'pixel_assets/expressions/*.png',
        'clothes': 'pixel_assets/equipment/*.png',
        'hats': 'pixel_assets/hats/*.png',
        'acc': 'pixel_assets/accessories/*.png',
        'badges': 'pixel_assets/badges/*.png',
        'frames': 'pixel_assets/frames/*.png'
    }
    
    # 处理每个类别的素材
    for category, path_pattern in asset_paths.items():
        import glob
        input_files = glob.glob(path_pattern)
        output_dir = f'src/assets/images/nft/{category}'
        
        print(f"\n处理 {category} 类别的素材...")
        for input_file in input_files:
            filename = os.path.basename(input_file)
            output_path = os.path.join(output_dir, f'pixel_{filename}')
            
            # 检查是否是精灵图
            img = Image.open(input_file)
            if img.size[0] > 32 or img.size[1] > 32:
                process_sprite_sheet(input_file, output_dir)
            else:
                process_image(input_file, output_path)

if __name__ == '__main__':
    main() 