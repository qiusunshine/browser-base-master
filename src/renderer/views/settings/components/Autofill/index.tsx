import * as React from 'react';
import { observer } from 'mobx-react-lite';

import store from '../../store';
import {
  ContextMenu,
  ContextMenuItem,
} from '~/renderer/components/ContextMenu';
import { Passwords } from './Passwords';
import { Addresses } from './Addresses';
import {Control, Header, Row, Title} from '../App/style';
import { ICON_EDIT, ICON_TRASH } from '~/renderer/constants';
import {onSwitchChange} from "~/renderer/views/settings/utils";
import {Switch} from "~/renderer/components/Switch";

const onEditClick = () => {
  store.dialogContent = 'edit-address';
};

const onRemoveClick = () => {
  const item = store.autoFill.selectedItem;
  store.autoFill.removeItem(item);
};

const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
  e.stopPropagation();
};

const Menu = observer(() => {
  const item = store.autoFill.selectedItem;

  const style: any = {
    top: store.autoFill.menuTop,
    left: store.autoFill.menuLeft - 130,
    position: 'fixed',
  };

  return (
    <ContextMenu
      onMouseDown={onMouseDown}
      style={style}
      visible={store.autoFill.menuVisible}
    >
      {item && item.type === 'address' && (
        <ContextMenuItem icon={ICON_EDIT} onClick={onEditClick}>
          Edit
        </ContextMenuItem>
      )}
      <ContextMenuItem icon={ICON_TRASH} onClick={onRemoveClick}>
        Remove
      </ContextMenuItem>
    </ContextMenu>
  );
});

const AutofillSwitch = observer(() => {
  const { autofill } = store.settings;
  return (
    <Row onClick={onSwitchChange('autofill')}>
      <Title>密码自动记忆和填充</Title>
      <Control>
        <Switch value={autofill} />
      </Control>
    </Row>
  );
});

export const Autofill = () => {
  return (
    <>
      <Header style={{ paddingBottom: 12 }}>密码和自动填充</Header>
      <AutofillSwitch />
      <Passwords />
      <Addresses />
      <Menu />
    </>
  );
};
