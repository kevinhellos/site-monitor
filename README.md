# site-monitor
Monitor any changes or update made to any site and get notified immediately

## How it works
- It works by scraping the site and saving the initial snapshot
- The subsequent scrape compares the scraping result to the previously saved snapshot and detect any changes

## Future enhancement
- Add support for proxy rotation in the event that the site blocks you from scraping
- Add a captcha handling support for site with heavy antibot