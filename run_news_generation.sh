#!/bin/bash

# Путь к вашему CSV файлу
#csv_file="bases.csv"

# Чтение CSV файла и перебор строк
#tail -n +2 "$csv_file" | while IFS=',' read -r login key region source; do
#    echo "Запуск postgress_indexer2.py для региона: $region"
#    python3 postgress_indexer2.py "$region"
#done
python3 news-maker.py