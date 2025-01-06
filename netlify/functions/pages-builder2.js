// netlify/functions/builders/pages-builder.js
//const fs = require('fs');
//const path = require('path');
const { builder } = require('@netlify/functions');
const axios = require('axios');
const cheerio = require('cheerio');
//const { minify } = require('html-minifier');

const myHandler = async (event, context) => {
    try {
        // 1. Извлечение пути из параметров
        let pathFramer = event.path || "/";

        // const cleanPath = pathFramer.endsWith('/') && pathFramer !== '/' ? pathFramer.slice(0, -1) : pathFramer;
        // if (cleanPath !== pathFramer) {
        //     return {
        //         statusCode: 301, // Редирект с добавлением пути без слэша
        //         headers: {
        //             "Location": cleanPath,
        //             "Content-Type": "text/html; charset=utf-8",
        //         },
        //     };
        // }

        // Удаление ведущего слеша
        if (pathFramer.startsWith('/')) {
            pathFramer = pathFramer.slice(1);
        }

        // console.log(`Запрос на путь: "${pathFramer}"`);
        //
        // // Валидация пути для безопасности
        // const validPathRegex = /^([\w\-\/]*)$/;
        // if (!validPathRegex.test(pathFramer)) {
        //     console.log(`Неверный путь запроса: "${pathFramer}"`);
        //     return {
        //         statusCode: 400,
        //         body: `Неверный путь запроса: ${pathFramer}`,
        //     };
        // }
        console.log(`Запрос на путь: "${pathFramer}"`);

        // Валидация пути для безопасности
        if (pathFramer){
            const validPathRegex = /^([\w\-\/]+(\.[\w]+)?(\?.*)?)$/;
            if (!validPathRegex.test(pathFramer)) {
                console.log(`Неверный путь запроса: "${pathFramer}"`);
                return {
                    statusCode: 400,
                    body: `Неверный путь запроса: ${pathFramer}`,
                };
            }
        }


        // 2. Получение значения заголовка x-nf-builder-cache
        const cacheHeader = event.headers['x-nf-builder-cache'] || event.headers['X-NF-BUILDER-CACHE'];
        console.log(`Значение заголовка x-nf-builder-cache: ${cacheHeader}`);

        if (cacheHeader === 'revalidate') {
            // 3. Обработка фонового запроса для обновления кеша
            console.log('Фоновый запрос для обновления кеша.');

            // Формирование URL к Framer
            const framerBase = process.env.FRAMER_BASE_URL || "https://tan-website-724184.framer.app";
            //let framerUrl = `${framerBase}/${pathFramer}`.replace(/([^:])\/{2,}/g, "$1/");
            const url = new URL(pathFramer, framerBase);
            // Удаление последнего слеша из pathname, если он есть
            url.pathname = url.pathname.replace(/\/$/, '');
            let framerUrl = url.toString();

            console.log(`Проксируем запрос к URL: ${framerUrl}`);

            // Извлечение и добавление параметров запроса, если они есть
            const { queryStringParameters, rawQuery } = event;
            if (rawQuery) { // Проверяем, есть ли сырая строка запроса
                framerUrl += `?${rawQuery}`;
            } else if (queryStringParameters && Object.keys(queryStringParameters).length > 0) {
                // Альтернативный способ формирования строки запроса из объекта queryStringParameters
                const queryString = Object.keys(queryStringParameters)
                    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryStringParameters[key])}`)
                    .join('&');
                framerUrl += `?${queryString}`;
            }
            console.log(`Проксируем запрос к URL с параметрами: ${framerUrl}`);

            // Запрос к Framer с использованием axios
            let response;
            try {
                response = await axios.get(framerUrl, { maxRedirects: 5, validateStatus: null });
            } catch (error) {
                console.error(`Не удалось выполнить запрос к Framer: ${error.message}`);
                return {
                    statusCode: 500,
                    body: `Внутренняя ошибка сервера: ${error.message}`,
                };
            }

            // Обработка статусов ответа
            if (response.status === 404) {
                console.log(`Страница не найдена на Framer: ${framerUrl}`);
                return {
                    statusCode: 302, // Используйте 301 для постоянного редиректа, если это необходимо
                    headers: {
                        "Location": `${process.env.SITE_BASE_URL}/404.html`,
                        "Content-Type": "text/html; charset=utf-8", // Опционально, можно добавить для поддержки некоторых браузеров
                    },
                };
            } else if (response.status >= 400) {
                console.log(`Ошибка при запросе к Framer: ${response.status} ${response.statusText}`);
                return {
                    statusCode: response.status,
                    body: `Ошибка при загрузке страницы: ${response.statusText}`,
                };
            }

            // Если всё прошло успешно, возвращаем статус 200 без тела, так как это фоновый запрос
            return {
                statusCode: 200,
                body: '',
                ttl: 3600, // Пример: кешировать 1 час
            };
        }

        // Если запрос не является фоновым, обрабатываем его как первичный
        console.log('Первичный запрос. Генерируем и возвращаем контент.');

        // Формирование URL к Framer
        const framerBasePrimary = process.env.FRAMER_BASE_URL || "https://tan-website-724184.framer.app";
        //let framerUrlPrimary = `${framerBasePrimary}/${pathFramer}`.replace(/([^:])\/{2,}/g, "$1/");
        const url = new URL(pathFramer, framerBasePrimary);
        // Удаление последнего слеша из pathname, если он есть
        url.pathname = url.pathname.replace(/\/$/, '');
        let framerUrlPrimary = url.toString();

        console.log(`Проксируем запрос к URL: ${framerUrlPrimary}`);
        // Извлечение и добавление параметров запроса, если они есть
        const { queryStringParameters: queryParamsPrimary, rawQuery: rawQueryPrimary } = event;
        if (rawQueryPrimary) { // Проверяем, есть ли сырая строка запроса
            framerUrlPrimary += `?${rawQueryPrimary}`;
        } else if (queryParamsPrimary && Object.keys(queryParamsPrimary).length > 0) {
            // Альтернативный способ формирования строки запроса из объекта queryStringParameters
            const queryStringPrimary = Object.keys(queryParamsPrimary)
                .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryParamsPrimary[key])}`)
                .join('&');
            framerUrlPrimary += `?${queryStringPrimary}`;
        }
        console.log(`Проксируем запрос к URL с параметрами: ${framerUrlPrimary}`);

        // Запрос к Framer с использованием axios
        let responsePrimary;
        try {
            responsePrimary = await axios.get(framerUrlPrimary, { maxRedirects: 5, validateStatus: null });
        } catch (error) {
            console.error(`Не удалось выполнить запрос к Framer: ${error.message}`);
            return {
                statusCode: 500,
                body: `Внутренняя ошибка сервера: ${error.message}`,
            };
        }

        // Обработка статусов ответа
        if (responsePrimary.status === 404) {
            console.log(`Страница не найдена на Framer: ${framerUrlPrimary}`);
            return {
                statusCode: 302, // Используйте 301 для постоянного редиректа, если это необходимо
                headers: {
                    "Location": `${process.env.SITE_BASE_URL}/404.html`,
                    "Content-Type": "text/html; charset=utf-8", // Опционально, можно добавить для поддержки некоторых браузеров
                },
            };
        }else if (responsePrimary.status >= 400) {
            console.log(`Ошибка при запросе к Framer: ${responsePrimary.status} ${responsePrimary.statusText}`);
            return {
                statusCode: responsePrimary.status,
                body: `Ошибка при загрузке страницы: ${responsePrimary.statusText}`,
            };
        }

        // Получение HTML
        const pageHtmlPrimary = responsePrimary.data;

        // Парсинг HTML с помощью Cheerio
        const $ = cheerio.load(pageHtmlPrimary);

        // Скрытие баннера Framer вместо его удаления
        const framerBadge = $('#__framer-badge-container');
        if (framerBadge.length) {
            framerBadge.css('display', 'none');
            console.log(`Скрыли #__framer-badge-container`);
        } else {
            console.log(`#__framer-badge-container не найден`);
        }

        // Вставка Structured Data (JSON-LD)
        const structuredData = {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "url": `${process.env.SITE_BASE_URL}`,
            "name": `Бесплатный сервис онлайн упрощения текста - ${process.env.BASE_URL} - Экспертнэт`,
            "description": "Бесплатно помогает упростить текст онлайн - не только сокращает объём, но и устраняет повторы.",
            "image": {
                "@type": "ImageObject",
                "url": "https://framerusercontent.com/images/GP6blcWXoEm2Zvu7I0AnzyDyxMU.jpg",
                "width": "auto",
                "height": "auto"
            },
            "publisher": {
                "@type": "Organization",
                "name": "Экспертнэт",
                "logo": {
                    "@type": "ImageObject",
                    "url": "https://framerusercontent.com/images/I4bWRZUxVwLl3KIfdx1PMgc6B9k.png",
                    "width": 600,
                    "height": 60
                },
                "url": process.env.SITE_BASE_URL
            },
            "mainEntity": {
                "@type": "WebPage",
                "url": `${process.env.SITE_BASE_URL}/distiller`,
                "name": "Бесплатно упростить текст онлайн",
                "description": "Попробуйте прямо сейчас бесплатно упростить свой текст."
            },
            "breadcrumb": {
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {
                        "@type": "ListItem",
                        "position": 1,
                        "name": "Главная",
                        "item": `${process.env.SITE_BASE_URL}`
                    },
                    {
                        "@type": "ListItem",
                        "position": 2,
                        "name": "Продукты",
                        "item": `${process.env.SITE_BASE_URL}/new-products`
                    },
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": "Новости",
                        "item": `${process.env.SITE_BASE_URL}/news`
                    },
                    {
                        "@type": "ListItem",
                        "position": 4,
                        "name": "Проекты",
                        "item": `${process.env.SITE_BASE_URL}/projects`
                    },
                    {
                        "@type": "ListItem",
                        "position": 5,
                        "name": "Стоимость",
                        "item": `${process.env.SITE_BASE_URL}/price`
                    },
                    {
                        "@type": "ListItem",
                        "position": 6,
                        "name": "О компании",
                        "item": `${process.env.SITE_BASE_URL}/about-us`
                    }
                ]
            },
            "sameAs": []
        };


        // Добавление JSON-LD в <head>
        const structuredDataScript = `<script type="application/ld+json" id="xpertnet-structured-data">
${JSON.stringify(structuredData)}
</script>`;
        $('head').append(structuredDataScript);
        console.log(`Добавили structured data`);

        // Вставка или обновление canonical link
        //const newCanonicalURL = `${process.env.SITE_BASE_URL}/${pathFramer}`.replace(/([^:])\/{2,}/g, "$1/");

        const siteBaseURL = process.env.SITE_BASE_URL || "https://xpertnet.cx";
        
        const urlCanonical = new URL(pathFramer, siteBaseURL);
        // Удаление конечного слеша из pathname, если он есть
        urlCanonical.pathname = urlCanonical.pathname.replace(/\/$/, '');
        const newCanonicalURL = urlCanonical.toString();

        console.log(newCanonicalURL); // Например: https://xpertnet.cx/news

        let canonicalLink = $('head link[rel="canonical"]');

        if (canonicalLink.length) {
            canonicalLink.attr('href', newCanonicalURL);
            console.log(`Обновили canonical link: ${newCanonicalURL}`);
        } else {
            $('head').append(`<link rel="canonical" href="${newCanonicalURL}" />`);
            console.log(`Добавили canonical link: ${newCanonicalURL}`);
        }

        // Вставка или обновление meta property="og:url"
        const newOgUrl = newCanonicalURL;
        let metaOgUrl = $('head meta[property="og:url"]');

        if (metaOgUrl.length) {
            metaOgUrl.attr('content', newOgUrl);
            console.log(`Обновили meta og:url: ${newOgUrl}`);
        } else {
            $('head').append(`<meta property="og:url" content="${newOgUrl}" />`);
            console.log(`Добавили meta og:url: ${newOgUrl}`);
        }

        // Linguana meta (если нужно)
        if (!$('head meta[name="linguana-site-verification"]').length) {
            $('head').append(`<meta name="linguana-site-verification" content="Sc54SvPNs7qLat4QPKIX" />`);
            console.log(`Добавили meta linguana-site-verification`);
        }

        // Вставка Яндекс.Метрики с Проверкой на Наличие
        const yandexMetrikaID = process.env.YANDEX_METRIKA_ID;
        console.log("ID Яндекс.Метрики: ", yandexMetrikaID);

        const yandexMetrica = `
            <!-- Yandex.Metrika counter -->
            <script type="text/javascript" id="yandex-metrika-script">
               (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
               m[i].l=1*new Date();
               for (var j = 0; j < document.scripts.length; j++) {
                 if (document.scripts[j].src === r) { return; }
               }
               k=e.createElement(t),a=e.getElementsByTagName(t)[0],
               k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
               })
               (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
            
               ym(${yandexMetrikaID}, "init", {
                    clickmap:true,
                    trackLinks:true,
                    accurateTrackBounce:true,
                    webvisor:true
               });
            </script>
            <noscript><div><img src="https://mc.yandex.ru/watch/${yandexMetrikaID}" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
            <!-- /Yandex.Metrika counter -->
            `;

        // Проверка наличия Яндекс.Метрики перед вставкой
        if (!$('body script#yandex-metrika-script').length) {
            // Вставляем Яндекс.Метрику в <head> как можно ближе к началу
            //$('head').prepend(yandexMetrica);
            $('body').append(yandexMetrica);
            console.log(`Добавили Яндекс.Метрику`);
        } else {
            console.log(`Яндекс.Метрика уже присутствует`);
        }


        // Вставка Cookie Banner
        const cookieBannerHTML = `
            <!-- COOKIE BANNER -->
            <style>
              #cookieBanner {
                position: fixed; bottom: 0; left: 0; right: 0;
                background-color: black; color: white;
                text-align: center; padding: 10px; z-index: 1000;
                display: flex; justify-content: center; align-items: center;
              }
              #cookieBanner button {
                background-color: white; color: black; border: none;
                padding: 5px 10px; margin-left: 10px; cursor: pointer;
              }
              #cookieBanner a {
                color: #888888; text-decoration: underline; margin-left: 5px;
              }
              @media (max-width: 768px) {
                #cookieBanner {
                  flex-direction: column; padding: 20px;
                }
                #cookieBanner button {
                  margin-top: 10px; margin-left: 0;
                }
              }
            </style>
            <div id="cookieBanner">
              Этот сайт использует файлы cookies.
              <a href="https://xpertnet.cx/legal/cookies_policy.pdf" target="_blank">Политика</a>
              <button onclick="acceptCookies()">Принять</button>
            </div>
            <script>
              function setCookie(name, value, days) {
                var expires = "";
                if (days) {
                  var date = new Date();
                  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                  expires = "; expires=" + date.toUTCString();
                }
                document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Lax; Secure";
              }
              function getCookie(name) {
                var nameEQ = name + "=";
                var ca = document.cookie.split(';');
                for(var i=0;i < ca.length;i++) {
                  var c = ca[i];
                  while (c.charAt(0)==' ') c = c.substring(1,c.length);
                  if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
                }
                return null;
              }
              function acceptCookies() {
                setCookie('cookiesAccepted', 'true', 7);
                var banner = document.getElementById('cookieBanner');
                if (banner) {
                  banner.style.display = 'none';
                }
              }
              // Инициализация баннера
              (function(){
                var isAccepted = getCookie('cookiesAccepted');
                if (isAccepted) {
                  var banner = document.getElementById('cookieBanner');
                  if (banner) {
                    banner.style.display = 'none';
                  }
                }
              })();
            </script>
            <!-- COOKIE BANNER END -->
            `;
        $('body').append(cookieBannerHTML);
        console.log(`Добавили cookie-banner`);


        // 3. Добавление TTL для кеширования
        const ttl = parseInt(process.env.CACHE_MAX_AGE) || 10800; // 3 часа
        console.log(`Устанавливаем TTL: ${ttl} секунд`);

        const headers = {
            "Content-Type": "text/html; charset=utf-8",
            "Permissions-Policy": "browsing-topics=()",
        };

        // 6. Добавление Заголовков из Ответа Axios
        const allowedHeaders = [
            'cache-control',
            'expires',
            'pragma',
            'last-modified',
            'content-language',
            'content-type',
            'etag',
            'x-powered-by',
            'vary',
            'access-control-allow-origin',
            'access-control-allow-credentials',
            'access-control-allow-headers',
            'access-control-allow-methods',
            'access-control-max-age',
            'strict-transport-security',
            'content-security-policy',
            'x-content-type-options',
            'x-frame-options',
            'referrer-policy',
            'feature-policy',
            // Добавьте другие заголовки, которые вы хотите перенаправить
        ];

        const responseHeaders = {};
        for (const [key, value] of Object.entries(responsePrimary.headers)) {
            responseHeaders[key.toLowerCase()] = value;
        }

        for (const header of allowedHeaders) {
            if (responseHeaders[header]) {
                headers[header] = responseHeaders[header];
            }
        }

        const finalHtml = $.html();
        // 5. Возвращение ответа с TTL
        return {
            statusCode: 200,
            body: finalHtml,
            headers: headers,
            ttl: ttl, // Устанавливаем TTL для кеширования на Netlify Edge
        };
    } catch (error) {
        console.error("Ошибка в функции pages-builder:", error);
        return {
            statusCode: 500,
            body: "Internal Server Error",
            // Обычно TTL не устанавливается для ошибок, чтобы они не кешировались
        };
    }
};

const handler = builder(myHandler);

module.exports = { handler };
