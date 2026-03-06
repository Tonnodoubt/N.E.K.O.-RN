# 图片识别反馈 - 后端实现方案

> 对应前端任务：图片识别反馈（任务3）
> 依赖：前端已完成图片上传功能

---

## 概述

后端需要实现图片接收和 AI 识别功能，支持通过 WebSocket 接收图片，调用 Vision API 进行识别，并将结果返回给前端。

---

## 1. WebSocket 消息协议

### 1.1 接收图片消息（前端 → 后端）

```json
{
  "action": "stream_data",
  "input_type": "image",
  "data": ["data:image/jpeg;base64,/9j/4AAQ..."],
  "clientMessageId": "msg-1234567890-1",
  "metadata": {
    "width": 1920,
    "height": 1080,
    "size": 450000,
    "format": "jpeg"
  }
}
```

### 1.2 返回识别进度（后端 → 前端）

```typescript
// 识别中
interface ImageRecognitionProgress {
  type: 'image_recognition';
  clientMessageId: string;
  status: 'processing';
  message: string;  // 例如："正在识别图片..."
}

// 识别完成
interface ImageRecognitionCompleted {
  type: 'image_recognition';
  clientMessageId: string;
  status: 'completed';
  result: {
    description: string;     // AI 对图片的整体描述
    objects: string[];       // 识别的物体列表
    text?: string;          // OCR 识别的文字（可选）
  };
}

// 识别失败
interface ImageRecognitionFailed {
  type: 'image_recognition';
  clientMessageId: string;
  status: 'failed';
  error: string;
}
```

### 1.3 AI 回复消息（后端 → 前端）

```json
{
  "type": "chat_message",
  "sender": "gemini",
  "text": "我看到这张照片里有猫咪和阳光，看起来很舒服呢！",
  "referenced_images": ["msg-1234567890-1"],
  "timestamp": "2026-03-02T10:30:00Z"
}
```

---

## 2. 后端架构设计

### 2.1 处理流程

```
WebSocket 接收图片消息
        ↓
  验证消息格式
        ↓
  解析 base64 图片
        ↓
  发送 "processing" 状态给前端
        ↓
  调用 Vision API
        ↓
  等待 AI 识别结果
        ↓
  发送 "completed" 状态给前端
        ↓
  构造 AI 回复消息
        ↓
  发送最终回复给前端
```

### 2.2 模块划分

```
backend/
├── websocket/
│   └── handlers/
│       └── image_handler.py      # 图片消息处理器
├── services/
│   ├── vision_service.py         # Vision API 服务
│   └── image_processor.py        # 图片处理服务
├── models/
│   └── image_message.py          # 图片消息模型
└── utils/
    └── image_utils.py            # 图片工具函数
```

---

## 3. 实现示例（Python FastAPI + WebSocket）

### 3.1 图片消息处理器

```python
# websocket/handlers/image_handler.py
from typing import List
import base64
from datetime import datetime

class ImageMessageHandler:
    def __init__(self, vision_service, websocket_manager):
        self.vision = vision_service
        self.ws_manager = websocket_manager

    async def handle(self, client_id: str, message: dict):
        """处理图片消息"""
        client_message_id = message.get('clientMessageId')
        images_base64 = message.get('data', [])

        try:
            # 1. 发送处理中状态
            await self.ws_manager.send_to_client(client_id, {
                'type': 'image_recognition',
                'clientMessageId': client_message_id,
                'status': 'processing',
                'message': '正在识别图片...'
            })

            # 2. 解析图片
            image_data_list = []
            for img_base64 in images_base64:
                # 移除 data:image/jpeg;base64, 前缀
                if ',' in img_base64:
                    img_base64 = img_base64.split(',')[1]
                image_bytes = base64.b64decode(img_base64)
                image_data_list.append(image_bytes)

            # 3. 调用 Vision API
            result = await self.vision.analyze_images(image_data_list)

            # 4. 发送完成状态
            await self.ws_manager.send_to_client(client_id, {
                'type': 'image_recognition',
                'clientMessageId': client_message_id,
                'status': 'completed',
                'result': {
                    'description': result['description'],
                    'objects': result['objects'],
                    'text': result.get('text')
                }
            })

            # 5. 发送 AI 回复
            await self.ws_manager.send_to_client(client_id, {
                'type': 'chat_message',
                'sender': 'gemini',
                'text': result['response'],
                'referenced_images': [client_message_id],
                'timestamp': datetime.utcnow().isoformat()
            })

        except Exception as e:
            # 发送错误状态
            await self.ws_manager.send_to_client(client_id, {
                'type': 'image_recognition',
                'clientMessageId': client_message_id,
                'status': 'failed',
                'error': str(e)
            })
```

