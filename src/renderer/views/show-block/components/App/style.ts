import styled, { css } from 'styled-components';

import { robotoRegular } from '~/renderer/mixins';
import { ITheme } from '~/interfaces';
import { DialogStyle } from '~/renderer/mixins/dialogs';

export const StyledApp = styled(DialogStyle)`
  padding: 16px;

  & .textfield,
  .dropdown {
    width: 255px;
    margin-left: auto;
  }
  & .ellipsis-line {
    border: 1px solid #999999;
    padding: 4px;
    width: 400px;
    overflow: hidden;
    text-overflow: ellipsis; //文本溢出显示省略号
    white-space: nowrap; //文本不会换行
  }

  ${({ theme }: { theme?: ITheme; visible: boolean }) => css`
    color: ${theme['dialog.lightForeground'] ? '#fff' : '#000'};
  `}
`;

export const Subtitle = styled.div`
  font-size: 13px;
  opacity: 0.54;
  margin-top: 8px;
`;

export const Title = styled.div`
  font-size: 16px;
  margin-bottom: 16px;
  ${robotoRegular()};
`;

export const Row = styled.div`
  width: 100%;
  height: 48px;
  align-items: center;
  display: flex;
`;
export const SmallRow = styled.div`
  width: 100%;
  margin-bottom: 5px;
  align-items: center;
  display: flex;
`;
export const SmallRow2 = styled.div`
  width: 100%;
  margin-bottom: 10px;
  align-items: center;
  padding: 4px 4px;
  display: flex;
`;

export const Label = styled.div`
  font-size: 12px;
`;

export const Buttons = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 16px;
  & .button:not(:last-child) {
    margin-right: 8px;
  }
`;
export const Input = styled.textarea`
  min-width: 0;
  width: 100%;
  height: 100%;
  background-color: transparent;
  border: 1px solid #aaa;
  padding: 4px;
  margin: 0;
  color: black;
  font-family: inherit;
  word-spacing: inherit;
  font-size: 14px;
`;