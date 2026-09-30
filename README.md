# D's Torn Tools

A collection of Tampermonkey userscripts I built for use with Torn.

The tools are designed to provide information and decision support only. They do not automatically buy or sell items or stocks, perform attacks, train, travel, bypass CAPTCHA, or perform other gameplay actions for the player.

## Scripts

### D's Torn Item Flipper

Analyzes Torn Item Market data to identify potential profitable flips.

Features include:
- Item Market analysis
- Profit and ROI calculations
- Recommended purchase quantities
- Resale support/liquidity checks
- Opportunity scoring
- Locally saved scan results

The script provides recommendations only and does not automatically purchase, list, or sell items.

### D's Torn Stock Advisor

Provides stock portfolio and market decision support.

Features include:
- Portfolio analysis
- Stock comparison
- Buy/sell decision support
- Investment budget analysis
- ROI and payback calculations

The script does not automatically purchase or sell stocks.

### D's Torn Stock Predictor

Analyzes Torn stock data to identify trends and potential opportunities.

The Stock Predictor was rebuilt to use Torn API v2 for stock data.

Features include:
- Stock trend analysis
- Opportunity rankings
- Historical chart analysis
- Locally stored prediction history
- Backtesting
- Current-stock and market-wide analysis

The previous non-API chart request system has been removed.

## API Privacy

Where an API key is required:

- The API key is stored locally in the user's browser.
- The key is sent only to Torn's official API.
- API keys are not sent to me or to third parties.
- Retrieved data may be stored locally in the user's browser for analysis, history, and backtesting.
- Scripts request only the API access needed for their functionality.

## Compliance

These scripts are intended to comply with Torn's scripting and API rules.

They are designed as analysis and decision-support tools rather than gameplay automation.

The Stock Predictor was updated in September 2026 to remove its previous non-API stock chart requests and use Torn API v2 stock data instead.

## Status

These tools are currently under development and testing.

Source code is provided publicly in this repository for review.
