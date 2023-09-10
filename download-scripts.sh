#!/bin/bash
mkdir -p public/js
curl -o public/js/tag.js https://mc.yandex.ru/metrika/tag.js
curl -o public/js/exp.js https://abt.s3.yandex.net/expjs/latest/exp.js
