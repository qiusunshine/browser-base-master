import * as React from 'react';
import { observer } from 'mobx-react-lite';

import { Button } from '~/renderer/components/Button';
import store from '../../../store';
import { Textfield } from '~/renderer/components/Textfield';
import { Dropdown } from '~/renderer/components/Dropdown';
import { Row } from '../../App/style';
import { Dialog, Title, Content, Buttons, CloseButton } from '../../Dialog';

export default observer(() => {
  return (
    <Dialog
      visible={store.dialogContent === 'edit-address'}
      style={{ width: 344 }}
    >
      <Title>Edit address</Title>
      <Content>
        <Textfield label="名称" />
        <Textfield label="街道地址" />
        <Row>
          <Textfield label="邮政编码" style={{ marginRight: 24 }} />
          <Textfield label="城市 " />
        </Row>
        <Dropdown>
          <Dropdown.Item value="pl">Poland</Dropdown.Item>
        </Dropdown>
      </Content>
      <Buttons>
        <CloseButton />
        <Button>保存</Button>
      </Buttons>
    </Dialog>
  );
});
