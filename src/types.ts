import {EventEmitter} from 'events';

import React, {Component, ComponentClass, StatelessComponent} from 'react';

import FormActions from './FormActions';

export interface ProviderProps<StateType> {
  initialState?: StateType;
}

export interface ProviderState<StateType> {
  pristine: boolean;
  store: StateType;
  errors: {[P in keyof StateType]: Array<string>};
}

export interface ProviderComponent<StateType, OwnProps> extends Component<ProviderProps<StateType> & OwnProps, ProviderState<StateType>> {
  formActions: FormActions<StateType, OwnProps>;
}


/**
 * Type for the value between contexts.
 */
export interface ProviderValues<StateType> {
  pristine: boolean;
  formActions: FormActions<StateType, any>;
  channel: EventEmitter;
  state: StateType;
  errors: {[P in keyof StateType]: Array<string>};
}

export interface FormProps<StateType> {
  onSubmit(state: StateType): void | Promise<undefined>;
  onChanged(formActions: FormActions<any, any>): void;
  children: React.ReactNode;
}

export interface FieldProps<StateType> {
  name: string;
  type?: string;
  dataType?: string;
  placeholder?: string;
  component: string | ComponentClass<any, any> | StatelessComponent<any>;
  // NOTE: basically the field is not require the prop "value" but some of those like i.e. radio/checkbox use that in different context
  value: string;
  onChange?: (e: React.FormEvent, formActions: FormActions<StateType, any>) => void;
  validators: ReadonlyArray<(v: any) =>  undefined | null | string>;
  children: React.ReactNode;
  // ...restProps: any;
}
