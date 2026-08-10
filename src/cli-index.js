import { crawlWebsite } from './crawler.js';
import { loadSettings } from './settings.js';
await loadSettings();
console.log(await crawlWebsite());
