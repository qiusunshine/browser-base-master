import {ipcRenderer} from 'electron';
import {makeObservable, observable} from 'mobx';
import * as React from 'react';
import {DialogStore} from '~/models/dialog-store';

export class Store extends DialogStore {
  public titleRef = React.createRef<HTMLInputElement>();

  public list: any[] = [];
  public adListUrls: String = "";
  public filterCount = 0;

  public constructor() {
    super();
    makeObservable(this, {
      list: observable,
      adListUrls: observable,
      filterCount: observable
    });
    (async () => {
      this.adListUrls = await ipcRenderer.invoke('get-ad-lists');
      this.filterCount = await ipcRenderer.invoke('get-ad-filter-count');
      console.log("get-ad-lists2");
    })();
    ipcRenderer.on('data', async (e, data) => {
      this.list = data.data;
      this.filterCount = data.count;
    });
  }

}

export default new Store();