### 3.2 Vision API 服务（OpenAI GPT-4 Vision 示例）

```python
# services/vision_service.py
import openai
from typing import List, Dict
import base64

class VisionService:
    def __init__(self, api_key: str):
        self.client = openai.OpenAI(api_key=api_key)

    async def analyze_images(self, image_bytes_list: List[bytes]) -> Dict:
        """分析图片内容"""

        # 构建 messages
        messages = [{
            "role": "user",
            "content": [
                {"type": "text", "text": "请描述这张图片的内容，并列出图片中的主要物体。"}
            ]
        }]

        # 添加图片
        for image_bytes in image_bytes_list:
            base64_image = base64.b64encode(image_bytes).decode('utf-8')
            messages[0]["content"].append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/jpeg;base64,{base64_image}"
                }
            })

        # 调用 GPT-4 Vision
        response = self.client.chat.completions.create(
            model="gpt-4o",  # 或 gpt-4-turbo
            messages=messages,
            max_tokens=1000
        )

        ai_response = response.choices[0].message.content

        # 解析结果（简化示例）
        return {
            'description': ai_response,
            'objects': self._extract_objects(ai_response),
            'response': ai_response,
            'text': None  # OCR 结果（如有需要可添加）
        }

    def _extract_objects(self, text: str) -> List[str]:
        """从描述中提取物体列表（简化实现）"""
        # 实际项目中可以使用 NLP 或更精确的方法
        common_objects = ['猫', '狗', '人', '桌子', '椅子', '手机', '电脑', '书', '杯子']
        found = []
        for obj in common_objects:
            if obj in text:
                found.append(obj)
        return found
```

### 3.3 Vision API 服务（Google Gemini 示例）

```python
# services/vision_service_gemini.py
import google.generativeai as genai
from typing import List, Dict

class GeminiVisionService:
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-pro-vision')

    async def analyze_images(self, image_bytes_list: List[bytes]) -> Dict:
        """使用 Gemini 分析图片"""

        from PIL import Image
        import io

        # 转换图片
        images = []
        for image_bytes in image_bytes_list:
            img = Image.open(io.BytesIO(image_bytes))
            images.append(img)

        # 构建提示
        prompt = "请描述这些图片的内容，并列出图片中的主要物体。"

        # 调用 Gemini
        response = self.model.generate_content([prompt] + images)

        ai_response = response.text

        return {
            'description': ai_response,
            'objects': self._extract_objects(ai_response),
            'response': ai_response,
            'text': None
        }

    def _extract_objects(self, text: str) -> List[str]:
        """从描述中提取物体列表"""
        common_objects = ['猫', '狗', '人', '桌子', '椅子', '手机', '电脑', '书', '杯子']
        found = []
        for obj in common_objects:
            if obj in text:
                found.append(obj)
        return found
```

### 3.4 WebSocket 路由集成

```python
# websocket/routes.py
from fastapi import WebSocket, WebSocketDisconnect

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_id = str(id(websocket))

    try:
        while True:
            data = await websocket.receive_json()
            action = data.get('action')
            input_type = data.get('input_type')

            if action == 'stream_data':
                if input_type == 'image':
                    # 处理图片消息
                    await image_handler.handle(client_id, data)
                elif input_type == 'text':
                    # 处理文本消息
                    await text_handler.handle(client_id, data)
                # ... 其他类型

    except WebSocketDisconnect:
        await manager.disconnect(client_id)
```

---

## 4. 配置说明

### 4.1 环境变量

```bash
# .env
# OpenAI
OPENAI_API_KEY=sk-xxx

# 或 Google Gemini
GOOGLE_API_KEY=xxx

# 或 Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-xxx

# 图片大小限制
MAX_IMAGE_SIZE=5MB
```

### 4.2 图片处理配置

