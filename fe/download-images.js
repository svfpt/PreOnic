const https = require('https');
const fs = require('fs');
const path = require('path');

// Tạo folder nếu chưa có
const imageDir = path.join(__dirname, 'public', 'images', 'products');
if (!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir, { recursive: true });
}

// Danh sách ảnh cần download với URLs từ Unsplash (free & high quality)
const images = [
  {
    name: 'thanh-long.jpg',
    url: 'https://images.unsplash.com/photo-1601493700631-2b16ec4b4716?w=800&h=600&fit=crop&q=80'
  },
  {
    name: 'ca-phe.jpg',
    url: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800&h=600&fit=crop&q=80'
  },
  {
    name: 'gao-st25.jpg',
    url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&h=600&fit=crop&q=80'
  },
  {
    name: 'ot-chuong.jpg',
    url: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=800&h=600&fit=crop&q=80'
  },
  {
    name: 'xoai-cat.jpg',
    url: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&h=600&fit=crop&q=80'
  },
  {
    name: 'hat-tieu.jpg',
    url: 'https://picsum.photos/800/600?random=6'
  }
];

// Function download ảnh
function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const filepath = path.join(imageDir, filename);
    
    console.log(`📥 Đang tải ${filename}...`);
    
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // Follow redirect
        return downloadImage(response.headers.location, filename)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${filename}: Status ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(filepath);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`✅ Đã tải xong ${filename}`);
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Download tất cả ảnh
async function downloadAll() {
  console.log('🚀 Bắt đầu tải ảnh sản phẩm...\n');
  
  let success = 0;
  let failed = 0;

  for (const image of images) {
    try {
      await downloadImage(image.url, image.name);
      success++;
    } catch (error) {
      console.error(`❌ Lỗi khi tải ${image.name}:`, error.message);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✨ Hoàn thành!`);
  console.log(`✅ Thành công: ${success}/${images.length}`);
  if (failed > 0) {
    console.log(`❌ Thất bại: ${failed}/${images.length}`);
  }
  console.log('='.repeat(50));
  console.log(`\n📁 Ảnh được lưu tại: ${imageDir}`);
}

// Chạy
downloadAll().catch(console.error);
