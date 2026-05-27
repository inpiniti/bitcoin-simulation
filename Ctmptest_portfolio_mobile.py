from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # Mobile viewport (iPhone 12)
    page = browser.new_page(viewport={"width": 390, "height": 844})

    page.goto('http://localhost:3000/portfolio', wait_until='networkidle', timeout=30000)
    time.sleep(1)

    # Take screenshot
    page.screenshot(path='C:\tmp\portfolio_mobile.png', full_page=True)

    browser.close()
    print("Mobile screenshot saved to C:\tmp\portfolio_mobile.png")
