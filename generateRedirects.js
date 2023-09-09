const axios = require('axios');
const fs = require('fs');
const toml = require('toml');
const tomlify = require('tomlify-j0.4');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const path = require('path');
const cheerio = require('cheerio');
const { Feed } = require('feed');

const createRSSfromSitemap = async () => {
  try {
    const sitemapPath = path.resolve(__dirname, 'public', 'sitemap.xml');
    const rssOutputPath = path.resolve(__dirname, 'public', 'rss.xml');

    const data = fs.readFileSync(sitemapPath, 'utf8');
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
      const url = urlObj.loc[0].replace('xpertnet.framer.website', 'xpertnet.cx');
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

const fetchPageData = async (url) => {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);
    const title = $('title').text();
    const description = $('meta[name="description"]').attr('content');
    const source = $('meta[name="source"]').attr('content'); // Assume the source is stored in a meta tag with name="source"
    const topic = $('meta[name="topic"]').attr('content'); // Assume the topic is stored in a meta tag with name="topic"
    return { title, description, source, topic };
  } catch (error) {
    console.error(`Failed to fetch page data: ${error}`);
  }
};


const downloadAndChangeUrlInSitemap = async () => {
  try {
    // Fetch sitemap.xml from the target URL
    const response = await axios({
      url: 'https://xpertnet.framer.website/sitemap.xml',
      method: 'GET',
      responseType: 'text', // Update to text to handle the data as a string
    });

    // Replace all instances of the old URL with the new one (excluding https://)
    const modifiedData = response.data.replace(/xpertnet.framer.website/g, 'xpertnet.cx');

    // Define the path to the public folder and sitemap.xml filename
    const filepath = path.resolve(__dirname, 'public', 'sitemap.xml');

    // Write the modified data to the file
    fs.writeFileSync(filepath, modifiedData);

    console.log('Successfully downloaded and updated sitemap.xml');
  } catch (error) {
    console.error('Failed to download and update sitemap:', error);
  }
};

async function generateRedirects() {
  try {
    const { data } = await axios.get('https://xpertnet.framer.website/sitemap.xml');
    parser.parseString(data, async function (err, result) {
      const urls = result.urlset.url.map(urlObj => urlObj.loc[0]);

      // Load existing TOML file
      const file = fs.readFileSync('./netlify.toml', 'utf-8');
      const parsedToml = toml.parse(file);

      // Empty existing redirects
      parsedToml.redirects = [];

      urls.forEach((url) => {
        const path = url.replace('https://xpertnet.framer.website', '');
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
        from: "/index.html",
        to: "https://xpertnet.framer.website",
        status: 200,
        force: true
      });

      // Add catch-all 404 redirect
      parsedToml.redirects.push({
        from: "/*",
        to: "https://xpertnet.framer.website/not-found",
        status: 404
      });
/*      parsedToml.redirects.push({
        from: "https://xpertnet.cx/emotions/!*",
        to: "https://xpertnetz.com/:splat",
        status: 200,
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

generateRedirects();

createRSSfromSitemap();
