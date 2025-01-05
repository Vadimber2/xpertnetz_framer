const axios = require('axios');
const fs = require('fs');
const toml = require('toml');
const tomlify = require('tomlify-j0.4');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const path = require('path');
const cheerio = require('cheerio');
const { Feed } = require('feed');


const mainDomainName = "xpertnet.cx";
const mainFramerDomainName = "tan-website-724184.framer.app";
const netlifyBuilderFunction = "/.netlify/builders/pages-builder2"

const yandexIndexNowKey = "hwJ9rb6e8kYgEpKvG37z5Ra4yfWVUP";

const mainUrl ="https://" + mainDomainName;
const framerUrl = "https://" + mainFramerDomainName;

const createRSSfromSitemap = async (data) => {
    try {
        //const sitemapPath = path.resolve(__dirname, 'public', 'sitemap.xml');
        //console.log(sitemapPath);
        const rssOutputPath = path.resolve(__dirname, 'public', 'rss.xml');

        //const data = fs.readFileSync(sitemapPath, 'utf8');
        //console.log(data);

        const result = await xml2js.parseStringPromise(data);

        const feed = new Feed({
            title: 'СОЗДАЕМ УДОБНЫЕ И КАЧЕСТВЕННЫЕ ПЕРСОНАЛЬНЫЕ ПРЕДЛОЖЕНИЯ ТОВАРОВ',
            description: 'Поможем повысить конверсию и средний чек поиском товара по фотографиям.',
            id: mainUrl,
            link: mainUrl,
            image: 'https://framerusercontent.com/images/4rBbMDifZOnU3GOKjXH2dv4sxqI.jpg',
            favicon: 'https://framerusercontent.com/images/pqY7zilhKpYQcuyS5eLz0c9bbI.png',
            copyright: '© ООО Экспертнэт Рус, ' + new Date().getFullYear(),
            updated: new Date(),
            generator: 'gen_1_0',
            feedLinks: {
                rss2: mainUrl + '/rss.xml',
            },
            customNamespaces: {
                turbo: 'http://turbo.yandex.ru',
                yandex: 'http://news.yandex.ru',
                media: 'http://search.yahoo.com/mrss/'
            }
        });

        for (let urlObj of result.urlset.url) {
            const url = urlObj.loc[0].replace(mainFramerDomainName, mainDomainName);
            //const url = urlObj.loc[0];
            console.log(url);
            const pageData = await fetchPageData(url);

            feed.addItem({
                title: pageData.title,
                id: url,
                link: url,
                description: pageData.description,
                content: pageData.description,
                date: new Date(),
                author: 'Vadim Berkovich', // use actual author name
                customElements: [
                    { 'turbo:source': pageData.source },
                    { 'turbo:topic': pageData.topic },
                    { 'turbo:content': { _cdata: pageData.description } },
                    {
                        'turbo:extendedHtml': 'true',
                        'yandex:related': {},
                        'metrics': {
                            'yandex': {
                                _attr: { schema_identifier: 'Identifier' }, // use actual identifier
                                'breadcrumblist': {
                                    'breadcrumb': [
                                        { _attr: { url: mainUrl, text: 'Домашняя' } },
                                        { _attr: { url: mainUrl + '/new-products/', text: 'Проекты' } },
                                        { _attr: { url: mainUrl + '/projects/', text: 'Проекты' } },
                                        { _attr: { url: mainUrl + '/price/', text: 'Цены' } },
                                        { _attr: { url: mainUrl + '/articles/', text: 'Статьи' } },
                                        { _attr: { url: mainUrl + '/blog/', text: 'Блог' } },
                                        { _attr: { url: mainUrl + '/about_us/', text: 'О компании' } }
                                    ]
                                }
                            }
                        },
                    }
                ]
            });
        }

        const rssData = feed.rss2();
        const modifiedRssData = rssData.replace(/<item>/g, '<item turbo="true">');

        fs.writeFileSync(rssOutputPath, modifiedRssData);

    } catch (error) {
        console.error(`Failed to create RSS from sitemap: ${error}`);
    }

    console.error(`RSS completed`);
};

// const fetchPageData = async (url) => {
//   try {
//     const { data } = await axios.get(url);
//     const $ = cheerio.load(data);
//     const title = $('title').text();
//     const description = $('meta[name="description"]').attr('content');
//     const source = $('meta[name="source"]').attr('content'); // Assume the source is stored in a meta tag with name="source"
//     const topic = $('meta[name="topic"]').attr('content'); // Assume the topic is stored in a meta tag with name="topic"
//     return { title, description, source, topic };
//   } catch (error) {
//     console.error(`Failed to fetch page data: ${error}`);
//   }
// };

async function fetchPageData(url) {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        const title = $('title').text() || 'No Title';
        const description = $('meta[name="description"]').attr('content') || '';
        const source = $('meta[name="source"]').attr('content') || '';
        const topic = $('meta[name="topic"]').attr('content') || '';

        return { title, description, source, topic };
    } catch (error) {
        console.error(`Failed to fetch page data from ${url}: ${error}`);
        // Возвращаем хоть какую-то «заглушку», чтобы вся итерация не падала
        return {
            title: 'Страница недоступна',
            description: '',
            source: '',
            topic: ''
        };
    }
}


