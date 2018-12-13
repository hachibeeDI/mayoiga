import {EventEmitter} from 'events';

import React, {ComponentType, ComponentClass, Component, PureComponent, createContext} from 'react';
import objectPath from 'object-path';

import {StateTypeRestriction, FormProvidedProps, ProviderValues, ProviderProps, ProviderState, FormProps, FieldProps} from './types';
import {toTargetProp} from './utils/eventHandling';
import FormActions from './FormActions';

const ReactFormContext = createContext<ProviderValues<any>>({} as any);

function getDisplayName(WrappedComponent: any): string {
  return WrappedComponent.displayName || WrappedComponent.name || 'Component';
}

// TODO: asynchronous validation should be here?
export function connectForm<OwnProps, StateType extends StateTypeRestriction>(initialState?: StateType) {
  return (
    WrappedComponent: ComponentType<OwnProps & FormProvidedProps<StateType>>
  ): ComponentClass<ProviderProps<StateType> & OwnProps, ProviderState<StateType>> => {
    const channel = new EventEmitter();

    class FormProvider extends PureComponent<ProviderProps<StateType> & OwnProps, ProviderState<StateType>> {
      formActions: FormActions<StateType, OwnProps>;
      static displayName: string;

      constructor(props: ProviderProps<StateType> & OwnProps) {
        super(props);

        const fixedInitialState: StateType = {...(props.initialState || initialState || ({} as any))};
        this.state = {
          pristine: true,
          store: fixedInitialState,
          errors: Object.keys(fixedInitialState).reduce((buf: any, x: string) => {
            buf[x] = [];
            return buf;
          }, {}),
        };

        this.formActions = new FormActions(this, fixedInitialState);
      }

      componentWillUnmount() {
        channel.removeAllListeners('changed');
      }

      render() {
        return (
          <ReactFormContext.Provider
            value={{
              pristine: this.state.pristine,
              state: this.state.store,
              errors: this.state.errors,
              formActions: this.formActions,
              channel,
            }}
          >
            <WrappedComponent formErrors={this.state.errors} formState={this.state.store} formActions={this.formActions} {...this.props} />
          </ReactFormContext.Provider>
        );
      }
    }

    FormProvider.displayName = `ConnectForm(${getDisplayName(WrappedComponent)})`;
    return FormProvider;
  };
}

interface InvertPeeperProps {
  channel: EventEmitter;
  onChanged(formActions: FormActions<any, any>): void;
}

class InvertPeeper extends PureComponent<InvertPeeperProps> {
  constructor(props: InvertPeeperProps) {
    super(props);
    props.channel.on('changed', this.peepChanged);
  }

  private peepChanged = (formActions: FormActions<any, any>) => {
    this.props.onChanged(formActions);
  };

  public componentWillUnmount() {
    this.props.channel.removeListener('changed', this.peepChanged);
  }

  public render() {
    return this.props.children;
  }
}

// TODO: consider to be under connectForm context instead of dirty peeper hack
export function Form<StateType = any>({onSubmit, onChanged, children, ...restProps}: FormProps<StateType>) {
  return (
    <ReactFormContext.Consumer>
      {({channel, formActions}: ProviderValues<any>): React.ReactNode => {
        const innerForm = (
          <form
            onSubmit={e => {
              e.preventDefault();
              const state = formActions.getState();
              onSubmit(state, formActions);
            }}
            {...restProps}
          >
            {children}
          </form>
        );

        // TODO: do we really need this hook? Form have had a event handler for onChange.
        if (onChanged) {
          return (
            <InvertPeeper channel={channel} onChanged={onChanged}>
              {innerForm}
            </InvertPeeper>
          );
        } else {
          return innerForm;
        }
      }}
    </ReactFormContext.Consumer>
  );
}

// TODO: implement shouldComponentUpdate if performance would be a problem
export function Field<StateType extends StateTypeRestriction = any, ComponentProps = any>({
  name,
  type,
  dataType,
  placeholder,
  component = 'input',
  // NOTE: basically the field is not require the prop "value" but some of those like i.e. radio/checkbox use that in different context
  value: domValue,
  onChange,
  // NOTE: to synchronous validation
  validators = [],
  children,
  ...restProps
}: FieldProps<StateType, ComponentProps>) {
  return (
    <ReactFormContext.Consumer>
      {({pristine, state, errors, formActions, channel}: ProviderValues<any>): React.ReactNode => {
        // keyof StateTypeRestriction should be string but TypeScript doesn't thought :thinking_face:
        const stateValue = objectPath.get(state, name as string);
        return React.createElement(
          component,
          {
            name,
            type,
            'data-type': dataType,
            placeholder,
            onChange(e: React.SyntheticEvent) {
              // NOTE: if just changed twice, latter will cause a race condition.
              const changed = formActions.change(e).then(() => channel.emit('changed', formActions));
              if (onChange) {
                e.persist();
                changed.then(() => onChange(e, formActions));
              }
            },
            onBlur() {
              // TODO: warnings
              if (!pristine) {
                formActions.validate(name as string, validators);
              }
            },
            errors: errors && errors[name]!,
            ...toTargetProp(stateValue, type, dataType, domValue),
            ...restProps,
          } as any,
          children
        );
      }}
    </ReactFormContext.Consumer>
  );
}
