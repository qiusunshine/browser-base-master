import {observable, action, computed, makeObservable} from 'mobx';
import {ipcRenderer} from 'electron';

import {ISettings} from '~/interfaces';
import {DEFAULT_SETTINGS} from '~/constants';
import {Store} from '.';
import {updateStoreNewTab, updateStoreNewTabTemp} from "~/common/webui";

export type SettingsSection =
  | 'appearance'
  | 'autofill'
  | 'address-bar'
  | 'privacy'
  | 'permissions'
  | 'startup'
  | 'language'
  | 'shortcuts'
  | 'downloads'
  | 'system';

export class SettingsStore {
  public selectedSection: SettingsSection = 'appearance';

  public object: ISettings = DEFAULT_SETTINGS;

  public store: Store;

  public constructor(store: Store) {
    makeObservable(this, {
      selectedSection: observable,
      object: observable,
      searchEngine: computed,
      updateSettings: action,
    });

    this.store = store;

    let firstTime = false;

    ipcRenderer.send('get-settings');

    ipcRenderer.on('update-settings', (e, settings: ISettings) => {
      this.updateSettings(settings);
      if (!firstTime) {
        store.startupTabs.load();
        firstTime = true;
      }
    });

    ipcRenderer.on('update-newtab-url', (e, newtab: string, url: string) => {
      updateStoreNewTab(newtab);
      updateStoreNewTabTemp(url);
      this.object = {...this.object, newtab: newtab};
    });
  }

  public get searchEngine() {
    return this.object.searchEngines[this.object.searchEngine];
  }

  public updateSettings(newSettings: ISettings) {
    //console.log("updateSettings", newSettings.newtab);
    const prevState = {...this.object};
    this.object = {...this.object, ...newSettings};
    if (newSettings.newtab != prevState.newtab) {
      updateStoreNewTab(newSettings.newtab);
    }

    if (prevState.topBarVariant !== newSettings.topBarVariant) {
      requestAnimationFrame(() => {
        this.store.tabs.updateTabsBounds(true);
      });
    }
  }

  public async save() {
    ipcRenderer.send('save-settings', {
      settings: JSON.stringify(this.object),
    });
  }
}
