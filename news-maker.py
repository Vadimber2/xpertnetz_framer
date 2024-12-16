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
full_html = "".join(html_output)#     print(put_response.status_code, put_response.text)
with open('template.html', 'r', encoding='utf-8') as f:
    template_content = f.read()
#%%
from dotenv import load_dotenv
import os
from datetime import datetime
import requests
import base64

# final_content - итоговый HTML контент для нового newsbody.html
# github_token, github_username, github_repo - ваши токен, имя пользователя и репо
# Мы хотим:
# 1. Получить старую версию newsbody.html
# 2. Переименовать её в newsbody_HH_MM_DD_MM_YYYY.html
# 3. Добавить ссылку на неё в новый final_content
# 4. Загрузить сначала архивную версию, затем обновлённый newsbody.html

load_dotenv()
github_token = os.environ.get("GITHUB_TOKEN")  # или ваш токен напрямую
github_username = "Vadimber2"
github_repo = "xpertnetz_framer"

timestamp = datetime.now()
formatted_time = timestamp.strftime("%H_%M_%d_%m_%Y")  # Часы_Минуты_День_Месяц_Год
old_file_name = "public/static/newsbody.html"
backup_file_name = f"public/static/newsbody_{formatted_time}.html"

headers = {
    "Authorization": f"token {github_token}",
    "Content-Type": "application/json"
}

url = f"https://api.github.com/repos/{github_username}/{github_repo}/contents/{old_file_name}"
get_response = requests.get(url, headers=headers)

if get_response.status_code == 200:
    file_info = get_response.json()
    existing_sha = file_info["sha"]
    old_content_base64 = file_info["content"]
    old_content = base64.b64decode(old_content_base64.encode('utf-8')).decode('utf-8')

    # Теперь у нас есть старый контент. Создадим backup файл.
    # Загрузим backup с содержимым old_content
    backup_url = f"https://api.github.com/repos/{github_username}/{github_repo}/contents/{backup_file_name}"
    backup_encoded = base64.b64encode(old_content.encode('utf-8')).decode('utf-8')
    backup_data = {
        "message": f"Backup old newsbody.html as {backup_file_name}",
        "content": backup_encoded
    }

    backup_put = requests.put(backup_url, headers=headers, json=backup_data)
    if backup_put.status_code in [200, 201]:
        print("Архивная версия успешно создана:", backup_file_name)

        # Теперь добавим ссылку на эту архивную версию в новый контент
        # Например, в конец файла можно добавить ссылку на архив:
        archive_link = f'''
        <p style="text-align:center; margin-top:20px;">
            <a href="/static/newsbody_{formatted_time}.html" 
               style="color:#666; text-decoration:none; font-weight:bold; font-size:16px;">
               Еще новости прошлых дней... {formatted_time}
            </a>
        </p>
        '''


        template_content_with_link = template_content.replace('<!-- NEWS_PLACEHOLDER -->',
                                                              f'<!-- NEWS_PLACEHOLDER -->{archive_link}')


        final_content_with_link = template_content_with_link.replace('<!-- NEWS_PLACEHOLDER -->', full_html)

        # Запишем обновлённый контент локально
        with open('newsbody.html', 'w', encoding='utf-8') as f:
            f.write(final_content_with_link)

        # Теперь загрузим новый newsbody.html
        new_file_path = "public/static/newsbody.html"
        with open('newsbody.html', 'rb') as f:
            new_content = f.read()
        new_encoded = base64.b64encode(new_content).decode('utf-8')

        # Поскольку файл уже существует, нам нужно передать sha
        new_data = {
            "message": "Update newsbody.html with new content and archive link",
            "content": new_encoded,
            "sha": existing_sha
        }

        new_put_response = requests.put(url, headers=headers, json=new_data)
        if new_put_response.status_code in [200, 201]:
            print("Файл newsbody.html успешно обновлён с ссылкой на архив.")
        else:
            print("Ошибка при обновлении newsbody.html:")
            print(new_put_response.status_code, new_put_response.text)

    else:
        print("Ошибка при создании архивного файла:")
        print(backup_put.status_code, backup_put.text)

elif get_response.status_code == 404:
    # Файл newsbody.html не существует в репо, просто создадим его
    # без архивации
    print("newsbody.html не найден, создадим новый.")

    # Добавим в новый контент только ссылку на архив, если нужно
    # (Если файла нет, то и архива нет. Можно пропустить.)
    final_content= template_content.replace('<!-- NEWS_PLACEHOLDER -->', full_html)
    with open('newsbody.html', 'w', encoding='utf-8') as f:
        f.write(final_content)

    # Заливаем новый файл
    with open('newsbody.html', 'rb') as f:
        new_content = f.read()
    new_encoded = base64.b64encode(new_content).decode('utf-8')

    create_data = {
        "message": "Create newsbody.html",
        "content": new_encoded
    }

    create_response = requests.put(url, headers=headers, json=create_data)
    if create_response.status_code in [200, 201]:
        print("Файл newsbody.html успешно создан.")
    else:
        print("Ошибка при создании newsbody.html:")
        print(create_response.status_code, create_response.text)
else:
    print("Ошибка при получении информации о newsbody.html:")
    print(get_response.status_code, get_response.text)
#%%