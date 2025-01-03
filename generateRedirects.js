const axios = require('axios');
const fs = require('fs');
const toml = require('toml');
const tomlify = require('tomlify-j0.4');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const path = require('path');
const cheerio = require('cheerio');
const { Feed } = require('feed');

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
      id: 'https://xpertnet.cx/',
      link: 'https://xpertnet.cx/',
      image: 'https://framerusercontent.com/images/4rBbMDifZOnU3GOKjXH2dv4sxqI.jpg',
      favicon: 'https://framerusercontent.com/images/pqY7zilhKpYQcuyS5eLz0c9bbI.png',
      copyright: '© ООО Экспертнэт Рус, ' + new Date().getFullYear(),
      updated: new Date(),
      generator: 'gen_1_0',
      feedLinks: {
        rss2: 'https://xpertnet.cx/rss.xml',
      },
      customNamespaces: {
        turbo: 'http://turbo.yandex.ru',
        yandex: 'http://news.yandex.ru',
        media: 'http://search.yahoo.com/mrss/'
      }
    });

    for (let urlObj of result.urlset.url) {
      const url = urlObj.loc[0].replace('tan-website-724184.framer.app', 'xpertnet.cx');
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
                    { _attr: { url: 'http://xpertnet.cx/', text: 'Домашняя' } },
                    { _attr: { url: 'http://xpertnet.cx/projects/', text: 'Проекты' } },
                    { _attr: { url: 'http://xpertnet.cx/price/', text: 'Цены' } },
                    { _attr: { url: 'http://xpertnet.cx/articles/', text: 'Статьи' } },
                    { _attr: { url: 'http://xpertnet.cx/blog/', text: 'Блог' } },
                    { _attr: { url: 'http://xpertnet.cx/about_us/', text: 'О компании' } }
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
      url: 'https://tan-website-724184.framer.app/sitemap.xml',
      method: 'GET',
      responseType: 'text', // Update to text to handle the data as a string
    });

    // Replace all instances of the old URL with the new one (excluding https://)
    const modifiedData = response.data.replace(/tan-website-724184.framer.app/g, 'xpertnet.cx');

    // Define the path to the public folder and sitemap.xml filename
    const filepath = path.resolve(__dirname, 'public', 'sitemap.xml');

    // Write the modified data to the file
    fs.writeFileSync(filepath, modifiedData);

    console.log('Successfully downloaded and updated sitemap.xml');
    await generateRedirects(response.data);
    await createRSSfromSitemap(response.data);

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
        const path = url.replace('https://tan-website-724184.framer.app', '');
        // Add new redirect to the parsed TOML
        //if (path === "/404") {
        //  return;
        //}
        //console.log(path);
        parsedToml.redirects.push({
          from: path,
          to: url,
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
      parsedToml.redirects.push({
        from: "/static/*",
        to: "/static/:splat",
        status: 200,
        force: true
      });

      parsedToml.redirects.push({
        from: "/legal/*",
        to: "/legal/:splat",
        status: 200,
        force: true
      });

      parsedToml.redirects.push({
        from: "/index.html",
        to: "https://tan-website-724184.framer.app",
        status: 200,
        force: true
      });

      parsedToml.redirects.push({
        from: "/generator-generator-seo-teksta",
        to: "https://xpertnet.cx/generator-seo-teksta",
        status: 302,
        force: true
      });
      //https://xpertnet.cx/blog/istoriya-rasskazannaya-neposredstvenno-v-tochke-prodazh/

      parsedToml.redirects.push({
        from: "/blog/istoriya-rasskazannaya-neposredstvenno-v-tochke-prodazh/*",
        to: "https://xpertnet.cx/marketing",
        status: 302,
        force: true
      });

      parsedToml.redirects.push({
        from: "/generation-content",
        to: "https://xpertnet.cx/generator-teksta",
        status: 302,
        force: true
      });

      parsedToml.redirects.push({
        from: "/bots",
        to: "https://xpertnet.cx/new-bots",
        status: 302,
        force: true
      });

      parsedToml.redirects.push({
        from: "/products",
        to: "https://xpertnet.cx/new-products",
        status: 302,
        force: true
      });

      parsedToml.redirects.push({
        from: "/product",
        to: "https://xpertnet.cx/new-products",
        status: 302,
        force: true
      });

      parsedToml.redirects.push({
        from: "/bots-sommelier-chatbots",
        to: "https://xpertnet.cx/bots-somele",
        status: 302,
        force: true
      });

      parsedToml.redirects.push({
        from: "/page",
        to: "https://xpertnet.cx",
        status: 302,
        force: true
      });
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

downloadAndChangeUrlInSitemap();