const downloadAndChangeUrlInSitemap = async () => {
    try {
        // Fetch sitemap.xml from the target URL
        const response = await axios({
            url: framerUrl + '/sitemap.xml',
            method: 'GET',
            responseType: 'text', // Update to text to handle the data as a string
        });

        // Replace all instances of the old URL with the new one (excluding https://)
        const regexpstr = new RegExp(mainFramerDomainName, 'g');
        const modifiedData = response.data.replace(regexpstr, mainDomainName);

        // Define the path to the public folder and sitemap.xml filename
        const filepath = path.resolve(__dirname, 'public', 'sitemap.xml');

        // Write the modified data to the file
        fs.writeFileSync(filepath, modifiedData);

        console.log('Successfully downloaded and updated sitemap.xml');
        //await generateRedirects(response.data);
        //await sendDataToYandex(response.data);
        //await createRSSfromSitemap(response.data);

    } catch (error) {
        console.error('Failed to download and update sitemap:', error);
    }
};

async function generateRedirects(data) {
    try {
        //const { data } = await axios.get('https://tan-website-724184.framer.app/sitemap.xml');
        parser.parseString(data, async function (err, result) {
            const urls = result.urlset.url.map(urlObj => urlObj.loc[0]);

            // Load existing TOML file
            const file = fs.readFileSync('./netlify.toml', 'utf-8');
            const parsedToml = toml.parse(file);

            // Empty existing redirects
            parsedToml.redirects = [];

            urls.forEach((url) => {
                const path = url.replace(framerUrl, '');
                // Add new redirect to the parsed TOML
                //if (path === "/404") {
                //  return;
                //}
                //console.log(path);
                parsedToml.redirects.push({
                    from: path,
                    to: netlifyBuilderFunction,//url,
                    status: 200,
                    force: true
                });
            });

            // Add redirect for 'public/static' to itself
            parsedToml.redirects.push({
                from: "/sitemap.xml",
                to: "/sitemap.xml",
                status: 200,
                force: true
            });

            parsedToml.redirects.push({
                from: "/rss.xml",
                to: "/rss.xml",
                status: 200,
                force: true
            });

            parsedToml.redirects.push({
                from: "/robots.txt",
                to: "/robots.txt",
                status: 200,
                force: true
            });

            // Add redirect for 'public/static' to itself
            // parsedToml.redirects.push({
            //     from: "/static/*",
            //     to: "/static/:splat",
            //     status: 200,
            //     force: true
            // });
            //
            // parsedToml.redirects.push({
            //     from: "/legal/*",
            //     to: "/legal/:splat",
            //     status: 200,
            //     force: true
            // });

            // Add catch-all 404 redirect
            /*      parsedToml.redirects.push({
                    from: "/404",
                    to: "https://tan-website-724184.framer.app/not-found",
                    status: 404
                  });*/
            /*      parsedToml.redirects.push({
                    from: "https://xpertnet.cx/emotions/!*",
                    to: "https://xpertnetz.com/:splat",
                    status: 200,
                    force: true
                  });*/

            // Redirect for stripping trailing slashes
            /*      parsedToml.redirects.push({
                    from: "/!*!/",
                    to: "/:splat",
                    status: 301,
                    force: true
                  });*/

            // Convert the parsed TOML back to a string
            let newToml = tomlify.toToml(parsedToml, { space: 2 });
            newToml = newToml.replace(/= (\d+)\.0/g, '= $1');

            // Print the contents of the new TOML file to the console
            console.log(newToml);
            // Write the new TOML string back to the file
            fs.writeFileSync('./netlify.toml', newToml);
        });
    } catch (error) {
        console.error('Failed to fetch sitemap:', error);
    }
}

async function sendDataToYandex(data) {
    try {
        parser.parseString(data, async (err, result) => {
            if (err) {
                throw err;
            }

            // Собираем все URL из sitemap
            const rawUrls = result.urlset.url.map(urlObj => urlObj.loc[0]);

            // Для редиректов домены могут быть переопределены
            // Тут, например, заменяем framerUrl на mainUrl
            const urls = rawUrls.map(u => u.replace(framerUrl, mainUrl));
            console.log("Urls for yandex:", urls);
            // Примерные данные для IndexNow
            const indexNowPayload = {
                host: mainDomainName, // Вместо этого можно вставить свой хост (без https://)
                key: yandexIndexNowKey, // Ваш ключ IndexNow
                keyLocation: 'https://'+ mainDomainName +'/'+yandexIndexNowKey+'.txt', // URL-адрес, где лежит ключ
                urlList: urls
            };

            try {
                const response = await axios.post(
                    "https://yandex.com/indexnow",
                    indexNowPayload,
                    {
                        headers: {
                            "Content-Type": "application/json; charset=utf-8"
                        }
                    }
                );
                console.log("Yandex indexNow request successful:", response.data);
            } catch (error) {
                console.error("Failed to send data to Yandex:", error);
            }
        });
    } catch (error) {
        console.error('Failed to send data to Yandex:', error);
    }
}

downloadAndChangeUrlInSitemap();


