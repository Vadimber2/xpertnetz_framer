#%%
from dotenv import load_dotenv
import os
import requests
import json
from pydantic import BaseModel
from openai import OpenAI
from tqdm import tqdm

#%%
load_dotenv()
diffbot_token = os.environ.get("DIFF_BOT_TOKEN")
print("diffbot_token: ", diffbot_token)

#%%
load_dotenv()
diffbot_token = os.environ.get("DIFF_BOT_TOKEN")

resources = {
    "habr": f"https://api.diffbot.com/v3/list?url=https://habr.com/ru/news/&token={diffbot_token}",
    "retailnews": f"https://api.diffbot.com/v3/list?url=https://retailnews.ai/category/news&useProxy=default&token={diffbot_token}"
}

headers = {
    "Content-Type": "application/json"
}

all_items = []

# Сбор данных в один список
for resource_name, api_url in tqdm(resources.items(), desc="Processing resources"):
    response = requests.get(api_url, headers=headers)
    if response.status_code == 200:
        data = json.loads(response.text).get("objects", [])
        if data and isinstance(data, list) and len(data) > 0:
            items = data[0].get("items", [])
        else:
            items = []

        #items = items[:30]  # ограничиваем до 30 элементов
        for item in items:
            item["source"] = resource_name  # Добавляем поле с именем ресурса
        all_items.extend(items)
    else:
        print(f"Не удалось получить данные для ресурса {resource_name}. Код ответа: {response.status_code}")

# Объединённый список всех элементов
print("Total items: ", len(all_items))

#%%
results = []

class ConfirmationModel(BaseModel):
    isArticleAI: int

class TextTransformer(BaseModel):
    title:str
    summary:str
    hashtags: str
#%%
load_dotenv()
openai_key = os.environ.get("OPENAI_API_KEY")
print("openai_key: ", openai_key)

client = OpenAI(api_key=openai_key)

for item in tqdm(all_items, desc="Processing items"):
    title = item.get('title')
    summary = item.get('summary')
    
    if title and summary:
        completion = client.beta.chat.completions.parse(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an Artificial Intelligence subject matter expert and expert at structured data extraction. You will be given structured items and you need to make conclusion about data."},
                {"role": "user", "content": "Return in structured data '1' if this text can be classified as related to Artificial Intelligence area of knowledge: "+title +" " +summary +" and '0' if not."}
            ],
            response_format=ConfirmationModel,
        )
        
        res= completion.choices[0].message.parsed
        
        if res.isArticleAI == 1:
            completion2 = client.beta.chat.completions.parse(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an Artificial Intelligence subject matter expert and expert at structured data extraction. You will be given structured items and you need to make conclusion about data."},
                    {"role": "user", "content": "Add 3 most relevant hashtags and return title and summary on Russian title:"+title +" summary:" +summary}
                ],
                response_format=TextTransformer,
            )
            res2= completion2.choices[0].message.parsed
            #Add 3 (three) relevant hashtags and translate title and summary to russian language"
            item["title"]= res2.title
            item["summary"]= res2.summary
            item["hashtags"]= res2.hashtags
            results.append(item)
#list(items)
# Добавляем элементы 
#%%
#print(results)
#%%
# Генерация HTML-кода
from datetime import datetime
today = datetime.now()
# Форматируем дату в нужном формате
formatted_date = today.strftime('%d-%m-%Y')
#<p>{item.date}</p>
#<p><strong>Хештеги:</strong> {item["hashtags"]}</p>
#<p>{item["date"]}</p>
html_output = ""
for item in results:
    image = item.get('image')
    hashtags = item.get('hashtags')
    summary = item.get('summary')
    title = item.get('title')
    link = item.get('link')
       
    html_output += f"""
    <div class="news-item">
        <p>{formatted_date}</p>
        <h2><a href="{link}" target="_blank">{title}</a></h2>
        <img src="{image}" alt="{title}">
        <p>{summary}</p>
        <p><strong>Хештеги:</strong> {hashtags}</p>
    </div>
    """
print(html_output)
#%%
with open('template.html', 'r', encoding='utf-8') as f:
    template_content = f.read()
#%%
#full_html = '<div class="news-container">\n' + "".join(html_output) + '\n</div>'
full_html = "".join(html_output)
#%%
final_content = template_content.replace('<!-- NEWS_PLACEHOLDER -->', full_html)
#%%
# Записываем итог в newsbody.html
with open('newsbody.html', 'w', encoding='utf-8') as f:
    f.write(final_content)
#%%
import requests
import base64
import os

github_token = os.environ.get("GITHUB_TOKEN")  # или ваш токен напрямую
github_username = "Vadimber2"
github_repo = "xpertnetz_framer"
file_path = "public/static/newsbody.html"  # путь к файлу в репо
local_file_path = "newsbody.html"  # локальный файл, который вы хотите загрузить

headers = {
    "Authorization": f"token {github_token}",
    "Content-Type": "application/json"
}

# Сначала получим информацию о файле (в том числе SHA)
url = f"https://api.github.com/repos/{github_username}/{github_repo}/contents/{file_path}"
get_response = requests.get(url, headers=headers)

# Проверяем статус GET-запроса
if get_response.status_code == 200:
    file_info = get_response.json()
    existing_sha = file_info["sha"]
elif get_response.status_code == 404:
    # Файл не существует, SHA указывать не нужно
    existing_sha = None
else:
    print("Ошибка при получении информации о файле:")
    print(get_response.status_code, get_response.text)
    exit(1)

# Читаем локальный файл и кодируем в base64
with open(local_file_path, 'rb') as f:
    content = f.read()
encoded = base64.b64encode(content).decode('utf-8')

data = {
    "message": "Update newsbody.html",
    "content": encoded
}

# Если файл уже существует, добавляем SHA
if existing_sha is not None:
    data["sha"] = existing_sha

# Теперь делаем PUT-запрос для обновления/создания файла
put_response = requests.put(url, headers=headers, json=data)

if put_response.status_code in [200, 201]:
    print("Файл успешно обновлён или создан в репозитории.")
else:
    print("Ошибка при загрузке файла:")
    print(put_response.status_code, put_response.text)

#%%
