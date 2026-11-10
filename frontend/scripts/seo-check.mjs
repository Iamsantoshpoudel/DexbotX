import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const frontendRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const nextCli = join(frontendRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const port = await getAvailablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [nextCli, 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: frontendRoot,
  stdio: 'ignore',
});

try {
  await waitForServer(`${baseUrl}/`);
  const sitemapResponse = await fetch(`${baseUrl}/sitemap.xml`);
  assert(sitemapResponse.ok, `Sitemap request failed with ${sitemapResponse.status}`);
  const sitemap = await sitemapResponse.text();
  const pageUrls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, location]) => {
    const sitemapUrl = new URL(location, baseUrl);
    return new URL(`${sitemapUrl.pathname}${sitemapUrl.search}`, baseUrl);
  });
  assert(pageUrls.length > 0, 'Sitemap did not contain any pages');

  for (const pageUrl of pageUrls) {
    const response = await fetch(pageUrl);
    assert(response.ok, `Page request failed for ${pageUrl.pathname}: ${response.status}`);
    const html = await response.text();
    const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => parseAttributes(match[0]));
    const openGraphImages = tags.filter((attributes) => attributes.property === 'og:image');
    assert(openGraphImages.length === 1, `${pageUrl.pathname} has ${openGraphImages.length} og:image tags`);

    const openGraphUrl = new URL(openGraphImages[0].content);
    const pageOrigin = tags.find((attributes) => attributes.property === 'og:url')?.content;
    assert(pageOrigin, `${pageUrl.pathname} is missing og:url`);
    assert(
      openGraphImages[0].content === `${new URL(pageOrigin).origin}/og-banner`,
      `${pageUrl.pathname} og:image does not equal the site's absolute /og-banner URL`,
    );
    assert(openGraphUrl.pathname === '/og-banner', `${pageUrl.pathname} og:image path is not /og-banner`);

    const twitterImages = tags.filter((attributes) => attributes.name === 'twitter:image');
    assert(twitterImages.length === 1, `${pageUrl.pathname} has ${twitterImages.length} twitter:image tags`);
    assert(twitterImages[0].content === openGraphImages[0].content, `${pageUrl.pathname} Twitter image differs from og:image`);
    assert(
      tags.some((attributes) => attributes.name === 'twitter:card' && attributes.content === 'summary_large_image'),
      `${pageUrl.pathname} is missing twitter:card summary_large_image`,
    );
    assert(
      !tags.some(({ property, name }) =>
        ['og:image:type', 'og:image:width', 'og:image:height'].includes(property)
        || ['twitter:image:type', 'twitter:image:width', 'twitter:image:height'].includes(name),
      ),
      `${pageUrl.pathname} contains social image type or dimension metadata`,
    );
  }

  await assertContentType(
    `${baseUrl}/og-banner`,
    'TelegramBot (like TwitterBot)',
    'image/jpeg',
  );
  await assertContentType(
    `${baseUrl}/og-banner`,
    'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
    'image/gif',
  );
  await assertContentType(`${baseUrl}/og-banner`, 'curl/8.0', 'image/gif');

  console.log(`SEO check passed for ${pageUrls.length} sitemap pages and all /og-banner user agents.`);
} finally {
  server.kill();
}

function parseAttributes(tag) {
  const attributes = {};
  const pattern = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attributes;
}

async function assertContentType(url, userAgent, expected) {
  const response = await fetch(url, { headers: { 'user-agent': userAgent } });
  assert(response.ok, `/og-banner request for ${userAgent} failed with ${response.status}`);
  const contentType = response.headers.get('content-type')?.split(';')[0].toLowerCase();
  assert(contentType === expected, `${userAgent} received ${contentType ?? 'no content-type'}, expected ${expected}`);
  assert(response.headers.get('vary')?.toLowerCase() === 'user-agent', '/og-banner response is missing Vary: User-Agent');
}

async function getAvailablePort() {
  const listener = createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const address = listener.address();
  assert(address && typeof address !== 'string', 'Could not allocate a local port');
  await new Promise((resolve, reject) => listener.close((error) => (error ? reject(error) : resolve())));
  return address.port;
}

async function waitForServer(url) {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next server exited early with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Next server did not become ready${lastError ? `: ${lastError}` : ''}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
