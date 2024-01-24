import { ipcRenderer } from 'electron';
import { makeObservable, observable } from 'mobx';
import { DialogStore } from '~/models/dialog-store';

export class Store extends DialogStore {
  public videoUrls: string[] = [];
  public tabId: number = 0;

  public constructor() {
    super();

    makeObservable(this, {
      videoUrls: observable,
      tabId: observable,
    });

    ipcRenderer.on('data', async (e, data) => {
      const { videoUrls, tabId } = data;
      this.videoUrls = videoUrls;
      this.tabId = tabId;
    });
  }
}

export default new Store();
