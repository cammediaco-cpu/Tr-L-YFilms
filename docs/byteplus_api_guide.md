# 📘 HƯỚNG DẪN GỌI API QUA PROXY – BYTEPLUS AI MODELS

---

## 🌐 KẾT NỐI
- **Base URL**: `http://[IP_PROXY]:9045/v1`
- **Endpoint**: `POST /v1/chat/completions`
- **Header**: `Authorization: Bearer bp_proxy_sk_...`

---

## 🧠 NHÓM CHAT – TEXT GENERATION

### `seed-1-8`
Tham số:
- `temperature`: 0 – 2 (Mặc định: `1.0`)
- `top_p`: 0 – 1 (Mặc định: `0.95`)
- `max_tokens`: 0 – 32768 (Mặc định: `32768`)
- `reasoning_effort`: `"minimal"` | `"low"` | `"medium"` | `"high"` (Mặc định: `"minimal"`)
- `stream`: `True` / `False`

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://127.0.0.1:9045/v1",
    api_key="bp_proxy_sk_..."
)

response = client.chat.completions.create(
    model="seed-1-8",
    messages=[
        {
            "role": "system",
            "content": "Bạn là trợ lý AI."
        },
        {
            "role": "user",
            # Truyền List nếu muốn gửi nhiều định dạng ảnh/video kèm text
            "content": "Bạn hãy làm một bài thơ về mùa xuân."
        }
    ],
    temperature=1.0,   # 0 đến 2 (Mặc định: 1)
    top_p=0.95,        # 0 đến 1 (Mặc định: 0.95)
    max_tokens=32768,  # 0 đến 32768 (Mặc định: 32768)
    # reasoning_effort="minimal",  # 4 chế độ: minimal, low, medium, high
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

Gửi ảnh / video kèm text:
```python
# Chuẩn OpenAI multimodal
messages=[{
    "role": "user",
    "content": [
        {"type": "text", "text": "Mô tả bức ảnh này"},
        {"type": "image_url", "image_url": {"url": "https://example.com/image.png"}}
    ]
}]

# Hoặc qua extra_body.images
messages=[{"role": "user", "content": "Mô tả bức ảnh"}],
extra_body={"images": ["https://example.com/img1.png"]}
```

---

### `seed-2-0-lite`
> ⚠️ **Không có `temperature` và `top_p`**. `max_tokens` tối đa **131071**.

Tham số:
- `max_tokens`: 0 – 131071 (Mặc định: `131071`)
- `reasoning_effort`: `"minimal"` | `"low"` | `"medium"` | `"high"` (Mặc định: `"minimal"`)
- `stream`: `True` / `False`

```python
response = client.chat.completions.create(
    model="seed-2-0-lite",
    messages=[
        {
            "role": "system",
            "content": "Bạn là trợ lý AI."
        },
        {
            "role": "user",
            # Hỗ trợ truyền mảng Array để nhúng Text và Image URLs
            "content": "Phân tích bức ảnh này giúp tôi được không?"
        }
    ],
    max_tokens=131071,  # 0 đến 131071 (Mặc định: 131071)
    # reasoning_effort="high",  # 4 chế độ: minimal, low, medium, high
    stream=True
)

for chunk in response:
    if chunk.choices[0].delta.content is not None:
        print(chunk.choices[0].delta.content, end="")
```

---

## 🎬 NHÓM VIDEO GENERATION
> **Kết quả:** `response.choices[0].message.content` → URL video  
> **Prompt** truyền qua `messages[role=user].content`  
> **Tham số video** truyền qua `extra_body`

---

### `seedance-1-0-lite`
Tham số extra_body:
- `Resolution`: `"480p"` | `"720p"` | `"1080p"` (Mặc định: `"480p"`)
- `Ratio`: `"16:9"` | `"9:16"` | `"1:1"` | `"21:9"` | `"4:3"` | `"3:4"` (Mặc định: `"3:4"`)
- `Duration`: 2 – 12 (giây) (Mặc định: `2`)
- `CameraFixed`: `True` / `False` (Mặc định: `False`)
- `images`: Danh sách URL ảnh (Mặc định: `[]`)
- `useFirstLastFrame`: `True` / `False` (Mặc định: `False`)

Chế độ tạo video theo số ảnh truyền vào:
- `0` (bỏ trống): T2V – Tạo video từ text
- `1`: I2V First Frame – Ảnh làm khung đầu
- `2` + `useFirstLastFrame: True`: First & Last Frame – Ảnh đầu & cuối
- `2` đến `4` + `useFirstLastFrame: False` (hoặc không truyền): Smart Reference – Đa góc nhìn tham chiếu

> ⚠️ Chế độ **Smart Reference** bị giới hạn tối đa **720p** (nếu truyền `1080p` sẽ tự động hạ xuống `720p`)

```python
response = client.chat.completions.create(
    model="seedance-1-0-lite",
    messages=[
        {
            "role": "user",
            "content": "Một con chó nhỏ đang chơi đùa"
        }
    ],
    extra_body={
        # Bỏ trống images[] thì sẽ tạo video từ chữ (T2V)
        #
        # --- CÁC CHẾ ĐỘ ẢNH (I2V) ---
        # 1. Điền 1 ảnh vào images[] -> Tạo Image-to-video (I2V / First Frame)
        # 2. Điền 2 đến 4 ảnh vào images[] -> Chế độ Smart Reference
        # 3. Điền đúng 2 ảnh + kèm "useFirstLastFrame": True -> First & Last Frame
        "images": [
            # "https://example.com/first.png",
            # "https://example.com/second.png",
        ],
        # (Chỉ cần khi truyền đúng 2 ảnh và muốn dùng First & Last Frame)
        # "useFirstLastFrame": True,
        
        # Cấu hình video
        "Resolution": "480p",   # "1080p" | "720p" | "480p" (Smart Reference TỐI ĐA 720p)
        "Ratio": "3:4",         # "16:9" | "9:16" | "1:1" | "21:9" | "4:3" | "3:4"
        "Duration": 2,          # Thời lượng video (2-12 giây)
        "CameraFixed": False    # Camera cố định (True / False)
    }
)
video_url = response.choices[0].message.content
print(video_url)
```

---

### `seedance-1-0-pro`
> ⚠️ **Không có Smart Reference**. Chỉ hỗ trợ tối đa **2 ảnh** (1 ảnh = First Frame, 2 ảnh = First & Last Frame).

Tham số extra_body:
- `Resolution`: `"480p"` | `"720p"` | `"1080p"` (Mặc định: `"480p"`)
- `Ratio`: `"16:9"` | `"9:16"` | `"1:1"` | `"21:9"` | `"4:3"` | `"3:4"` (Mặc định: `"16:9"`)
- `Duration`: 2 – 12 (giây) (Mặc định: `2`)
- `CameraFixed`: `True` / `False` (Mặc định: `False`)
- `images`: Tối đa 2 URL (Mặc định: `[]`)

```python
response = client.chat.completions.create(
    model="seedance-1-0-pro",
    messages=[
        {
            "role": "user",
            "content": "Một con chó nhỏ đang chơi đùa"
        }
    ],
    extra_body={
        "images": [
            # "https://example.com/first.png",
            # "https://example.com/last.png"
        ],
        "Resolution": "720p",   # "1080p" | "720p" | "480p"
        "Ratio": "16:9",        # "16:9" | "9:16" | "1:1" | "21:9" | "4:3" | "3:4"
        "Duration": 2,          # Thời lượng video (2-12 giây)
        "CameraFixed": False
    }
)
video_url = response.choices[0].message.content
print(video_url)
```

---

### `seedance-1-0-pro-fast`
> ⚠️ **Không có Smart Reference**. Chỉ hỗ trợ tối đa **2 ảnh**. Duration mặc định **5 giây** (khác Pro thường là 2 giây).

Tham số extra_body:
- `Resolution`: `"480p"` | `"720p"` | `"1080p"` (Mặc định: `"480p"`)
- `Ratio`: `"16:9"` | `"9:16"` | `"1:1"` | `"21:9"` | `"4:3"` | `"3:4"` (Mặc định: `"16:9"`)
- `Duration`: 2 – 12 (giây) (Mặc định: `5`)
- `CameraFixed`: `True` / `False` (Mặc định: `False`)
- `images`: Tối đa 2 URL (Mặc định: `[]`)

```python
response = client.chat.completions.create(
    model="seedance-1-0-pro-fast",
    messages=[
        {
            "role": "user",
            "content": "Một con mèo chạy trên bãi cỏ"
        }
    ],
    extra_body={
        "images": [
            # "https://example.com/first.png",
            # "https://example.com/last.png"
        ],
        "Resolution": "720p",   # "1080p" | "720p" | "480p"
        "Ratio": "16:9",        # "16:9" | "9:16" | "1:1" | "21:9" | "4:3" | "3:4"
        "Duration": 5,          # Thời lượng video (2-12 giây)
        "CameraFixed": False
    }
)
video_url = response.choices[0].message.content
print(video_url)
```

---

### `seedance-1.5-pro`
> ⚠️ **Model ID dùng dấu CHẤM**: `seedance-1.5-pro`  
> ⚠️ **Duration tối thiểu 4 giây** (không phải 2 giây như các model khác)  
> ✅ Có thêm tham số `GenerateAudio` để tạo âm thanh kèm video  
> ⚠️ **Không có Smart Reference**. Chỉ hỗ trợ tối đa **2 ảnh**.

Tham số extra_body:
- `Resolution`: `"480p"` | `"720p"` | `"1080p"` (Mặc định: `"720p"`)
- `Ratio`: `"16:9"` | `"9:16"` | `"1:1"` | `"21:9"` | `"4:3"` | `"3:4"` (Mặc định: `"16:9"`)
- `Duration`: 4 – 12 (giây) (Mặc định: `5`)
- `CameraFixed`: `True` / `False` (Mặc định: `False`)
- `GenerateAudio`: `True` / `False` (Mặc định: `True`)
- `images`: Tối đa 2 URL (Mặc định: `[]`)

```python
response = client.chat.completions.create(
    model="seedance-1.5-pro",   # Dấu CHẤM, không phải gạch ngang
    messages=[
        {
            "role": "user",
            "content": "Một con mèo chạy trên bãi cỏ"
        }
    ],
    extra_body={
        "images": [
            # "https://example.com/first.png",
            # "https://example.com/last.png"
        ],
        "Resolution": "1080p",  # "1080p" | "720p" | "480p"
        "Ratio": "16:9",        # "16:9" | "9:16" | "1:1" | "21:9" | "4:3" | "3:4"
        "Duration": 5,          # Thời lượng video (4-12 giây) – TỐI THIỂU 4s
        "CameraFixed": False,
        "GenerateAudio": True   # Tạo âm thanh (True / False)
    }
)
video_url = response.choices[0].message.content
print(video_url)
```

---

## 🖼️ NHÓM IMAGE GENERATION
> **Kết quả:** `response.choices[0].message.content` → URL ảnh  
> **Prompt** truyền qua `messages[role=user].content`  
> **Tham số ảnh** truyền qua `extra_body`  
> **Phí:** 1 PIECE / lần tạo thành công (không phân biệt độ phân giải)

---

### `seedream-4-0`
Tham số extra_body:
- `Ratio`: `"1:1"` | `"3:4"` | `"4:3"` | `"16:9"` | `"9:16"` | `"2:3"` | `"21:9"` (Mặc định khi sai/thiếu: `"21:9"`)
- `Resolution`: `"2k"` | `"4k"` (Mặc định khi sai/thiếu: `"2k"`)
- `images`: URL ảnh tham chiếu (I2I) (Mặc định khi sai/thiếu: `[]`)

```python
response = client.chat.completions.create(
    model="seedream-4-0",
    messages=[
        {
            "role": "user",
            "content": "Một bức ảnh phong cảnh thành phố tương lai cyberpunk, phong cách 3D render"
        }
    ],
    extra_body={
        # Bỏ trống images[] thì sẽ tạo ảnh từ chữ (T2I)
        # Thêm URL ảnh vào images[] nếu muốn dùng chế độ tham chiếu (I2I)
        "images": [
            # "https://example.com/reference.png",
        ],
        "Ratio": "16:9",      # "1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "21:9"
        "Resolution": "2k"    # "2k" | "4k"
    }
)
image_url = response.choices[0].message.content
print(image_url)
```

---

### `seedream-4-5`
> ⚠️ Giống `seedream-4-0` về mọi mặt, **chỉ khác duy nhất**: Ratio mặc định (khi truyền sai hoặc thiếu) là **`"9:16"`** thay vì `"21:9"`.

Tham số extra_body:
- `Ratio`: `"1:1"` | `"3:4"` | `"4:3"` | `"16:9"` | `"9:16"` | `"2:3"` | `"21:9"` (Mặc định khi sai/thiếu: `"9:16"`)
- `Resolution`: `"2k"` | `"4k"` (Mặc định khi sai/thiếu: `"2k"`)
- `images`: URL ảnh tham chiếu (I2I) (Mặc định khi sai/thiếu: `[]`)

```python
response = client.chat.completions.create(
    model="seedream-4-5",
    messages=[
        {
            "role": "user",
            "content": "Một bức ảnh phong cảnh thành phố tương lai cyberpunk, phong cách 3D render"
        }
    ],
    extra_body={
        "images": [
            # "https://example.com/reference.png",
        ],
        "Ratio": "16:9",      # "1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "21:9"
        "Resolution": "2k"    # "2k" | "4k"
    }
)
image_url = response.choices[0].message.content
print(image_url)
```

---

### `seedream-5-0`
> ⚠️ **Không có tham số `Resolution`** — model không đọc giá trị này từ `extra_body`.  
> Kích thước ảnh được tự động tính theo `Ratio`, **cố định một mức duy nhất** (không có 4K).  
> Mặc định `Ratio` khi truyền sai/thiếu là **`"16:9"`**.

Tham số extra_body:
- `Ratio`: `"1:1"` | `"3:4"` | `"4:3"` | `"16:9"` | `"9:16"` | `"2:3"` | `"21:9"` (Mặc định khi sai/thiếu: `"16:9"`)
- `images`: URL ảnh tham chiếu (I2I) (Mặc định khi sai/thiếu: `[]`)

```python
response = client.chat.completions.create(
    model="seedream-5-0",
    messages=[
        {
            "role": "user",
            "content": "Một bức ảnh phong cảnh thành phố tương lai cyberpunk, phong cách 3D render"
        }
    ],
    extra_body={
        # Bỏ trống images[] thì sẽ tạo ảnh từ chữ (T2I)
        # Thêm URL ảnh vào images[] nếu muốn dùng chế độ tham chiếu (I2I)
        "images": [
            # "https://example.com/reference.png",
        ],
        "Ratio": "16:9"   # "1:1" | "3:4" | "4:3" | "16:9" | "9:16" | "2:3" | "21:9"
        # Không có Resolution cho model này
    }
)
image_url = response.choices[0].message.content
print(image_url)
```

---

## 📊 SO SÁNH NHANH

| Chat | `seed-1-8` | `seed-2-0-lite` |
| :--- | :--- | :--- |
| `temperature` | ✅ 0–2 | ❌ |
| `top_p` | ✅ 0–1 | ❌ |
| `max_tokens` | ✅ 0–32768 | ✅ 0–131071 |
| `reasoning_effort` | ✅ | ✅ |
| Multimodal (ảnh/video) | ✅ | ✅ |

| Video | `seedance-1-0-lite` | `seedance-1-0-pro` | `seedance-1-0-pro-fast` | `seedance-1.5-pro` |
| :--- | :--- | :--- | :--- | :--- |
| T2V (0 ảnh) | ✅ | ✅ | ✅ | ✅ |
| I2V First Frame (1 ảnh) | ✅ | ✅ | ✅ | ✅ |
| First & Last Frame (2 ảnh) | ✅ | ✅ | ✅ | ✅ |
| Smart Reference (2–4 ảnh) | ✅ | ❌ | ❌ | ❌ |
| `GenerateAudio` | ❌ | ❌ | ❌ | ✅ |
| Duration tối thiểu | 2s | 2s | 2s | 4s |
| Duration mặc định | `2` | `2` | `5` | `5` |
| Resolution mặc định | `"480p"` | `"480p"` | `"480p"` | `"720p"` |
| Ratio mặc định | `"3:4"` | `"16:9"` | `"16:9"` | `"16:9"` |

| Image | `seedream-4-0` | `seedream-4-5` | `seedream-5-0` |
| :--- | :--- | :--- | :--- |
| Hỗ trợ `Resolution` | ✅ (`"2k"` / `"4k"`) | ✅ (`"2k"` / `"4k"`) | ❌ |
| Ratio mặc định (khi sai) | `"21:9"` | `"9:16"` | `"16:9"` |
| Hỗ trợ 4K | ✅ | ✅ | ❌ |
