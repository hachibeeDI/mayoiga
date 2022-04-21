import React from 'react';

import type {SliceProps, FieldProps, StateRestriction, Controller, } from './index';

type ControlledComponentProps<State, Props> = Props & {
  controller: Controller<State>;
}

export function Slicer<State extends StateRestriction, R extends ReadonlyArray<unknown>>(props: ControlledComponentProps<State, SliceProps<State, R>>) {
  const {controller, selector, children} = props;
  const {Slicer: Delegate} = controller.components;
  return <Delegate selector={selector} children={children} />;
}

export function Field<State extends StateRestriction, Name extends keyof State>(props: ControlledComponentProps<State, FieldProps<State, Name>>) {
  const {controller, name, children} = props;
  const {Field: Delegate} = controller.components;
  return <Delegate name={name} children={children} />;
}
