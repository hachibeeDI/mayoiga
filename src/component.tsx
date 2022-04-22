import React from 'react';

import type {SliceProps, FieldProps, StateRestriction, Controller} from './index';

type ControlledComponentProps<State, Props> = Props & {
  controller: Controller<State>;
};

export function Slicer<State extends StateRestriction, R extends ReadonlyArray<unknown>>(
  props: ControlledComponentProps<State, SliceProps<State, R>>,
) {
  const {controller, ...restProps} = props;
  const {Slicer: Delegate} = controller.components;
  return <Delegate {...restProps} />;
}

export function Field<State extends StateRestriction, Name extends keyof State>(
  props: ControlledComponentProps<State, FieldProps<State, Name>>,
) {
  const {controller, ...restProps} = props;
  const {Field: Delegate} = controller.components;
  return <Delegate {...restProps} />;
}
