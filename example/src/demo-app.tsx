import * as React from 'react';
import {FC, SyntheticEvent, useCallback, useMemo} from 'react';

import {useForm, createFormScope} from '../../src/';
import {Input, NumberInput, MappedRadioFactory, MappedSelectFactory} from '../../src/forms';

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

const validateLooks = (value: string, record: typeof INITIAL_FORM_STATE) => {
  if (record.race === 'jellyfish') {
    return value === 'unknown' ? null : 'It should be unknown';
  }
};

type FormState = {
  name: string;
  age: number;
  race: 'squid' | 'octopus' | 'jellyfish';
  looks: null | 'unknown' | 'boy' | 'girl';
};
const INITIAL_FORM_STATE = {
  name: '',
  age: 13,
  race: 'fish',
  looks: null,
};

const {context, scope} = createFormScope<typeof INITIAL_FORM_STATE>();

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
  const {touched, errors} = props;
  return (
    <Form onSubmit={value => console.log(value)}>
      <div style={{margin: '16px auto'}}>
        <Field name="name" component={Input} validations={[required]} />
      </div>
      <div style={{margin: '16px auto'}}>
        <Field name="age" component={NumberInput} validations={[between(5, 20)]} />
      </div>
      <div style={{margin: '16px auto'}}>
        <Field name="race" component={RaceChoice} validations={[choice('jellyfish', 'squid', 'octopus')]} />
      </div>
      <div style={{margin: '16px auto'}}>
        <Field name="looks" component={LooksChoice} validations={[required, validateLooks]} />
      </div>

      <button disabled={Object.values(errors).some(e => !!e.length)}>submit</button>
    </Form>
  );
});

export default function DemoApp() {
  return (
    <section>
      <h2>Mayoiga form demo</h2>
      <DemoForm initialState={INITIAL_FORM_STATE} onSubmit={value => alert(`submit ${JSON.stringify(value)}`)} />
    </section>
  );
}
