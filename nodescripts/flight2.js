import express from "express";
import nodemailer from "nodemailer";
import puppeteer from "puppeteer";
import cron from "node-cron";

const app = express();
const PORT = 3000;

// --- Utility: scrape flight info ---
async function getFlightInfo() {
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-infobars',
      '--disable-blink-features=AutomationControlled',
      '--no-default-browser-check',
      '--disable-default-apps',
      '--disable-popup-blocking',
      '--disable-translate',
      '--disable-background-media-track',
      '--disable-ipc-flooding-protection',
      '--window-size=1920,1080'
    ],
    ignoreHTTPSErrors: true,
    ignoreDefaultArgs: ['--enable-automation']
  });  const page = await browser.newPage();
  await page.goto("https://www.google.com");

  try {
    await page.click('button[aria-label="Accept all"]');
  } catch (e) {}

  await page.type('textarea[name="q"]', "sv 796 flight status");
  await page.keyboard.press("Enter");
  await page.waitForNavigation({ waitUntil: "networkidle0" });

  await page.waitForSelector("div.OcpZAb", { timeout: 10000 });
  const flightInfo = await page.evaluate(() => {
    const container = document.querySelector("div.OcpZAb");
    return container ? container.innerText : "No flight info found";
  });

  await browser.close();
  return flightInfo;
}

// --- Utility: format HTML email ---
function formatEmail(flightInfo) {
  // Extract times (basic parsing as before)
  const match = flightInfo.match(/Scheduled arrival\s+([\d:]+ ?(am|pm))/i);
  let scheduledArrival = match ? match[1] : null;

  let statusTag = `<span style="background:#28a745;color:#fff;padding:6px 12px;border-radius:20px;font-size:13px;font-weight:bold;">🟢 ON TIME</span>`;
  if (scheduledArrival) {
    let [time, meridian] = scheduledArrival.split(" ");
    let [hour, minute] = time.split(":").map(Number);
    if (meridian.toLowerCase() === "pm" && hour !== 12) hour += 12;
    if (meridian.toLowerCase() === "am" && hour === 12) hour = 0;
    const arrivalMinutes = hour * 60 + minute;
    const lowerBound = 9 * 60;      // 9:00am
    const upperBound = 10 * 60 + 20; // 10:20am
    if (arrivalMinutes < lowerBound || arrivalMinutes > upperBound) {
      statusTag = `<span style="background:#dc3545;color:#fff;padding:6px 12px;border-radius:20px;font-size:13px;font-weight:bold;">🔴 DELAYED</span>`;
    }
  }

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:650px;margin:auto;padding:20px;border:1px solid #ddd;border-radius:12px;background:#f5f7fa;">
    <h2 style="text-align:center;color:#222;margin-bottom:20px;">✈️ Flight Status Update</h2>
    
    <div style="background:#fff;padding:20px;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,0.08);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
        <h3 style="margin:0;color:#007bff;">Saudi Airlines – SV 796</h3>
        ${statusTag}
      </div>

      <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;font-size:14px;color:#333;">
        <tr style="background:#f0f4f9;">
          <th align="left">Departure</th>
          <th align="center">Duration</th>
          <th align="right">Arrival</th>
        </tr>
        <tr>
          <td style="padding-top:12px;">
            <div style="font-size:18px;font-weight:bold;color:#111;">2:45 AM</div>
            <div style="color:#555;">Jeddah (JED)</div>
            <div style="font-size:12px;color:#999;">Terminal 1</div>
          </td>
          <td align="center" style="font-size:14px;color:#666;">
            5h 10m
          </td>
          <td style="text-align:right;padding-top:12px;">
            <div style="font-size:18px;font-weight:bold;color:#111;">9:55 AM</div>
            <div style="color:#555;">Peshawar (PEW)</div>
            <div style="font-size:12px;color:#999;">Terminal –</div>
          </td>
        </tr>
      </table>

      <div style="margin-top:20px;font-size:12px;color:#666;text-align:center;">
        Updated automatically • Source: Google / Cirium
      </div>
    </div>
  </div>
  `;
}


// --- Utility: send email ---
async function sendEmail(to, flightInfo) {
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "huzaifa084567@gmail.com", // your gmail
      pass: "jqnh prfq uiur dvwy",     // Gmail App Password
    },
  });

  const htmlContent = formatEmail(flightInfo);

  let info = await transporter.sendMail({
    from: '"Flight Tracker" <huzaifa084567@gmail.com>',
    to: to || "huzaifa084567@gmail.com",
    subject: "✈️ SV 796 Flight Status Update",
    text: flightInfo,
    html: htmlContent,
  });

  return info.messageId;
}

// --- API route to trigger manually ---
app.get("/send-flight-email", async (req, res) => {
  const { email } = req.query;
  try {
    const flightInfo = await getFlightInfo();
    const messageId = await sendEmail(email, flightInfo);
    res.send({ success: true, messageId, flightInfo });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error sending flight info");
  }
});

// --- Cron: every 2 hours ---
cron.schedule("0 */2 * * *", async () => {
  try {
    console.log("⏰ Running scheduled job...");
    const flightInfo = await getFlightInfo();
    await sendEmail("huzaifa084567@gmail.com", flightInfo);
    console.log("✅ Flight info email sent");
  } catch (err) {
    console.error("❌ Error in scheduled job:", err);
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