```python
# config.py
IMAGE_CONFIG = {
    'max_size': 5 * 1024 * 1024,  # 5MB
    'allowed_formats': ['jpeg', 'jpg', 'png', 'webp'],
    'vision_timeout': 30,  # 秒
    'max_images_per_message': 5
}
```

---

## 5. 前端配合修改

当前前端已实现图片发送，需要添加识别状态处理：

```typescript
// 在 useChatMessages 或相关 hook 中处理识别状态
ws.onMessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'image_recognition') {
    switch (data.status) {
      case 'processing':
        // 显示"AI 正在识别..."
        showRecognitionStatus('processing');
        break;
      case 'completed':
        // 显示识别完成
        showRecognitionStatus('completed', data.result);
        break;
      case 'failed':
        // 显示错误
        showRecognitionStatus('failed', null, data.error);
        break;
    }
  }
};
```

---

## 6. 性能优化建议

### 6.1 异步处理

```python
# 使用 Celery 或 RQ 进行异步处理
from celery import Celery

celery_app = Celery('tasks', broker='redis://localhost:6379')

@celery_app.task
def process_image_async(client_id: str, message: dict):
    """异步处理图片"""
    # 处理逻辑...
    pass

# 在 handler 中调用
process_image_async.delay(client_id, message)
```

### 6.2 缓存机制

```python
# 缓存识别结果，避免重复识别相同图片
import hashlib
from functools import lru_cache

def get_image_hash(image_bytes: bytes) -> str:
    return hashlib.md5(image_bytes).hexdigest()

# 使用 Redis 缓存
async def get_cached_result(image_hash: str):
    return await redis.get(f"vision:{image_hash}")
```

### 6.3 图片预处理

```python
from PIL import Image
import io

def preprocess_image(image_bytes: bytes, max_size: int = 1024) -> bytes:
    """压缩图片以减少 API 调用成本"""
    img = Image.open(io.BytesIO(image_bytes))

    # 调整尺寸
    img.thumbnail((max_size, max_size))

    # 转换为 RGB（去除透明通道）
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    # 保存为 JPEG
    output = io.BytesIO()
    img.save(output, format='JPEG', quality=85)
    return output.getvalue()
```

---

## 7. 测试方案

### 7.1 单元测试

```python
# tests/test_vision_service.py
import pytest
from services.vision_service import VisionService

@pytest.mark.asyncio
async def test_analyze_image():
    service = VisionService(api_key="test-key")

    # 使用测试图片
    with open("tests/fixtures/test_image.jpg", "rb") as f:
        image_bytes = f.read()

    result = await service.analyze_images([image_bytes])

    assert 'description' in result
    assert 'objects' in result
    assert isinstance(result['objects'], list)
```

### 7.2 WebSocket 集成测试

```python
# tests/test_websocket_image.py
import pytest
from fastapi.testclient import TestClient

@pytest.mark.asyncio
async def test_image_message(client: TestClient):
    with client.websocket_connect("/ws") as websocket:
        # 发送图片消息
        websocket.send_json({
            'action': 'stream_data',
            'input_type': 'image',
            'data': ['data:image/jpeg;base64,/9j/4AAQ...'],
            'clientMessageId': 'test-1'
        })

        # 接收 processing 状态
        response1 = websocket.receive_json()
        assert response1['status'] == 'processing'

        # 接收 completed 状态
        response2 = websocket.receive_json()
        assert response2['status'] == 'completed'
```

---

## 8. 部署检查清单

- [ ] 配置 Vision API Key
- [ ] 设置图片大小限制
- [ ] 配置 Redis（用于缓存和异步任务）
- [ ] 设置超时时间
- [ ] 配置错误监控（Sentry 等）
- [ ] 配置日志记录
- [ ] 设置 CORS（如需要）
- [ ] 配置 WebSocket 连接池

---

## 相关文档

- [OpenAI Vision API](https://platform.openai.com/docs/guides/vision)
- [Google Gemini API](https://ai.google.dev/docs/gemini_api_overview)
- [Anthropic Claude Vision](https://docs.anthropic.com/claude/docs/vision)
- [FastAPI WebSocket](https://fastapi.tiangolo.com/advanced/websockets/)

---

**文档版本**: 1.0
**创建日期**: 2026-03-02
**维护者**: N.E.K.O Team
