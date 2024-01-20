import styled, { css } from 'styled-components';
import { ITheme } from '~/interfaces';
import { BLUE_300 } from '~/renderer/constants';

export const StyledAddressBar = styled.div`
  height: 30px;
  flex: 1;
  border-radius: 8px;
  margin: 0 7px;
  display: flex;
  align-items: center;
  position: relative;

  font-size: 15px;
  overflow: hidden;

  ${({ theme, focus }: { theme: ITheme; focus: boolean }) => css`
    background-color: ${theme['addressbar.backgroundColor']};
    border: 1px solid rgba(0, 0, 0, 0.32);
    color: ${theme['addressbar.textColor']};
  `};
`;

export const InputContainer = styled.div`
  flex: 1;
  position: relative;
  height: 100%;
  margin-left: 2px;
  overflow: hidden;
`;

export const Text = styled.div`
  pointer-events: none;
  position: absolute;
  top: 50%;
  transform: translateY(calc(-50%));
  flex: 1;
  color: inherit;
  margin-top: -1px;
  flex-wrap: nowrap;
  white-space: nowrap;
  overflow: hidden;
  font-size: 14px;
  ${({ visible }: { visible: boolean; theme: ITheme }) => css`
    display: ${visible ? 'flex' : 'none'};
  `};
`;

export const Input = styled.input`
  outline: none;
  min-width: 0;
  width: 100%;
  height: 100%;
  background-color: transparent;
  border: none;
  padding: 0;
  margin: 0;
  color: black;
  font-family: inherit;
  word-spacing: inherit;
  font-size: 14px;

  ${({ visible, theme }: { visible: boolean; theme: ITheme }) => css`
    color: ${visible ? 'inherit' : 'transparent'};

    &::placeholder {
      color: ${theme['searchBox.lightForeground']
        ? 'rgba(255, 255, 255, 0.54)'
        : 'rgba(0, 0, 0, 0.54)'};
    }

    ${theme['searchBox.lightForeground'] &&
    css`
      ::selection {
        background: rgba(145, 185, 230, 0.99);
        color: black;
        height: 100px;
      }
    `}
  `};
`;
