const axios = require('axios');
const fs = require('fs');
const toml = require('toml');
const tomlify = require('tomlify-j0.4');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const path = require('path');


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

      // Add catch-all 404 redirect
      parsedToml.redirects.push({
        from: "/*",
        to: "https://xpertnet.framer.website/404",
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

downloadAndChangeUrlInSitemap();
generateRedirects();
