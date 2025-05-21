# Ark Nova Logs Extension

This extension automatically collects BGA logs for Ark Nova games and upload it to be analyzed.

## Installation

1. Download the repository as zip
2. Extract to a folder
3. Google Chrome
    3.1 Go to `chrome://extensions/`
    3.2 Enable Developer mode (top right corner)
    3.3 Select `Load unpacked`
    3.4 Navigate to the `chrome` folder inside `ark-nova-logs-ext` and click `Select Folder`
4. Firefox
    4.1 Go to `about:debugging#/runtime/this-firefox`
    4.2 Click on `Load Temporary Add-on`
    4.3 Select `manifest` or `manifest.json` inside the `firefox` folder in `ark-nova-logs-ext` and click `Open`

## Usage

Click on the Humphead Wrasse icon once to enable/disable the extension. The working status is shown by the ON/OFF text over the icon. While enabled, the extension will occasionally opens random Ark Nova games on different tabs to collect the logs and automatically closes those tabs once it is done with the collection.
