// This script fetches all available tags for itzg/minecraft-server from Docker Hub
// and writes them to a JSON file for use in your slash command registration.
import https from 'https';
import fs from 'fs';
import path from 'path';

const DOCKER_TAGS_URL = 'https://hub.docker.com/v2/repositories/itzg/minecraft-server/tags?page_size=100';
const OUT_PATH = path.join(__dirname, '../data/mc_versions.json');

function fetchTags(url: string, tags: string[] = []): Promise<string[]> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        const newTags = json.results.map((t: any) => t.name);
        const allTags = tags.concat(newTags);
        if (json.next) {
          fetchTags(json.next, allTags).then(resolve).catch(reject);
        } else {
          resolve(allTags);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  const tags = await fetchTags(DOCKER_TAGS_URL);
  // Filter out non-version tags (e.g., 'latest', 'test', etc.)
  const versionTags = tags.filter(t => /^\d+\.\d+(\.\d+)?$/.test(t) || t === 'latest');
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(versionTags, null, 2), 'utf-8');
  console.log(`Fetched ${versionTags.length} Minecraft versions.`);
})();
