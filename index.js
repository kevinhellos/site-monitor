const chalk = require("chalk");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const axios = require("axios");
puppeteer.use(StealthPlugin());

const siteLink = "https://fanciful-profiterole-94abb7.netlify.app/";
const webhookUrl = "";
let checkDelay = 0;

let previousHTML = "";

function getTimestamp() {
  const sgTime = new Date().toLocaleString("en-US", {
    timeZone: "Asia/Singapore"
  });
  const d = new Date(sgTime);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const mss = String(d.getMilliseconds()).padStart(3, "0");
  return `${dd}-${mm}-${yy} ${hh}:${min}:${ss}.${mss}`;
}


function getDiff(oldStr, newStr) {
  // Remove HTML tags
  const cleanOldStr = oldStr.replace(/<[^>]*>/g, "");
  const cleanNewStr = newStr.replace(/<[^>]*>/g, "");

  const oldWords = cleanOldStr.split(" ").filter(Boolean);
  const newWords = cleanNewStr.split(" ").filter(Boolean);

  let diff = "";
  let i = 0, j = 0;
  let removedBuffer = [];
  let addedBuffer = [];

  while (i < oldWords.length || j < newWords.length) {
    const oldWord = oldWords[i] || null;
    const newWord = newWords[j] || null;

    if (oldWord === newWord) {
      // Flush for any buffered changes
      if (removedBuffer.length) {
        diff += `[-] ${removedBuffer.join(" ")}\n`;
        removedBuffer = [];
      }
      if (addedBuffer.length) {
        diff += `[+] ${addedBuffer.join(" ")}\n`;
        addedBuffer = [];
      }
      i++;
      j++;
    } 
    else {
      // Word removed
      if (oldWord && !newWords.includes(oldWord, j)) {
        removedBuffer.push(oldWord);
        i++;
      }
      // Word added
      else if (newWord && !oldWords.includes(newWord, i)) {
        addedBuffer.push(newWord);
        j++;
      } 
      // Word replaced
      else {
        if (oldWord) removedBuffer.push(oldWord);
        if (newWord) addedBuffer.push(newWord);
        i++;
        j++;
      }
    }
  }

  // Flush any remaining buffers
  if (removedBuffer.length) diff += `[-] ${removedBuffer.join(" ")}\n`;
  if (addedBuffer.length) diff += `[+] ${addedBuffer.join(" ")}\n`;

  return diff.trim() || "No readable diff";
}

function sendDiscordPing(diffText = "-") {
  axios.post(webhookUrl,
    {
      username: "Site Monitor",
      embeds: [
        {
          author: { 
            name: siteLink,
            // icon_url: ""
          },
          title: "Site Changes Detected!",
          url: siteLink,
          color: 0x3498db,
          fields: [
            {
              name: "Change(s)",
              value: "```" + diffText + "```",
              inline: false
            },
            {
              name: "Link",
              value: `[[Click]](${siteLink})`,
              inline: false
            }
          ],
          footer: {
            text: getTimestamp(),
            // icon_url: "",
          },
        },
      ],
    }
  );

  console.log(`${getTimestamp()} > ${chalk.green("Webhook sent!")}`);
}


(async () => {
  console.log(`${getTimestamp()} > Start monitor`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--disable-features=IsolateOrigins,site-per-process,SitePerProcess",
      "--disable-site-isolation-trials",
      "--window-size=500,700",
    ],
  });

  const pages = await browser.pages();
  if (pages[0]) await pages[0].close();

  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(60000);
  await page.setDefaultTimeout(60000);

  async function scrape() {
    try {
      await page.goto(siteLink, { waitUntil: "networkidle2" });
  
      try {
        await page.waitForSelector("body", { timeout: 15000 });
      } 
      catch {
        // Do nothing
      }
  
      const html = await page.content();
  
      if (!previousHTML) {
        previousHTML = html;
        console.log(`${getTimestamp()} > ${chalk.cyan("Monitor initialized!")}`);
        return;
      }
  
      // Compare
      if (html !== previousHTML) {
        const diff = getDiff(previousHTML, html);
        console.log(`${getTimestamp()} > ${chalk.magenta(`Change(s) detected - ${diff}`)}`);
        if (diff.includes(""))
        sendDiscordPing(diff);
        previousHTML = html; // Update the snapshot
      } 
      else {
        console.log(`${getTimestamp()} > ${chalk.yellow("Monitoring...")}`);
      }
  
    } 
    catch (error) {
      console.log(`${getTimestamp()} > ${chalk.red(`Error: ${error.message}`)}`);
    }
  }  

  // Loop
  async function startLoop() {
    while (true) {
      await scrape();
      await new Promise((r) => setTimeout(r, checkDelay));
    }
  }

  startLoop();
})();