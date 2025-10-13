import puppeteer from 'puppeteer';

/**
 * TempMail Service - Automates temp-mail.org operations
 * Supports email creation, reading, and management
 */
export class TempMailService {
  constructor(options = {}) {
    this.browser = null;
    this.page = null;
    this.currentEmail = null;
    this.baseUrl = 'https://temp-mail.org/en/';
    this.options = {
      headless: options.headless ?? false,
      slowMo: options.slowMo ?? 50,
      timeout: options.timeout ?? 30000,
      ...options
    };
  }

  /**
   * Initialize browser and navigate to temp-mail.org
   */
  async initialize() {
    console.log('🚀 Launching browser...');
    
    this.browser = await puppeteer.launch({
      headless: this.options.headless,
      slowMo: this.options.slowMo,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ],
      defaultViewport: {
        width: 1280,
        height: 900
      }
    });
    
    this.page = await this.browser.newPage();
    
    // Set user agent to avoid detection
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // Add extra headers
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });
    
    console.log('📧 Navigating to temp-mail.org...');
    
    try {
      await this.page.goto(this.baseUrl, {
        waitUntil: 'networkidle2',
        timeout: this.options.timeout
      });
      
      // Wait for page to fully load
      await this.page.waitForSelector('body', { timeout: 10000 });
      await this.sleep(2000);
      
      console.log('✅ Page loaded successfully');
    } catch (error) {
      console.error('❌ Error navigating to page:', error.message);
      throw error;
    }
  }

  /**
   * Get the current temporary email address
   */
  async getEmailAddress() {
    try {
      console.log('📬 Fetching email address...');
      
      // Try multiple selectors as the site structure may vary
      const selectors = [
        '#mail',
        'input[id="mail"]',
        'input[type="text"][readonly]',
        '.email-address',
        '#email'
      ];
      
      for (const selector of selectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          this.currentEmail = await this.page.$eval(selector, el => el.value || el.textContent);
          
          if (this.currentEmail && this.currentEmail.includes('@')) {
            console.log('✅ Email address retrieved:', this.currentEmail);
            return this.currentEmail;
          }
        } catch (e) {
          continue;
        }
      }
      
      // Fallback: try to find any input with email pattern
      const emailInput = await this.page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input[type="text"], input[readonly]'));
        const emailInput = inputs.find(input => {
          const value = input.value || input.textContent;
          return value && value.includes('@') && value.includes('.');
        });
        return emailInput ? emailInput.value : null;
      });
      
      if (emailInput) {
        this.currentEmail = emailInput;
        console.log('✅ Email address retrieved:', this.currentEmail);
        return this.currentEmail;
      }
      
      throw new Error('Could not find email address on page');
      
    } catch (error) {
      console.error('❌ Error getting email:', error.message);
      
      // Take screenshot for debugging
      await this.page.screenshot({ path: 'debug-email-error.png' });
      console.log('📸 Debug screenshot saved as debug-email-error.png');
      
      throw error;
    }
  }

  /**
   * Copy email address to clipboard
   */
  async copyEmailToClipboard() {
    try {
      const copySelectors = [
        '#click-to-copy',
        'button[class*="copy"]',
        '.copy-button',
        'button[title*="Copy"]'
      ];
      
      for (const selector of copySelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            await button.click();
            console.log('📋 Email copied to clipboard');
            await this.sleep(500);
            return true;
          }
        } catch (e) {
          continue;
        }
      }
      
      console.log('ℹ️  Copy button not found');
      return false;
    } catch (error) {
      console.error('❌ Error copying email:', error.message);
      return false;
    }
  }

  /**
   * Generate a new email address
   */
  async changeEmail() {
    try {
      console.log('🔄 Generating new email address...');
      
      const refreshSelectors = [
        '#click-to-refresh',
        'button[class*="refresh"]',
        '.refresh-button',
        'button[title*="Refresh"]',
        'a[href*="refresh"]'
      ];
      
      for (const selector of refreshSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            await button.click();
            await this.sleep(3000);
            return await this.getEmailAddress();
          }
        } catch (e) {
          continue;
        }
      }
      
      // Fallback: reload page
      console.log('⚠️  Refresh button not found, reloading page...');
      await this.page.reload({ waitUntil: 'networkidle2' });
      await this.sleep(2000);
      return await this.getEmailAddress();
      
    } catch (error) {
      console.error('❌ Error changing email:', error.message);
      throw error;
    }
  }

  /**
   * Wait for emails to arrive
   */
  async waitForEmails(timeoutSeconds = 60, checkInterval = 3) {
    console.log(`⏳ Waiting for emails (timeout: ${timeoutSeconds}s, checking every ${checkInterval}s)...`);
    
    const startTime = Date.now();
    let checkCount = 0;
    
    while ((Date.now() - startTime) / 1000 < timeoutSeconds) {
      checkCount++;
      console.log(`🔍 Check #${checkCount}...`);
      
      try {
        await this.page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
        await this.sleep(1000);
      } catch (e) {
        console.log('⚠️  Reload timed out, continuing...');
      }
      
      const emails = await this.getEmails();
      
      if (emails.length > 0) {
        console.log(`✉️  Found ${emails.length} email(s)!`);
        return emails;
      }
      
      await this.sleep(checkInterval * 1000);
    }
    
    console.log('⏰ Timeout reached, no emails received');
    return [];
  }

  /**
   * Get all emails in the inbox
   */
  async getEmails() {
    try {
      // Possible selectors for email list items
      const listSelectors = [
        '.inbox-dataList .inbox-data-item',
        '.message-list .message-item',
        '[class*="inbox"] [class*="item"]',
        '.mail-item',
        'ul.inbox li',
        'div[class*="email-list"] > div'
      ];
      
      let emailElements = [];
      
      for (const selector of listSelectors) {
        emailElements = await this.page.$$(selector);
        if (emailElements.length > 0) break;
      }
      
      if (emailElements.length === 0) {
        // Check if there's a "no messages" indicator
        const noMessages = await this.page.evaluate(() => {
          const body = document.body.textContent.toLowerCase();
          return body.includes('no messages') || 
                 body.includes('inbox is empty') ||
                 body.includes('no emails');
        });
        
        if (noMessages) {
          return [];
        }
        
        // Take screenshot for debugging
        await this.page.screenshot({ path: 'debug-no-emails.png' });
        console.log('📸 Debug screenshot saved as debug-no-emails.png');
        
        return [];
      }

      const emails = [];
      
      for (let i = 0; i < emailElements.length; i++) {
        const email = await this.page.evaluate((index, selector) => {
          const items = document.querySelectorAll(selector);
          const item = items[index];
          
          if (!item) return null;
          
          // Try to find sender, subject, and time
          const findText = (selectors) => {
            for (const sel of selectors) {
              const el = item.querySelector(sel);
              if (el) return el.textContent.trim();
            }
            return 'Unknown';
          };
          
          const from = findText([
            '.inbox-data-from',
            '[class*="from"]',
            '[class*="sender"]',
            '.sender',
            '.from'
          ]);
          
          const subject = findText([
            '.inbox-data-subject',
            '[class*="subject"]',
            '.subject',
            '.title'
          ]);
          
          const time = findText([
            '.inbox-data-time',
            '[class*="time"]',
            '[class*="date"]',
            '.time',
            '.date'
          ]);
          
          return { from, subject, time, index };
        }, i, listSelectors.find(sel => emailElements.length > 0) || listSelectors[0]);
        
        if (email && email.from !== 'Unknown') {
          emails.push(email);
        }
      }
      
      return emails;
    } catch (error) {
      console.error('❌ Error getting emails:', error.message);
      return [];
    }
  }

  /**
   * Read a specific email
   */
  async readEmail(index = 0) {
    try {
      console.log(`📖 Reading email at index ${index}...`);
      
      // Get email elements
      const listSelectors = [
        '.inbox-dataList .inbox-data-item',
        '.message-list .message-item',
        '[class*="inbox"] [class*="item"]',
        '.mail-item'
      ];
      
      let emailElements = [];
      let usedSelector = '';
      
      for (const selector of listSelectors) {
        emailElements = await this.page.$$(selector);
        if (emailElements.length > 0) {
          usedSelector = selector;
          break;
        }
      }
      
      if (index >= emailElements.length) {
        console.log('❌ Email index out of range');
        return null;
      }
      
      // Click on the email
      await emailElements[index].click();
      await this.sleep(2000);
      
      // Wait for email content to load
      const contentSelectors = [
        '.inbox-message',
        '.message-content',
        '[class*="message-body"]',
        '.email-content'
      ];
      
      let contentLoaded = false;
      for (const selector of contentSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          contentLoaded = true;
          break;
        } catch (e) {
          continue;
        }
      }
      
      if (!contentLoaded) {
        console.log('⚠️  Could not find email content');
      }
      
      // Extract email content
      const emailContent = await this.page.evaluate(() => {
        const findText = (selectors) => {
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return el.textContent.trim();
          }
          return 'Not found';
        };
        
        const from = findText([
          '.inbox-message-header-from',
          '[class*="from"]',
          '.sender',
          '.from'
        ]);
        
        const subject = findText([
          '.inbox-message-header-subject',
          '[class*="subject"]',
          '.subject'
        ]);
        
        const body = findText([
          '.inbox-message-body',
          '[class*="message-body"]',
          '[class*="email-body"]',
          '.content',
          '.body'
        ]);
        
        // Try to get HTML body as well
        const bodyHtml = document.querySelector('.inbox-message-body, [class*="message-body"]');
        
        return {
          from,
          subject,
          body,
          bodyHtml: bodyHtml ? bodyHtml.innerHTML : ''
        };
      });
      
      console.log('\n📧 Email Details:');
      console.log('═'.repeat(50));
      console.log('From:', emailContent.from);
      console.log('Subject:', emailContent.subject);
      console.log('─'.repeat(50));
      console.log('Body:', emailContent.body);
      console.log('═'.repeat(50));
      console.log('\n');
      
      return emailContent;
    } catch (error) {
      console.error('❌ Error reading email:', error.message);
      await this.page.screenshot({ path: 'debug-read-email-error.png' });
      console.log('📸 Debug screenshot saved');
      return null;
    }
  }

  /**
   * Delete an email
   */
  async deleteEmail(index = 0) {
    try {
      console.log(`🗑️  Deleting email at index ${index}...`);
      
      // First, read/click the email
      await this.readEmail(index);
      await this.sleep(1000);
      
      // Try to find and click delete button
      const deleteSelectors = [
        '.inbox-message-delete',
        'button[class*="delete"]',
        '[title*="Delete"]',
        '.delete-button'
      ];
      
      for (const selector of deleteSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            await button.click();
            await this.sleep(1000);
            console.log('✅ Email deleted');
            return true;
          }
        } catch (e) {
          continue;
        }
      }
      
      console.log('⚠️  Delete button not found');
      return false;
    } catch (error) {
      console.error('❌ Error deleting email:', error.message);
      return false;
    }
  }

  /**
   * Download email attachments
   */
  async downloadAttachment() {
    try {
      const attachmentSelectors = [
        '.inbox-message-attachment',
        '[class*="attachment"]',
        'a[download]',
        '.download-link'
      ];
      
      for (const selector of attachmentSelectors) {
        const attachmentBtn = await this.page.$(selector);
        if (attachmentBtn) {
          console.log('📎 Downloading attachment...');
          await attachmentBtn.click();
          await this.sleep(2000);
          console.log('✅ Attachment download initiated');
          return true;
        }
      }
      
      console.log('ℹ️  No attachments found');
      return false;
    } catch (error) {
      console.error('❌ Error downloading attachment:', error.message);
      return false;
    }
  }

  /**
   * Get page HTML for debugging
   */
  async getPageHTML() {
    return await this.page.content();
  }

  /**
   * Take a screenshot
   */
  async screenshot(filename = 'screenshot.png') {
    await this.page.screenshot({ path: filename, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Close the browser
   */
  async close() {
    if (this.browser) {
      console.log('👋 Closing browser...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Get current email (without fetching from page)
   */
  getCurrentEmail() {
    return this.currentEmail;
  }
}

/**
 * Example usage function
 */
export async function example() {
  const tempMail = new TempMailService({
    headless: false, // Set to true for background operation
    slowMo: 50,      // Slow down actions for visibility
    timeout: 30000   // 30 seconds timeout
  });
  
  try {
    // Initialize
    await tempMail.initialize();
    
    // Get email address
    const email = await tempMail.getEmailAddress();
    await tempMail.copyEmailToClipboard();
    
    console.log('\n' + '═'.repeat(60));
    console.log('📧 YOUR TEMPORARY EMAIL:', email);
    console.log('═'.repeat(60));
    console.log('Use this email for registrations, then wait for messages...\n');
    
    // Wait for emails (60 seconds)
    const emails = await tempMail.waitForEmails(60, 3);
    
    if (emails.length > 0) {
      // Display inbox
      console.log('\n📬 INBOX:');
      console.log('─'.repeat(60));
      emails.forEach((email, index) => {
        console.log(`\n${index + 1}. From: ${email.from}`);
        console.log(`   Subject: ${email.subject}`);
        console.log(`   Time: ${email.time}`);
      });
      console.log('─'.repeat(60) + '\n');
      
      // Read first email
      await tempMail.readEmail(0);
      
      // Check for attachments
      await tempMail.downloadAttachment();
    } else {
      console.log('\n📭 No emails received during waiting period\n');
    }
    
    // Keep browser open for manual interaction
    console.log('✨ Browser will remain open. Press Ctrl+C to exit.\n');
    console.log('You can:');
    console.log('  - Send test emails to:', email);
    console.log('  - Manually interact with the page');
    console.log('  - Check for more messages\n');
    
    // Wait 5 minutes before auto-closing
    await tempMail.sleep(300000);
    
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    await tempMail.screenshot('error-screenshot.png');
  } finally {
    // Uncomment to auto-close browser
    // await tempMail.close();
  }
}

// Run example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  example();
}

export default TempMailService;