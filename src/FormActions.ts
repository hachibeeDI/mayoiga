import React, {PureComponent} from 'react';
import immutable from 'object-path-immutable';
import objectPath from 'object-path';

import {ProviderComponent, ProviderProps, ProviderState} from './types';
import {extractEventValue} from './utils/eventHandling';

export default class FormActions<StateType = {}, OwnProps = {}> {
  private provider: PureComponent<ProviderProps<StateType> & OwnProps, ProviderState<StateType>>;
  private initialState: StateType;

  constructor(provider: ProviderComponent<StateType, OwnProps>, initialState: StateType) {
    this.provider = provider;
    this.initialState = initialState;
  }

  clear = () => {
    this.provider.setState({pristine: true, store: this.initialState});
  };

  updateState = (name: string, updater: (formerValue: any) => any): Promise<undefined> => {
    return new Promise(done => {
      this.provider.setState(
        {
          pristine: false,
          // TODO: I guess an definition of the .d.ts is wrong
          store: immutable.update(this.provider.state.store, name, updater) as any,
        },
        done
      );
    });
  };

  setState = (name: string, value: any): Promise<undefined> => {
    return new Promise(done => {
      this.provider.setState(
        {
          pristine: false,
          store: immutable.set(this.provider.state.store, name, value),
        },
        done
      );
    });
  };

  change = (e: React.FormEvent): Promise<undefined> => {
    const {name, value, type, target} = extractEventValue(e)!;
    if (type === 'check-list') {
      const previousState: Array<any> = objectPath.get(this.provider.state.store, name);
      let newV;
      if (previousState.includes(target.value)) {
        newV = previousState.filter(p => p !== target.value);
      } else {
        newV = [...previousState, target.value];
      }
      return this.setState(name, newV);
    }

    return this.setState(name, value);
  };

  validate = (name: string, validators: ReadonlyArray<(v: any, store: StateType) => undefined | null | string>) => {
    const {store} = this.provider.state;
    const targetValue = objectPath.get(store, name);
    this.provider.setState({
      errors: {
        ...(this.provider.state.errors as any),
        [name]: validators.map(v => v(targetValue, store)).filter(r => r),
      },
    });
  };

  getState = (): StateType => {
    return this.provider.state.store;
  };

  isPristine = () => {
    return this.provider.state.pristine;
  };

  isValid = () => {
    return (
      Object.values(this.provider.state.errors)
        // FIXME: TypeScript may failed to parse type declaration?
        //  or `errors: {[P in keyof StateType]: Array<string>};` is not valid?
        .map(err => (err as Array<string>).length)
        .reduce((sum, x) => sum + x, 0) === 0
    );
  };
}
