import puppeteer from 'puppeteer';

async function checkFlightStatus() {
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
  });

  try {
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('Navigating to Saudia website...');
    await page.goto('https://www.saudia.com/en-PK', {
      waitUntil: 'networkidle0',
      timeout: 60000
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Click on "Flight status" tab using the correct selector
    console.log('Clicking Flight status tab...');
    await page.evaluate(() => {
      // Find the span containing "Flight status" text
      const spans = Array.from(document.querySelectorAll('span'));
      const flightStatusSpan = spans.find(span => 
        span.textContent && span.textContent.trim() === 'Flight status'
      );
      if (flightStatusSpan) {
        // Click on the parent tab element
        let parent = flightStatusSpan.parentElement;
        while (parent && !parent.classList.contains('mat-tab-label')) {
          parent = parent.parentElement;
        }
        if (parent) {
          parent.click();
          console.log('Found and clicked Flight status tab');
        }
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Click "Flight number" radio button using the correct selector
    console.log('Selecting Flight number radio...');
    await page.evaluate(() => {
      // Find the radio input with value="flight-number"
      const radioInput = document.querySelector('input[type="radio"][value="flight-number"]');
      if (radioInput) {
        // Click the label instead of the input directly
        const label = radioInput.closest('label.mat-radio-label');
        if (label) {
          label.click();
          console.log('Found and clicked Flight number radio');
        } else {
          radioInput.click();
        }
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Enter flight number 796
    console.log('Entering flight number 796...');
    await page.evaluate(() => {
      // Look for the flight number input field
      const input = document.querySelector('input[formcontrolname="flightNo"]') || 
                   document.querySelector('input[name="flightnumber"]') ||
                   document.querySelector('#mat-input-3');
      if (input) {
        input.focus();
        input.value = '796';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        console.log('Entered flight number: 796');
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click on date picker - find the calendar icon
    console.log('Opening date picker...');
    await page.evaluate(() => {
      // Look for the calendar icon
      const calendarIcon = document.querySelector('.material-icons.ngx-daterangepicker-action') ||
                          document.querySelector('span.material-icons:has-text("today")') ||
                          document.querySelector('.ngx-daterangepicker-action');
      if (calendarIcon) {
        calendarIcon.click();
        console.log('Clicked date picker icon');
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Select October 5, 2025
    console.log('Selecting October 5, 2025...');
    const dateSelected = await page.evaluate(() => {
      // Find all td elements with role="button"
      const dateCells = Array.from(document.querySelectorAll('td[role="button"]'));
      
      // Look for October 5, 2025
      const oct5Cell = dateCells.find(cell => {
        const ariaLabel = cell.getAttribute('aria-label');
        if (!ariaLabel) return false;
        
        // Check if it's October 5, 2025
        const isOct5 = ariaLabel.includes('5th October 2025') || 
                       ariaLabel.includes('Sunday, 5th October 2025');
        
        // Make sure it's not November (to avoid confusion)
        const isNotNovember = !ariaLabel.includes('November');
        
        // Check if it's not disabled
        const isAvailable = cell.classList.contains('available') && 
                           !cell.classList.contains('disabled');
        
        return isOct5 && isNotNovember;
      });
      
      if (oct5Cell) {
        oct5Cell.click();
        console.log('Found and clicked October 5, 2025');
        return true;
      }
      
      // If not found, try to find by the span containing "5"
      const spans = Array.from(document.querySelectorAll('td.available span'));
      const oct5Span = spans.find(span => span.textContent === '5');
      if (oct5Span) {
        oct5Span.closest('td').click();
        console.log('Clicked date 5 via span');
        return true;
      }
      
      return false;
    });
    
    if (!dateSelected) {
      console.log('Warning: Could not find October 5, 2025 in calendar');
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click Confirm button
    console.log('Confirming date...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const confirmBtn = buttons.find(btn => 
        btn.textContent.trim().toLowerCase() === 'confirm' ||
        btn.classList.contains('btn')
      );
      if (confirmBtn) {
        confirmBtn.click();
        console.log('Clicked Confirm button');
      }
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Click "Check status" button
    console.log('Clicking Check status button...');
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const checkBtn = buttons.find(btn => 
        btn.textContent.includes('Check status') ||
        btn.querySelector('span')?.textContent.includes('Check status')
      );
      if (checkBtn) {
        checkBtn.click();
        console.log('Clicked Check status button');
      }
    });
    
    console.log('Waiting for results...');
    await new Promise(resolve => setTimeout(resolve, 7000));

    // Extract flight information with the correct selectors
    console.log('\n=== FLIGHT STATUS RESULTS ===\n');
    
    const flightInfo = await page.evaluate(() => {
      const results = {};
      
      // Find the flight record card
      const flightCard = document.querySelector('.mat-card.flightRecord') || 
                        document.querySelector('.flightRecord');
      
      if (!flightCard) {
        return { error: 'No flight record found' };
      }
      
      // Extract departure info
      const fromCity = flightCard.querySelector('.from-city')?.textContent?.trim();
      const depTime = flightCard.querySelector('.dep-time')?.textContent?.trim();
      
      // Extract arrival info
      const toCity = flightCard.querySelector('.to-city')?.textContent?.trim();
      const arrTime = flightCard.querySelector('.arr-time')?.textContent?.trim();
      
      // Extract flight details
      const stopCount = flightCard.querySelector('.stop-count')?.textContent?.trim();
      const duration = flightCard.querySelector('.duration')?.textContent?.trim();
      const flightNumber = flightCard.querySelector('.cabinFlightNumber')?.textContent?.trim();
      
      // Extract flight status - using the correct selector
      const flightStatus = flightCard.querySelector('.flight-status-ontime')?.textContent?.trim() ||
                          flightCard.querySelector('.cabinFlightStatus')?.textContent?.trim();
      
      results.flightNumber = flightNumber || 'N/A';
      results.route = `${fromCity || 'N/A'} → ${toCity || 'N/A'}`;
      results.departure = `${fromCity || 'N/A'} at ${depTime || 'N/A'}`;
      results.arrival = `${toCity || 'N/A'} at ${arrTime || 'N/A'}`;
      results.duration = duration || 'N/A';
      results.stops = stopCount || 'N/A';
      results.status = flightStatus || 'N/A';
      
      // Additional debug info
      console.log('Found flight card:', !!flightCard);
      console.log('HTML snippet:', flightCard ? flightCard.innerHTML.substring(0, 200) : 'N/A');
      
      return results;
    });

    if (flightInfo.error) {
      console.log('Error:', flightInfo.error);
      
      // Try to debug what's on the page
      const pageContent = await page.evaluate(() => {
        const hasFlightRecord = !!document.querySelector('.flightRecord');
        const hasMatCard = !!document.querySelector('.mat-card');
        const bodyText = document.body.innerText.substring(0, 500);
        return {
          hasFlightRecord,
          hasMatCard,
          bodySnippet: bodyText
        };
      });
      
      console.log('Debug info:', pageContent);
    } else {
      console.log('Flight Number:', flightInfo.flightNumber);
      console.log('Route:', flightInfo.route);
      console.log('Departure:', flightInfo.departure);
      console.log('Arrival:', flightInfo.arrival);
      console.log('Duration:', flightInfo.duration);
      console.log('Stops:', flightInfo.stops);
      console.log('Status:', flightInfo.status);
    }
    
    // Take screenshot
    await page.screenshot({ path: 'flight-status-result.png', fullPage: true });
    console.log('\nScreenshot saved as flight-status-result.png');

    return flightInfo;

  } catch (error) {
    console.error('Error occurred:', error.message);
    console.error('Stack trace:', error.stack);
    
    try {
      const pages = await browser.pages();
      if (pages.length > 0) {
        await pages[0].screenshot({ path: 'error-screenshot.png', fullPage: true });
        console.log('Error screenshot saved as error-screenshot.png');
      }
    } catch (e) {
      console.log('Could not take error screenshot');
    }
    
    throw error;
  } finally {
    console.log('\nKeeping browser open for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    await browser.close();
  }
}

checkFlightStatus()
  .then(results => {
    console.log('\n=== Script completed successfully ===');
  })
  .catch(error => {
    console.error('\n=== Script failed ===');
    console.error(error);
    process.exit(1);
  });