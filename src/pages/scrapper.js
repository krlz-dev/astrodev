import puppeteer from "puppeteer"
import cheerio from "cheerio"
import pLimit from "p-limit"

let sites = [
    "https://pb.proxybay.ca"
];
let notFoundSites = [];
const fetchedSites = await fetchProxyUrls();
console.log(fetchedSites)
const cleanedSites = fetchedSites.map((site) => site.replace(/\/$/, '')); // Remove trailing slashes

export async function get({ request }) {
    const limit = pLimit(5);
    const allSites = sortSites([...sites, ...cleanedSites]);
    const url = new URL(request.url)
    const params = new URLSearchParams(url.search)
    
    let failedCount = 0;
    for (const site of allSites) {
        const someResults = await scrapeWebsite(site, params.get('q'));
        if (someResults.length > 0) {
            return {
                body: JSON.stringify(someResults),
            };
        }
    }

    return {
        body: JSON.stringify([]),
    };
}

async function scrapeWebsite(site, searchValue) {
    const results = [];
    try {
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();

        const endpoints = [
            `${site}/search.php?q=${searchValue}`,
            `${site}/s/?q=${searchValue}`,
            `${site}/search/${searchValue}`
        ];

        for (const endpoint of endpoints) {
            await page.goto(endpoint, { timeout: 5000 }); 
            const html = await page.content();

            const $ = cheerio.load(html);
            const links = $('a[href^="magnet:?"]');

            if (links.length > 0) {
                links.each((index, element) => {
                    const parentList = $(element).parents('li');
                    const vipImage = parentList.find('img[src="/static/images/vip.gif"][alt="VIP"]');

                    if (vipImage.length > 0) {
                        const href = $(element).attr('href');
                        const descriptionLink = parentList.find('a[href^="/description.php"]');
                        const descriptionText = descriptionLink.text().trim();

                        results.push({ magnet: href, description: descriptionText });
                    }
                });
                return results;
            }else{
                console.log(`${endpoint} - No results found`);
                notFoundSites.push(site);
            }
        }
        await page.close();
        await browser.close();
        return results;
    } catch (error) {
        console.error(`Error scraping ${site}:`, error.message);
        notFoundSites.push(site);
        return results;
    }
}

function sortSites(sites) {
    return sites.sort((a, b) => notFoundSites.filter(site => site === a).length - notFoundSites.filter(site => site === b).length);
}
 

async function fetchProxyUrls() {
    const response = await fetch('https://emulatorclub.com/the-pirate-bay-proxy-list/');
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
