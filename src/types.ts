import {EventEmitter} from 'events';

import React, {Component, ComponentClass, StatelessComponent} from 'react';

import FormActions from './FormActions';

export type StateTypeRestriction = {
  [key: string]: string | number | boolean | Array<any> | null | undefined;
};

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

export interface FormProvidedProps<StateType> {
  formErrors: {[P in keyof StateType]: Array<string>};
  formState: StateType;
  formActions: FormActions<StateType, any>;
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
  onSubmit(state: StateType, formActions: FormActions<StateType, any>): void | Promise<undefined>;
  onChanged?(formActions: FormActions<StateType, any>): void;
  children: React.ReactNode;
}

interface FieldPropsBase<StateType extends StateTypeRestriction> {
  name: keyof StateType;
  type?: string;
  dataType?: string;
  placeholder?: string;
  // NOTE: basically the field is not require the prop "value" but some of those like i.e. radio/checkbox use that in different context
  value?: string;
  onChange?: (e: React.SyntheticEvent, formActions: FormActions<StateType, any>) => void;
  validators?: ReadonlyArray<(v: any) => undefined | null | string>;
  children?: React.ReactNode;
}

type BuildInFieldProps<StateType extends StateTypeRestriction> = FieldPropsBase<StateType> & {
  component: string;
} & React.InputHTMLAttributes<any>;

type CustomFieldProps<StateType extends StateTypeRestriction, Props> = FieldPropsBase<StateType> & {
  component: ComponentClass<Props, any> | StatelessComponent<Props>;
} & {[P in keyof Props]: Props[P]};

export type FieldProps<StateType extends StateTypeRestriction, ComponentProps> =
  | BuildInFieldProps<StateType>
  | CustomFieldProps<StateType, ComponentProps>;
