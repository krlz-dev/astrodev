import {load} from "cheerio";
import puppeteerExtra from "puppeteer-extra";
import blockResources from "puppeteer-extra-plugin-block-resources";

let site = "https://pb.proxybay.ca";

export async function get({request}) {
    const url = new URL(request.url);
    const params = new URLSearchParams(url.search);
    const someResults = await scrapeWebsite(site, params.get('q'));
    if (someResults.length > 0) {
        return {
            body: JSON.stringify(someResults),
        };
    }

    return {
        body: JSON.stringify([]),
    };
}

async function scrapeWebsite(site, searchValue) {
    const results = [];
    try {
        const browser = await puppeteerExtra.launch({headless: "new"});
        const page = await browser.newPage();
        const endpoints = [
            `${site}/search.php?q=${searchValue}`,
            `${site}/s/?q=${searchValue}`,
            `${site}/search/${searchValue}`
        ];

        for (const endpoint of endpoints) {
            await page.goto(endpoint, {timeout: 5000});
            const html = await page.content();

            const $ = load(html);
            const links = $('a[href^="magnet:?"]');

            if (links.length > 0) {
                links.each((index, element) => {
                    const parentList = $(element).parents('li');
                    const vipImage = parentList.find('img[src="/static/images/vip.gif"][alt="VIP"]');

                    if (vipImage.length > 0) {
                        const href = $(element).attr('href');
                        const descriptionLink = parentList.find('a[href^="/description.php"]');
                        const descriptionText = descriptionLink.text().trim();

                        results.push({magnet: href, description: descriptionText});
                    }
                });
                return results;
            } else {
                console.log(`${endpoint} - No results found`);
            }
        }
        await page.close();
        await browser.close();
        return results;
    } catch (error) {
        console.error(`Error scraping ${site}:`, error.message);
        return results;
    }
}


/*
* TODO: Scrape proxy urls from https://emulatorclub.com/the-pirate-bay-proxy-list
* TODO: apply a heartbeat to the proxy urls to check if they are still alive
*
* async function fetchProxyUrls() {
    const response = await fetch('https://emulatorclub.com/the-pirate-bay-proxy-list');
    const html = await response.text();
    const $ = cheerio.load(html);

    const urls = [];
    $('ul li').each((index, element) => {
        const text = $(element).text();
        if (text.startsWith('https://')) {
            urls.push(text);
        }
    });

    return urls;
}
*
*
* */
