const pkgcloud = require('pkgcloud');
const https = require('https');
const fs = require('fs');

const endpoint = 'https://xxxx.rackcdn.com';

const file = JSON.parse(fs.readFileSync('./assets.json', { encoding:'utf8', flag:'r' }));
const assets = new Map([...file]);
const total = assets.size;
const uuids = [...assets.keys()];

// step 1 download assets and modify layers
(async () => {
  uuids.forEach((uuid, i) => {
    await (new Promise(resolve => {
      const layers = assets.get(uuid);
      const file = fs.createWriteStream(`download/${uuid}.svg`);
      // download asset
      https.get(`${endpoint}/${uuid}.svg`, response => {
        response.setEncoding('utf8');
        response.on('data', data => {
          // run through all layers that need updating - fix visibility
          layers.forEach(id => {
            // double check if the layer already had visibility
            if (data.match(new RegExp('layer="' + id + '"[^>]*visibility="visible"', 'g'))) {
              console.log(`[${i + 1}/${total}] - failed, ${uuid} - found visibility=visible`);
            } else if (!data.match(new RegExp('layer="' + id + '"[^>]*visibility="hidden"', 'g'))) {
              data = data.replace(new RegExp('layer="' + id + '"', 'g'), 'visibility="hidden" layer="' + id + '"');
            }
          });
          // save asset
          file.write(data);
        })
        response.on('error', () => {
          console.log(`[${i + 1}/${total}] - failed, ${uuid}`);
        });
        response.on('end', async() => {
          console.log(`[${i + 1}/${total}] - downloaded, ${uuid}`);
          setTimeout(() => resolve(), 500); // throttle download just in case
        });
      });
    }));
  }

  // step 2 re-upload asset
  const client = pkgcloud.storage.createClient({
    provider: 'rackspace',
    username: 'xxxx',
    apiKey: 'xxxx',
  });
  const container = 'xxxx';

  uuids.forEach((uuid, i) => {
    await (new Promise(resolve => {
      // read updated asset
      const readStream = fs.createReadStream(`download/${uuid}.svg`);
      // upload it to the container
      const writeStream = client.upload({
        container,
        remote: `${uuid}.svg`,
      });
      writeStream.on('error', () => {
        console.log(`[${i + 1}/${total}] - failed, ${uuid}`);
      });
      writeStream.on('success', () => {
        console.log(`[${i + 1}/${total}] - uploaded, ${uuid}`);
        setTimeout(() => resolve(), 500); // throttle upload just in case
      });
      readStream.pipe(writeStream);
    }));
  });
})();