import gui from 'gui';
import semverCompare from 'semantic-compare';
import {Signal} from 'typed-signals';

import {ConfigStoreItem} from '../model/config-store';

const ONE_DAY = 1000 * 60 * 60 * 24;

interface AutoUpdaterData {
  latestVersion?: string;
  lastCheckTime?: string;
}

// Currently this class only acts as a version checker.
export class AutoUpdater extends ConfigStoreItem {
  onCheckVersion: Signal<(options: {reportResult: boolean}, isChecking: boolean) => void> = new Signal;

  currentVersion = require('../../package.json').version;
  latestVersion?: string;
  isCheckingLatestVersion?: boolean;

  #lastCheckTime?: Date;
  #versionCheckerTimer?: NodeJS.Timeout;

  deserialize(data: AutoUpdaterData) {
    if (!data)  // accepts empty data
      data = {};
    if (data.latestVersion &&
        semverCompare(data.latestVersion, this.currentVersion) > 0)
      this.latestVersion = data.latestVersion;
    if (data.lastCheckTime)
      this.#lastCheckTime = new Date(data.lastCheckTime);
    // Start version checker after deserialization, there is a little delay so
    // we don't do too much work on startup.
    const check = this.checkLatestVersion.bind(this, {reportResult: false});
    const passedTime = Date.now() - Number(this.#lastCheckTime ?? 0);
    if (passedTime > ONE_DAY)
      setTimeout(check, 1000 * 10);
    else
      setTimeout(check, ONE_DAY - passedTime);
  }

  serialize() {
    const data: AutoUpdaterData = {};
    if (this.latestVersion)
      data.latestVersion = this.latestVersion;
    if (this.#lastCheckTime)
      data.lastCheckTime = this.#lastCheckTime.toJSON();
    return data;
  }

  async checkLatestVersion(options: {reportResult?: boolean}) {
    if (this.isCheckingLatestVersion)
      return;

    // Cancel pending check.
    clearTimeout(this.#versionCheckerTimer);

    const reportResult = options.reportResult ?? false;
    this.isCheckingLatestVersion = true;
    this.onCheckVersion.emit({reportResult}, true);

    // Fetch and parse the remote latest_version.json file.
    const params = new URLSearchParams({
      version: this.currentVersion,
      platform: process.platform,
      locale: gui.Locale.getCurrentIdentifier(),
    });
    const versionUrl = new URL('https://chieapp.com/latest_version.json');
    versionUrl.search = params.toString();
    try {
      const response = await fetch(versionUrl);
      const {version} = await response.json();
      if (semverCompare(version, this.currentVersion) > 0)
        this.latestVersion = version;
      else
        this.latestVersion = null;
    } catch (error) {
      this.latestVersion = undefined;
      console.error('Failed to fetch latest version:', versionUrl);
    }

    // Check version at 1 day interval.
    this.#lastCheckTime = new Date();
    this.#versionCheckerTimer = setTimeout(this.checkLatestVersion.bind(this), ONE_DAY);
    this.isCheckingLatestVersion = false;
    this.saveConfig();

    this.onCheckVersion.emit({reportResult}, false);
  }
}

export default new AutoUpdater();
