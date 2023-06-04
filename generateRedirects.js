const axios = require('axios');
const fs = require('fs');
const toml = require('toml');
const tomlify = require('tomlify-j0.4');
const xml2js = require('xml2js');

const parser = new xml2js.Parser();

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
        to: "https://xpertnet.framer.website/sitemap.xml",
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

      // Add catch-all 404 redirect
      parsedToml.redirects.push({
        from: "/*",
        to: "/404",
        status: 404,
        force: false
      });

      // Convert the parsed TOML back to a string
      const newToml = tomlify.toToml(parsedToml, { space: 2 });

      // Print the contents of the new TOML file to the console
      console.log(newToml);
      // Write the new TOML string back to the file
      fs.writeFileSync('./netlify.toml', newToml);
    });
  } catch (error) {
    console.error('Failed to fetch sitemap:', error);
  }
}

generateRedirects();
