import {ipcRenderer} from 'electron';

import {formFieldFilters} from '../constants';
import {isVisible, searchElements} from '../utils';
import {getFormFillValue} from '~/utils/form-fill';
import {IFormFillData} from '~/interfaces';
import AutoComplete from './auto-complete';
import {windowId} from '../view-preload';

export type FormField = HTMLInputElement | HTMLSelectElement;

export class Form {
  public data: IFormFillData;

  public changedFields: FormField[] = [];

  public tempFields: FormField[] = [];

  public ref: HTMLFormElement;

  public submitBlock = false;

  public constructor(ref: HTMLFormElement) {
    this.ref = ref;
    this.load();
  }

  public load() {
    for (const field of this.fields) {
      const {menu} = formFieldFilters;
      const isNameValid = menu.test(field.getAttribute('name'));

      if (field instanceof HTMLInputElement && isNameValid) {
        field.addEventListener('focus', this.onFieldFocus);
        field.addEventListener('input', this.onFieldInput);
        const typeAttr = field.getAttribute('type');
        if (typeAttr === 'password' || /password/i.test(field.getAttribute('name'))) {
          window.addEventListener('beforeunload', (event) => {
            this.onFormSubmit(event);
          });
        }
      }
    }

    this.ref.addEventListener('submit', this.onFormSubmit);
  }

  public get fields() {
    const id = this.ref.getAttribute('id');
    const inside = searchElements(this.ref, 'input') as FormField[];
    const outside = searchElements(
      document,
      `input[form=${id}]`,
    ) as FormField[];

    return [...inside, ...outside].filter((el) => this.validateField(el));
  }

  public validateField(field: FormField) {
    const {name, type} = formFieldFilters;
    const isNameValid = name.test(field.getAttribute('name'));
    const isTypeValid =
      type.test(field.getAttribute('type')) ||
      field instanceof HTMLSelectElement;

    return isVisible(field) && isNameValid && isTypeValid;
  }

  public insertData(data: IFormFillData, persistent = false) {
    const pwd = this.passwordField;
    if(!pwd) {
      return
    }
    const name = this.usernameField;
    if(name && data.fields.username && !name.value) {
      name.value = data.fields.username;
    }
    if(pwd && data.fields.password && !pwd.value) {
      pwd.value = data.fields.password;
    }
  }

  private clearTemp() {
    for (const field of this.tempFields) {
      if (this.changedFields.indexOf(field) === -1) {
        field.value = '';
      }
    }

    this.tempFields = [];
  }

  public get usernameField() {
    return this.fields.find((r) => {
      return /username|email|name|fname|mname|lname|phone|mobile/i.test(r.getAttribute('name'));
    });
  }

  public get passwordField() {
    return this.fields.find((r) => {
      const typeAttr = r.getAttribute('type');
      return typeAttr === 'password' || /password/i.test(r.getAttribute('name'));
    });
  }

  public onFormSubmit = (e: any) => {
    const username = (this.usernameField || {}).value;
    const password = (this.passwordField || {}).value;
    console.log("onFormSubmit", username, password);

    const sameUsername = this.data && username === this.data.fields.username;
    const samePassword = this.data && password === this.data.fields.password;

    if (!username.length || (sameUsername && samePassword)) return;

    ipcRenderer.send(`credentials-show-${windowId}`, {
      username,
      password,
      url: window.location.href,
      content: samePassword ? 'update' : 'save',
      oldUsername: this.data ? this.data.fields.username : username
    });
  };

  public onFieldFocus = (e: FocusEvent) => {
    const field = e.target as HTMLInputElement;
    const rects = field.getBoundingClientRect();

    AutoComplete.currentForm = this;
    AutoComplete.visible = true;

    ipcRenderer.send(
      `form-fill-show-${windowId}`,
      {
        width: rects.width,
        height: rects.height,
        x: Math.floor(rects.left),
        y: Math.floor(rects.top),
      },
      field.getAttribute('name'),
      field.value,
    );
  };

  public onFieldInput = (e: KeyboardEvent) => {
    AutoComplete.hide();

    const target = e.target as HTMLInputElement;
    const index = this.changedFields.indexOf(target);

    if (index === -1) {
      this.changedFields.push(target);
    } else if (!target.value.length) {
      this.changedFields.splice(index, 1);
    }
  };
}
