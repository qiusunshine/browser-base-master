import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Dialog, Title, Content, Buttons, CloseButton } from '../../Dialog';
import { Button } from '~/renderer/components/Button';
import store from '../../../store';

const clearData = () => {
  alert("此功能开发中");
}

export default observer(() => {
  return (
    <Dialog visible={store.dialogContent === 'privacy'} style={{ width: 344, marginLeft: "auto" }}>
      <Title>清除浏览数据</Title>
      <Content></Content>
      <Buttons>
        <CloseButton />
        <Button background="transparent" foreground="#3F51B5" onClick={clearData}>
          立即清除
        </Button>
      </Buttons>
    </Dialog>
  );
});
