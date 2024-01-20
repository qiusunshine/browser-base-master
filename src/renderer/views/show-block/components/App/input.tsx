import {useRef, ChangeEvent, FocusEvent, forwardRef, Ref} from 'react';
import * as React from 'react';
import {Input} from "./style";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
}

export const MyInput = forwardRef((props: InputProps, ref: Ref<HTMLInputElement>) => {
  const el = useRef<HTMLInputElement>(null);
  const {onChange, onFocus, onBlur, value, defaultValue, ...attrs} = props;
  const _value = 'value' in props ? value : 'defaultValue' in props ? defaultValue : null;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (onChange) {
      onChange(e);
    }
  };

  const forceSetValue = () => {
    if ('value' in props && el.current) {
      const input = el.current;
      input.value = value as string;
      input.setAttribute('value', value as string);
    }
  };

  let inputing = false;

  return (
    <Input
      {...attrs}
      defaultValue={_value}
      ref={(input) => {
        el.current = input;
        if (ref) {
          if (typeof ref === 'function') {
            ref(input);
          } else {
            ref.current = input;
          }
        }
        if (!input) {
          return;
        }
        forceSetValue();
      }}
      onFocus={(e) => {
        setTimeout(forceSetValue, 10);
        onFocus && onFocus(e);
      }}
      onBlur={(e) => {
        setTimeout(forceSetValue, 150);
        onBlur && onBlur(e);
      }}
      onCompositionStart={() => {
        inputing = true;
      }}
      onCompositionEnd={(e) => {
        inputing = false;
        handleChange(e);
      }}
      onChange={(e) => {
        if (!inputing) {
          handleChange(e);
        }
      }}
    />
  );
});

export default MyInput;