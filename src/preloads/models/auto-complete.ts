import { ipcRenderer } from 'electron';

import { Form } from './form';
import { searchElements } from '../utils';
import { windowId } from '../view-preload';

export class AutoComplete {
  public forms: Form[] = [];

  public currentForm: Form;

  public visible = false;

  public constructor() {
    this.checkFormAutofill();
    ipcRenderer.on(`check-form-autofill`, () => {
      console.log(`check-form-autofill-${windowId}`);
      this.checkFormAutofill();
    });
  }
  
  private checkFormAutofill() {
    requestAnimationFrame(() => {
      (async ()=>{
        const item = await ipcRenderer.invoke(`find-form-fill-update-${windowId}`);
        if(item) {
          for (let form of this.forms) {
            form.insertData(item, true);
          }
        }
      })();
    });
  }

  public loadForms = () => {
    try {
      const forms = searchElements(document, 'form') as HTMLFormElement[];
      //console.log("forms", forms);

      this.forms = forms.map((el) => new Form(el));
    } catch (e) {
      
    }
  };

  public onWindowMouseDown = () => {
    this.hide();
  };

  public hide() {
    if (this.visible) {
      this.visible = false;
      ipcRenderer.send(`form-fill-hide-${windowId}`);
    }
  }
}

export default new AutoComplete();
