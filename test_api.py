import requests
import json
import time

# 配置
API_KEY = "ms-d65a691a-adcf-43cb-bde8-71e6b45a2d78"
BASE_URL = "https://api-inference.modelscope.cn/v1/images/generations"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
    "X-ModelScope-Async-Mode": "true"
}

def create_task():
    """创建图片生成任务"""
    print("=" * 60)
    print("创建任务...")
    print("=" * 60)
    
    payload = {
        "model": "Qwen/Qwen-Image",
        "prompt": "A beautiful sunset over the ocean, vibrant colors",
        "size": "1024x1024",
        "negative_prompt": "lowres, bad quality, blurry"
    }
    
    print(f"\n请求体:\n{json.dumps(payload, indent=2, ensure_ascii=False)}\n")
    
    response = requests.post(BASE_URL, headers=headers, json=payload)
    
    print(f"状态码: {response.status_code}")
    result = response.json()
    print(f"\n创建任务响应:\n{json.dumps(result, indent=2, ensure_ascii=False)}\n")
    
    # 检查是否同步返回结果
    if result.get("task_status") == "SUCCEED":
        print("🎉 任务同步完成！")
        print("\n返回的所有字段:")
        print("=" * 60)
        for key, value in result.items():
            if key == "output_images":
                print(f"  {key}: [图片URL列表]")
                for idx, img_url in enumerate(value):
                    print(f"    [{idx}] {img_url}")
            else:
                print(f"  {key}: {value}")
        print("=" * 60)
        
        # 检查特殊参数
        if "seed" in result:
            print(f"\n🎲 找到 seed: {result['seed']}")
        if "parameters" in result:
            print(f"\n📋 找到 parameters: {json.dumps(result['parameters'], indent=2, ensure_ascii=False)}")
        
        return result
    
    if response.status_code == 200:
        task_id = result.get("task_id")
        return task_id
    else:
        print(f"错误: {response.text}")
        return None

def query_task(task_id):
    """查询任务状态"""
    print("=" * 60)
    print(f"查询任务: {task_id}")
    print("=" * 60)
    
    # 正确的查询接口
    url = f"https://api-inference.modelscope.cn/v1/tasks/{task_id}"
    headers_query = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "X-ModelScope-Task-Type": "image_generation"
    }
    response = requests.get(url, headers=headers_query)
    
    print(f"状态码: {response.status_code}")
    
    if response.status_code == 404:
        print("\n⚠️ 任务不存在或已过期（404）")
        print(f"响应内容: {response.text}")
        return None
    
    try:
        result = response.json()
        print(f"\n任务状态响应:\n{json.dumps(result, indent=2, ensure_ascii=False)}\n")
        
        # 打印所有返回的字段
        print("=" * 60)
        print("返回的所有字段:")
        print("=" * 60)
        for key, value in result.items():
            print(f"  {key}: {value}")
        
        return result
    except Exception as e:
        print(f"\n解析响应失败: {e}")
        print(f"原始响应: {response.text}")
        return None

def wait_for_completion(task_id, max_retries=30, interval=5):
    """等待任务完成"""
    print("=" * 60)
    print("等待任务完成...")
    print("=" * 60)
    
    for i in range(max_retries):
        result = query_task(task_id)
        status = result.get("task_status")
        
        print(f"\n[{i+1}/{max_retries}] 状态: {status}")
        
        if status == "SUCCEED":
            print("\n✅ 任务完成！")
            print("\n最终结果的所有字段:")
            print("=" * 60)
            for key, value in result.items():
                if key == "output_images":
                    print(f"  {key}: [图片URL列表]")
                    for idx, img_url in enumerate(value):
                        print(f"    [{idx}] {img_url}")
                else:
                    print(f"  {key}: {value}")
            print("=" * 60)
            
            # 检查是否有 seed 或其他特殊参数
            if "seed" in result:
                print(f"\n🎲 找到 seed: {result['seed']}")
            if "parameters" in result:
                print(f"\n📋 找到 parameters: {json.dumps(result['parameters'], indent=2, ensure_ascii=False)}")
            
            return result
        elif status == "FAILED":
            print("\n❌ 任务失败")
            return result
        else:
            print(f"等待 {interval} 秒后重试...")
            time.sleep(interval)
    
    print("\n⏱️ 超时")
    return None

if __name__ == "__main__":
    # 测试已有的 task_id
    existing_task_id = "8a88150a-ac22-40e9-8673-0e3bf1c52ccb"
    
    print("选择操作:")
    print("1. 查询已有任务")
    print("2. 创建新任务（查看返回参数）")
    
    choice = input("\n请选择 (1/2): ").strip()
    
    if choice == "1":
        query_task(existing_task_id)
    elif choice == "2":
        result = create_task()
        # 如果是同步返回，result 已经包含完整信息
        # 如果是异步，result 是 task_id，需要等待
        if isinstance(result, str):
            wait_for_completion(result)
    else:
        print("无效选择")
