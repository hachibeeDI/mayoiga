import * as React from 'react';
import {FC, SyntheticEvent, useCallback, useMemo} from 'react';

import {useForm, useFormState, createFormScope} from '../../src/';
import {InputProtocol} from '../../src/inputProtocol';
import {Input, NumberInput, MappedRadioFactory, MappedSelectFactory} from '../../src/forms';

type FormState = {
  freeSpace: string;
  name: string;
  height: number;
  age: number;
  race: 'squid' | 'octopus' | 'jellyfish';
  looks: null | 'unknown' | 'boy' | 'girl';
};

const required = (target: string | null) => (!target ? 'required' : undefined);

const between = (min: number, max: number) => (target: number) => {
  if (target < min) {
    return `more than ${min}`;
  }
  if (target > max) {
    return `less than ${max}`;
  }
};

const choice = function<T>(...candidates: Array<T>) {
  return (target: T) => (candidates.includes(target) ? undefined : 'You should choose from the candidates.');
};

const validateLooks = (value: any, record: FormState) => {
  if (record.race === 'jellyfish') {
    return value === 'unknown' ? undefined : 'It should be unknown';
  }
};

const INITIAL_FORM_STATE: FormState = {
  freeSpace: '',
  name: '',
  height: 130,
  age: 13,
  race: 'jellyfish',
  looks: null,
};

const {context, scope} = createFormScope<FormState>();

// NOTE: After TypeScript 3.4, you can `componen={useMemo(MappedRadioFactory([...]))}` but so far type inference is not working correctly.
const RaceChoice = MappedRadioFactory([
  {label: 'Squid', value: 'squid'},
  {label: 'Octopus', value: 'octopus'},
  {label: 'Jellyfish', value: 'jellyfish'},
]);
const LooksChoice = MappedSelectFactory([
  {label: 'Unknown', value: 'unknown'},
  {label: 'Boy', value: 'boy'},
  {label: 'Girl', value: 'girl'},
]);

const DemoForm = scope(props => {
  const {Form, Field} = useForm(context);
  // const {touched, errors} = props;
  const [store] = useFormState(context);
  return (
    <Form onSubmit={value => console.log(value)}>
      <div style={{margin: '16px auto'}}>
        <Field name="name" component={props => <Input<FormState, 'name'> {...props} />} validations={[required]} />
      </div>
      <div style={{margin: '16px auto'}}>
        <Field
          name="height"
          component={props => (
            <div>
              <input value={props.value.toString()} onChange={e => props.onChange(props.name, parseInt(e.target.value, 10) || 0)} />
              <div style={{color: 'red'}}>{props.errors[0]}</div>
            </div>
          )}
          validations={[between(30, 250)]}
        />
      </div>
      <div style={{margin: '16px auto'}}>
        <Field name="age" component={props => <NumberInput<FormState, 'age'> {...props} />} validations={[between(5, 20)]} />
      </div>
      <div style={{margin: '16px auto'}}>
        <Field
          name="race"
          component={props => <RaceChoice<FormState, 'race'> {...props} />}
          validations={[choice('jellyfish', 'squid', 'octopus')]}
        />
      </div>
      <div style={{margin: '16px auto'}}>
        <Field name="looks" component={props => <LooksChoice<FormState, 'looks'> {...props} />} validations={[required, validateLooks]} />
      </div>
      <div style={{margin: '16px auto'}}>
        <Field
          name="freeSpace"
          component={props => <textarea value={props.value} onChange={e => props.onChange(props.name, e.target.value)} />}
          validations={[required]}
        />
      </div>

      <button disabled={Object.values(store.errors).some(e => !!e.length)}>submit</button>
    </Form>
  );
});

export default function DemoApp() {
  return (
    <section>
      <h2>Mayoiga form demo</h2>
      <DemoForm
        initialState={INITIAL_FORM_STATE}
        onSubmit={(hasError, value, {errors}) => {
          if (hasError) {
            return alert(`errors! ${JSON.stringify(errors)}`);
          }
          alert(`submit ${JSON.stringify(value)}`);
        }}
      />
    </section>
  );
}
